<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FanAccount extends Model
{
    protected $fillable = [
        'email', 'name', 'password_hash',
        'email_verified_at', 'newsletter_subscribed',
    ];

    protected $hidden = ['password_hash', 'remember_token'];

    protected $casts = [
        'email_verified_at'     => 'datetime',
        'newsletter_subscribed' => 'boolean',
    ];

    public function tickets()
    {
        return $this->hasMany(Ticket::class);
    }
}
