<?php

use App\Assistant\Crawler\CrawlSourceJob;
use App\Assistant\Crawler\Query;
use App\Assistant\Crawler\SourceCapped;
use App\Assistant\Crawler\SourceRegistry;
use App\Assistant\Crawler\Sources\MetaOwnSource;
use App\Assistant\Crawler\Sources\PlacesSource;
use App\Assistant\Crawler\Sources\RedditSource;
use App\Assistant\Crawler\Sources\RssSource;
use App\Assistant\Crawler\Sources\SetlistFmSource;
use App\Models\AssistantRun;
use App\Support\CrawlerSettings;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Sleep;

// Slice 2's sources: setlist.fm sibling bands, Google Places, RSS feeds, the
// band's own Facebook/Instagram tags, Reddit. Every HTTP call is faked; a test
// that reaches a provider is a bug.

beforeEach(function () {
    Sleep::fake();
    $this->travelTo(\Carbon\Carbon::parse('2026-10-31 12:00', 'UTC'));
    config([
        'services.setlistfm.api_key'           => 'sfm',
        'services.google.api_key'              => 'gkey',
        'services.facebook.page_id'            => 'PAGE1',
        'services.facebook.page_access_token'  => 'pagetoken',
        'services.facebook.instagram_user_id'  => 'IG1',
        'services.reddit.client_id'            => 'rid',
        'services.reddit.client_secret'        => 'rsecret',
        'services.reddit.username'             => 'storks',
    ]);
});

function runSource(string $key): AssistantRun
{
    (new CrawlSourceJob($key))->handle(app(SourceRegistry::class));

    return AssistantRun::query()->where('source', $key)->latest('id')->firstOrFail();
}

function setlist(string $venueId, string $venue, string $date, string $country = 'DE'): array
{
    return [
        'eventDate' => $date,
        'url'       => "https://www.setlist.fm/setlist/x/{$venueId}.html",
        'artist'    => ['name' => 'The Busters'],
        'venue'     => [
            'id'   => $venueId,
            'name' => $venue,
            'url'  => "https://www.setlist.fm/venue/{$venueId}.html",
            'city' => ['name' => 'Berlin', 'country' => ['code' => $country]],
        ],
    ];
}

// ── setlist.fm ──────────────────────────────────────────────────────────────

it('asks setlist.fm for two pages per sibling band, only when there is one', function () {
    $source = new SetlistFmSource();

    expect(iterator_to_array($source->queries(CrawlerSettings::get()), false))->toBe([])
        ->and($source->enabled(CrawlerSettings::get()))->toBeFalse();

    CrawlerSettings::set(['sibling_bands' => [['mbid' => 'mb-1', 'name' => 'The Busters']]]);
    $queries = iterator_to_array($source->queries(CrawlerSettings::get()), false);

    expect($queries)->toHaveCount(2)
        ->and($queries[0]->params)->toBe(['mbid' => 'mb-1', 'page' => 1])
        ->and($queries[1]->params['page'])->toBe(2);
});

it('turns a sibling band\'s recent setlists into one venue lead per venue', function () {
    Http::fake(['api.setlist.fm/*' => Http::response(['setlist' => [
        setlist('v1', 'SO36', '12-09-2026'),
        setlist('v1', 'SO36', '01-03-2026'),            // same venue again
        setlist('v2', 'Lido', '20-06-2025'),
        setlist('v3', 'Old Hall', '01-01-2023'),        // older than two years
    ]])]);

    $found = (new SetlistFmSource())->fetch(new Query('The Busters', null, 'lead', ['mbid' => 'mb-1', 'page' => 1]));

    expect($found)->toHaveCount(2)
        ->and($found[0]->externalKey)->toBe('v1')
        ->and($found[0]->kind)->toBe('lead')
        ->and($found[0]->leadType)->toBe('venue')
        ->and($found[0]->country)->toBe('DE')
        ->and($found[0]->payload)->toMatchArray(['city' => 'Berlin', 'lastPlayed' => '2026-09-12', 'bandName' => 'The Busters']);
    Http::assertSent(fn (Request $r) => $r->hasHeader('x-api-key', 'sfm')
        && str_contains($r->url(), '/artist/mb-1/setlists') && str_contains($r->url(), 'p=1'));
});

