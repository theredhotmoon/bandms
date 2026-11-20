<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Lets only a superadmin through. Stack it inside `role:admin` — a superadmin
 * is always an admin (UserController enforces that), so the role check runs
 * first and this one narrows it.
 *
 * Usage in routes:  ->middleware('superadmin')
 */
class RequireSuperadmin
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user()?->is_superadmin) {
            return response()->json(['message' => 'Only a superadmin can do this.'], 403);
        }

        return $next($request);
    }
}
