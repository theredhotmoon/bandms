<?php

namespace App\Http\Resources;

use App\Support\Locales;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AlbumResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $photos = $this->whenLoaded('photos');

        return [
            'id'           => $this->id,
            'title'        => $this->title,
            'slug'         => $this->slugIn(Locales::default()),
            'translations' => [
                'slug' => collect(Locales::codes())->mapWithKeys(fn (string $c) => [$c => $this->slugIn($c)])->all(),
            ],
            'description'  => $this->description,
            'taken_at'     => $this->taken_at,
            'published_at' => $this->published_at,
            'venue'        => $this->whenLoaded('venue', fn () => $this->venue
                ? ['id' => $this->venue->id, 'name' => $this->venue->name]
                : null),
            'concert'      => $this->whenLoaded('concert', fn () => $this->concert
                ? ['id' => $this->concert->id, 'date' => $this->concert->date?->format('Y-m-d'), 'description' => $this->concert->description]
                : null),
            'tags'         => TagResource::collection($this->whenLoaded('tags')),
            'photos'       => $this->whenLoaded('photos', fn () => $this->photos->map(fn ($p) => [
                'id'           => $p->id,
                'image_url'    => $p->image ? '/storage/' . $p->image : null,
                'sort_order'   => $p->sort_order,
                'caption'      => $p->caption,
                'epk_featured' => (bool) $p->epk_featured,
                // Who is in it, for the admin's tag picker. Absent unless the
                // query loaded photos.members.
                'member_ids'   => $p->relationLoaded('members') ? $p->members->pluck('id')->values() : null,
            ])),
            'photo_count'  => $this->when($photos !== null, fn () => $photos->count(), fn () => $this->photos()->count()),
            'cover_url'    => $this->whenLoaded('photos', fn () =>
                $this->photos->first()?->image ? '/storage/' . $this->photos->first()->image : null
            ),
            // What links to this album and is public: the album page lists
            // these as "See also". A draft post or a hidden merch item is
            // left out, because its page is never built.
            'linked'       => $this->when(
                $this->relationLoaded('linkedPosts'),
                fn () => $this->linkedRecords(),
            ),
            'created_at'   => $this->created_at,
            'updated_at'   => $this->updated_at,
        ];
    }

    /** @return array<int, array<string, mixed>> */
    private function linkedRecords(): array
    {
        $default = Locales::default();
        // Titles through the declared fallback chain, as every other public
        // resource does: a release titled only in Polish would otherwise be
        // an empty string on /en/, and the album page drops an empty entry.
        $title = fn ($model, string $field) => Locales::resolve($model->getTranslations($field)) ?? '';
        $out = [];

        foreach ($this->linkedPosts->whereNotNull('published_at')->sortByDesc('published_at') as $p) {
            $out[] = [
                'type'         => 'post',
                'id'           => $p->id,
                'title'        => $title($p, 'title'),
                'slug'         => $p->slugIn($default),
                // Posts are routed per language — postSlug() on the site.
                'translations' => ['slug' => collect(Locales::codes())->mapWithKeys(fn (string $c) => [$c => $p->slugIn($c)])->all()],
            ];
        }
        foreach ($this->linkedConcerts->sortByDesc('date') as $c) {
            $out[] = [
                'type'  => 'concert',
                'id'    => $c->id,
                'title' => $title($c, 'name') ?: null,
                'slug'  => $c->slugIn($default) ?? 'concert-' . $c->id,
                'date'  => $c->date?->format('Y-m-d'),
                'venue' => $c->venue?->name,
            ];
        }
        foreach ($this->linkedReleases as $r) {
            $out[] = ['type' => 'release', 'id' => $r->id, 'title' => $title($r, 'title'), 'slug' => null];
        }
        foreach ($this->linkedShopItems->where('is_available', true) as $s) {
            $out[] = ['type' => 'shop_item', 'id' => $s->id, 'title' => $s->name, 'slug' => $s->slugIn($default)];
        }

        return $out;
    }
}
