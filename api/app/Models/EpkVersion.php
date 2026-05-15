<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EpkVersion extends Model
{
    protected $fillable = ['version_number', 'release_reason', 'snapshot', 'status', 'published_at'];

    protected $casts = [
        'published_at' => 'datetime',
        'snapshot'     => 'array',
    ];
}
