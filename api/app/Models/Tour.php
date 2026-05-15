<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Tour extends Model
{
    protected $fillable = ['name', 'description', 'start_date', 'end_date', 'poster'];

    protected $casts = [
        'start_date' => 'date:Y-m-d',
        'end_date'   => 'date:Y-m-d',
    ];

    public function concerts(): BelongsToMany
    {
        return $this->belongsToMany(Concert::class, 'concert_tour')
            ->orderBy('date');
    }

    public function images(): HasMany
    {
        return $this->hasMany(TourImage::class)->orderBy('sort_order')->orderBy('id');
    }

    public function links(): HasMany
    {
        return $this->hasMany(TourLink::class);
    }
}
