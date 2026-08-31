<?php

namespace App\Http\Middleware;

use App\Support\Locales;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SetLocale
{
    public function handle(Request $request, Closure $next): Response
    {
        $supported = Locales::codes();
        $default   = Locales::default();

        $locale = $request->query('lang')
            ?? $request->getPreferredLanguage($supported)
            ?? $default;

        // An unregistered ?lang= degrades to the default rather than 404ing:
        // the Astro build fetches with a locale in the URL and a hard failure
        // there takes down every page, not one.
        app()->setLocale(is_string($locale) && Locales::isSupported($locale) ? $locale : $default);

        return $next($request);
    }
}
