<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Spatie\Translatable\HasTranslations;

class Faq extends Model
{
    use HasTranslations;

    public array $translatable = ['question', 'answer'];

    protected $fillable = ['module_slug', 'question', 'answer', 'sort_order', 'is_published'];

    protected $casts = [
        'sort_order'   => 'integer',
        'is_published' => 'boolean',
    ];
}
