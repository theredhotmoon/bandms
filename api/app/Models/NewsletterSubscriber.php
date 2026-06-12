<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NewsletterSubscriber extends Model
{
    protected $fillable = [
        'email',
        'name',
        'source',
        'subscribed_at',
        'confirmation_token',
        'unsubscribe_token',
        'confirmed_at',
    ];

    protected $casts = [
        'subscribed_at' => 'datetime',
        'confirmed_at'  => 'datetime',
    ];

    public function isConfirmed(): bool
    {
        return $this->confirmed_at !== null;
    }
}
