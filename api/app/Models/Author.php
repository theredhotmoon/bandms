<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Author extends Model
{
    protected $fillable = [
        'name', 'email', 'facebook', 'instagram', 'whatsapp', 'phone', 'notes',
    ];

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
}
