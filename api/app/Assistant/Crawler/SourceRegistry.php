<?php

namespace App\Assistant\Crawler;

/** Every source the crawler knows, by key. Bound in AssistantServiceProvider. */
final class SourceRegistry
{
    /** @var array<string, Source> */
    private array $sources = [];

    /** @param iterable<Source> $sources */
    public function __construct(iterable $sources)
    {
        foreach ($sources as $source) {
            $this->sources[$source->key()] = $source;
        }
    }

    public function get(string $key): ?Source
    {
        return $this->sources[$key] ?? null;
    }

    /** @return string[] */
    public function keys(): array
    {
        return array_keys($this->sources);
    }
}
