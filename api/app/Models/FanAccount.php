<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FanAccount extends Model
{
    protected $fillable = [
        'email', 'name', 'display_name', 'comments_blocked_at', 'password_hash',
        'email_verified_at', 'newsletter_subscribed',
    ];

    protected $hidden = ['password_hash', 'remember_token'];

    protected $casts = [
        'email_verified_at'     => 'datetime',
        'comments_blocked_at'   => 'datetime',
        'newsletter_subscribed' => 'boolean',
    ];

    public function tickets()
    {
        return $this->hasMany(Ticket::class);
    }

    public function comments()
    {
        return $this->hasMany(PostComment::class);
    }

    public function isCommentBlocked(): bool
    {
        return $this->comments_blocked_at !== null;
    }
}