it('treats setlist.fm running out of pages as nothing found, and a second 429 as capped', function () {
    Http::fake(['api.setlist.fm/*' => Http::sequence()->push(['code' => 404], 404)->push('', 429)->push('', 429)]);
    $q = new Query('The Busters', null, 'lead', ['mbid' => 'mb-1', 'page' => 2]);

    expect((new SetlistFmSource())->fetch($q))->toBe([]);
    expect(fn () => (new SetlistFmSource())->fetch($q))->toThrow(SourceCapped::class);
});

// ── Google Places ───────────────────────────────────────────────────────────

it('searches Places for venues in each configured city, with the field mask', function () {
    CrawlerSettings::set(['countries' => ['PL'], 'cities_by_country' => ['PL' => ['Kraków']]]);
    $queries = iterator_to_array((new PlacesSource())->queries(CrawlerSettings::get()), false);
    expect($queries)->toHaveCount(2)->and($queries[0]->country)->toBe('PL');

    Http::fake(['places.googleapis.com/*' => Http::response(['places' => [[
        'id' => 'pl-1', 'displayName' => ['text' => 'Klub Pod Minogą'],
        'formattedAddress' => 'Nowy Świat 7, Kraków', 'websiteUri' => 'https://minoga.example', 'types' => ['night_club'],
    ]]])]);

    $found = (new PlacesSource())->fetch($queries[0]);

    expect($found)->toHaveCount(1)
        ->and($found[0]->externalKey)->toBe('pl-1')
        ->and($found[0]->leadType)->toBe('venue')
        ->and($found[0]->url)->toBe('https://minoga.example')
        ->and($found[0]->payload['address'])->toBe('Nowy Świat 7, Kraków');
    Http::assertSent(fn (Request $r) => $r->method() === 'POST'
        && $r->hasHeader('X-Goog-Api-Key', 'gkey')
        && str_contains($r->header('X-Goog-FieldMask')[0], 'places.websiteUri')
        && str_contains($r['textQuery'], 'Kraków'));
});

it('links a Places result with no website to its Maps page, and treats 429 as capped', function () {
    Http::fake(['places.googleapis.com/*' => Http::sequence()
        ->push(['places' => [['id' => 'pl-2', 'displayName' => ['text' => 'Bar']]]])
        ->push(['error' => ['status' => 'RESOURCE_EXHAUSTED']], 429)]);
    $q = new Query('ska bar Kraków', 'PL', 'lead');

    expect((new PlacesSource())->fetch($q)[0]->url)->toContain('place_id:pl-2');
    expect(fn () => (new PlacesSource())->fetch($q))->toThrow(SourceCapped::class);
});

it('stops Places at its month cap', function () {
    CrawlerSettings::set([
        'countries' => ['PL'], 'cities_by_country' => ['PL' => ['Kraków', 'Warszawa']],
        'sources' => ['places' => ['enabled' => true, 'cap_day' => 30, 'cap_month' => 3]],
    ]);
    Http::fake(['places.googleapis.com/*' => Http::response(['places' => []])]);

    $run = runSource('places');

    expect($run->status)->toBe('capped')->and($run->queries)->toBe(3);
});

// ── RSS ─────────────────────────────────────────────────────────────────────

it('reads RSS 2.0 items from the last 14 days as news', function () {
    Http::fake(['ska.example/*' => Http::response(<<<'XML'
<?xml version="1.0"?>
<rss version="2.0"><channel><title>Ska News</title>
  <item><title>New Busters album</title><link>https://ska.example/busters</link><guid>g-1</guid>
    <pubDate>Mon, 26 Oct 2026 10:00:00 +0000</pubDate><description>&lt;p&gt;Out now&lt;/p&gt;</description></item>
  <item><title>Old story</title><link>https://ska.example/old</link><pubDate>Mon, 01 Jun 2026 10:00:00 +0000</pubDate></item>
</channel></rss>
XML)]);

    $found = (new RssSource())->fetch(new Query('https://ska.example/feed.xml', null, 'news'));

    expect($found)->toHaveCount(1)
        ->and($found[0]->kind)->toBe('news')
        ->and($found[0]->title)->toBe('New Busters album')
        ->and($found[0]->url)->toBe('https://ska.example/busters')
        ->and($found[0]->snippet)->toBe('Out now')
        ->and($found[0]->externalKey)->toBe(sha1('g-1'));
});

