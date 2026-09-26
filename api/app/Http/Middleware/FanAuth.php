<?php

namespace App\Http\Middleware;

use App\Models\FanAccount;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class FanAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        // These three reach a fan verbatim: utils/fanErrors.ts prints any 4xx
        // message the server wrote, so an English literal here lands under
        // Polish chrome — the defect localizing TicketTransferController was
        // meant to close. A lapsed `fan_session:` entry is the ordinary way to
        // get here (they last 30 days, and a cache flush drops them early).
        //
        // The two session cases deliberately share one message. "Invalid or
        // expired session" and "Fan account not found" mean the same thing to
        // the person reading them — sign in again — and telling a caller which
        // of the two it was serves nobody but someone probing tokens.
        $token = $request->bearerToken();
        abort_unless($token, 401, __('api.unauthenticated'));

        $fanId = cache()->get("fan_session:{$token}");
        abort_unless($fanId, 401, __('api.fan.session_expired'));

        $fan = FanAccount::find($fanId);
        abort_unless($fan, 401, __('api.fan.session_expired'));

        $request->attributes->set('fan', $fan);
        return $next($request);
    }
}
