<?php

namespace App\Http\Requests\Concerns;

use App\Support\EmbedProvider;
use App\Support\PostBlockType;
use Closure;
use Illuminate\Validation\Rule;

trait PostRules
{
    /**
     * Title, intro and at least one tag are required for every post, drafts
     * included — a draft is still the record the band publishes later, and a
     * post with no intro or tag left holes in the news list and its filter.
     *
     * `$sometimes` is the update verb: a partial PUT may leave them out, but
     * may not send them blank.
     */
    protected function requiredContentRules(bool $sometimes = false): array
    {
        // An array of rules, not a pipe string: the closure cannot be piped.
        $presence = $sometimes ? ['sometimes', 'required'] : ['required'];

        return [
            'title'   => [...$presence, $this->someLocaleFilled()],
            'intro'   => [...$presence, $this->someLocaleFilled()],
            'tag_ids' => [...$presence, 'array', 'min:1'],
        ];
    }

    /**
     * A translated bag must hold text in at least one language. Laravel's
     * `required` passes {"en": null, "pl": null} — the array is not empty —
     * which is exactly what a form with every input blank sends.
     */
    private function someLocaleFilled(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) {
            $values = is_array($value) ? $value : [$value];
            $filled = collect($values)->contains(fn ($v) => is_string($v) && trim($v) !== '');
            if (! $filled) {
                $fail(__('validation.required', ['attribute' => $attribute]));
            }
        };
    }

    /**
     * Everything except the slug rules, which differ per verb. Cross-locale
     * slug uniqueness — the #83 check that lived here as slugCrossUniqueRule()
     * — is now HasTranslatedSlug::translatedSlugRules(), for every model.
     */
    protected function sharedRules(): array
    {
        return [
            'title.en'      => 'nullable|string|max:255',
            'title.pl'      => 'nullable|string|max:255',
            'intro.en'      => 'nullable|string|max:1000',
            'intro.pl'      => 'nullable|string|max:1000',
            // A path returned by POST /api/posts/image, never a data URL (the
            // column held base64 until Oct 2026) and never a path into
            // another folder — the controller deletes whatever path it replaces.
            'image'         => ['nullable', 'string', 'max:255', 'regex:#^post-images/[A-Za-z0-9_-]+\.(jpe?g|png|gif|webp)$#i'],
            'published_at'  => 'nullable|date',
            'event_date_display' => ['nullable', Rule::in(['range', 'list'])],
            'tag_ids.*'     => 'integer|exists:tags,id',
            'concert_ids'   => 'nullable|array',
            'concert_ids.*' => 'integer|exists:concerts,id',
            'member_ids'    => 'nullable|array',
            'member_ids.*'  => 'integer|distinct|exists:band_members,id',

            'blocks'                    => 'nullable|array',
            'blocks.*.type'             => ['required', Rule::in(PostBlockType::ALL)],
            'blocks.*.payload'          => 'required|array',
            'blocks.*.payload.body.en'  => 'nullable|string',
            'blocks.*.payload.body.pl'  => 'nullable|string',
            'blocks.*.payload.alt.en'   => 'nullable|string|max:255',
            'blocks.*.payload.alt.pl'   => 'nullable|string|max:255',
            'blocks.*.payload.caption.en' => 'nullable|string|max:500',
            'blocks.*.payload.caption.pl' => 'nullable|string|max:500',
            'blocks.*.payload.label.en' => 'nullable|string|max:255',
            'blocks.*.payload.label.pl' => 'nullable|string|max:255',
            // Stamped by normaliseBlocks() in prepareForValidation(), not sent
            // by the client — but FormRequest::validated() drops any key that
            // has no rule naming it, merged input included.
            'blocks.*.payload.provider' => ['nullable', Rule::in(EmbedProvider::PROVIDERS)],
        ];
    }

    /**
     * Per-type payload rules, which Laravel's flat `blocks.*` syntax cannot
     * express — the required fields depend on each row's own `type`.
     */
    protected function blockPayloadRules(array $blocks): array
    {
        $rules = [];

        foreach ($blocks as $i => $block) {
            $rules += match ($block['type'] ?? null) {
                PostBlockType::IMAGE => ["blocks.{$i}.payload.path" => 'required|string|max:2048'],
                PostBlockType::EMBED => ["blocks.{$i}.payload.url"  => 'required|string|url|max:2048'],
                PostBlockType::REF   => [
                    "blocks.{$i}.payload.entity" => ['required', Rule::in(PostBlockType::REF_ENTITIES)],
                    "blocks.{$i}.payload.id"     => 'required|integer|min:1',
                ],
                PostBlockType::TEXT  => ["blocks.{$i}.payload.body" => 'required|array'],
                default              => [],
            };
        }

        return $rules;
    }

    /** Stamp the detected provider onto every embed block before validation. */
    protected function normaliseBlocks(array $blocks): array
    {
        foreach ($blocks as $i => $block) {
            if (($block['type'] ?? null) === PostBlockType::EMBED && isset($block['payload']['url'])) {
                $blocks[$i]['payload']['provider'] = EmbedProvider::detect($block['payload']['url']);
            }
        }

        return $blocks;
    }
}
