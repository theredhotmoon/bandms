<?php

use App\Models\BandProfile;
use App\Models\ShopCategory;
use App\Models\ShopItem;
use App\Models\Tag;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Passport\Passport;

beforeEach(function () {
    $this->createProfile();
    Storage::fake('public');
});

// ── GET /api/shop ─────────────────────────────────────────────────────────────

describe('GET /api/shop', function () {
    it('is publicly accessible', function () {
        $this->getJson('/api/shop')->assertSuccessful();
    });

    it('returns only available items', function () {
        ShopItem::factory()->create(['name' => 'Available Item', 'slug' => 'available-item', 'is_available' => true]);
        ShopItem::factory()->create(['name' => 'Hidden Item',    'slug' => 'hidden-item',    'is_available' => false]);

        $this->getJson('/api/shop')
            ->assertSuccessful()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Available Item');
    });

    it('returns items ordered by sort_order asc', function () {
        ShopItem::factory()->create(['name' => 'B Item', 'slug' => 'b-item', 'sort_order' => 2]);
        ShopItem::factory()->create(['name' => 'A Item', 'slug' => 'a-item', 'sort_order' => 1]);

        $this->getJson('/api/shop')
            ->assertSuccessful()
            ->assertJsonPath('data.0.name', 'A Item');
    });

    it('returns empty collection when no available items exist', function () {
        ShopItem::factory()->unavailable()->create(['slug' => 'hidden']);

        $this->getJson('/api/shop')
            ->assertSuccessful()
            ->assertJsonCount(0, 'data');
    });

    it('includes prices in response', function () {
        $item = ShopItem::factory()->create(['slug' => 'item-with-price']);
        $item->prices()->create(['currency' => 'USD', 'amount' => 29.99]);

        $data = $this->getJson('/api/shop')->assertSuccessful()->json('data');

        expect($data[0]['prices'])->toHaveCount(1)
            ->and($data[0]['prices'][0]['currency'])->toBe('USD')
            ->and($data[0]['prices'][0]['amount'])->toBe(29.99);
    });

    it('includes categories in summary response', function () {
        $item = ShopItem::factory()->create(['slug' => 'item-with-cat']);
        $cat  = ShopCategory::factory()->create();
        $item->categories()->attach($cat->id);

        $data = $this->getJson('/api/shop')->assertSuccessful()->json('data');

        expect($data[0]['categories'])->toHaveCount(1)
            ->and($data[0]['categories'][0]['id'])->toBe($cat->id);
    });
});

// ── GET /api/shop/{shopItem} ──────────────────────────────────────────────────

describe('GET /api/shop/{shopItem}', function () {
    it('returns the item', function () {
        $item = ShopItem::factory()->create(['name' => 'Test Vinyl', 'slug' => 'test-vinyl']);

        $this->getJson("/api/shop/{$item->id}")
            ->assertSuccessful()
            ->assertJsonPath('data.name', 'Test Vinyl');
    });

    it('returns 404 for an unavailable item', function () {
        $item = ShopItem::factory()->unavailable()->create(['slug' => 'hidden-item']);

        $this->getJson("/api/shop/{$item->id}")->assertNotFound();
    });

    it('returns 404 for a non-existent item', function () {
        $this->getJson('/api/shop/9999')->assertNotFound();
    });

    it('returns full resource with relations', function () {
        $item = ShopItem::factory()->create(['slug' => 'full-item']);
        $tag  = Tag::factory()->create();
        $item->tags()->attach($tag->id);

        $data = $this->getJson("/api/shop/{$item->id}")->assertSuccessful()->json('data');

        expect($data)->toHaveKeys(['tags', 'release_ids', 'concert_ids', 'post_ids', 'video_ids', 'category_ids', 'photos']);
    });
});

// ── GET /api/shop-admin ───────────────────────────────────────────────────────

