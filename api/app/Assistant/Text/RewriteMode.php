<?php

namespace App\Assistant\Text;

/**
 * What the Enhance menu offers. Mirrored by app/src/utils/rewriteModes.ts,
 * pinned by its spec (which reads this file) — add a case in both places.
 * The prompt fragment per mode is added in RewritePrompt's task.
 */
enum RewriteMode: string
{
    case Flow     = 'flow';
    case Punchier = 'punchier';
    case Shorter  = 'shorter';
    case Longer   = 'longer';
    case Press    = 'press';

    /** @return string[] */
    public static function values(): array
    {
        return array_map(fn (self $m) => $m->value, self::cases());
    }

    /** The prompt fragment for this mode — the one thing that differs between modes. */
    public function instruction(): string
    {
        return match ($this) {
            self::Flow     => 'Fix grammar, rhythm and clarity. Keep the meaning, every fact, the length (within 10%) and the tone.',
            self::Punchier => 'Keep every fact. More energy: shorter sentences, a stronger opening. Length within 20% of the original.',
            self::Shorter  => 'Keep every fact. About half the length: drop repetition and filler, never a fact.',
            self::Longer   => 'Keep every fact and add detail drawn only from the text itself — invent nothing. Up to twice the length.',
            self::Press    => 'Keep every fact. Third person, neutral press-release register: no exclamation marks, no "we" or "us".',
        };
    }
}
