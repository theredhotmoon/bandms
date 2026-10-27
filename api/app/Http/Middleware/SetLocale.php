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
        $preferred = $request->getPreferredLanguage($supported);
        $content   = $this->contentLocale($request);

        $locale = $request->query('lang')
            ?? $content
            ?? $preferred
            ?? $default;

        // An unregistered ?lang= degrades to the default rather than 404ing:
        // the Astro build fetches with a locale in the URL and a hard failure
        // there takes down every page, not one.
        app()->setLocale(is_string($locale) && Locales::isSupported($locale) ? $locale : $default);

        // The admin sends the band's content language as X-Content-Locale and
        // leaves Accept-Language as the person's own. Resources resolve
        // translated fields with app()->getLocale(); messages go through the
        // translator — so only the translator is handed back to the person,
        // and an English-UI editor on a Polish-first band gets Polish concert
        // names with English validation errors.
        if ($content !== null && $request->query('lang') === null) {
            app('translator')->setLocale($preferred ?? $default);
        }

        return $next($request);
    }

    /** X-Content-Locale when it names a registered locale; an unknown value is ignored. */
    private function contentLocale(Request $request): ?string
    {
        $header = $request->header('X-Content-Locale');

        return is_string($header) && Locales::isSupported($header) ? $header : null;
    }
}