describe('GET /api/shop-admin', function () {
    it('returns 401 without authentication', function () {
        $this->getJson('/api/shop-admin')->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->getJson('/api/shop-admin')->assertForbidden();
    });

    it('returns all items including unavailable ones', function () {
        $this->actingAsAdmin();
        ShopItem::factory()->create(['name' => 'Public',  'slug' => 'pub',    'is_available' => true]);
        ShopItem::factory()->create(['name' => 'Private', 'slug' => 'priv',   'is_available' => false]);

        $this->getJson('/api/shop-admin')
            ->assertSuccessful()
            ->assertJsonCount(2, 'data');
    });

    it('includes categories in the admin index', function () {
        $this->actingAsAdmin();
        $item = ShopItem::factory()->create(['slug' => 'cat-item']);
        $cat  = ShopCategory::factory()->create();
        $item->categories()->attach($cat->id);

        $data = $this->getJson('/api/shop-admin')->assertSuccessful()->json('data');

        expect($data[0]['categories'])->toHaveCount(1);
    });
});

// ── POST /api/shop ────────────────────────────────────────────────────────────

describe('POST /api/shop', function () {
    it('returns 401 without authentication', function () {
        $this->postJson('/api/shop', ['name' => 'T-Shirt'])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->postJson('/api/shop', ['name' => 'T-Shirt'])->assertForbidden();
    });

    it('creates a shop item with prices', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/shop', [
            'name'        => 'Debut LP',
            'is_available'=> true,
            'prices'      => [['currency' => 'USD', 'amount' => 24.99]],
        ])->assertCreated()
          ->assertJsonPath('data.name', 'Debut LP')
          ->assertJsonPath('data.slug', 'debut-lp');

        $this->assertDatabaseHas('shop_items', ['name' => 'Debut LP']);
    });

    it('persists prices in the shop_item_prices table', function () {
        $this->actingAsAdmin();

        $response = $this->postJson('/api/shop', [
            'name'   => 'EP',
            'prices' => [
                ['currency' => 'USD', 'amount' => 10.00],
                ['currency' => 'EUR', 'amount' => 9.00],
            ],
        ])->assertCreated();

        $id = $response->json('data.id');

        $this->assertDatabaseHas('shop_item_prices', ['shop_item_id' => $id, 'currency' => 'USD', 'amount' => 10.00]);
        $this->assertDatabaseHas('shop_item_prices', ['shop_item_id' => $id, 'currency' => 'EUR', 'amount' => 9.00]);
    });

    it('validates name is required', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/shop', ['prices' => [['currency' => 'USD', 'amount' => 10]]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    });

    it('validates prices are required', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/shop', ['name' => 'Item'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['prices']);
    });

    it('validates price currency must be 3 characters', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/shop', [
            'name'   => 'Item',
            'prices' => [['currency' => 'US', 'amount' => 10]],
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['prices.0.currency']);
    });

    it('syncs category_ids on create', function () {
        $this->actingAsAdmin();
        $cat = ShopCategory::factory()->create();

        $response = $this->postJson('/api/shop', [
            'name'         => 'Categorised Item',
            'prices'       => [['currency' => 'USD', 'amount' => 5]],
            'category_ids' => [$cat->id],
        ])->assertCreated();

        $id = $response->json('data.id');

        $this->assertDatabaseHas('shop_item_category', ['shop_item_id' => $id, 'shop_category_id' => $cat->id]);
    });

    it('syncs tag_ids on create', function () {
        $this->actingAsAdmin();
        $tag = Tag::factory()->create();

        $response = $this->postJson('/api/shop', [
            'name'    => 'Tagged Item',
            'prices'  => [['currency' => 'USD', 'amount' => 5]],
            'tag_ids' => [$tag->id],
        ])->assertCreated();

        $id = $response->json('data.id');

        $this->assertDatabaseHas('shop_item_tag', ['shop_item_id' => $id, 'tag_id' => $tag->id]);
    });

    it('auto-uppercases currency codes', function () {
        $this->actingAsAdmin();

        $response = $this->postJson('/api/shop', [
            'name'   => 'Item',
            'prices' => [['currency' => 'usd', 'amount' => 10]],
        ])->assertCreated();

        $id = $response->json('data.id');

        $this->assertDatabaseHas('shop_item_prices', ['shop_item_id' => $id, 'currency' => 'USD']);
    });

    it('generates a unique slug on name collision', function () {
        $this->actingAsAdmin();
        ShopItem::factory()->create(['name' => 'My Item', 'slug' => 'my-item']);

        $response = $this->postJson('/api/shop', [
            'name'   => 'My Item',
            'prices' => [['currency' => 'USD', 'amount' => 10]],
        ])->assertCreated();

        $slug = $response->json('data.slug');

        expect($slug)->not->toBe('my-item');
        expect($slug)->toStartWith('my-item');
    });
});

