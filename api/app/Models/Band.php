<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Band extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'website'];

    public function concerts(): BelongsToMany
    {
        return $this->belongsToMany(Concert::class, 'concert_band');
    }

    /**
     * People to contact about this band — managers, bookers, the drummer who
     * answers their email. Shares the `authors` table with press contacts.
     */
    public function authors(): BelongsToMany
    {
        return $this->belongsToMany(Author::class, 'author_bands')->orderBy('name');
    }
}
