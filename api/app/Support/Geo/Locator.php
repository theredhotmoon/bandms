<?php

namespace App\Support\Geo;

/** Places a request IP on the map. Never returns or logs more than a Point. */
interface Locator
{
    /** Null for a private, unknown or unlookupable address — callers fail open. */
    public function locate(string $ip): ?Point;

    /** Whether a location database is installed at all. */
    public function available(): bool;
}
