<?php

use App\Models\Album;
use App\Models\Concert;
use App\Models\Photo;
use App\Models\Post;
use App\Models\Release;
use App\Models\ShopItem;
use App\Models\SiteDirtyArea;
use Illuminate\Support\Facades\DB;

// Photo albums linked from news, concerts, releases and merch through the
// polymorphic `albumables` pivot (App\Support\AlbumLinks). The admin's
// "Link to… → Photo albums" writes `album_ids`; the public pages read
// `albums` — cards for the albums the site builds a page for.

function linkAlbum(string $title = 'Live in Kraków', bool $published = true, bool $withPhoto = true): Album
{
    $album = Album::create([
        'title'        => $title,
        'slug'         => ['en' => \Illuminate\Support\Str::slug($title) . '-' . \Illuminate\Support\Str::random(4)],
        'published_at' => $published ? now()->subDay() : null,
    ]);
    if ($withPhoto) {
        Photo::create(['album_id' => $album->id, 'image' => 'photos/a.jpg', 'sort_order' => 0]);
    }

    return $album;
}

beforeEach(fn () => $this->createProfile());

describe('posts', function () {
    it('links albums on create, in the order given', function () {
        $this->actingAsAdmin();
        [$a, $b] = [linkAlbum('A'), linkAlbum('B')];

        $id = $this->postJson('/api/posts', $this->validPost([
            'title' => ['en' => 'Tour diary'],
            'album_ids' => [$b->id, $a->id],
        ]))->assertCreated()->assertJsonPath('data.album_ids', [$b->id, $a->id])->json('data.id');

        expect(Post::find($id)->albums()->pluck('albums.id')->all())->toBe([$b->id, $a->id]);
    });

    it('replaces on update, leaves alone when absent, clears with []', function () {
        $this->actingAsAdmin();
        [$a, $b] = [linkAlbum('A'), linkAlbum('B')];
        $post = Post::factory()->create();
        $post->albums()->sync([$a->id]);

        $this->putJson("/api/posts/{$post->id}", ['album_ids' => [$b->id]])->assertOk();
        expect($post->albums()->pluck('albums.id')->all())->toBe([$b->id]);

        $this->putJson("/api/posts/{$post->id}", ['title' => ['en' => 'Renamed']])->assertOk();
        expect($post->albums()->pluck('albums.id')->all())->toBe([$b->id]);

        $this->putJson("/api/posts/{$post->id}", ['album_ids' => []])
            ->assertOk()->assertJsonPath('data.album_ids', []);
    });

    it('rejects an unknown album id', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/posts', $this->validPost(['title' => ['en' => 'x'], 'album_ids' => [999999]]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('album_ids.0');
    });

    it('serves cards only for albums the site builds a page for', function () {
        $live = linkAlbum('Live');
        $draft = linkAlbum('Draft', published: false);
        $empty = linkAlbum('Empty', withPhoto: false);
        $post = Post::factory()->create();
        $post->albums()->sync([$live->id, $draft->id, $empty->id]);

        $res = $this->getJson("/api/posts/{$post->id}")->assertOk();

        expect($res->json('data.albums'))->toHaveCount(1)
            ->and($res->json('data.albums.0'))->toMatchArray([
                'id' => $live->id, 'title' => 'Live', 'slug' => $live->slugIn('en'),
                'photo_count' => 1, 'cover_url' => '/storage/photos/a.jpg',
            ]);
    });

    it('counts and covers a card with photos that have a file only', function () {
        $album = linkAlbum();
        Photo::create(['album_id' => $album->id, 'image' => null, 'sort_order' => -1]);
        $fileless = linkAlbum('Fileless', withPhoto: false);
        Photo::create(['album_id' => $fileless->id, 'image' => null, 'sort_order' => 0]);
        $post = Post::factory()->create();
        $post->albums()->sync([$album->id, $fileless->id]);

        $cards = $this->getJson("/api/posts/{$post->id}")->assertOk()->json('data.albums');

        expect($cards)->toHaveCount(1)
            ->and($cards[0])->toMatchArray(['id' => $album->id, 'photo_count' => 1, 'cover_url' => '/storage/photos/a.jpg']);
    });

    it('marks photos dirty when the links change, and not on an unrelated save', function () {
        $this->actingAsAdmin();
        $post = Post::factory()->create();
        $album = linkAlbum();

        SiteDirtyArea::query()->delete();
        $this->putJson("/api/posts/{$post->id}", ['album_ids' => [$album->id]])->assertOk();
        expect(SiteDirtyArea::pluck('area')->all())->toContain('posts', 'photos');

        SiteDirtyArea::query()->delete();
        $this->putJson("/api/posts/{$post->id}", ['album_ids' => [$album->id]])->assertOk();
        expect(SiteDirtyArea::pluck('area')->all())->not->toContain('photos');
    });

    it('unlinks when the post is deleted, under the "post" alias', function () {
        $post = Post::factory()->create();
        $post->albums()->sync([linkAlbum()->id]);
        expect(DB::table('albumables')->value('albumable_type'))->toBe('post');

        $post->delete();

        expect(DB::table('albumables')->count())->toBe(0);
    });
});

