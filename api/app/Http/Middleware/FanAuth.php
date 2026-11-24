<?php

namespace App\Http\Middleware;

use App\Support\FanSession;
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
        // meant to close. A lapsed session is the ordinary way to get here:
        // sessions are `fan_sessions` rows that expire after 180 days without
        // use, and a password change deletes a fan's other ones.
        //
        // The two session cases deliberately share one message. "Invalid or
        // expired session" and "Fan account not found" mean the same thing to
        // the person reading them — sign in again — and telling a caller which
        // of the two it was serves nobody but someone probing tokens.
        $token = $request->bearerToken();
        abort_unless($token, 401, __('api.unauthenticated'));

        $row = FanSession::current($request);
        abort_unless($row, 401, __('api.fan.session_expired'));

        $request->attributes->set('fan', $row->fan);
        $request->attributes->set('fan_session', $row);
        return $next($request);
    }
}
