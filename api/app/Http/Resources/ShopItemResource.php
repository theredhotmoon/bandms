<?php

namespace App\Http\Resources;

use App\Http\Resources\ShopItemVariantResource;
use App\Support\Locales;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ShopItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'               => $this->id,
            'name'             => $this->name,
            // The default locale's slug: what every public merch URL is built
            // from, in every language (it was slug_en — same value).
            'slug'             => $this->slugIn(Locales::default()),
            'translations'     => [
                'slug' => collect(Locales::codes())->mapWithKeys(fn (string $c) => [$c => $this->slugIn($c)])->all(),
            ],
            'type'             => $this->type,
            'description'      => $this->description,
            'is_available'     => $this->is_available,
            'is_presale'       => $this->is_presale,
            'presale_ships_at' => $this->presale_ships_at?->format('Y-m-d'),
            'stock_quantity'   => $this->stock_quantity,
            'purchase_url'     => $this->purchase_url,
            'sort_order'       => $this->sort_order,
            'prices'           => $this->prices->map(fn ($p) => [
                'currency' => $p->currency,
                'amount'   => (float) $p->amount,
            ])->values(),
            'photos'           => $this->photos->map(fn ($p) => [
                'id'        => $p->id,
                'url'       => '/storage/' . $p->image,
                'alt_text'  => $p->alt_text,
                'sort_order'=> $p->sort_order,
            ])->values(),
            'tags'             => $this->tags->map(fn ($t) => [
                'id'      => $t->id,
                'name'    => Locales::resolve($t->getTranslations('name')) ?? '',
                'slug'    => $t->slugIn(Locales::default()),
            ])->values(),
            'release_ids'      => $this->releases->pluck('id')->values(),
            'concert_ids'      => $this->concerts->pluck('id')->values(),
            'post_ids'         => $this->posts->pluck('id')->values(),
            'video_ids'        => $this->videos->pluck('id')->values(),
            'category_ids'     => $this->categories->pluck('id')->values(),
            // The public shop detail page renders category names. It only ever
            // received ids, so `item.categories` was undefined and reading
            // .length off it aborted the whole Astro build.
            'categories'       => $this->categories->map(fn ($c) => [
                'id'   => $c->id,
                'name' => $c->name,
                'slug' => $c->slug,
            ])->values(),
            'variants'         => ShopItemVariantResource::collection($this->whenLoaded('variants')),
            'clips'            => ClipResource::collection($this->whenLoaded('clips')),
            'created_at'       => $this->created_at,
            'updated_at'       => $this->updated_at,
        ];
    }
}
