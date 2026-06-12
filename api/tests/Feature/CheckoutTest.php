<?php

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\ShopItem;
use App\Models\ShopItemVariant;
use App\Services\StripeService;
use Stripe\Checkout\Session;

beforeEach(function () {
    $this->createProfile();

    $fakeSession = Session::constructFrom([
        'id'  => 'cs_test_fakesession',
        'url' => 'https://checkout.stripe.com/pay/cs_test_fakesession',
    ]);

    $mock = Mockery::mock(StripeService::class);
    $mock->shouldReceive('createCheckoutSession')->andReturn($fakeSession);
    $this->app->instance(StripeService::class, $mock);
});

// ── POST /api/checkout ────────────────────────────────────────────────────────

describe('POST /api/checkout', function () {
    it('creates an order and returns a checkout url', function () {
        $item = ShopItem::factory()->create(['stock_quantity' => 5]);
        $item->prices()->create(['currency' => 'USD', 'amount' => 29.99]);

        $this->postJson('/api/checkout', [
            'currency' => 'USD',
            'items'    => [['shop_item_id' => $item->id, 'shop_item_variant_id' => null, 'quantity' => 2]],
            'customer' => [
                'name'  => 'John Doe',
                'email' => 'john@example.com',
                'shipping_address' => [
                    'line1'       => '123 Main St',
                    'city'        => 'New York',
                    'postal_code' => '10001',
                    'country'     => 'US',
                ],
            ],
        ])->assertSuccessful()
            ->assertJsonStructure(['checkout_url', 'order_uuid']);

        $this->assertDatabaseHas('orders', [
            'email'    => 'john@example.com',
            'status'   => 'pending',
            'currency' => 'USD',
            'total'    => 59.98,
        ]);
    });

    it('returns 422 when item stock is insufficient', function () {
        $item = ShopItem::factory()->create(['stock_quantity' => 1]);
        $item->prices()->create(['currency' => 'USD', 'amount' => 10.00]);

        $this->postJson('/api/checkout', [
            'currency' => 'USD',
            'items'    => [['shop_item_id' => $item->id, 'shop_item_variant_id' => null, 'quantity' => 5]],
            'customer' => [
                'name'  => 'Jane',
                'email' => 'jane@example.com',
                'shipping_address' => ['line1' => 'A', 'city' => 'B', 'postal_code' => '00000', 'country' => 'US'],
            ],
        ])->assertStatus(422);
    });

    it('returns 422 when variant stock is zero', function () {
        $item    = ShopItem::factory()->create(['stock_quantity' => null]);
        $variant = ShopItemVariant::factory()->soldOut()->create(['shop_item_id' => $item->id]);
        $item->prices()->create(['currency' => 'USD', 'amount' => 15.00]);

        $this->postJson('/api/checkout', [
            'currency' => 'USD',
            'items'    => [['shop_item_id' => $item->id, 'shop_item_variant_id' => $variant->id, 'quantity' => 1]],
            'customer' => [
                'name'  => 'Jane',
                'email' => 'jane@example.com',
                'shipping_address' => ['line1' => 'A', 'city' => 'B', 'postal_code' => '00000', 'country' => 'US'],
            ],
        ])->assertStatus(422);
    });

    it('returns 422 when item has no price in the requested currency', function () {
        $item = ShopItem::factory()->create(['stock_quantity' => null]);
        $item->prices()->create(['currency' => 'EUR', 'amount' => 10.00]);

        $this->postJson('/api/checkout', [
            'currency' => 'USD',
            'items'    => [['shop_item_id' => $item->id, 'shop_item_variant_id' => null, 'quantity' => 1]],
            'customer' => [
                'name'  => 'Jane',
                'email' => 'jane@example.com',
                'shipping_address' => ['line1' => 'A', 'city' => 'B', 'postal_code' => '00000', 'country' => 'US'],
            ],
        ])->assertStatus(422);
    });

    it('validates required fields', function () {
        $this->postJson('/api/checkout', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['currency', 'items', 'customer.name', 'customer.email']);
    });
});

// ── POST /api/webhooks/stripe ─────────────────────────────────────────────────