// ── PUT /api/shop/{shopItem} ──────────────────────────────────────────────────

describe('PUT /api/shop/{shopItem}', function () {
    it('returns 401 without authentication', function () {
        $item = ShopItem::factory()->create(['slug' => 'item']);

        $this->putJson("/api/shop/{$item->id}", ['name' => 'New', 'prices' => []])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $item = ShopItem::factory()->create(['slug' => 'item']);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->putJson("/api/shop/{$item->id}", ['name' => 'New', 'prices' => []])->assertForbidden();
    });

    it('updates an item', function () {
        $this->actingAsAdmin();
        $item = ShopItem::factory()->create(['name' => 'Old Name', 'slug' => 'old-name']);

        $this->putJson("/api/shop/{$item->id}", [
            'name'   => 'New Name',
            'prices' => [['currency' => 'USD', 'amount' => 19.99]],
        ])->assertSuccessful()
          ->assertJsonPath('data.name', 'New Name');

        $this->assertDatabaseHas('shop_items', ['id' => $item->id, 'name' => 'New Name']);
    });

    it('replaces all prices on update', function () {
        $this->actingAsAdmin();
        $item = ShopItem::factory()->create(['slug' => 'item-x']);
        $item->prices()->create(['currency' => 'USD', 'amount' => 10]);
        $item->prices()->create(['currency' => 'EUR', 'amount' => 9]);

        $this->putJson("/api/shop/{$item->id}", [
            'name'   => $item->name,
            'prices' => [['currency' => 'GBP', 'amount' => 8]],
        ])->assertSuccessful();

        $this->assertDatabaseMissing('shop_item_prices', ['shop_item_id' => $item->id, 'currency' => 'USD']);
        $this->assertDatabaseHas('shop_item_prices',    ['shop_item_id' => $item->id, 'currency' => 'GBP']);
    });

    it('updates category associations', function () {
        $this->actingAsAdmin();
        $item = ShopItem::factory()->create(['slug' => 'cat-item-u']);
        $catA = ShopCategory::factory()->create();
        $catB = ShopCategory::factory()->create();
        $item->categories()->attach($catA->id);

        $this->putJson("/api/shop/{$item->id}", [
            'name'         => $item->name,
            'prices'       => [['currency' => 'USD', 'amount' => 5]],
            'category_ids' => [$catB->id],
        ])->assertSuccessful();

        $this->assertDatabaseMissing('shop_item_category', ['shop_item_id' => $item->id, 'shop_category_id' => $catA->id]);
        $this->assertDatabaseHas('shop_item_category',    ['shop_item_id' => $item->id, 'shop_category_id' => $catB->id]);
    });

    it('regenerates slug when name changes', function () {
        $this->actingAsAdmin();
        $item = ShopItem::factory()->create(['name' => 'Old Name', 'slug' => 'old-name']);

        $response = $this->putJson("/api/shop/{$item->id}", [
            'name'   => 'Completely Different',
            'prices' => [['currency' => 'USD', 'amount' => 10]],
        ])->assertSuccessful();

        expect($response->json('data.slug'))->toBe('completely-different');
    });

    it('returns 404 for a non-existent item', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/shop/9999', ['name' => 'X', 'prices' => [['currency' => 'USD', 'amount' => 1]]])->assertNotFound();
    });
});

