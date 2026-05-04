<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PostLink extends Model
{
    use HasFactory;

    protected $fillable = ['post_id', 'type', 'url', 'label', 'sort_order'];

    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }
}
