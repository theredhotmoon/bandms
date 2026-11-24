<?php

namespace App\Support;

use App\Models\FanAccount;
use App\Models\FanSessionRow;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Resolves the fan behind a request's Bearer token, or null.
 *
 * FanAuth aborts with 401 when there is none; the public comments list must
 * not — a stale token in a visitor's browser is an anonymous reader, not an
 * error. Both go through here so "what is a valid fan session" has one answer.
 *
 * Sessions live in `fan_sessions`, keyed by the SHA-256 of the token so a
 * database leak does not hand out live sessions.
 */
class FanSession
{
    public const METHODS = ['link', 'password', 'google', 'facebook'];

    /** Open a session and return the raw token (shown once, never stored). */
    public static function open(FanAccount $fan, string $method): string
    {
        FanSessionRow::where('fan_account_id', $fan->id)
            ->where('expires_at', '<=', now())
            ->delete();

        $token = Str::random(64);

        FanSessionRow::create([
            'fan_account_id' => $fan->id,
            'token_hash'     => hash('sha256', $token),
            'method'         => $method,
            'last_used_at'   => now(),
            'expires_at'     => now()->addDays(config('fan_auth.session_days')),
        ]);

        return $token;
    }

    /** The row behind a raw token, for a response built right after open(). */
    public static function rowFor(string $token): ?FanSessionRow
    {
        return FanSessionRow::where('token_hash', hash('sha256', $token))->first();
    }

    public static function fan(Request $request): ?FanAccount
    {
        return self::current($request)?->fan;
    }

    public static function current(Request $request): ?FanSessionRow
    {
        $token = $request->bearerToken();
        if (! is_string($token) || $token === '') {
            return null;
        }

        $hash = hash('sha256', $token);
        $row  = FanSessionRow::where('token_hash', $hash)
            ->where('expires_at', '>', now())
            ->first();

        if (! $row) {
            $row = self::migrateLegacy($token, $hash);
        }
        if (! $row) {
            return null;
        }

        // Slide the expiry, but write at most once a day.
        if (! $row->last_used_at->isToday()) {
            $row->forceFill([
                'last_used_at' => now(),
                'expires_at'   => now()->addDays(config('fan_auth.session_days')),
            ])->save();
        }

        return $row;
    }

    public static function close(Request $request): void
    {
        $token = $request->bearerToken();
        if (! is_string($token) || $token === '') {
            return;
        }

        FanSessionRow::where('token_hash', hash('sha256', $token))->delete();
        cache()->forget("fan_session:{$token}");
    }

    /** Sign the fan out everywhere except `$keep`, legacy cache sessions included. */
    public static function revokeOthers(FanAccount $fan, ?FanSessionRow $keep): void
    {
        // The marker first: a legacy session moving into the table right now either
        // lands before the delete below, or finds the marker after its insert.
        cache()->put("fan_legacy_revoked:{$fan->id}", true, now()->addDays(31));

        FanSessionRow::where('fan_account_id', $fan->id)
            ->when($keep, fn ($q) => $q->where('id', '!=', $keep->id))
            ->delete();
    }

    /**
     * Sessions written before the table existed were cache entries
     * `fan_session:{token}` (30 days). Move one into the table on first use so
     * deploying signs nobody out.
     *
     * Removable 30 days after this ships (2026-11-24): by then every legacy
     * entry has expired on its own.
     */
    private static function migrateLegacy(string $token, string $hash): ?FanSessionRow
    {
        $fanId = cache()->get("fan_session:{$token}");
        if (! $fanId) {
            return null;
        }
        if (cache()->has("fan_legacy_revoked:{$fanId}")) {
            return null;
        }
        if (! FanAccount::whereKey($fanId)->exists()) {
            return null;
        }

        // Parallel requests carrying the same token all land here right after a
        // deploy: the insert must be idempotent, and the loser of a race on the
        // unique token_hash re-selects the winner's row instead of failing.
        $attributes = [
            'fan_account_id' => $fanId,
            'method'         => 'link',
            // Backdated: a migrated session must not look like a link opened a
            // moment ago, or it could change a password without the current one.
            'created_at'     => now()->subDays(30),
            'last_used_at'   => now(),
            'expires_at'     => now()->addDays(config('fan_auth.session_days')),
        ];
        try {
            $row = FanSessionRow::firstOrCreate(['token_hash' => $hash], $attributes);
        } catch (QueryException $e) {
            $row = FanSessionRow::where('token_hash', $hash)->first();
            if (! $row) {
                throw $e;
            }
        }
        if ($row->expires_at->isPast()) {
            return null;
        }
        // Revoked between the check above and the insert (see revokeOthers). Only a
        // row this request made: one already there may be the session that was kept.
        if ($row->wasRecentlyCreated && cache()->has("fan_legacy_revoked:{$fanId}")) {
            $row->delete();

            return null;
        }
        cache()->forget("fan_session:{$token}");

        return $row;
    }
}
