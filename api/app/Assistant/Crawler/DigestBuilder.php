<?php

namespace App\Assistant\Crawler;

use App\Assistant\Text\NullTextModel;
use App\Assistant\Text\TextModel;
use App\Models\AssistantFinding;
use App\Models\SiteSetting;
use App\Models\User;
use App\Support\CrawlerSettings;
use Illuminate\Support\Carbon;

/**
 * What the Monday digest says: new findings since the last digest that
 * triage scored at least SCORE_FLOOR — the ten best leads grouped by
 * country, the twenty best mentions, the five best news items.
 *
 * "Since" is measured on `triaged_at` while a model scores findings: a
 * finding found before Monday but scored after it (triage down, or past its
 * nightly limit) must reach the next digest, not fall behind the stamp
 * unscored. With no model bound nothing is ever scored, so the floor is
 * dropped and `found_at` is the clock. The first digest covers one week,
 * not everything the crawler has ever found.
 */
final class DigestBuilder
{
    public const LAST_SENT_KEY = 'assistant_last_digest_at';
    public const SCORE_FLOOR = 50;
    public const MAX_LEADS = 10;
    public const MAX_MENTIONS = 20;
    public const MAX_NEWS = 5;

    public function __construct(private readonly TextModel $model) {}

    /**
     * @param  Carbon  $until  the moment the digest covers up to — taken before
     *                         the query, and stamped after sending, so nothing that
     *                         arrives meanwhile falls between two digests
     * @return array{since: Carbon, leads: array<string, list<AssistantFinding>>, mentions: list<AssistantFinding>, news: list<AssistantFinding>, total: int}|null
     *         null when there is nothing to say
     */
    public function build(Carbon $until): ?array
    {
        $stored  = SiteSetting::get(self::LAST_SENT_KEY);
        $since   = $stored ? Carbon::parse($stored) : $until->copy()->subWeek();
        // The real check, not the config string: a driver named without its
        // key is bound to the null model and scores nothing.
        $scoring = !($this->model instanceof NullTextModel);
        $clock   = $scoring ? 'triaged_at' : 'found_at';

        $base = fn () => AssistantFinding::query()
            ->status('new')
            ->where($clock, '>', $since)->where($clock, '<=', $until)
            ->when($scoring, fn ($q) => $q->where('score', '>=', self::SCORE_FLOOR))
            ->orderByDesc('score')->orderByDesc('found_at')->orderByDesc('id');

        $leads    = $base()->kind('lead')->limit(self::MAX_LEADS)->get();
        $mentions = $base()->kind('mention')->limit(self::MAX_MENTIONS)->get();
        $news     = $base()->kind('news')->limit(self::MAX_NEWS)->get();

        $total = $leads->count() + $mentions->count() + $news->count();
        if ($total === 0) {
            return null;
        }

        // By country, busiest first; leads with no country last.
        $byCountry = $leads->groupBy(fn (AssistantFinding $f) => $f->country ?? '—')
            ->sortBy(fn ($group, $code) => [$code === '—' ? 1 : 0, -$group->count(), -$group->max('score')])
            ->map(fn ($group) => $group->values()->all())
            ->all();

        return [
            'since'    => $since,
            'leads'    => $byCountry,
            'mentions' => $mentions->all(),
            'news'     => $news->all(),
            'total'    => $total,
        ];
    }

    /** The settings' recipients, or every superadmin when none are set. @return list<string> */
    public function recipients(): array
    {
        $set = CrawlerSettings::get()['digest_to'];
        if ($set !== []) {
            return $set;
        }

        return User::query()->where('is_superadmin', true)->whereNotNull('email')->pluck('email')->all();
    }

    public function stamp(Carbon $until): void
    {
        SiteSetting::set(self::LAST_SENT_KEY, $until->toIso8601String());
    }
}
