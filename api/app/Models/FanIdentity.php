<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\UniqueConstraintViolationException;

/** One Google or Facebook account linked to a fan. */
class FanIdentity extends Model
{
    protected $fillable = ['fan_account_id', 'provider', 'provider_user_id'];

    public function fan()
    {
        return $this->belongsTo(FanAccount::class, 'fan_account_id');
    }

    /** The link with exactly this id — never one the collation merely calls equal (see FanEmail). */
    public static function findLinked(string $provider, string $id): ?self
    {
        return self::where('provider', $provider)->where('provider_user_id', $id)->get()
            ->first(fn (self $identity) => $identity->provider_user_id === $id);
    }

    /**
     * Link to the fan — unless it is linked already, and then it stays where it is:
     * the caller must look at whose it is. Null when a lookalike id holds the key.
     */
    public static function linkTo(FanAccount $fan, string $provider, string $id): ?self
    {
        if ($identity = self::findLinked($provider, $id)) {
            return $identity;
        }

        try {
            return self::create(['fan_account_id' => $fan->id, 'provider' => $provider, 'provider_user_id' => $id]);
        } catch (UniqueConstraintViolationException) {
            return self::findLinked($provider, $id);
        }
    }
}
