<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;


class Venue extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'street', 'street_number', 'city', 'postcode', 'additional_info', 'capacity', 'latitude', 'longitude'];

    protected function casts(): array
    {
        return [
            'latitude'  => 'float',
            'longitude' => 'float',
            'capacity'  => 'integer',
        ];
    }

    public function concerts(): HasMany
    {
        return $this->hasMany(Concert::class);
    }

    public function photos(): HasMany
    {
        return $this->hasMany(Photo::class);
    }

    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class, 'venue_tag');
    }

    public function socialLinks(): HasMany
    {
        return $this->hasMany(SocialLink::class, 'venue_id');
    }
}