it('reads Atom entries too', function () {
    Http::fake(['ska.example/*' => Http::response(<<<'XML'
<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>Atom ska</title>
  <entry><title>Festival lineup</title><link rel="alternate" href="https://ska.example/lineup"/>
    <id>tag:ska.example,2026:1</id><updated>2026-10-30T09:00:00Z</updated><summary>Twelve bands</summary></entry>
</feed>
XML)]);

    $found = (new RssSource())->fetch(new Query('https://ska.example/atom', null, 'news'));

    expect($found)->toHaveCount(1)
        ->and($found[0]->url)->toBe('https://ska.example/lineup')
        ->and($found[0]->snippet)->toBe('Twelve bands');
});

it('fails the run with a clear error for a feed on a private address', function () {
    CrawlerSettings::set(['rss_feeds' => ['http://10.0.0.1/feed.xml']]);
    Http::fake();

    $run = runSource('rss');

    expect($run->status)->toBe('failed')->and($run->error)->toContain('not a public');
    Http::assertNothingSent();
});

// ── The band's own Facebook Page and Instagram ──────────────────────────────

it('collects posts that tag the band on Facebook and Instagram as mentions', function () {
    Http::fake([
        'graph.facebook.com/*/PAGE1/tagged*' => Http::response(['data' => [[
            'id' => 'fb-1', 'message' => 'Great gig with the Storks!', 'permalink_url' => 'https://facebook.com/p/1',
            'from' => ['name' => 'Klub X'], 'created_time' => '2026-10-29T20:00:00+0000',
        ]]]),
        'graph.facebook.com/*/IG1/tags*' => Http::response(['data' => [[
            'id' => 'ig-1', 'caption' => 'Storks live', 'permalink' => 'https://instagram.com/p/1',
            'username' => 'skafan', 'timestamp' => '2026-10-29T21:00:00+0000',
        ]]]),
    ]);
    $source  = new MetaOwnSource();
    $queries = iterator_to_array($source->queries(CrawlerSettings::get()), false);

    $fb = $source->fetch($queries[0]);
    $ig = $source->fetch($queries[1]);

    expect($fb[0])->kind->toBe('mention')->externalKey->toBe('fb:fb-1')->url->toBe('https://facebook.com/p/1')
        ->and($fb[0]->title)->toContain('Klub X')
        ->and($ig[0])->externalKey->toBe('ig:ig-1')->snippet->toBe('Storks live')
        ->and($ig[0]->title)->toContain('skafan');
});

it('asks only Facebook when there is no Instagram account', function () {
    config(['services.facebook.instagram_user_id' => '']);

    expect(iterator_to_array((new MetaOwnSource())->queries(CrawlerSettings::get()), false))->toHaveCount(1);
});

it('fails the run saying the Page token expired when Facebook answers code 190', function () {
    config(['services.facebook.instagram_user_id' => '']);
    Http::fake(['graph.facebook.com/*' => Http::response(['error' => ['code' => 190, 'message' => 'Session has expired']], 400)]);

    $run = runSource('meta_own');

    expect($run->status)->toBe('failed')->and($run->error)->toContain('token expired');
});

// ── Reddit ──────────────────────────────────────────────────────────────────

