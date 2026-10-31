<?php

namespace App\Http\Middleware;

use App\Support\Activity\ActivityRecorder;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Gives the activity log its request: who, which route, which record.
 *
 * Model writes are itemised by the global Eloquent listener whatever the
 * route; this middleware adds the action row for authenticated writes that
 * itemise nothing (a pivot sync, a query-builder delete) and names the record
 * the route was about. Reads are never logged.
 */
class RecordActivity
{
    private const MUTATING = ['POST', 'PUT', 'PATCH', 'DELETE'];

    /** POSTs that compute rather than change (a translation, a rewrite). */
    private const READ_ONLY_PREFIX = 'api.admin.assistant.';

    public function __construct(private readonly ActivityRecorder $recorder) {}

    public function handle(Request $request, Closure $next): Response
    {
        $this->recorder->forRequest($request);

        $response = $next($request);

        if (in_array($request->method(), self::MUTATING, true)
            && $response->isSuccessful()
            && !str_starts_with((string) $request->route()?->getName(), self::READ_ONLY_PREFIX)) {
            $this->recorder->finishRequest($request);
        }

        return $response;
    }
}
