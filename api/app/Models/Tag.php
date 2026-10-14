<?php

namespace App\Models;

use App\Support\Locales;
use App\Traits\HasTranslatedSlug;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Spatie\Translatable\HasTranslations;

class Tag extends Model
{
    use HasFactory, HasTranslatedSlug, HasTranslations;

    public array $translatable = ['name', 'slug'];

    protected $fillable = ['name', 'slug'];

    /**
     * The name in every registered locale, blank as null: what the admin
     * reads to name a tag in the band's first content language. One shape
     * for every embed, so a hand-built one cannot drift from TagResource.
     *
     * @return array<string, string|null>
     */
    public function nameBag(): array
    {
        $names = $this->getTranslations('name');

        return collect(Locales::codes())
            ->mapWithKeys(fn (string $code) => [$code => ($names[$code] ?? null) ?: null])
            ->all();
    }

    public function posts(): BelongsToMany
    {
        return $this->belongsToMany(Post::class, 'post_tag');
    }

    public function photos(): BelongsToMany
    {
        return $this->belongsToMany(Photo::class, 'photo_tag');
    }

    public function bands(): BelongsToMany
    {
        return $this->belongsToMany(Band::class, 'band_tag');
    }

    public function venues(): BelongsToMany
    {
        return $this->belongsToMany(Venue::class, 'venue_tag');
    }

    public function concerts(): BelongsToMany
    {
        return $this->belongsToMany(Concert::class, 'concert_tag');
    }

    public function shopItems(): BelongsToMany
    {
        return $this->belongsToMany(ShopItem::class, 'shop_item_tag');
    }
}
