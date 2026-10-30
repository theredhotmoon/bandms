<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Passport\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'first_name',
        'last_name',
        'email',
        'password',
        'role',
        'band_member_id',
        'is_superadmin',
        'can_translate',
        'can_enhance',
    ];

    /** Mirrors the column defaults, so a just-created model reports them too. */
    protected $attributes = [
        'is_superadmin' => false,
        'can_translate' => false,
        'can_enhance'   => false,
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password'          => 'hashed',
            'is_superadmin'     => 'boolean',
            'can_translate'     => 'boolean',
            'can_enhance'       => 'boolean',
        ];
    }

    /** Superadmins always may; everyone else only what a superadmin switched on. */
    public function mayTranslate(): bool { return (bool) ($this->is_superadmin || $this->can_translate); }

    public function mayEnhance(): bool { return (bool) ($this->is_superadmin || $this->can_enhance); }

    public function bandMember(): BelongsTo
    {
        return $this->belongsTo(BandMember::class);
    }

    public function isAdmin(): bool    { return $this->role === 'admin'; }
    public function isMember(): bool   { return $this->role === 'member'; }
    public function isPublisher(): bool { return $this->role === 'publisher'; }
}
