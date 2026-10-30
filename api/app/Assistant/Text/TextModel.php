<?php

namespace App\Assistant\Text;

/**
 * The language model behind Enhance (phase 2) and the crawler's triage
 * (phase 3). Deliberately not Translator: DeepL translates better and cheaper;
 * this one rewrites and classifies. Both methods exist from day one so phase
 * 3 does not change the interface under code already built on it.
 */
interface TextModel
{
    /** Driver name as reported to the admin: 'anthropic', 'none'. */
    public function name(): string;

    /**
     * The rewritten text, nothing else — same language, same facts.
     *
     * @throws TextModelUnavailable unconfigured, refused, too long, provider error
     */
    public function rewrite(RewriteRequest $request): string;

    /**
     * A JSON object matching $schema (the API's json_schema output format),
     * decoded. `$model` lets a caller pick a cheaper model than the default.
     *
     * @throws TextModelUnavailable
     */
    public function structured(string $system, string $user, array $schema, ?string $model = null): array;
}
