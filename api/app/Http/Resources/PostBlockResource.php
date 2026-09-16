<?php

namespace App\Http\Resources;

use App\Support\EmbedProvider;
use App\Support\PostBlockType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/**
 * One block, shaped for its type.
 *
 * `ref` blocks need their entity resolved, which must happen in batch — so the
 * caller passes a pre-built map from PostBlockResolver via `withResolved()`
 * rather than each resource fetching its own entity.
 */
class PostBlockResource extends JsonResource
{
    /** @var array<int, array|null> */
    private array $resolved = [];

    /** @param array<int, array|null> $resolved */
    public function withResolved(array $resolved): static
    {
        $this->resolved = $resolved;

        return $this;
    }

    public function toArray(Request $request): array
    {
        $locale  = app()->getLocale();
        $payload = $this->payload ?? [];

        $base = ['id' => $this->id, 'type' => $this->type, 'position' => $this->position];

        return match ($this->type) {
            PostBlockType::TEXT => $base + [
                'body'         => $this->translated($payload['body'] ?? [], $locale),
                'translations' => ['body' => $payload['body'] ?? ['en' => null, 'pl' => null]],
            ],

            PostBlockType::IMAGE => $base + [
                'path'         => $payload['path'] ?? null,
                'url'          => isset($payload['path']) ? Storage::url($payload['path']) : null,
                'alt'          => $this->translated($payload['alt'] ?? [], $locale),
                'caption'      => $this->translated($payload['caption'] ?? [], $locale),
                'translations' => [
                    'alt'     => $payload['alt'] ?? ['en' => null, 'pl' => null],
                    'caption' => $payload['caption'] ?? ['en' => null, 'pl' => null],
                ],
            ],

            PostBlockType::EMBED => $base + [
                'provider'     => $payload['provider'] ?? 'link',
                'url'          => $payload['url'] ?? null,
                'label'        => $this->translated($this->labelBag($payload), $locale),
                'embed_id'     => isset($payload['url']) ? EmbedProvider::embedId($payload['url']) : null,
                'translations' => ['label' => $this->labelBag($payload)],
            ],

            PostBlockType::REF => $base + [
                'entity' => $payload['entity'] ?? null,
                // null means the entity was deleted. Emitted rather than
                // omitted so the admin can show "missing item — remove?"; the
                // public dispatcher skips it.
                'data'   => $this->resolved[$this->id] ?? null,
            ],

            default => $base + ['payload' => $payload],
        };
    }

    /**
     * Normalises an embed's `label` to a {en, pl} bag regardless of what's
     * stored. New rows are always written as a bag (PostRules, the 2026-09-15
     * migration), but a rolled-back migration or a stale pre-deploy client
     * can still leave a legacy plain string here — coercing it up front, once,
     * keeps `translated()`'s strict array type hint safe and stops a raw
     * string reaching the admin editor's `translations.label`, where it would
     * be spread character-by-character into a corrupt payload on save.
     */
    private function labelBag(array $payload): array
    {
        $label = $payload['label'] ?? null;

        if (is_array($label)) {
            return $label;
        }

        return filled($label) ? ['en' => $label, 'pl' => null] : ['en' => null, 'pl' => null];
    }

    /** Resolve a {en, pl} bag for the request locale, falling back to the other. */
    private function translated(array $bag, string $locale): ?string
    {
        foreach (\App\Support\Locales::chain($locale) as $code) {
            if (filled($bag[$code] ?? null)) {
                return $bag[$code];
            }
        }

        return null;
    }
}