// ── DELETE /api/shop/{shopItem} ───────────────────────────────────────────────

describe('DELETE /api/shop/{shopItem}', function () {
    it('returns 401 without authentication', function () {
        $item = ShopItem::factory()->create(['slug' => 'del-item']);

        $this->deleteJson("/api/shop/{$item->id}")->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $item = ShopItem::factory()->create(['slug' => 'del-item2']);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->deleteJson("/api/shop/{$item->id}")->assertForbidden();
    });

    it('deletes an item', function () {
        $this->actingAsAdmin();
        $item = ShopItem::factory()->create(['slug' => 'to-del']);

        $this->deleteJson("/api/shop/{$item->id}")->assertOk();

        $this->assertDatabaseMissing('shop_items', ['id' => $item->id]);
    });

    it('returns 404 for a non-existent item', function () {
        $this->actingAsAdmin();

        $this->deleteJson('/api/shop/9999')->assertNotFound();
    });
});

// ── POST /api/shop/{shopItem}/photos ──────────────────────────────────────────

describe('POST /api/shop/{shopItem}/photos', function () {
    it('returns 401 without authentication', function () {
        $item = ShopItem::factory()->create(['slug' => 'photo-item-1']);

        $this->postJson("/api/shop/{$item->id}/photos", [])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $item = ShopItem::factory()->create(['slug' => 'photo-item-2']);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->postJson("/api/shop/{$item->id}/photos", [])->assertForbidden();
    });

    it('uploads a photo and returns the photo data', function () {
        $this->actingAsAdmin();
        $item = ShopItem::factory()->create(['slug' => 'photo-item-3']);
        $file = UploadedFile::fake()->create('cover.jpg', 100, 'image/jpeg');

        $this->postJson("/api/shop/{$item->id}/photos", ['photo' => $file])
            ->assertOk()
            ->assertJsonStructure(['id', 'url', 'alt_text', 'sort_order']);

        $this->assertDatabaseHas('shop_item_photos', ['shop_item_id' => $item->id]);
    });

    it('validates photo is required', function () {
        $this->actingAsAdmin();
        $item = ShopItem::factory()->create(['slug' => 'photo-item-4']);

        $this->postJson("/api/shop/{$item->id}/photos", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['photo']);
    });

    it('validates photo must be an image', function () {
        $this->actingAsAdmin();
        $item = ShopItem::factory()->create(['slug' => 'photo-item-5']);
        $file = UploadedFile::fake()->create('document.pdf', 100, 'application/pdf');

        $this->postJson("/api/shop/{$item->id}/photos", ['photo' => $file])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['photo']);
    });
});

// ── DELETE /api/shop/{shopItem}/photos/{photo} ────────────────────────────────

describe('DELETE /api/shop/{shopItem}/photos/{photo}', function () {
    it('returns 401 without authentication', function () {
        $item  = ShopItem::factory()->create(['slug' => 'photo-del-1']);
        $photo = $item->photos()->create(['image' => 'logos/x.jpg', 'sort_order' => 0]);

        $this->deleteJson("/api/shop/{$item->id}/photos/{$photo->id}")->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $item  = ShopItem::factory()->create(['slug' => 'photo-del-2']);
        $photo = $item->photos()->create(['image' => 'logos/x.jpg', 'sort_order' => 0]);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->deleteJson("/api/shop/{$item->id}/photos/{$photo->id}")->assertForbidden();
    });

    it('deletes the photo', function () {
        $this->actingAsAdmin();
        $item  = ShopItem::factory()->create(['slug' => 'photo-del-3']);
        $photo = $item->photos()->create(['image' => 'logos/x.jpg', 'sort_order' => 0]);

        $this->deleteJson("/api/shop/{$item->id}/photos/{$photo->id}")->assertOk();

        $this->assertDatabaseMissing('shop_item_photos', ['id' => $photo->id]);
    });

    it('returns 404 when photo does not belong to the item', function () {
        $this->actingAsAdmin();
        $itemA = ShopItem::factory()->create(['slug' => 'photo-del-4a']);
        $itemB = ShopItem::factory()->create(['slug' => 'photo-del-4b']);
        $photo = $itemB->photos()->create(['image' => 'logos/x.jpg', 'sort_order' => 0]);

        $this->deleteJson("/api/shop/{$itemA->id}/photos/{$photo->id}")->assertNotFound();
    });
});

