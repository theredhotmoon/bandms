<?php

namespace App\Models;

use App\Models\Concerns\HasClips;
use App\Traits\HasTranslatedSlug;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphToMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Translatable\HasTranslations;

class Album extends Model
{
    use HasTranslatedSlug, HasTranslations, HasClips;

    /** Only the slug: an album's title is a plain string. */
    public array $translatable = ['slug'];

    protected $fillable = ['title', 'slug', 'description', 'venue_id', 'concert_id', 'taken_at', 'published_at'];

    protected function casts(): array
    {
        return [
            'taken_at'     => 'datetime',
            'published_at' => 'datetime',
        ];
    }

    public function venue(): BelongsTo
    {
        return $this->belongsTo(Venue::class);
    }

    public function concert(): BelongsTo
    {
        return $this->belongsTo(Concert::class);
    }

    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class, 'album_tag');
    }

    public function photos(): HasMany
    {
        return $this->hasMany(Photo::class)->orderBy('sort_order');
    }

    // ── What links to this album (albumables, see AlbumLinks) ───────────────

    public function linkedPosts(): MorphToMany
    {
        return $this->morphedByMany(Post::class, 'albumable');
    }

    public function linkedConcerts(): MorphToMany
    {
        return $this->morphedByMany(Concert::class, 'albumable');
    }

    public function linkedReleases(): MorphToMany
    {
        return $this->morphedByMany(Release::class, 'albumable');
    }

    public function linkedShopItems(): MorphToMany
    {
        return $this->morphedByMany(ShopItem::class, 'albumable');
    }

    /**
     * Albums the public site builds a page for: published, with at least one
     * photo that has a file. The Photos page has always hidden the rest — a
     * card that opens an empty album is worse than no card — so a link to
     * one from a post would be a link to a page that was never built.
     */
    public function scopeOnSite(Builder $query): Builder
    {
        return $query->whereNotNull('published_at')
            ->whereHas('photos', fn ($p) => $p->whereNotNull('image'));
    }

    /** The first photo with a file, in the album's order — a card's cover. */
    public function coverPhoto(): HasOne
    {
        return $this->hasOne(Photo::class)->ofMany(
            ['sort_order' => 'min', 'id' => 'min'],
            fn ($q) => $q->whereNotNull('image'),
        );
    }

    /**
     * What a card and isOnSite() need, without loading every photo: the
     * count of photos with a file (`site_photos_count`) and the cover.
     */
    public function scopeWithOnSiteCounts(Builder $query): Builder
    {
        return $query
            ->withCount(['photos as site_photos_count' => fn ($p) => $p->whereNotNull('image')])
            ->with('coverPhoto');
    }

    /** Photos with a file — from withOnSiteCounts() when loaded, else from `photos`. */
    public function sitePhotoCount(): int
    {
        return $this->site_photos_count
            ?? $this->photos->filter(fn ($p) => $p->image !== null)->count();
    }

    /** scopeOnSite() for a loaded model. */
    public function isOnSite(): bool
    {
        return $this->published_at !== null && $this->sitePhotoCount() > 0;
    }
}
