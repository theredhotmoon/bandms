<?php

namespace App\Http\Requests\Concerns;

use App\Support\EmbedProvider;
use App\Support\PostBlockType;
use Illuminate\Validation\Rule;

trait PostRules
{
    /** Everything except the slug uniqueness rule, which differs per verb. */
    protected function sharedRules(): array
    {
        return [
            'title.en'      => 'nullable|string|max:255',
            'title.pl'      => 'nullable|string|max:255',
            'intro'         => 'nullable',
            'intro.en'      => 'nullable|string|max:1000',
            'intro.pl'      => 'nullable|string|max:1000',
            'image'         => ['nullable', 'string', 'regex:/^data:image\/(jpeg|jpg|png|gif|webp);base64,/'],
            'published_at'  => 'nullable|date',
            'event_date'    => 'nullable|date',
            'tag_ids'       => 'nullable|array',
            'tag_ids.*'     => 'integer|exists:tags,id',

            'blocks'                    => 'nullable|array',
            'blocks.*.type'             => ['required', Rule::in(PostBlockType::ALL)],
            'blocks.*.payload'          => 'required|array',
            'blocks.*.payload.body.en'  => 'nullable|string',
            'blocks.*.payload.body.pl'  => 'nullable|string',
            'blocks.*.payload.alt.en'   => 'nullable|string|max:255',
            'blocks.*.payload.alt.pl'   => 'nullable|string|max:255',
            'blocks.*.payload.caption.en' => 'nullable|string|max:500',
            'blocks.*.payload.caption.pl' => 'nullable|string|max:500',
            'blocks.*.payload.label'    => 'nullable|string|max:255',
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
