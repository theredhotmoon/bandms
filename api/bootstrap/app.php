<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Every request arrives through Caddy on a private Docker network, and
        // no other container publishes a port, so the proxy chain is trusted by
        // construction. Without this Laravel reads the proxy's container IP as
        // the client IP, which collapses the per-IP login throttle into a
        // single global bucket — one bot then locks out every real user — and
        // ignores X-Forwarded-Proto, so generated URLs go out as http.
        $middleware->trustProxies(at: '*');

        // There is no login page to send a guest to: the admin SPA renders its
        // sign-in form at the panel root on a 401 (see CLAUDE.md, "There is no
        // /login route"). Laravel's default is route('login'), and the
        // Authenticate middleware builds that URL itself — before any exception
        // renderer runs — so with the route gone every unauthenticated request
        // lacking `Accept: application/json` died with RouteNotFoundException.
        // Null means "no redirect"; the renderer below then answers 401 JSON.
        $middleware->redirectGuestsTo(fn () => null);

        $middleware->append(\App\Http\Middleware\SetLocale::class);
        $middleware->alias([
            'role'     => \App\Http\Middleware\RequireRole::class,
            'fan.auth' => \App\Http\Middleware\FanAuth::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Everything under /api is a JSON API, whatever the client's Accept
        // header says. Without this, a guest on an auth:api route who did not
        // send `Accept: application/json` got Laravel's redirect to
        // route('login') — a route that no longer exists — so the redirect
        // itself threw and the answer was a 500 instead of a 401. Validation
        // failures had the same split: a 302 back instead of a 422 body.
        $exceptions->shouldRenderJsonWhen(
            fn ($request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
