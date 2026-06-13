<?php

namespace App\Http\Controllers;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\ShopItem;
use App\Models\ShopItemVariant;
use App\Services\StripeService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Stripe\Exception\SignatureVerificationException;
use Stripe\Webhook;

class CheckoutController extends Controller
{
    public function __construct(private StripeService $stripe) {}

    public function checkout(Request $request): \Illuminate\Http\JsonResponse
    {
        $validated = $request->validate([
            'currency'                         => 'required|string|size:3',
            'items'                            => 'required|array|min:1',
            'items.*.shop_item_id'             => 'required|integer|exists:shop_items,id',
            'items.*.shop_item_variant_id'     => 'nullable|integer|exists:shop_item_variants,id',
            'items.*.quantity'                 => 'required|integer|min:1|max:100',
            'customer.name'                    => 'required|string|max:255',
            'customer.email'                   => 'required|email|max:255',
            'customer.shipping_address.line1'  => 'required|string|max:255',
            'customer.shipping_address.line2'  => 'nullable|string|max:255',
            'customer.shipping_address.city'   => 'required|string|max:255',
            'customer.shipping_address.postal_code' => 'required|string|max:20',
            'customer.shipping_address.country'     => 'required|string|size:2',
        ]);

        $currency = strtoupper($validated['currency']);
        $customer = $validated['customer'];

        [$order, $lineItems] = DB::transaction(function () use ($validated, $currency, $customer) {
            $itemIds   = array_column($validated['items'], 'shop_item_id');
            $shopItems = ShopItem::with(['prices', 'variants'])
                ->lockForUpdate()
                ->whereIn('id', $itemIds)
                ->get()
                ->keyBy('id');

            $total     = 0;
            $orderItemsData = [];
            $lineItems      = [];

            foreach ($validated['items'] as $lineInput) {
                $shopItem = $shopItems->get($lineInput['shop_item_id']);
                abort_if(! $shopItem || ! $shopItem->is_available, 422, 'Item not available.');

                $variantId    = $lineInput['shop_item_variant_id'] ?? null;
                $qty          = $lineInput['quantity'];
                $variantLabel = null;

                if ($variantId !== null) {
                    $variant = ShopItemVariant::lockForUpdate()->find($variantId);
                    abort_unless($variant && $variant->shop_item_id === $shopItem->id, 422, 'Invalid variant.');

                    if ($variant->stock_quantity !== null && $variant->stock_quantity < $qty) {
                        abort(422, "Insufficient stock for variant {$variant->name}: {$variant->value}.");
                    }
                    $variantLabel = "{$variant->name}: {$variant->value}";
                } else {
                    if ($shopItem->stock_quantity !== null && $shopItem->stock_quantity < $qty) {
                        abort(422, "Insufficient stock for {$shopItem->name}.");
                    }
                }

                $price = $shopItem->prices->firstWhere('currency', $currency);
                abort_unless($price, 422, "Item {$shopItem->name} has no price in {$currency}.");

                $total += $price->amount * $qty;

                $orderItemsData[] = [
                    'shop_item_id'         => $shopItem->id,
                    'shop_item_variant_id' => $variantId,
                    'name'                 => $shopItem->name,
                    'variant_label'        => $variantLabel,
                    'price'                => $price->amount,
                    'currency'             => $currency,
                    'quantity'             => $qty,
                ];

                $lineItems[] = [
                    'price_data' => [
                        'currency'     => strtolower($currency),
                        'unit_amount'  => (int) round($price->amount * 100),
                        'product_data' => [
                            'name' => $variantLabel
                                ? "{$shopItem->name} ({$variantLabel})"
                                : $shopItem->name,
                        ],
                    ],
                    'quantity' => $qty,
                ];
            }

            $order = Order::create([
                'email'            => $customer['email'],
                'name'             => $customer['name'],
                'status'           => OrderStatus::Pending,
                'currency'         => $currency,
                'total'            => $total,
                'shipping_address' => $customer['shipping_address'],
            ]);

            $order->items()->createMany($orderItemsData);

            return [$order, $lineItems];
        });

        $frontendUrl = rtrim(config('services.stripe.frontend_url'), '/');

        try {
            $session = $this->stripe->createCheckoutSession([
                'mode'                 => 'payment',
                'payment_method_types' => ['card'],
                'customer_email'       => $customer['email'],
                'line_items'           => $lineItems,
                'metadata'             => ['order_uuid' => $order->uuid],
                'success_url'          => "{$frontendUrl}/merch/success?session_id={CHECKOUT_SESSION_ID}&order_uuid={$order->uuid}",
                'cancel_url'           => "{$frontendUrl}/merch/cancel",
            ]);
        } catch (\Exception $e) {
            $order->update(['status' => \App\Enums\OrderStatus::Cancelled]);
            return response()->json(['message' => 'Payment provider unavailable. Please try again.'], 503);
        }

        $order->update(['stripe_session_id' => $session->id]);

        return response()->json([
            'checkout_url' => $session->url,
            'order_uuid'   => $order->uuid,
        ]);
    }

    public function webhook(Request $request): \Illuminate\Http\JsonResponse
    {
        $payload   = $request->getContent();
        $sigHeader = $request->header('Stripe-Signature', '');

        try {
            $event = Webhook::constructEvent(
                $payload,
                $sigHeader,
                config('services.stripe.webhook_secret')
            );
        } catch (SignatureVerificationException $e) {
            return response()->json(['error' => 'Invalid signature'], 400);
        } catch (\UnexpectedValueException $e) {
            return response()->json(['error' => 'Invalid payload'], 400);
        }

        if ($event->type === 'checkout.session.completed') {
            $stripeSession = $event->data->object;
            $orderUuid     = $stripeSession->metadata->order_uuid ?? null;

            if (! $orderUuid) {
                return response()->json(['received' => true]);
            }

            DB::transaction(function () use ($stripeSession, $orderUuid) {
                $order = Order::where('uuid', $orderUuid)
                    ->lockForUpdate()
                    ->with('items.shopItem', 'items.shopItemVariant')
                    ->first();

                if (! $order || $order->status !== OrderStatus::Pending) {
                    return;
                }

                $order->update([
                    'status'                    => OrderStatus::Paid,
                    'stripe_payment_intent_id'  => $stripeSession->payment_intent,
                ]);

                foreach ($order->items as $item) {
                    if ($item->shopItemVariant && $item->shopItemVariant->stock_quantity !== null) {
                        ShopItemVariant::lockForUpdate()->find($item->shop_item_variant_id)
                            ?->decrement('stock_quantity', $item->quantity);
                    } elseif ($item->shopItem && $item->shopItem->stock_quantity !== null) {
                        ShopItem::lockForUpdate()->find($item->shop_item_id)
                            ?->decrement('stock_quantity', $item->quantity);
                    }
                }
            });
        }

        return response()->json(['received' => true]);
    }
}
