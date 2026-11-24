<?php

namespace App\Models;

use App\Support\FanEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Log;

class FanAccount extends Model
{
    use HasFactory;

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

    /** The account with exactly this address — never one the collation merely calls equal (see FanEmail). */
    public static function findByEmail(string $email): ?self
    {
        return self::where('email', FanEmail::normalise($email))->get()
            ->first(fn (self $fan) => FanEmail::same($fan->email, $email));
    }

    /**
     * The account for an address, made if there is none.
     *
     * Null when a *different* address holds the unique key because the collation
     * folds the two together: no account can be made, and the one there is
     * belongs to someone else. The caller answers as usual and does nothing.
     */
    public static function findOrCreateByEmail(string $email, ?string $name = null): ?self
    {
        if ($fan = self::findByEmail($email)) {
            return $fan;
        }

        $email = FanEmail::normalise($email);

        try {
            return self::create(['email' => $email, 'name' => $name ?? explode('@', $email)[0]]);
        } catch (UniqueConstraintViolationException) {
            // A parallel first request for this address won, or a lookalike is in the way.
            if ($fan = self::findByEmail($email)) {
                return $fan;
            }
            Log::warning('Fan sign-up refused: the address collates equal to that of fan ' . self::where('email', $email)->value('id'));

            return null;
        }
    }

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