describe('concerts, releases and merch', function () {
    it('links albums to a concert', function () {
        $this->actingAsAdmin();
        $concert = Concert::factory()->create();
        $album = linkAlbum();

        $this->putJson("/api/concerts/{$concert->id}", ['album_ids' => [$album->id]])
            ->assertOk()
            ->assertJsonPath('data.album_ids', [$album->id])
            ->assertJsonPath('data.albums.0.id', $album->id);

        expect($this->getJson('/api/concerts')->json('data.0.album_ids'))->toBe([$album->id]);
    });

    it('links albums to a release', function () {
        $this->actingAsAdmin();
        $release = Release::factory()->create();
        $album = linkAlbum();

        $this->putJson("/api/releases/{$release->id}", [
            'title' => ['en' => 'Record'], 'type' => 'LP', 'album_ids' => [$album->id],
        ])->assertOk()->assertJsonPath('data.album_ids', [$album->id]);

        $this->getJson("/api/releases/{$release->id}")->assertJsonPath('data.albums.0.id', $album->id);
    });

    it('links albums to a merch item', function () {
        $this->actingAsAdmin();
        $item = ShopItem::factory()->create(['is_available' => true]);
        $album = linkAlbum();

        $this->putJson("/api/shop/{$item->id}", [
            'name' => $item->name,
            'prices' => [['currency' => 'PLN', 'amount' => 50]],
            'album_ids' => [$album->id],
        ])->assertOk()->assertJsonPath('data.album_ids', [$album->id]);

        $this->getJson("/api/shop/{$item->id}")->assertJsonPath('data.albums.0.id', $album->id);
    });
});

