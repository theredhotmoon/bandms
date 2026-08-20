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
        $token = $request->bearerToken();
        abort_unless($token, 401, 'Unauthenticated.');

        $fanId = cache()->get("fan_session:{$token}");
        abort_unless($fanId, 401, 'Invalid or expired session.');

        $fan = FanAccount::find($fanId);
        abort_unless($fan, 401, 'Fan account not found.');

        $request->attributes->set('fan', $fan);
        return $next($request);
    }
}
