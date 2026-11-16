<?php

namespace App\Support;

use App\Models\Album;
use App\Models\Concert;
use App\Models\Post;
use App\Models\Release;
use App\Models\ShopItem;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * Which records a photo album can be linked from, by morph alias.
 *
 * The alias is what `albumables.albumable_type` stores, so it is part of the
 * data: never rename one. A class has one morph alias app-wide, so each must
 * match ClipOwners / MemberLinks where the model appears there too.
 */
final class AlbumLinks
{
    public const MAP = [
        'post'      => Post::class,
        'concert'   => Concert::class,
        'release'   => Release::class,
        'shop_item' => ShopItem::class,
    ];

    /** SiteRebuild area whose baked pages show this owner's album cards. */
    private const DIRTY = [
        'post'      => 'posts',
        'concert'   => 'concerts',
        'release'   => 'releases',
        'shop_item' => 'shop',
    ];

    /**
     * An album changed (title, cover, published, photos, deleted): its own
     * page is in the photos area, and every page linking it shows its card.
     * Call before a delete — the link rows cascade away with the album.
     */
    public static function markAlbumDirty(Album $album): void
    {
        SiteRebuild::markDirty('photos');

        $types = DB::table('albumables')->where('album_id', $album->id)
            ->distinct()->pluck('albumable_type');
        foreach ($types as $type) {
            if (isset(self::DIRTY[$type])) {
                SiteRebuild::markDirty(self::DIRTY[$type]);
            }
        }
    }

    /**
     * The album's own "Concert" field also links it from that concert, so the
     * concert's "Link to… → Photo albums" opens with it ticked. Only when the
     * field is set or changed: unticking it on the concert afterwards sticks
     * until someone picks that concert on the album again.
     *
     * A change moves the link: the concert the field used to name loses it,
     * or a corrected "wrong gig" would leave the album on both show pages.
     * The new link goes last in that concert's order, never ahead of the
     * albums the band has already arranged there.
     */
    public static function linkOwnConcert(Album $album, ?int $previous = null): void
    {
        $changed = $album->wasRecentlyCreated || $album->wasChanged('concert_id');
        if (! $changed) {
            return;
        }

        // `$previous` is the field before this save — the caller reads it
        // before fill(); Laravel 11's model keeps no copy after save().
        if ($previous !== null) {
            $album->linkedConcerts()->detach($previous);
        }

        if ($album->concert_id !== null && ! $album->linkedConcerts()->whereKey($album->concert_id)->exists()) {
            $last = DB::table('albumables')
                ->where('albumable_type', 'concert')->where('albumable_id', $album->concert_id)
                ->max('position');
            $album->linkedConcerts()->attach($album->concert_id, ['position' => $last === null ? 0 : $last + 1]);
        }

        if ($previous !== null || $album->concert_id !== null) {
            SiteRebuild::markDirty('concerts');
        }
    }

    /**
     * Eager load for an owner's `albums`, shaped for AlbumCardResource: the
     * count of photos with a file and the cover photo, never every photo row
     * — a list of 200 concerts with gig albums of 100+ photos each would
     * otherwise hydrate tens of thousands of models per build.
     *
     * @return array<string, \Closure>
     */
    public static function eager(string $relation = 'albums'): array
    {
        return [$relation => fn ($q) => $q->withOnSiteCounts()];
    }

    /** Validation for an owner's `album_ids`. Absent leaves the links alone; [] clears them. */
    public static function rules(): array
    {
        return [
            'album_ids'   => 'sometimes|nullable|array',
            'album_ids.*' => 'integer|distinct|exists:albums,id',
        ];
    }

    /**
     * Sync an owner's albums from validated data, keeping the order given.
     * Keyed on presence: a save that never mentions `album_ids` leaves the
     * links alone. An album page lists what links to it, so a real change
     * marks the photos area dirty; the owner's own area is its controller's.
     */
    public static function sync(Model $owner, array $data): void
    {
        if (! array_key_exists('album_ids', $data)) {
            return;
        }

        $ids = array_map('intval', array_values($data['album_ids'] ?? []));
        // Compared here, not read off sync()'s report: its "updated" list
        // counts rows the position UPDATE matched, which on SQLite is every
        // row, changed or not.
        if ($owner->albums()->pluck('albums.id')->map(fn ($id) => (int) $id)->all() === $ids) {
            return;
        }

        $sync = [];
        foreach ($ids as $position => $id) {
            $sync[$id] = ['position' => $position];
        }
        $owner->albums()->sync($sync);

        SiteRebuild::markDirty('photos');
    }
}
