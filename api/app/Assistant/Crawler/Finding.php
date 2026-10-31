<?php

namespace App\Assistant\Crawler;

/**
 * What a source hands back for one item: a pointer, a title, a short snippet
 * and the source's own id — never a page body. `payload` is the source's raw
 * record, trimmed to what triage and the inbox need.
 */
final readonly class Finding
{
    public function __construct(
        public string $kind,
        public string $externalKey,
        public string $url,
        public string $title,
        public string $snippet,
        public ?string $country,
        public ?string $leadType,
        public array $payload = [],
    ) {}
}
