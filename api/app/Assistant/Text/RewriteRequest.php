<?php

namespace App\Assistant\Text;

/**
 * One rewrite: the text, its format and language, the mode, the field it
 * came from (for style examples) and the length the field can hold.
 * `examples` are the band's own recent texts of that field — StyleExamples.
 */
final readonly class RewriteRequest
{
    public const FORMATS = ['text', 'html'];

    /** @param string[] $examples */
    public function __construct(
        public string $text,
        public string $format,
        public string $locale,
        public RewriteMode $mode,
        public string $fieldKey,
        public int $maxLength,
        public array $examples = [],
    ) {}
}
