<?php

namespace App\Assistant\Text;

/**
 * Bound when no text model is configured. `capabilities` reports rewrite
 * off for this driver, so the admin never renders a control that would
 * reach these methods — the 503 is for a direct call, not a UI state.
 */
final class NullTextModel implements TextModel
{
    public function name(): string
    {
        return 'none';
    }

    public function rewrite(RewriteRequest $request): string
    {
        throw new TextModelUnavailable('The writing assistant is not configured on this server.');
    }

    public function structured(string $system, string $user, array $schema, ?string $model = null): array
    {
        throw new TextModelUnavailable('The writing assistant is not configured on this server.');
    }
}
