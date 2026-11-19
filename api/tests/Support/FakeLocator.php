<?php

namespace Tests\Support;

use App\Support\Geo\Locator;
use App\Support\Geo\Point;

/** The geo lookup in tests: answers a fixed point (or none). Nothing reads a database file. */
final class FakeLocator implements Locator
{
    public function __construct(private ?Point $point = null, private bool $available = true) {}

    public function locate(string $ip): ?Point
    {
        return $this->point;
    }

    public function available(): bool
    {
        return $this->available;
    }
}
