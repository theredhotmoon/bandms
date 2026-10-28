<?php

namespace App\Http\Resources;

use App\Support\Locales;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

class PostSummaryResource extends JsonResource
{
    /** Request attribute set by PostController::adminIndex. */
    public const ADMIN_LIST = 'post_admin_list';

    public function toArray(Request $request): array
    {
        // content is gone; the excerpt now comes from the first text block, and
        // falls back to intro. It feeds <meta description> and the JSON-LD on
        // both article routes, so it cannot simply be dropped.
        $firstText = $this->relationLoaded('blocks')
            ? $this->blocks->firstWhere('type', 'text')
            : null;

        $body = $firstText
            ? (Locales::resolve($firstText->payload['body'] ?? [], app()->getLocale()) ?? '')
            : '';

        $excerpt = Str::limit(strip_tags($body) ?: (string) $this->intro, 280);

        return [
            'id'           => $this->id,
            'title'        => $this->title,
            // The default locale's slug. A post's URL is per language — the
            // public site resolves translations.slug down the locale chain.
            'slug'         => $this->slugIn(Locales::default()),
            'intro'        => $this->intro,
            // Present on the public list, absent on the admin list — see
            // PostController::listQuery(). A loaded null is still emitted.
            'image'        => $this->when(
                array_key_exists('image', $this->resource->getAttributes()),
                fn () => $this->image ? '/storage/' . $this->image : null,
            ),
            'excerpt'      => $excerpt,
            'published_at' => $this->published_at,
            'event_dates'  => $this->whenLoaded('concerts', fn () => $this->sortedConcerts()
                ->map(fn ($c) => $c->date->format('Y-m-d'))),
            'event_date_display' => $this->event_date_display,
            'tags'         => TagResource::collection($this->whenLoaded('tags')),
            'translations' => [
                'title' => $this->getTranslations('title'),
                'intro' => $this->getTranslations('intro'),
                'slug'    => collect(Locales::codes())->mapWithKeys(fn (string $c) => [$c => $this->slugIn($c)])->all(),
            ],
            'translation_gaps' => $this->when(
                (bool) $request->attributes->get(self::ADMIN_LIST),
                fn () => $this->translationGaps(),
            ),
            'created_at'   => $this->created_at,
            'updated_at'   => $this->updated_at,
        ];
    }

    /**
     * Per locale, which parts of the post have no text in it: title, intro,
     * slug, and "blocks" when any text block is blank there. An empty list
     * means the language is complete. Text blocks only — the list loads no
     * other block type, and an image's alt text is not what the band means
     * by "translated".
     *
     * @return array<string, list<string>>
     */
    private function translationGaps(): array
    {
        $filled = fn ($v) => is_string($v) && trim(strip_tags($v)) !== '';
        $texts  = $this->relationLoaded('blocks') ? $this->blocks->where('type', 'text') : collect();

        return collect(Locales::codes())->mapWithKeys(function (string $code) use ($filled, $texts) {
            $gaps = [];
            if (! $filled($this->getTranslation('title', $code, false))) $gaps[] = 'title';
            if (! $filled($this->getTranslation('intro', $code, false))) $gaps[] = 'intro';
            if (! $filled($this->slugIn($code))) $gaps[] = 'slug';
            if ($texts->contains(fn ($b) => ! $filled($b->payload['body'][$code] ?? null))) $gaps[] = 'blocks';

            return [$code => $gaps];
        })->all();
    }
}
