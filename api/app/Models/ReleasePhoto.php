<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReleasePhoto extends Model
{
    protected $fillable = ['release_id', 'image', 'sort_order', 'caption'];

    public function release(): BelongsTo
    {
        return $this->belongsTo(Release::class);
    }
}
