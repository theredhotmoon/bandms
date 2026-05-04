<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Venue extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'address', 'latitude', 'longitude'];

    protected function casts(): array
    {
        return [
            'latitude'  => 'float',
            'longitude' => 'float',
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
}
