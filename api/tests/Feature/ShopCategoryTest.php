<?php

use App\Models\ShopCategory;
use App\Models\User;
use Laravel\Passport\Passport;

beforeEach(fn () => $this->createProfile());

// ── GET /api/shop-categories ──────────────────────────────────────────────────

describe('GET /api/shop-categories', function () {
    it('is publicly accessible', function () {
        $this->getJson('/api/shop-categories')->assertSuccessful();
    });

    it('returns categories ordered by sort_order then name', function () {
        ShopCategory::factory()->create(['name' => 'Vinyl',    'slug' => 'vinyl',    'sort_order' => 2]);
        ShopCategory::factory()->create(['name' => 'Apparel',  'slug' => 'apparel',  'sort_order' => 1]);
        ShopCategory::factory()->create(['name' => 'Bundles',  'slug' => 'bundles',  'sort_order' => 1]);

        $this->getJson('/api/shop-categories')
            ->assertSuccessful()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.name', 'Apparel')
            ->assertJsonPath('data.1.name', 'Bundles')
            ->assertJsonPath('data.2.name', 'Vinyl');
    });
});

// ── POST /api/shop-categories ─────────────────────────────────────────────────

describe('POST /api/shop-categories', function () {
    it('returns 401 without authentication', function () {
        $this->postJson('/api/shop-categories', ['name' => 'Test'])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->postJson('/api/shop-categories', ['name' => 'Test'])->assertForbidden();
    });

    it('creates a category and auto-generates a slug', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/shop-categories', ['name' => 'Limited Editions', 'sort_order' => 1])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Limited Editions')
            ->assertJsonPath('data.slug', 'limited-editions')
            ->assertJsonPath('data.sort_order', 1);
    });

    it('validates name is required', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/shop-categories', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    });

    it('validates name must be unique', function () {
        $this->actingAsAdmin();
        ShopCategory::factory()->create(['name' => 'Merch', 'slug' => 'merch']);

        $this->postJson('/api/shop-categories', ['name' => 'Merch'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    });
});

// ── PUT /api/shop-categories/{shopCategory} ───────────────────────────────────

describe('PUT /api/shop-categories/{shopCategory}', function () {
    it('returns 401 without authentication', function () {
        $cat = ShopCategory::factory()->create();

        $this->putJson("/api/shop-categories/{$cat->id}", ['name' => 'New'])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $cat = ShopCategory::factory()->create();
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->putJson("/api/shop-categories/{$cat->id}", ['name' => 'New'])->assertForbidden();
    });

    it('updates a category and regenerates the slug on name change', function () {
        $this->actingAsAdmin();
        $cat = ShopCategory::factory()->create(['name' => 'Old Name', 'slug' => 'old-name']);

        $this->putJson("/api/shop-categories/{$cat->id}", ['name' => 'New Name'])
            ->assertSuccessful()
            ->assertJsonPath('data.slug', 'new-name');
    });

    it('allows keeping the same name', function () {
        $this->actingAsAdmin();
        $cat = ShopCategory::factory()->create(['name' => 'Merch', 'slug' => 'merch']);

        $this->putJson("/api/shop-categories/{$cat->id}", ['name' => 'Merch'])->assertSuccessful();
    });

    it('returns 404 for non-existent category', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/shop-categories/9999', ['name' => 'X'])->assertNotFound();
    });
});

// ── DELETE /api/shop-categories/{shopCategory} ────────────────────────────────

describe('DELETE /api/shop-categories/{shopCategory}', function () {
    it('returns 401 without authentication', function () {
        $cat = ShopCategory::factory()->create();

        $this->deleteJson("/api/shop-categories/{$cat->id}")->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $cat = ShopCategory::factory()->create();
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->deleteJson("/api/shop-categories/{$cat->id}")->assertForbidden();
    });

    it('deletes a category', function () {
        $this->actingAsAdmin();
        $cat = ShopCategory::factory()->create();

        $this->deleteJson("/api/shop-categories/{$cat->id}")->assertNoContent();

        $this->assertDatabaseMissing('shop_categories', ['id' => $cat->id]);
    });

    it('returns 404 for non-existent category', function () {
        $this->actingAsAdmin();

        $this->deleteJson('/api/shop-categories/9999')->assertNotFound();
    });
});
