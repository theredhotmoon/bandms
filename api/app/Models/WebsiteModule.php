<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WebsiteModule extends Model
{
    protected $fillable = ['slug', 'display_name', 'enabled', 'sort_order'];

    protected $casts = [
        'enabled'    => 'boolean',
        'sort_order' => 'integer',
    ];
}
