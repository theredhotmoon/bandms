<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Spatie\Translatable\HasTranslations;

class WebsiteModule extends Model
{
    use HasTranslations;

    public array $translatable = ['custom_name', 'custom_slug'];

    protected $fillable = ['slug', 'display_name', 'custom_name', 'custom_slug', 'enabled', 'sort_order', 'per_page', 'settings'];

    protected $casts = [
        'enabled'    => 'boolean',
        'sort_order' => 'integer',
        'per_page'   => 'integer',
        'settings'   => 'array',
    ];
}
