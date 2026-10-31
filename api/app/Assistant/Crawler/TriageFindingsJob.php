<?php

namespace App\Assistant\Crawler;

use App\Assistant\Crawler\Sources\GoogleCseSource;
use App\Assistant\Text\TextModel;
use App\Models\AssistantFinding;
use App\Models\Author;
use App\Models\Band;
use App\Models\BandProfile;
use App\Models\Venue;
use App\Support\ContentLocales;
use App\Support\Locales;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Reads the night's new findings in batches of 20 and asks the triage model
 * (a cheap one — config `assistant.triage_model_id`) which matter to this
 * band, how much (0–100), and in one line why, in the band's first content
 * language. Before that, two things never reach the model: a lead whose name
 * the band already has (a venue, band or contact — `triage.known`), and a page
 * another source already found (`triage.duplicate_of`). Both score 0.
 *
 * A batch is written all at once or not at all: an answer that is not the
 * schema, or that skips a finding, fails the job and leaves every row
 * untriaged for the next night — counting the attempt on each row it asked
 * about. A finding asked about MAX_ATTEMPTS times is set aside as
 * `unreadable`, so one the model keeps fumbling cannot block every newer one.
 */
final class TriageFindingsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public const BATCH = 20;
    /** At most 200 findings a night — a runaway crawl must not become a runaway bill. */
    public const MAX_BATCHES = 10;
    private const SIMILARITY = 85.0;
    public const MAX_ATTEMPTS = 3;

    public int $tries = 1;
    public int $timeout = 1500;

    public const SCHEMA = [
        'type'                 => 'object',
        'additionalProperties' => false,
        'required'             => ['items'],
        'properties'           => [
            'items' => [
                'type'  => 'array',
                'items' => [
                    'type'                 => 'object',
                    'additionalProperties' => false,
                    'required'             => ['id', 'relevant', 'score', 'summary', 'reason', 'lead_type', 'country', 'contacts'],
                    'properties'           => [
                        'id'        => ['type' => 'integer'],
                        'relevant'  => ['type' => 'boolean'],
                        'score'     => ['type' => 'integer'],
                        'summary'   => ['type' => 'string'],
                        'reason'    => ['type' => 'string'],
                        'lead_type' => ['type' => ['string', 'null'], 'enum' => [...AssistantFinding::LEAD_TYPES, null]],
                        'country'   => ['type' => ['string', 'null']],
                        'contacts'  => [
                            'type'                 => ['object', 'null'],
                            'additionalProperties' => false,
                            'required'             => ['email', 'website', 'instagram', 'facebook'],
                            'properties'           => [
                                'email'     => ['type' => ['string', 'null']],
                                'website'   => ['type' => ['string', 'null']],
                                'instagram' => ['type' => ['string', 'null']],
                                'facebook'  => ['type' => ['string', 'null']],
                            ],
                        ],
                    ],
                ],
            ],
        ],
    ];

    /** @return array<int, object> */
    public function middleware(): array
    {
        return [(new WithoutOverlapping('assistant-triage'))->expireAfter(1800)->dontRelease()];
    }

    public function handle(TextModel $model): void
    {
        $known = $this->knownNames();
        $urls  = AssistantFinding::query()->orderBy('id')->pluck('url', 'id')
            ->map(fn (string $url) => GoogleCseSource::normaliseUrl($url));
        $seenUrl = [];
        foreach ($urls as $id => $url) {
            $seenUrl[$url] ??= $id; // the first finding of each page
        }

        $this->setAsideUnreadable();

        for ($i = 0; $i < self::MAX_BATCHES; $i++) {
            $batch = AssistantFinding::query()
                ->whereNull('triaged_at')->where('status', 'new')
                ->orderBy('id')->limit(self::BATCH)->get();
            if ($batch->isEmpty()) {
                return;
            }

            $writes  = [];
            $toModel = [];
            foreach ($batch as $f) {
                $first = $seenUrl[$urls[$f->id] ?? ''] ?? $f->id;
                if ($first !== $f->id) {
                    $writes[$f->id] = ['score' => 0, 'triage' => ['duplicate_of' => $first]];
                } elseif ($f->kind === 'lead' && ($match = $this->match($f->title, $known))) {
                    $writes[$f->id] = ['score' => 0, 'triage' => ['known' => $match]];
                } else {
                    $toModel[$f->id] = $f;
                }
            }

            if ($toModel !== []) {
                try {
                    $answer = $model->structured($this->system(), $this->user($toModel), self::SCHEMA, config('assistant.triage_model_id'));
                    $writes += $this->parse($answer, $toModel);
                } catch (\Throwable $e) {
                    $this->countAttempt(array_keys($toModel));
                    throw $e;
                }
            }

            DB::transaction(function () use ($writes) {
                foreach ($writes as $id => $attributes) {
                    AssistantFinding::query()->whereKey($id)->update([
                        ...$attributes,
                        'triage'     => json_encode($attributes['triage']),
                        'triaged_at' => now(),
                    ]);
                }
            });
        }
    }

    /**
     * The model's answer as row updates — or an exception, never a partial set.
     *
     * @param  array<int, AssistantFinding>  $asked
     * @return array<int, array<string, mixed>>
     */
    private function parse(array $answer, array $asked): array
    {
        $items = $answer['items'] ?? null;
        if (!is_array($items)) {
            throw new RuntimeException('Triage answer has no items.');
        }

        $countries = array_keys(config('countries', []));
        $writes    = [];
        foreach ($items as $item) {
            $id = $item['id'] ?? null;
            if (!is_int($id) || !isset($asked[$id]) || !is_bool($item['relevant'] ?? null)
                || !is_int($item['score'] ?? null) || !is_string($item['summary'] ?? null)) {
                throw new RuntimeException('Triage answer item does not match the schema.');
            }
            $f       = $asked[$id];
            $country = is_string($item['country'] ?? null) ? strtoupper($item['country']) : null;
            $type    = $item['lead_type'] ?? null;

            $writes[$id] = array_filter([
                'score'     => $item['relevant'] ? max(0, min(100, $item['score'])) : 0,
                // A lead type belongs on a lead only — never a badge on a news item.
                'lead_type' => $f->lead_type ?? ($f->kind === 'lead' && in_array($type, AssistantFinding::LEAD_TYPES, true) ? $type : null),
                'country'   => $f->country ?? (in_array($country, $countries, true) ? $country : null),
                'triage'    => [
                    'relevant' => $item['relevant'],
                    'summary'  => mb_substr($item['summary'], 0, 300),
                    'reason'   => mb_substr((string) ($item['reason'] ?? ''), 0, 300),
                    'contacts' => is_array($item['contacts'] ?? null) ? array_filter($item['contacts'], 'is_string') : null,
                ],
            ], fn ($v) => $v !== null);
        }

        if (count($writes) !== count($asked)) {
            throw new RuntimeException('Triage answer skipped ' . (count($asked) - count($writes)) . ' finding(s).');
        }

        return $writes;
    }

    private function system(): string
    {
        $p        = BandProfile::query()->first();
        $code     = ContentLocales::primary();
        $language = collect(Locales::all())->firstWhere('code', $code)['name'] ?? 'English';
        $band     = $p?->name ?: 'the band';
        $genres   = trim((string) $p?->genres) ?: 'ska, reggae and punk';
        $about    = implode(', ', array_filter([
            "a band playing {$genres}",
            $p?->hometown ? "based in {$p->hometown}" : null,
        ]));

        return <<<TXT
You triage what a nightly web crawl found for {$band}, {$about}.
For each finding decide:
- relevant: would this band care? Yes for news from the scene around its music ({$genres}), mentions of the band, and venues, promoters, festivals, bands or media that book or cover bands like it. No for anything else (another band with a similar name, unrelated businesses, spam).
- score: 0–100, how useful it is to act on now (a festival taking applications or a venue that books ska is high; general news is low).
- summary: one sentence in {$language}, saying what it is and why it matters to the band.
- reason: a few words in English for the band's records.
- lead_type and country (ISO 3166-1 alpha-2) only when the finding itself makes them clear.
- contacts: only what is written in the finding itself — never guess an address.
Answer for every finding, by its id.
TXT;
    }

    /** @param array<int, AssistantFinding> $findings */
    private function user(array $findings): string
    {
        return json_encode(array_values(array_map(fn (AssistantFinding $f) => [
            'id'      => $f->id,
            'kind'    => $f->kind,
            'source'  => $f->source,
            'title'   => $f->title,
            'snippet' => $f->snippet,
            'url'     => $f->url,
            'country' => $f->country,
        ], $findings)), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    }

    /** One more failed answer for each of these findings. */
    private function countAttempt(array $ids): void
    {
        foreach (AssistantFinding::query()->whereKey($ids)->get() as $f) {
            $triage = is_array($f->triage) ? $f->triage : [];
            $triage['attempts'] = (int) ($triage['attempts'] ?? 0) + 1;
            AssistantFinding::query()->whereKey($f->id)->update(['triage' => json_encode($triage)]);
        }
    }

    /** Findings the model failed on MAX_ATTEMPTS times leave the queue, scored 0. */
    private function setAsideUnreadable(): void
    {
        AssistantFinding::query()->whereNull('triaged_at')->where('status', 'new')->whereNotNull('triage')->get()
            ->filter(fn (AssistantFinding $f) => (int) ($f->triage['attempts'] ?? 0) >= self::MAX_ATTEMPTS)
            ->each(fn (AssistantFinding $f) => AssistantFinding::query()->whereKey($f->id)->update([
                'score'      => 0,
                'triage'     => json_encode(['unreadable' => true, 'attempts' => $f->triage['attempts']]),
                'triaged_at' => now(),
            ]));
    }

    /** @return list<array{type: string, id: int, name: string, key: string}> */
    private function knownNames(): array
    {
        $rows = [];
        foreach (Venue::query()->get(['id', 'name']) as $v) {
            $rows[] = ['type' => 'venue', 'id' => $v->id, 'name' => $v->name];
        }
        foreach (Band::query()->get(['id', 'name']) as $b) {
            $rows[] = ['type' => 'band', 'id' => $b->id, 'name' => $b->name];
        }
        foreach (Author::query()->get(['id', 'first_name', 'last_name']) as $a) {
            $rows[] = ['type' => 'author', 'id' => $a->id, 'name' => $a->name];
        }

        return array_map(fn ($r) => $r + ['key' => self::key($r['name'])], array_filter($rows, fn ($r) => trim($r['name']) !== ''));
    }

    /**
     * The record a lead's title names, if the band has it. The name is the
     * title up to its first separator ("SO36, Berlin", "The Busters — official").
     *
     * @return array{type: string, id: int, name: string}|null
     */
    private function match(string $title, array $known): ?array
    {
        $name = self::key((string) preg_split('/\s*(?:,|—|–| - |\||:)\s*/u', $title, 2)[0]);
        if ($name === '') {
            return null;
        }
        foreach ($known as $k) {
            similar_text($name, $k['key'], $percent);
            if ($percent >= self::SIMILARITY) {
                return ['type' => $k['type'], 'id' => $k['id'], 'name' => $k['name']];
            }
        }

        return null;
    }

    private static function key(string $name): string
    {
        return trim(preg_replace('/[^a-z0-9]+/', ' ', strtolower(Str::ascii($name))));
    }
}
