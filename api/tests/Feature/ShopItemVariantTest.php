<?php

use App\Models\ShopItem;
use App\Models\ShopItemVariant;
use Laravel\Passport\Passport;

beforeEach(fn () => $this->createProfile());

// ── GET /api/shop/{shopItem}/variants ─────────────────────────────────────────

describe('GET /api/shop/{shopItem}/variants', function () {
    it('returns 401 without authentication', function () {
        $item = ShopItem::factory()->create();
        $this->getJson("/api/shop/{$item->id}/variants")->assertUnauthorized();
    });

    it('returns 403 for non-admin users', function () {
        $item = ShopItem::factory()->create();
        $this->actingAsUser();
        $this->getJson("/api/shop/{$item->id}/variants")->assertForbidden();
    });

    it('returns variants for a shop item', function () {
        $item = ShopItem::factory()->create();
        ShopItemVariant::factory()->create(['shop_item_id' => $item->id, 'name' => 'Size', 'value' => 'M']);
        $this->actingAsAdmin();

        $this->getJson("/api/shop/{$item->id}/variants")
            ->assertSuccessful()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Size')
            ->assertJsonPath('data.0.value', 'M');
    });
});

// ── POST /api/shop/{shopItem}/variants ────────────────────────────────────────

describe('POST /api/shop/{shopItem}/variants', function () {
    it('returns 401 without authentication', function () {
        $item = ShopItem::factory()->create();
        $this->postJson("/api/shop/{$item->id}/variants", [])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $item = ShopItem::factory()->create();
        $this->actingAsUser();
        $this->postJson("/api/shop/{$item->id}/variants", [])->assertForbidden();
    });

    it('creates a variant', function () {
        $item = ShopItem::factory()->create();
        $this->actingAsAdmin();

        $this->postJson("/api/shop/{$item->id}/variants", [
            'name'           => 'Size',
            'value'          => 'L',
            'stock_quantity' => 10,
            'sort_order'     => 0,
        ])->assertSuccessful()->assertJsonPath('data.value', 'L');

        $this->assertDatabaseHas('shop_item_variants', [
            'shop_item_id' => $item->id,
            'name'         => 'Size',
            'value'        => 'L',
        ]);
    });

    it('validates required fields', function () {
        $item = ShopItem::factory()->create();
        $this->actingAsAdmin();

        $this->postJson("/api/shop/{$item->id}/variants", [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name', 'value']);
    });
});

// ── PUT /api/shop/{shopItem}/variants/{variant} ───────────────────────────────

describe('PUT /api/shop/{shopItem}/variants/{variant}', function () {
    it('updates a variant', function () {
        $item    = ShopItem::factory()->create();
        $variant = ShopItemVariant::factory()->create(['shop_item_id' => $item->id, 'value' => 'S']);
        $this->actingAsAdmin();

        $this->putJson("/api/shop/{$item->id}/variants/{$variant->id}", [
            'name'  => 'Size',
            'value' => 'XL',
        ])->assertSuccessful()->assertJsonPath('data.value', 'XL');
    });

    it('returns 404 when variant belongs to a different item', function () {
        $item    = ShopItem::factory()->create();
        $other   = ShopItem::factory()->create();
        $variant = ShopItemVariant::factory()->create(['shop_item_id' => $other->id]);
        $this->actingAsAdmin();

        $this->putJson("/api/shop/{$item->id}/variants/{$variant->id}", [
            'name'  => 'Size',
            'value' => 'M',
        ])->assertNotFound();
    });
});

// ── DELETE /api/shop/{shopItem}/variants/{variant} ────────────────────────────

describe('DELETE /api/shop/{shopItem}/variants/{variant}', function () {
    it('deletes a variant', function () {
        $item    = ShopItem::factory()->create();
        $variant = ShopItemVariant::factory()->create(['shop_item_id' => $item->id]);
        $this->actingAsAdmin();

        $this->deleteJson("/api/shop/{$item->id}/variants/{$variant->id}")
            ->assertSuccessful();

        $this->assertDatabaseMissing('shop_item_variants', ['id' => $variant->id]);
    });

    it('returns 404 when variant belongs to a different item', function () {
        $item    = ShopItem::factory()->create();
        $other   = ShopItem::factory()->create();
        $variant = ShopItemVariant::factory()->create(['shop_item_id' => $other->id]);
        $this->actingAsAdmin();

        $this->deleteJson("/api/shop/{$item->id}/variants/{$variant->id}")
            ->assertNotFound();
    });

    it('returns 401 without authentication', function () {
        $item    = ShopItem::factory()->create();
        $variant = ShopItemVariant::factory()->create(['shop_item_id' => $item->id]);

        $this->deleteJson("/api/shop/{$item->id}/variants/{$variant->id}")
            ->assertUnauthorized();
    });
});
