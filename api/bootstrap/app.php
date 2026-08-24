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

        $middleware->append(\App\Http\Middleware\SetLocale::class);
        $middleware->alias([
            'role'     => \App\Http\Middleware\RequireRole::class,
            'fan.auth' => \App\Http\Middleware\FanAuth::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
