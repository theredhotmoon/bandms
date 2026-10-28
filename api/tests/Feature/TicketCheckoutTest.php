<?php

use App\Enums\OrderStatus;
use App\Models\Concert;
use App\Models\ConcertTicketType;
use App\Models\Order;
use App\Models\PresaleCode;
use App\Models\PromoCode;
use App\Services\StripeService;
use Stripe\Checkout\Session;

beforeEach(function () {
    $this->createProfile();

    $this->stripe = Mockery::mock(StripeService::class);
    $this->stripe->shouldReceive('createCheckoutSession')
        ->andReturnUsing(function (array $params) {
            $this->sessionParams = $params;

            return Session::constructFrom(['id' => 'cs_test_tickets', 'url' => 'https://checkout.stripe.com/pay/cs_test_tickets']);
        });
    $this->app->instance(StripeService::class, $this->stripe);
});

function ticketType(array $attrs = [], float $price = 25.00): ConcertTicketType
{
    $type = ConcertTicketType::create(array_merge([
        'concert_id' => Concert::factory()->create()->id,
        'name'       => 'General admission',
    ], $attrs));
    $type->tiers()->create(['name' => 'Standard', 'price' => $price, 'currency' => 'EUR']);

    return $type;
}

function ticketCheckout(array $items, array $extra = []): array
{
    return array_merge([
        'currency' => 'EUR',
        'items'    => $items,
        'customer' => ['name' => 'Fan', 'email' => 'fan@example.com'],
    ], $extra);
}

describe('presale codes at checkout', function () {
    it('ignores an order-level code on tickets that are already on sale', function () {
        $presaleShow = ticketType(['available_from' => now()->addWeek()]);
        $onSale      = ticketType();
        PresaleCode::create(['code' => 'EARLY', 'concert_id' => $presaleShow->concert_id]);

        $this->postJson('/api/checkout', ticketCheckout([
            ['ticket_type_id' => $presaleShow->id, 'quantity' => 1],
            ['ticket_type_id' => $onSale->id, 'quantity' => 1],
        ], ['presale_code' => 'EARLY']))->assertSuccessful();
    });

    it('still refuses a ticket that is not on sale without a code', function () {
        $type = ticketType(['available_from' => now()->addWeek()]);

        $this->postJson('/api/checkout', ticketCheckout([['ticket_type_id' => $type->id, 'quantity' => 1]]))
            ->assertStatus(422);
    });

    it('spends nothing at checkout and one use per ticket on payment', function () {
        $type = ticketType(['available_from' => now()->addWeek()]);
        $code = PresaleCode::create(['code' => 'EARLY', 'concert_id' => $type->concert_id, 'max_uses' => 5]);

        $res = $this->postJson('/api/checkout', ticketCheckout(
            [['ticket_type_id' => $type->id, 'quantity' => 3]],
            ['presale_code' => 'EARLY'],
        ))->assertSuccessful();

        expect($code->fresh()->used_count)->toBe(0);

        $order = Order::where('uuid', $res->json('order_uuid'))->firstOrFail();
        expect($order->items()->where('presale_code_id', $code->id)->count())->toBe(3);

        $secret = 'whsec_test_secret';
        config(['services.stripe.webhook_secret' => $secret]);
        $payload = json_encode([
            'type' => 'checkout.session.completed',
            'data' => ['object' => ['id' => 'cs_test_tickets', 'payment_intent' => 'pi_x', 'metadata' => ['order_uuid' => $order->uuid]]],
        ]);
        $this->withHeaders(['Stripe-Signature' => makeStripeSignature($payload, $secret)])
            ->postJson('/api/webhooks/stripe', json_decode($payload, true))
            ->assertSuccessful();

        expect($order->fresh()->status)->toBe(OrderStatus::Paid)
            ->and($code->fresh()->used_count)->toBe(3);
    });

    it('refuses an order larger than the uses a code has left', function () {
        $type = ticketType(['available_from' => now()->addWeek()]);
        PresaleCode::create(['code' => 'EARLY', 'concert_id' => $type->concert_id, 'max_uses' => 5, 'used_count' => 3]);

        $this->postJson('/api/checkout', ticketCheckout(
            [['ticket_type_id' => $type->id, 'quantity' => 3]],
            ['presale_code' => 'EARLY'],
        ))->assertStatus(422);
    });
});

describe('promo codes at checkout', function () {
    it('sends the exact stored discount to Stripe as one coupon', function () {
        $type = ticketType([], 3.33);
        PromoCode::create(['code' => 'FIVER', 'discount_type' => 'fixed', 'value' => 5.00]);

        $this->stripe->shouldReceive('createOneOffCoupon')->once()
            ->with(500, 'EUR', 'Promo: FIVER')->andReturn('coupon_x');

        $res = $this->postJson('/api/checkout', ticketCheckout(
            [['ticket_type_id' => $type->id, 'quantity' => 3]],
            ['promo_code' => 'FIVER'],
        ))->assertSuccessful();

        $order = Order::where('uuid', $res->json('order_uuid'))->firstOrFail();
        expect((float) $order->total)->toBe(4.99)
            ->and((float) $order->discount_amount)->toBe(5.00)
            ->and($this->sessionParams['discounts'])->toBe([['coupon' => 'coupon_x']])
            ->and($this->sessionParams['line_items'][0]['price_data']['unit_amount'])->toBe(333);
    });

    it('creates no coupon without a promo', function () {
        $type = ticketType();
        $this->stripe->shouldNotReceive('createOneOffCoupon');

        $this->postJson('/api/checkout', ticketCheckout([['ticket_type_id' => $type->id, 'quantity' => 1]]))
            ->assertSuccessful();

        expect($this->sessionParams)->not->toHaveKey('discounts');
    });
});
