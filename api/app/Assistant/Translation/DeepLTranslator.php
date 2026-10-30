<?php

namespace App\Assistant\Translation;

use App\Support\Locales;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * DeepL (https://developers.deepl.com/docs/api-reference/translate).
 *
 * Items are grouped by (source, target, format) — one request per group,
 * `text[]` carrying every uncached item — and each translated string is cached
 * by its text, so re-translating a sentence costs no quota. A free key ends in
 * `:fx` and lives on a different host; that suffix is DeepL's own convention.
 */
final class DeepLTranslator implements Translator
{
    private const FREE_HOST = 'https://api-free.deepl.com';
    private const PAID_HOST = 'https://api.deepl.com';

    /** DeepL's "quota exceeded" status. */
    private const QUOTA_EXCEEDED = 456;

    public function __construct(
        private readonly string $apiKey,
        private readonly int $cacheTtlDays,
    ) {}

    public function name(): string
    {
        return 'deepl';
    }

    public function translate(array $items): array
    {
        $out    = [];
        $groups = [];

        foreach ($items as $item) {
            $cached = Cache::get($this->cacheKey($item));
            if (is_string($cached)) {
                $out[$item->key] = $cached;
                continue;
            }
            $groups["{$item->source}|{$item->target}|{$item->format}"][] = $item;
        }

        $chars = 0;
        foreach ($groups as $group) {
            $texts = $this->request($group);
            foreach ($group as $i => $item) {
                $out[$item->key] = $texts[$i];
                $chars          += mb_strlen($item->text);
                Cache::put($this->cacheKey($item), $texts[$i], now()->addDays($this->cacheTtlDays));
            }
        }

        Log::info('assistant.translate', [
            'provider' => $this->name(),
            'items'    => count($items),
            'cached'   => count($items) - array_sum(array_map('count', $groups)),
            'chars'    => $chars,
        ]);

        return $out;
    }

    /**
     * One API call for a group sharing source, target and format.
     *
     * @param  TranslationItem[]  $group
     * @return string[]  translated texts in the group's order
     */
    private function request(array $group): array
    {
        $first = $group[0];

        // DeepL takes a regional variant (EN-GB) for target_lang ONLY. Its
        // source_lang list is bare languages, and a region there is a 400 —
        // which a faked HTTP layer never sees. Stripping the region is DeepL's
        // convention, so it lives here and not in the registry.
        try {
            $payload = [
                'text'        => array_map(fn (TranslationItem $i) => $i->text, $group),
                'source_lang' => strtok(Locales::translationCode($first->source, $this->name()), '-'),
                'target_lang' => Locales::translationCode($first->target, $this->name()),
            ];
        } catch (\InvalidArgumentException $e) {
            // A registered locale with no `translation.deepl` entry passes
            // request validation (it IS a locale); it must still come back as
            // the 503 the admin can show, not a 500.
            throw new TranslatorUnavailable('Translation into this language is not configured.', $e);
        }
        if ($first->format === 'html') {
            $payload['tag_handling'] = 'html';
        }

        try {
            // One retry on a throttle or a DeepL-side error; a 4xx that names
            // the key or the quota is final and is not retried. `throw: false`
            // hands back the last response so the status can be read below.
            $response = Http::timeout(15)
                ->withHeaders(['Authorization' => "DeepL-Auth-Key {$this->apiKey}"])
                ->retry(2, 500, fn (\Throwable $e) => $e instanceof RequestException
                    && ($e->response->status() === 429 || $e->response->serverError()), throw: false)
                ->post($this->host() . '/v2/translate', $payload);
        } catch (ConnectionException $e) {
            Log::warning('assistant.translate.unreachable', ['error' => $e->getMessage()]);
            throw new TranslatorUnavailable('Translation failed — try again.', $e);
        }

        $this->guard($response);

        $translations = $response->json('translations');
        if (!is_array($translations) || count($translations) !== count($group)) {
            Log::warning('assistant.translate.malformed', ['body' => $response->body()]);
            throw new TranslatorUnavailable('Translation failed — try again.');
        }

        return array_map(fn (array $t) => (string) ($t['text'] ?? ''), $translations);
    }

    private function guard(Response $response): void
    {
        if ($response->successful()) {
            return;
        }

        Log::warning('assistant.translate.failed', ['status' => $response->status(), 'body' => $response->body()]);

        throw new TranslatorUnavailable(match (true) {
            $response->status() === self::QUOTA_EXCEEDED => 'DeepL quota reached for this month.',
            in_array($response->status(), [401, 403], true) => 'DeepL rejected the API key.',
            default => 'Translation failed — try again.',
        });
    }

    private function host(): string
    {
        return str_ends_with($this->apiKey, ':fx') ? self::FREE_HOST : self::PAID_HOST;
    }

    private function cacheKey(TranslationItem $item): string
    {
        return 'assistant:tr:' . sha1("{$this->name()}|{$item->source}|{$item->target}|{$item->format}|{$item->text}");
    }
}
