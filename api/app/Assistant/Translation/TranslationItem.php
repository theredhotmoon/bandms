<?php

namespace App\Assistant\Translation;

/**
 * One string to translate. `key` is the caller's handle for matching the
 * answer back (the admin uses "<field>.<locale>"); `format` tells the provider
 * whether to protect markup. Source and target are registry locale codes —
 * the driver maps them to its own codes through Locales::translationCode().
 */
final readonly class TranslationItem
{
    public const FORMATS = ['text', 'html'];

    public function __construct(
        public string $key,
        public string $text,
        public string $format,
        public string $source,
        public string $target,
    ) {}
}
