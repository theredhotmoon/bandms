<?php

namespace App\Assistant\Translation;

/**
 * Bound when no translator is configured. `capabilities` reports translate
 * off for this driver, so the admin never renders a button that would reach
 * translate() — the 503 here is for a direct call, not a UI state.
 */
final class NullTranslator implements Translator
{
    public function name(): string
    {
        return 'none';
    }

    public function translate(array $items): array
    {
        throw new TranslatorUnavailable('Translation is not configured on this server.');
    }
}
