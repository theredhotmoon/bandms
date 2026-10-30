<?php

namespace App\Assistant\Translation;

/**
 * A machine-translation provider behind the admin's Translate button.
 *
 * Deliberately separate from the (phase 2) text model: DeepL/Google translate
 * better and cheaper than any LLM at this volume, and an LLM rewrites and
 * summarises, which they cannot. AssistantServiceProvider binds the driver
 * named in config/assistant.php, or NullTranslator when nothing is set up.
 */
interface Translator
{
    /** Driver name as reported to the admin: 'deepl', 'none'. */
    public function name(): string;

    /**
     * Translate every item, all-or-nothing. Partial success is the client's
     * concern — it sends one request per form field for exactly that reason.
     *
     * @param  TranslationItem[]  $items
     * @return array<string, string>  item key => translated text
     *
     * @throws TranslatorUnavailable when the provider is unconfigured, out of
     *         quota, or refuses the key — carrying a message fit for a toast.
     */
    public function translate(array $items): array;
}
