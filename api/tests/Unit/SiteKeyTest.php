<?php

use App\Assistant\Crawler\SiteKey;

// What "Wrong → block the whole site" blocks: a website's host, but on a
// platform the account — never the platform itself.

it('keys a website by its host, without www', function () {
    expect(SiteKey::for('https://WWW.Klub-Studio.pl/koncerty?id=4'))
        ->toBe(['key' => 'klub-studio.pl', 'label' => 'klub-studio.pl', 'host' => 'klub-studio.pl']);
});

it('keys a platform by the account, not the platform', function (string $url, string $key) {
    expect(SiteKey::for($url)['key'])->toBe($key);
})->with([
    'instagram'       => ['https://www.instagram.com/klubstudio/', 'instagram.com/klubstudio'],
    'facebook mobile' => ['https://m.facebook.com/KlubStudio/posts/123', 'facebook.com/klubstudio'],
    'subreddit'       => ['https://www.reddit.com/r/Ska/comments/abc/title/', 'reddit.com/r/ska'],
    'youtube handle'  => ['https://www.youtube.com/@SkaChannel/videos', 'youtube.com/@skachannel'],
    'old reddit'      => ['https://old.reddit.com/r/Ska/comments/abc/', 'reddit.com/r/ska'],
    'localised fb'    => ['https://pl-pl.facebook.com/KlubStudio', 'facebook.com/klubstudio'],
    'youtube music'   => ['https://music.youtube.com/@SkaChannel', 'youtube.com/@skachannel'],
    'fb people page'  => ['https://www.facebook.com/people/Klub-Foo/100064123/', 'facebook.com/people/100064123'],
    'linktree'        => ['https://linktr.ee/SomeBand', 'linktr.ee/someband'],
]);

it('keeps a website’s own subdomain and name — only www goes', function (string $url, string $key) {
    expect(SiteKey::for($url)['key'])->toBe($key);
})->with([
    'm. is a site'      => ['https://m.example.com/a', 'm.example.com'],
    'mobile.de'         => ['https://mobile.de/auto', 'mobile.de'],
    'bandcamp tenant'   => ['https://someband.bandcamp.com/album/x', 'someband.bandcamp.com'],
]);

it('keys a YouTube video by the channel the source reported', function () {
    expect(SiteKey::for('https://www.youtube.com/watch?v=abc', ['channelId' => 'UCxyz', 'channelTitle' => 'Ska TV']))
        ->toBe(['key' => 'youtube.com/channel/UCxyz', 'label' => 'YouTube: Ska TV', 'host' => 'youtube.com']);
});

it('keeps a channel id’s case — ids differing only in case are different channels', function () {
    expect(SiteKey::for('https://www.youtube.com/channel/UCaBc/videos')['key'])->toBe('youtube.com/channel/UCaBc');
});

it('never offers to block the band’s own page', function () {
    expect(SiteKey::for('https://www.facebook.com/skankingstorks/posts/1', [], 'meta_own'))->toBeNull()
        ->and(SiteKey::for('https://www.facebook.com/skankingstorks/posts/1', [], 'google_cse'))->not->toBeNull();
});

it('has nothing to block where no account can be read off the URL', function (string $url) {
    expect(SiteKey::for($url))->toBeNull();
})->with([
    'instagram post'  => ['https://www.instagram.com/p/Cxyz/'],
    'facebook event'  => ['https://www.facebook.com/events/123/'],
    'bare platform'   => ['https://www.facebook.com/'],
    'video, no channel' => ['https://www.youtube.com/watch?v=abc'],
    'reddit post link' => ['https://www.reddit.com/comments/abc/'],
    'maps link'       => ['https://www.google.com/maps/place/?q=place_id:abc'],
    'setlist.fm page' => ['https://www.setlist.fm/venue/klub-studio-krakow-poland-1bd6b5c4.html'],
    'bandcamp apex'   => ['https://bandcamp.com/tag/ska'],
    'blogspot apex'   => ['https://www.blogspot.com/'],
    'fb people, no id' => ['https://www.facebook.com/people/Klub-Foo/'],
    'fb pg'           => ['https://www.facebook.com/pg/KlubStudio/events/'],
    'x intent'        => ['https://x.com/intent/tweet?text=hi'],
    'not a URL'       => ['javascript:alert(1)'],
]);

it('blocks the same key, and a website’s subdomains — never an account through its platform', function () {
    $blocked = ['example.com', 'instagram.com/klubstudio'];

    expect(SiteKey::isBlocked(SiteKey::for('https://example.com/a'), $blocked))->toBeTrue()
        ->and(SiteKey::isBlocked(SiteKey::for('https://news.example.com/a'), $blocked))->toBeTrue()
        ->and(SiteKey::isBlocked(SiteKey::for('https://notexample.com/a'), $blocked))->toBeFalse()
        ->and(SiteKey::isBlocked(SiteKey::for('https://instagram.com/klubstudio'), $blocked))->toBeTrue()
        ->and(SiteKey::isBlocked(SiteKey::for('https://instagram.com/otherclub'), $blocked))->toBeFalse()
        ->and(SiteKey::isBlocked(null, $blocked))->toBeFalse();
});
