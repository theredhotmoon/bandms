<?php

namespace App\Support\Geo;

final class Point
{
    public function __construct(public readonly float $lat, public readonly float $lng) {}
}
