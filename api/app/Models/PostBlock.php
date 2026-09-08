<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PostBlock extends Model
{
    use HasFactory;

    protected $fillable = ['post_id', 'position', 'type', 'payload'];

    protected function casts(): array
    {
        return [
            'payload'  => 'array',
            'position' => 'integer',
        ];
    }

    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }
}
