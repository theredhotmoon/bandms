<?php

namespace App\Http\Resources;

use App\Support\Locales;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * An album as a card on another record's page (a post, a show, a release, a
 * merch item): enough to draw the card and link to the album page. Expects
 * the album loaded through AlbumLinks::eager() (withOnSiteCounts()).
 */
class AlbumCardResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $cover = $this->relationLoaded('coverPhoto')
            ? $this->coverPhoto
            : $this->photos->first(fn ($p) => $p->image !== null);

        return [
            'id'          => $this->id,
            'title'       => $this->title,
            // The default locale's slug: the album page's URL in every
            // language, as concert and merch pages are.
            'slug'        => $this->slugIn(Locales::default()),
            'taken_at'    => $this->taken_at,
            'photo_count' => $this->sitePhotoCount(),
            'cover_url'   => $cover ? '/storage/' . $cover->image : null,
        ];
    }

    /**
     * An owner's albums as the public sees them: only the ones the site
     * builds a page for, in the owner's order. The admin reads `album_ids`.
     */
    public static function forOwner($albums): array
    {
        return self::collection($albums->filter->isOnSite()->values())->resolve();
    }
}