describe('the album side', function () {
    it('links the album from the concert picked in its own Concert field', function () {
        $this->actingAsAdmin();
        $album = linkAlbum();
        $concert = Concert::factory()->create();

        $this->putJson("/api/albums/{$album->id}", ['concert_id' => $concert->id])->assertOk();

        expect($concert->albums()->pluck('albums.id')->all())->toBe([$album->id]);
    });

    it('moves the link when the Concert field changes, rather than keeping both', function () {
        $this->actingAsAdmin();
        $album = linkAlbum();
        [$a, $b] = [Concert::factory()->create(), Concert::factory()->create()];

        $this->putJson("/api/albums/{$album->id}", ['concert_id' => $a->id])->assertOk();
        $this->putJson("/api/albums/{$album->id}", ['concert_id' => $b->id])->assertOk();

        expect($a->albums()->count())->toBe(0)
            ->and($b->albums()->pluck('albums.id')->all())->toBe([$album->id]);

        $this->putJson("/api/albums/{$album->id}", ['concert_id' => null])->assertOk();
        expect($b->albums()->count())->toBe(0);
    });

    it('adds the Concert-field link after the albums the band already ordered there', function () {
        $this->actingAsAdmin();
        $concert = Concert::factory()->create();
        [$first, $second] = [linkAlbum('First'), linkAlbum('Second')];
        $this->putJson("/api/concerts/{$concert->id}", ['album_ids' => [$second->id, $first->id]])->assertOk();

        $third = linkAlbum('Third');
        $this->putJson("/api/albums/{$third->id}", ['concert_id' => $concert->id])->assertOk();

        expect($concert->albums()->pluck('albums.id')->all())->toBe([$second->id, $first->id, $third->id]);
    });

    it('does not relink a concert unticked on the concert, on an unrelated album save', function () {
        $this->actingAsAdmin();
        $concert = Concert::factory()->create();
        $album = linkAlbum();
        $this->putJson("/api/albums/{$album->id}", ['concert_id' => $concert->id])->assertOk();
        $this->putJson("/api/concerts/{$concert->id}", ['album_ids' => []])->assertOk();

        $this->putJson("/api/albums/{$album->id}", ['title' => 'Renamed'])->assertOk();

        expect($concert->albums()->count())->toBe(0);
    });

    it('lists the public records linking to it, and leaves drafts out', function () {
        $album = linkAlbum();
        $post = Post::factory()->create(['title' => ['en' => 'Tour diary']]);
        $draft = Post::factory()->draft()->create();
        $concert = Concert::factory()->create();
        $hidden = ShopItem::factory()->create(['is_available' => false]);
        foreach ([$post, $draft, $concert, $hidden] as $owner) {
            $owner->albums()->attach($album->id);
        }

        $linked = collect($this->getJson("/api/albums/{$album->id}")->assertOk()->json('data.linked'));

        expect($linked->pluck('type')->all())->toBe(['post', 'concert'])
            ->and($linked->firstWhere('type', 'post'))->toMatchArray(['id' => $post->id, 'title' => 'Tour diary'])
            ->and($linked->firstWhere('type', 'concert')['id'])->toBe($concert->id);
    });

    it('serves `linked` in the list only when asked — the admin pickers do not need it', function () {
        $album = linkAlbum();
        Post::factory()->create()->albums()->attach($album->id);

        expect($this->getJson('/api/albums')->json('data.0'))->not->toHaveKey('linked')
            ->and($this->getJson('/api/albums?linked=1')->json('data.0.linked'))->toHaveCount(1);
    });

    it('titles a linked record through the locale fallback chain', function () {
        $album = linkAlbum();
        $release = Release::factory()->create(['title' => ['pl' => 'Tylko po polsku']]);
        $release->albums()->attach($album->id);

        $this->getJson("/api/albums/{$album->id}?lang=en")
            ->assertOk()
            ->assertJsonPath('data.linked.0.title', 'Tylko po polsku');
    });

    it('marks every linking area dirty when the album changes', function () {
        $this->actingAsAdmin();
        $album = linkAlbum();
        Release::factory()->create()->albums()->attach($album->id);

        SiteDirtyArea::query()->delete();
        $this->putJson("/api/albums/{$album->id}", ['title' => 'Renamed'])->assertOk();

        expect(SiteDirtyArea::pluck('area')->all())->toContain('photos', 'releases');
    });

    it('drops its links when deleted', function () {
        $this->actingAsAdmin();
        $album = linkAlbum();
        Post::factory()->create()->albums()->attach($album->id);

        $this->deleteJson("/api/albums/{$album->id}")->assertNoContent();

        expect(DB::table('albumables')->count())->toBe(0)
            ->and(SiteDirtyArea::pluck('area')->all())->toContain('posts');
    });
});

it('backfills a link for every album that names a concert', function () {
    $concert = Concert::factory()->create();
    $album = linkAlbum();
    DB::table('albums')->where('id', $album->id)->update(['concert_id' => $concert->id]);
    DB::table('albumables')->delete();

    $migration = require database_path('migrations/2026_11_16_000001_create_albumables_table.php');
    $migration->down();
    $migration->up();

    expect(DB::table('albumables')->get(['album_id', 'albumable_type', 'albumable_id'])->map(fn ($r) => (array) $r)->all())
        ->toBe([['album_id' => $album->id, 'albumable_type' => 'concert', 'albumable_id' => $concert->id]]);
});
