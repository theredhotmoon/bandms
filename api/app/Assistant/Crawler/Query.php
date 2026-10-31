<?php

namespace App\Assistant\Crawler;

/** One request a source will spend a unit of its cap on. */
final readonly class Query
{
    /**
     * @param  string|null  $country  ISO code the query targets; findings inherit it
     * @param  string|null  $kind     the finding kind this query looks for (mention|news|lead)
     * @param  array<string, mixed>  $params  source-specific extras
     */
    public function __construct(
        public string $text,
        public ?string $country = null,
        public ?string $kind = null,
        public array $params = [],
    ) {}
}
