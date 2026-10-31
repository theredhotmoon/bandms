<?php

use App\Assistant\Crawler\CrawlSourceJob;
use App\Assistant\Crawler\Query;
use App\Assistant\Crawler\SourceCapped;
use App\Assistant\Crawler\Sources\GoogleCseSource;
use App\Assistant\Crawler\Sources\YouTubeSource;
use App\Assistant\Crawler\SourceRegistry;
use App\Models\AssistantFinding;
use App\Models\AssistantRun;
use App\Support\CrawlerSettings;
use Illuminate\Support\Facades\Http;

// The first two sources. Every HTTP call is faked; a test that reaches Google
// is a bug.

beforeEach(function () {
    config([
        'services.google.api_key'  => 'gkey',
        'services.google.cse_id'   => 'cx1',
        'services.youtube.api_key' => 'ykey',
    ]);
    CrawlerSettings::set(['keywords' => ['Skanking Storks'], 'countries' => ['PL', 'GB']]);
});

function cseItem(string $link, string $title = 'A title'): array
{
    return ['link' => $link, 'title' => $title, 'snippet' => 'A snippet about ska.', 'displayLink' => parse_url($link, PHP_URL_HOST)];
}

describe('google_cse', function () {
    it('asks mentions first, then news and leads per country with the right gl/hl', function () {
        $queries = iterator_to_array((new GoogleCseSource())->queries(CrawlerSettings::get()), false);

        expect($queries[0])->text->toBe('"Skanking Storks"')->kind->toBe('mention')
            ->and(collect($queries)->where('kind', 'news')->pluck('country')->all())->toBe(['PL', 'GB'])
            ->and(collect($queries)->firstWhere('country', 'GB')->params['gl'])->toBe('uk')
            ->and(collect($queries)->where('kind', 'lead')->count())->toBeGreaterThan(1);
    });

    it('turns results into findings keyed by the normalised URL, social profiles as leads', function () {
        Http::fake(['www.googleapis.com/customsearch/*' => Http::response(['items' => [
            cseItem('https://ska.example/news/storks?utm_source=x', 'Storks play Berlin'),
            cseItem('https://www.instagram.com/skaclubberlin/', 'Ska Club Berlin'),
        ]])]);

        $out = (new GoogleCseSource())->fetch(new Query('ska concert Germany', 'DE', 'lead', ['gl' => 'de', 'hl' => 'de']));

        expect($out)->toHaveCount(2)
            ->and($out[0]->externalKey)->toBe(sha1('ska.example/news/storks'))
            ->and($out[0]->country)->toBe('DE')
            ->and($out[1]->leadType)->toBe('profile');
        Http::assertSent(fn ($r) => $r->header('X-goog-api-key') === ['gkey'] && !str_contains($r->url(), 'gkey') && $r['cx'] === 'cx1' && $r['gl'] === 'de' && $r['q'] === 'ska concert Germany');
    });

    it('returns nothing for an empty result page', function () {
        Http::fake(['www.googleapis.com/customsearch/*' => Http::response(['searchInformation' => ['totalResults' => '0']])]);
        expect((new GoogleCseSource())->fetch(new Query('x')))->toBe([]);
    });

    it('treats 429 and a quota 403 as capped', function (int $status) {
        Http::fake(['www.googleapis.com/customsearch/*' => Http::response(['error' => ['errors' => [['reason' => 'dailyLimitExceeded']]]], $status)]);
        expect(fn () => (new GoogleCseSource())->fetch(new Query('x')))->toThrow(SourceCapped::class);
    })->with([429, 403]);

    it('runs end to end through the job and is disabled without a key', function () {
        app()->instance(SourceRegistry::class, new SourceRegistry([new GoogleCseSource()]));
        Http::fake(['www.googleapis.com/customsearch/*' => Http::response(['items' => [cseItem('https://ska.example/a')]])]);
        CrawlerSettings::set(['sources' => ['google_cse' => ['cap_day' => 2]]]);

        (new CrawlSourceJob('google_cse'))->handle(app(SourceRegistry::class));
        expect(AssistantRun::sole()->status)->toBe('capped')->and(AssistantFinding::count())->toBe(1);

        config(['services.google.cse_id' => '']);
        (new CrawlSourceJob('google_cse'))->handle(app(SourceRegistry::class));
        expect(AssistantRun::count())->toBe(1);
    });
});

describe('youtube', function () {
    it('asks for the band first, then live ska per country', function () {
        $queries = iterator_to_array((new YouTubeSource())->queries(CrawlerSettings::get()), false);

        expect($queries[0])->kind->toBe('mention')
            ->and(collect($queries)->where('kind', 'lead')->pluck('params.regionCode')->all())->toBe(['PL', 'GB']);
    });

    it('turns videos into findings; a live-ska channel is a band lead', function () {
        Http::fake(['www.googleapis.com/youtube/v3/search*' => Http::response(['items' => [[
            'id' => ['videoId' => 'vid123'],
            'snippet' => ['title' => 'Ska night live', 'description' => 'Full set', 'channelId' => 'ch9', 'channelTitle' => 'The Offbeats'],
        ]]])]);

        $out = (new YouTubeSource())->fetch(new Query('ska live', 'PL', 'lead', ['regionCode' => 'PL']));

        expect($out[0])->externalKey->toBe('vid123')->url->toBe('https://www.youtube.com/watch?v=vid123')
            ->leadType->toBe('band')->country->toBe('PL')
            ->and($out[0]->payload['channelId'])->toBe('ch9');
        Http::assertSent(fn ($r) => $r->header('X-goog-api-key') === ['ykey'] && !str_contains($r->url(), 'ykey') && $r['type'] === 'video' && $r['regionCode'] === 'PL');
    });

    it('treats quotaExceeded as capped', function () {
        Http::fake(['www.googleapis.com/youtube/*' => Http::response(['error' => ['errors' => [['reason' => 'quotaExceeded']]]], 403)]);
        expect(fn () => (new YouTubeSource())->fetch(new Query('x')))->toThrow(SourceCapped::class);
    });
});

it('keeps the query string in a result\'s identity, minus tracking parameters', function () {
    $a = GoogleCseSource::normaliseUrl('https://www.youtube.com/watch?v=AAA&utm_source=x');

    expect($a)->toBe(GoogleCseSource::normaliseUrl('https://youtube.com/watch?v=AAA'))
        ->and($a)->not->toBe(GoogleCseSource::normaliseUrl('https://youtube.com/watch?v=BBB'))
        ->and(GoogleCseSource::normaliseUrl('https://site.test/news.php?id=2&b=1'))
        ->toBe(GoogleCseSource::normaliseUrl('https://site.test/news.php?b=1&id=2&fbclid=zz'));
});
