<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Band extends Model
{
    use HasFactory;

    protected $fillable = ['name'];

    public function concerts(): BelongsToMany
    {
        return $this->belongsToMany(Concert::class, 'concert_band');
    }
}
