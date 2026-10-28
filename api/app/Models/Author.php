<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Author extends Model
{
    protected $fillable = [
        'first_name', 'last_name', 'email', 'facebook', 'instagram', 'whatsapp', 'phone', 'country', 'contact_language', 'notes',
    ];

    /**
     * "First Last". The API still sends `name`, so every list, picker and
     * search that only displays a contact needs no change. There is no `name`
     * column: writing one splits it, rather than failing at save time with an
     * unknown column.
     */
    protected function name(): Attribute
    {
        return Attribute::make(
            get: fn () => trim("{$this->first_name} {$this->last_name}"),
            set: fn (?string $value) => static::splitName((string) $value),
        );
    }

    /**
     * First word is the first name, the rest the last name. ASCII whitespace
     * only, without /u, so invalid UTF-8 cannot make the split return false.
     *
     * @return array{first_name: string, last_name: ?string}
     */
    public static function splitName(string $name): array
    {
        $parts = preg_split('/\s+/', trim($name), 2);

        return ['first_name' => $parts[0], 'last_name' => $parts[1] ?? null];
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
