<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FanSessionRow extends Model
{
    protected $table = 'fan_sessions';

    public const UPDATED_AT = null;

    protected $fillable = ['fan_account_id', 'token_hash', 'method', 'created_at', 'last_used_at', 'expires_at'];

    protected $casts = [
        'last_used_at' => 'datetime',
        'expires_at'   => 'datetime',
    ];

    public function fan()
    {
        return $this->belongsTo(FanAccount::class, 'fan_account_id');
    }
}
