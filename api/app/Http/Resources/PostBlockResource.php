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
                'provider' => $payload['provider'] ?? 'link',
                'url'      => $payload['url'] ?? null,
                'label'    => $payload['label'] ?? null,
                'embed_id' => isset($payload['url']) ? EmbedProvider::embedId($payload['url']) : null,
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