// ── PUT /api/shop/{shopItem}/photos/reorder ───────────────────────────────────

describe('PUT /api/shop/{shopItem}/photos/reorder', function () {
    it('returns 401 without authentication', function () {
        $item = ShopItem::factory()->create(['slug' => 'reorder-1']);

        $this->putJson("/api/shop/{$item->id}/photos/reorder", ['ids' => []])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $item = ShopItem::factory()->create(['slug' => 'reorder-2']);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->putJson("/api/shop/{$item->id}/photos/reorder", ['ids' => []])->assertForbidden();
    });

    it('reorders photos', function () {
        $this->actingAsAdmin();
        $item   = ShopItem::factory()->create(['slug' => 'reorder-3']);
        $photoA = $item->photos()->create(['image' => 'logos/a.jpg', 'sort_order' => 0]);
        $photoB = $item->photos()->create(['image' => 'logos/b.jpg', 'sort_order' => 1]);

        $this->putJson("/api/shop/{$item->id}/photos/reorder", [
            'ids' => [$photoB->id, $photoA->id],
        ])->assertOk();

        $this->assertDatabaseHas('shop_item_photos', ['id' => $photoB->id, 'sort_order' => 0]);
        $this->assertDatabaseHas('shop_item_photos', ['id' => $photoA->id, 'sort_order' => 1]);
    });

    it('validates ids is required', function () {
        $this->actingAsAdmin();
        $item = ShopItem::factory()->create(['slug' => 'reorder-4']);

        $this->putJson("/api/shop/{$item->id}/photos/reorder", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['ids']);
    });
});

// ── GET /api/shop-currencies ──────────────────────────────────────────────────

describe('GET /api/shop-currencies', function () {
    it('returns 401 without authentication', function () {
        $this->getJson('/api/shop-currencies')->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->getJson('/api/shop-currencies')->assertForbidden();
    });

    it('returns an empty array when no currencies are set', function () {
        $this->actingAsAdmin();

        $this->getJson('/api/shop-currencies')
            ->assertSuccessful()
            ->assertJsonPath('currencies', []);
    });

    it('returns configured currencies', function () {
        $this->actingAsAdmin();
        BandProfile::where('id', 1)->update(['shop_currencies' => json_encode(['USD', 'EUR'])]);

        $this->getJson('/api/shop-currencies')
            ->assertSuccessful()
            ->assertJsonPath('currencies', ['USD', 'EUR']);
    });
});

// ── PUT /api/shop-currencies ──────────────────────────────────────────────────

describe('PUT /api/shop-currencies', function () {
    it('returns 401 without authentication', function () {
        $this->putJson('/api/shop-currencies', ['currencies' => ['USD']])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->putJson('/api/shop-currencies', ['currencies' => ['USD']])->assertForbidden();
    });

    it('saves currencies', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/shop-currencies', ['currencies' => ['USD', 'EUR']])
            ->assertSuccessful()
            ->assertJsonPath('currencies', ['USD', 'EUR']);

        $this->assertDatabaseHas('band_profiles', ['id' => 1, 'shop_currencies' => json_encode(['USD', 'EUR'])]);
    });

    it('uppercases currency codes', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/shop-currencies', ['currencies' => ['usd', 'eur']])
            ->assertSuccessful()
            ->assertJsonPath('currencies', ['USD', 'EUR']);
    });

    it('validates currencies array is required', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/shop-currencies', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['currencies']);
    });

    it('validates each currency code must be 3 characters', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/shop-currencies', ['currencies' => ['US']])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['currencies.0']);
    });

    it('validates currencies array must not be empty', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/shop-currencies', ['currencies' => []])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['currencies']);
    });
});
