<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * For routes only the public-site build may call: it reaches the backend
 * straight over the Docker network (`http://backend`), while every outside
 * request arrives through Caddy, which always adds X-Forwarded-For. Caddy
 * also refuses `/api/internal/*` outright — this is the second lock, for a
 * Caddyfile that loses that block. A refused call is a 404, so the route
 * confirms nothing.
 */
class InternalOnly
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->headers->has('X-Forwarded-For') || $request->headers->has('X-Forwarded-Host')) {
            abort(404);
        }

        return $next($request);
    }
}