it('gets an app token once, then searches the ska subreddits with a named User-Agent', function () {
    CrawlerSettings::set(['keywords' => ['Skanking Storks', 'Storks ska']]);
    Http::fake([
        'www.reddit.com/api/v1/access_token' => Http::response(['access_token' => 'tok', 'expires_in' => 3600]),
        'oauth.reddit.com/*' => Http::response(['data' => ['children' => [['data' => [
            'id' => 'r1', 'title' => 'Anyone seen Skanking Storks?', 'permalink' => '/r/ska/comments/r1/x/',
            'selftext' => 'They were great', 'subreddit' => 'ska',
        ]]]]]),
    ]);
    $source = new RedditSource();

    $found = [];
    foreach ($source->queries(CrawlerSettings::get()) as $q) {
        $found = [...$found, ...$source->fetch($q)];
    }

    expect($found[0])->kind->toBe('mention')->externalKey->toBe('r1')
        ->url->toBe('https://www.reddit.com/r/ska/comments/r1/x/');
    Http::assertSentCount(3); // one token, two searches
    Http::assertSent(fn (Request $r) => str_contains($r->url(), 'oauth.reddit.com/r/ska+reggae+punk/search')
        && $r->hasHeader('Authorization', 'Bearer tok')
        && $r->header('User-Agent')[0] === 'web:bandms:v1 (by /u/storks)');
});

it('fails the run with the IP-block hint when Reddit answers 403', function () {
    CrawlerSettings::set(['keywords' => ['Skanking Storks'], 'sources' => ['reddit' => ['enabled' => true]]]);
    Http::fake([
        'www.reddit.com/api/v1/access_token' => Http::response(['access_token' => 'tok']),
        'oauth.reddit.com/*' => Http::response('blocked', 403),
    ]);

    $run = runSource('reddit');

    expect($run->status)->toBe('failed')->and($run->error)->toContain('blocks');
});

it('registers every planned source', function () {
    expect(app(SourceRegistry::class)->keys())
        ->toEqualCanonicalizing(array_keys(CrawlerSettings::SOURCES));
});

it('keeps a venue\'s newest gig when older pages and other bands played there too', function () {
    CrawlerSettings::set(['sibling_bands' => [['mbid' => 'mb-1', 'name' => 'The Busters'], ['mbid' => 'mb-2', 'name' => 'Skaos']]]);
    Http::fake([
        'api.setlist.fm/*/mb-1/setlists?p=1' => Http::response(['setlist' => [setlist('v1', 'SO36', '12-09-2026')]]),
        'api.setlist.fm/*/mb-1/setlists?p=2' => Http::response(['setlist' => [setlist('v1', 'SO36', '01-03-2025')]]),
        'api.setlist.fm/*/mb-2/setlists*'    => Http::response(['setlist' => [setlist('v1', 'SO36', '05-05-2026')]]),
    ]);

    runSource('setlistfm');

    $f = \App\Models\AssistantFinding::sole();
    expect($f->payload['lastPlayed'])->toBe('2026-09-12')->and($f->payload['bandName'])->toBe('The Busters');
});

it('paces setlist.fm and retries one rate-limit answer before giving up', function () {
    Http::fake(['api.setlist.fm/*' => Http::sequence()->push('', 429)->push(['setlist' => [setlist('v1', 'SO36', '12-09-2026')]])]);

    $found = (new SetlistFmSource())->fetch(new Query('The Busters', null, 'lead', ['mbid' => 'mb-1', 'page' => 1]));

    expect($found)->toHaveCount(1);
    Sleep::assertSlept(fn ($d) => $d->totalMilliseconds >= 1000);
});

it('reads RSS 1.0 (RDF) items too', function () {
    Http::fake(['ska.example/*' => Http::response(<<<'XML'
<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel rdf:about="https://ska.example/"><title>Old ska site</title></channel>
  <item rdf:about="https://ska.example/tour"><title>Tour dates</title><link>https://ska.example/tour</link>
    <description>Spring tour</description><dc:date>2026-10-28T10:00:00Z</dc:date></item>
</rdf:RDF>
XML)]);

    $found = (new RssSource())->fetch(new Query('https://ska.example/rdf', null, 'news'));

    expect($found)->toHaveCount(1)->and($found[0]->title)->toBe('Tour dates')->and($found[0]->snippet)->toBe('Spring tour');
});
