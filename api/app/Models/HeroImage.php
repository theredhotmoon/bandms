<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HeroImage extends Model
{
    protected $fillable = ['scope', 'image', 'caption', 'position', 'active'];

    protected $casts = [
        'position' => 'integer',
        'active'   => 'boolean',
    ];

    /**
     * Scopes that exist without a website_modules row behind them.
     *
     * The homepage is not a module, so a nullable "means main" column would
     * still have needed a second reserved name. Two explicit strings read
     * better than one null with two meanings.
     */
    public const RESERVED_SCOPES = ['main', 'home'];

    /**
     * Every scope a hero set may be saved under, resolved against live modules.
     *
     * Reading the table rather than a hardcoded list means adding a website
     * module makes it a hero scope with no code change — and a *disabled*
     * module stays valid, because switching a section off must not make its
     * pictures unsavable.
     *
     * @return array<int, string>
     */
    public static function allowedScopes(): array
    {
        return array_merge(self::RESERVED_SCOPES, WebsiteModule::pluck('slug')->all());
    }
}
