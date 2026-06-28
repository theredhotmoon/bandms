<?php

namespace App\Http\Controllers;

use App\Enums\OrderStatus;
use App\Models\ConcertTicketPriceTier;
use App\Models\ConcertTicketType;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PromoCode;
use App\Models\ShopItem;
use App\Models\ShopItemVariant;
use App\Services\StripeService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Stripe\Exception\SignatureVerificationException;
use Stripe\Webhook;

class CheckoutController extends Controller
{
    public function __construct(private StripeService $stripe) {}

    public function checkout(Request $request): \Illuminate\Http\JsonResponse
    {
        $validated = $request->validate([
            'currency'                              => 'required|string|size:3',
            'items'                                 => 'required|array|min:1',
            'items.*.shop_item_id'                  => 'nullable|integer|exists:shop_items,id',
            'items.*.shop_item_variant_id'          => 'nullable|integer|exists:shop_item_variants,id',
            'items.*.ticket_type_id'                => 'nullable|integer|exists:concert_ticket_types,id',
            'items.*.ticket_price_tier_id'          => 'nullable|integer|exists:concert_ticket_price_tiers,id',
            'items.*.quantity'                      => 'required|integer|min:1|max:100',
            'customer.name'                         => 'required|string|max:255',
            'customer.email'                        => 'required|email|max:255',
            'customer.shipping_address.line1'       => 'nullable|string|max:255',
            'customer.shipping_address.line2'       => 'nullable|string|max:255',
            'customer.shipping_address.city'        => 'nullable|string|max:255',
            'customer.shipping_address.postal_code' => 'nullable|string|max:20',
            'customer.shipping_address.country'     => 'nullable|string|size:2',
            'promo_code'                            => 'nullable|string|max:32',
        ]);

        $currency  = strtoupper($validated['currency']);
        $customer  = $validated['customer'];
        $items     = $validated['items'];

        // Determine whether cart has any shop items (require shipping only for those)
        $hasShopItems = collect($items)->contains(fn ($i) => !empty($i['shop_item_id']));

        if ($hasShopItems) {
            $addr = $customer['shipping_address'] ?? [];
            if (empty($addr['line1']) || empty($addr['city']) || empty($addr['postal_code']) || empty($addr['country'])) {
                return response()->json([
                    'message' => 'Shipping address is required for physical items.',
                    'errors'  => ['customer.shipping_address.line1' => ['Required for shop items.']],
                ], 422);
            }
        }

        // Validate promo code
        $promo = null;
        if (! empty($validated['promo_code'])) {
            $cartTicketTypeId = collect($items)
                ->filter(fn ($i) => !empty($i['ticket_type_id']))
                ->pluck('ticket_type_id')
                ->first();
            $promo = PromoCode::where('code', strtoupper($validated['promo_code']))->first();
            if (! $promo || ! $promo->isValid($cartTicketTypeId)) {
                return response()->json(['message' => 'Invalid or expired promo code.', 'errors' => ['promo_code' => ['Invalid or expired promo code.']]], 422);
            }
        }

        [$order, $lineItems] = DB::transaction(function () use ($validated, $currency, $customer, $items, $promo, $hasShopItems) {

            // Pre-load shop items and ticket types in bulk
            $shopItemIds   = array_filter(array_column($items, 'shop_item_id'));
            $ticketTypeIds = array_filter(array_column($items, 'ticket_type_id'));

            $shopItems  = $shopItemIds
                ? ShopItem::with(['prices', 'variants'])->lockForUpdate()->whereIn('id', $shopItemIds)->get()->keyBy('id')
                : collect();

            $ticketTypes = $ticketTypeIds
                ? ConcertTicketType::with(['tiers', 'concert.venue', 'concert.ticketTypes'])->lockForUpdate()->whereIn('id', $ticketTypeIds)->get()->keyBy('id')
                : collect();

            $total          = 0;
            $orderItemsData = [];
            $lineItemsArr   = [];

            // Track quantities per ticket type for max_per_order validation
            $ticketQtyByType = [];

            foreach ($items as $lineInput) {
                $qty = (int) $lineInput['quantity'];

                if (! empty($lineInput['shop_item_id'])) {
                    // ── Shop item ──────────────────────────────────────────────────
                    $shopItem = $shopItems->get($lineInput['shop_item_id']);
                    abort_if(! $shopItem || ! $shopItem->is_available, 422, 'Item not available.');

                    $variantId    = $lineInput['shop_item_variant_id'] ?? null;
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

                    $lineItemsArr[] = [
                        'price_data' => [
                            'currency'     => strtolower($currency),
                            'unit_amount'  => (int) round($price->amount * 100),
                            'product_data' => [
                                'name' => $variantLabel ? "{$shopItem->name} ({$variantLabel})" : $shopItem->name,
                            ],
                        ],
                        'quantity' => $qty,
                    ];

                } elseif (! empty($lineInput['ticket_type_id'])) {
                    // ── Ticket item ────────────────────────────────────────────────
                    $ticketType = $ticketTypes->get($lineInput['ticket_type_id']);
                    abort_unless($ticketType, 422, 'Ticket type not found.');

                    // Check sale window
                    if ($ticketType->available_from && $ticketType->available_from->isFuture()) {
                        abort(422, "Tickets for '{$ticketType->name}' are not on sale yet.");
                    }
                    if ($ticketType->on_sale_until && $ticketType->on_sale_until->isPast()) {
                        abort(422, "Tickets for '{$ticketType->name}' are no longer on sale.");
                    }

                    // Check max_per_order
                    if ($ticketType->max_per_order !== null) {
                        $ticketQtyByType[$ticketType->id] = ($ticketQtyByType[$ticketType->id] ?? 0) + $qty;
                        if ($ticketQtyByType[$ticketType->id] > $ticketType->max_per_order) {
                            abort(422, "Maximum {$ticketType->max_per_order} tickets per order for '{$ticketType->name}'.");
                        }
                    }

                    // Resolve active tier
                    $tierId = $lineInput['ticket_price_tier_id'] ?? null;
                    $tier   = $tierId ? $ticketType->tiers->firstWhere('id', $tierId) : $ticketType->activeTier();

                    abort_unless($tier, 422, "No ticket tier available for '{$ticketType->name}'.");

                    // Check tier availability_count
                    if ($tier->available_count !== null) {
                        $sold = OrderItem::where('concert_ticket_price_tier_id', $tier->id)
                            ->whereHas('order', fn ($q) => $q->whereIn('status', ['paid', 'pending']))
                            ->lockForUpdate()
                            ->sum('quantity');
                        if (($sold + $qty) > $tier->available_count) {
                            $remaining = max(0, $tier->available_count - $sold);
                            abort(422, "Only {$remaining} tickets remaining in tier '{$tier->name}'.");
                        }
                    }

                    // Venue capacity check
                    $venue = $ticketType->concert?->venue;
                    if ($venue?->capacity) {
                        $totalSold = OrderItem::whereIn('concert_ticket_type_id', $ticketType->concert->ticketTypes->pluck('id'))
                            ->whereHas('order', fn ($q) => $q->whereIn('status', ['paid', 'pending']))
                            ->lockForUpdate()
                            ->sum('quantity');
                        if (($totalSold + $qty) > $venue->capacity) {
                            abort(422, "This event has reached its venue capacity of {$venue->capacity}.");
                        }
                    }

                    $total += (float) $tier->price * $qty;

                    // Each ticket is a separate order item (qty=1 per item for independent scanning)
                    for ($i = 0; $i < $qty; $i++) {
                        $orderItemsData[] = [
                            'concert_ticket_type_id'      => $ticketType->id,
                            'concert_ticket_price_tier_id'=> $tier->id,
                            'name'                        => $ticketType->name,
                            'variant_label'               => $tier->name,
                            'price'                       => $tier->price,
                            'currency'                    => strtoupper($tier->currency),
                            'quantity'                    => 1,
                        ];
                    }

                    $lineItemsArr[] = [
                        'price_data' => [
                            'currency'     => strtolower($tier->currency),
                            'unit_amount'  => (int) round((float) $tier->price * 100),
                            'product_data' => [
                                'name' => "{$ticketType->name} ({$tier->name})",
                            ],
                        ],
                        'quantity' => $qty,
                    ];
                } else {
                    abort(422, 'Each item must have either shop_item_id or ticket_type_id.');
                }
            }

            // Apply promo code discount
            $discountAmount = 0;
            $promoId        = null;
            if ($promo) {
                $discounted     = $promo->applyTo($total);
                $discountAmount = round($total - $discounted, 2);
                $total          = $discounted;
                $promoId        = $promo->id;

                // Append a discount line item for Stripe
                if ($discountAmount > 0) {
                    $lineItemsArr[] = [
                        'price_data' => [
                            'currency'     => strtolower($currency),
                            'unit_amount'  => -(int) round($discountAmount * 100),
                            'product_data' => ['name' => "Promo: {$promo->code}"],
                        ],
                        'quantity' => 1,
                    ];
                }
            }

            $shippingAddress = $hasShopItems ? ($customer['shipping_address'] ?? null) : null;

            $order = Order::create([
                'email'           => $customer['email'],
                'name'            => $customer['name'],
                'status'          => OrderStatus::Pending,
                'currency'        => $currency,
                'total'           => $total,
                'shipping_address'=> $shippingAddress,
                'promo_code_id'   => $promoId,
                'discount_amount' => $discountAmount ?: null,
            ]);

            $order->items()->createMany($orderItemsData);

            return [$order, $lineItemsArr];
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
                    'status'                   => OrderStatus::Paid,
                    'stripe_payment_intent_id' => $stripeSession->payment_intent,
                ]);

                foreach ($order->items as $item) {
                    // Decrement shop stock
                    if ($item->shopItemVariant && $item->shopItemVariant->stock_quantity !== null) {
                        ShopItemVariant::lockForUpdate()->find($item->shop_item_variant_id)
                            ?->decrement('stock_quantity', $item->quantity);
                    } elseif ($item->shopItem && $item->shopItem->stock_quantity !== null) {
                        ShopItem::lockForUpdate()->find($item->shop_item_id)
                            ?->decrement('stock_quantity', $item->quantity);
                    }

                    // Generate unique ticket code for ticket items
                    if ($item->concert_ticket_type_id !== null && $item->ticket_code === null) {
                        $code = strtoupper(Str::random(12));
                        $item->update(['ticket_code' => $code]);
                    }
                }

                // Increment promo code usage
                if ($order->promo_code_id) {
                    PromoCode::lockForUpdate()->find($order->promo_code_id)?->increment('used_count');
                }
            });
        }

        return response()->json(['received' => true]);
    }
}