describe('POST /api/webhooks/stripe', function () {
    function makeStripeSignature(string $payload, string $secret): string
    {
        $timestamp = time();
        $signature = hash_hmac('sha256', "{$timestamp}.{$payload}", $secret);
        return "t={$timestamp},v1={$signature}";
    }

    it('marks order as paid and decrements stock on checkout.session.completed', function () {
        $secret = 'whsec_test_secret';
        config(['services.stripe.webhook_secret' => $secret]);

        $item = ShopItem::factory()->create(['stock_quantity' => 10]);
        $item->prices()->create(['currency' => 'USD', 'amount' => 20.00]);

        $order = Order::factory()->create(['status' => OrderStatus::Pending, 'currency' => 'USD', 'total' => 20.00]);
        $order->items()->create([
            'shop_item_id'         => $item->id,
            'shop_item_variant_id' => null,
            'name'                 => $item->name,
            'variant_label'        => null,
            'price'                => 20.00,
            'currency'             => 'USD',
            'quantity'             => 2,
        ]);

        $payload = json_encode([
            'type' => 'checkout.session.completed',
            'data' => [
                'object' => [
                    'id'              => 'cs_test_xxx',
                    'payment_intent'  => 'pi_test_xxx',
                    'metadata'        => ['order_uuid' => $order->uuid],
                ],
            ],
        ]);

        $sig = makeStripeSignature($payload, $secret);

        $this->withHeaders(['Stripe-Signature' => $sig])
            ->postJson('/api/webhooks/stripe', json_decode($payload, true))
            ->assertSuccessful()
            ->assertJsonPath('received', true);

        $this->assertDatabaseHas('orders', ['id' => $order->id, 'status' => 'paid']);
        $this->assertDatabaseHas('shop_items', ['id' => $item->id, 'stock_quantity' => 8]);
    });

    it('returns 400 with an invalid Stripe signature', function () {
        config(['services.stripe.webhook_secret' => 'whsec_real_secret']);

        $payload = json_encode(['type' => 'checkout.session.completed', 'data' => ['object' => []]]);

        $this->withHeaders(['Stripe-Signature' => 't=1,v1=invalidsig'])
            ->postJson('/api/webhooks/stripe', json_decode($payload, true))
            ->assertStatus(400);
    });

    it('is idempotent — does not double-process a paid order', function () {
        $secret = 'whsec_idempotent';
        config(['services.stripe.webhook_secret' => $secret]);

        $item = ShopItem::factory()->create(['stock_quantity' => 10]);
        $item->prices()->create(['currency' => 'USD', 'amount' => 20.00]);

        $order = Order::factory()->paid()->create(['total' => 20.00]);
        $order->items()->create([
            'shop_item_id' => $item->id, 'name' => $item->name,
            'price' => 20.00, 'currency' => 'USD', 'quantity' => 2,
        ]);

        $payload = json_encode([
            'type' => 'checkout.session.completed',
            'data' => ['object' => ['id' => 'cs_x', 'payment_intent' => 'pi_x', 'metadata' => ['order_uuid' => $order->uuid]]],
        ]);

        $sig = makeStripeSignature($payload, $secret);

        $this->withHeaders(['Stripe-Signature' => $sig])
            ->postJson('/api/webhooks/stripe', json_decode($payload, true))
            ->assertSuccessful();

        // Stock must not be decremented because order was already paid
        $this->assertDatabaseHas('shop_items', ['id' => $item->id, 'stock_quantity' => 10]);
    });
});

// ── GET /api/orders/{uuid} ────────────────────────────────────────────────────

describe('GET /api/orders/{uuid}', function () {
    it('returns order data by uuid', function () {
        $order = Order::factory()->paid()->create(['email' => 'test@example.com']);

        $this->getJson("/api/orders/{$order->uuid}")
            ->assertSuccessful()
            ->assertJsonPath('data.uuid', $order->uuid)
            ->assertJsonPath('data.status', 'paid')
            ->assertJsonMissingPath('data.email')
            ->assertJsonMissingPath('data.name')
            ->assertJsonMissingPath('data.shipping_address');
    });

    it('returns 404 for unknown uuid', function () {
        $this->getJson('/api/orders/nonexistent-uuid-xxx')->assertNotFound();
    });

    it('is publicly accessible (no auth required)', function () {
        $order = Order::factory()->create();
        $this->getJson("/api/orders/{$order->uuid}")->assertSuccessful();
    });
});
