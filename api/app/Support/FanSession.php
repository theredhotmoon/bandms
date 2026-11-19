<?php

namespace App\Support;

use App\Models\FanAccount;
use Illuminate\Http\Request;

/**
 * Resolves the fan behind a request's Bearer token, or null.
 *
 * FanAuth aborts with 401 when there is none; the public comments list must
 * not — a stale token in a visitor's browser is an anonymous reader, not an
 * error. Both go through here so "what is a valid fan session" has one answer.
 */
class FanSession
{
    public static function fan(Request $request): ?FanAccount
    {
        $token = $request->bearerToken();
        if (! is_string($token) || $token === '') {
            return null;
        }

        $fanId = cache()->get("fan_session:{$token}");

        return $fanId ? FanAccount::find($fanId) : null;
    }
}
