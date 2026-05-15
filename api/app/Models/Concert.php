<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Concert extends Model
{
    use HasFactory;

    protected $fillable = ['venue_id', 'date', 'doors_open', 'sound_check_time', 'start_time', 'own_sort_order', 'description', 'poster'];

    protected function casts(): array
    {
        return [
            'date'           => 'date:Y-m-d',
            'own_sort_order' => 'integer',
        ];
    }

    public function venue(): BelongsTo
    {
        return $this->belongsTo(Venue::class);
    }

    public function bands(): BelongsToMany
    {
        return $this->belongsToMany(Band::class, 'concert_band')
            ->withPivot(['sort_order', 'play_time'])
            ->orderByPivot('sort_order');
    }

    public function photos(): HasMany
    {
        return $this->hasMany(Photo::class);
    }

    public function tours(): BelongsToMany
    {
        return $this->belongsToMany(Tour::class, 'concert_tour');
    }

    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class, 'concert_tag');
    }

    public function links(): HasMany
    {
        return $this->hasMany(ConcertLink::class)->orderBy('id');
    }
}
