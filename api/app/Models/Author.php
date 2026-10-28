<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use LogicException;

class Author extends Model
{
    protected $fillable = [
        'first_name', 'last_name', 'email', 'facebook', 'instagram', 'whatsapp', 'phone', 'country', 'contact_language', 'notes',
    ];

    /**
     * "First Last", read-only. The API still sends `name`, so every list,
     * picker and search that only displays a contact needs no change.
     *
     * Writing it throws: there is no `name` column, and guessing a split would
     * undo one the band corrected by hand. (`Author::create(['name' => …])`
     * never reaches here — `name` is not fillable — and fails on the NOT NULL
     * `first_name` instead.)
     */
    protected function name(): Attribute
    {
        return Attribute::make(
            get: fn () => trim("{$this->first_name} {$this->last_name}"),
            set: fn () => throw new LogicException('Author has no name column; set first_name and last_name.'),
        );
    }

    /** One display order for every author list — the contacts page and the band picker. */
    public function scopeOrderByName(Builder $query): void
    {
        $query->orderBy('authors.first_name')->orderBy('authors.last_name');
    }

    public function pressReleases(): BelongsToMany
    {
        return $this->belongsToMany(PressRelease::class, 'author_press_releases');
    }

    public function concerts(): BelongsToMany
    {
        return $this->belongsToMany(Concert::class, 'author_concerts');
    }

    public function tours(): BelongsToMany
    {
        return $this->belongsToMany(Tour::class, 'author_tours');
    }

    public function photos(): BelongsToMany
    {
        return $this->belongsToMany(Photo::class, 'author_photos');
    }

    public function bands(): BelongsToMany
    {
        return $this->belongsToMany(Band::class, 'author_bands')->orderBy('bands.name');
    }

    public function socialLinks(): HasMany
    {
        return $this->hasMany(SocialLink::class, 'author_id')->orderBy('position');
    }
}
