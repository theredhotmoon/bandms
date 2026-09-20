<?php

use App\Support\EmbedProvider;

describe('EmbedProvider::detect', function () {
    it('detects youtube from both hosts', function () {
        expect(EmbedProvider::detect('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))->toBe('youtube');
        expect(EmbedProvider::detect('https://youtu.be/dQw4w9WgXcQ'))->toBe('youtube');
    });

    it('detects vimeo, instagram and tiktok', function () {
        expect(EmbedProvider::detect('https://vimeo.com/76979871'))->toBe('vimeo');
        expect(EmbedProvider::detect('https://www.instagram.com/p/CxYzAbC1234/'))->toBe('instagram');
        expect(EmbedProvider::detect('https://www.tiktok.com/@band/video/7234567890123456789'))->toBe('tiktok');
    });

    it('detects facebook from facebook.com and fb.watch', function () {
        expect(EmbedProvider::detect('https://www.facebook.com/band/videos/1234567890/'))->toBe('facebook');
        expect(EmbedProvider::detect('https://fb.watch/abcDEF123/'))->toBe('facebook');
    });

    it('falls back to link for any other host', function () {
        expect(EmbedProvider::detect('https://example.com/news'))->toBe('link');
    });

    it('falls back to link rather than throwing on an unparseable url', function () {
        expect(EmbedProvider::detect('not a url at all'))->toBe('link');
        expect(EmbedProvider::detect(''))->toBe('link');
    });
});

describe('EmbedProvider::embedId', function () {
    it('extracts a youtube id from watch, short and embed forms', function () {
        expect(EmbedProvider::embedId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))->toBe('dQw4w9WgXcQ');
        expect(EmbedProvider::embedId('https://youtu.be/dQw4w9WgXcQ'))->toBe('dQw4w9WgXcQ');
        expect(EmbedProvider::embedId('https://www.youtube.com/embed/dQw4w9WgXcQ'))->toBe('dQw4w9WgXcQ');
    });

    it('extracts vimeo, instagram and tiktok ids', function () {
        expect(EmbedProvider::embedId('https://vimeo.com/76979871'))->toBe('76979871');
        expect(EmbedProvider::embedId('https://www.instagram.com/p/CxYzAbC1234/'))->toBe('CxYzAbC1234');
        expect(EmbedProvider::embedId('https://www.tiktok.com/@band/video/7234567890123456789'))
            ->toBe('7234567890123456789');
    });

    it('extracts an instagram reel id as well as a post id', function () {
        expect(EmbedProvider::embedId('https://www.instagram.com/reel/CxYzAbC1234/'))->toBe('CxYzAbC1234');
    });

    // A provider with a null id must render as a link row, never as an iframe
    // with a broken src — so returning null here is load-bearing.
    it('returns null for a link and for an unparseable provider url', function () {
        expect(EmbedProvider::embedId('https://example.com/news'))->toBeNull();
        expect(EmbedProvider::embedId('https://vimeo.com/channels/staffpicks'))->toBeNull();
    });

    // Facebook's player takes the whole video URL as ?href=, not an id — so
    // the "id" is the URL itself, and a page URL (no video) yields null.
    it('returns the full url as the facebook embed id, null for a page', function () {
        $video = 'https://www.facebook.com/band/videos/1234567890/';
        expect(EmbedProvider::embedId($video))->toBe($video);
        expect(EmbedProvider::embedId('https://www.facebook.com/watch/?v=1234567890'))->toBe('https://www.facebook.com/watch/?v=1234567890');
        expect(EmbedProvider::embedId('https://www.facebook.com/reel/1234567890'))->toBe('https://www.facebook.com/reel/1234567890');
        expect(EmbedProvider::embedId('https://fb.watch/abcDEF123/'))->toBe('https://fb.watch/abcDEF123/');
        expect(EmbedProvider::embedId('https://www.facebook.com/band/posts/123'))->toBeNull();
    });

    it('extracts spotify as type/id and rejects an artist page', function () {
        expect(EmbedProvider::embedId('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC'))->toBe('track/4uLU6hMCjMI75M1A2tKUQC');
        expect(EmbedProvider::embedId('https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3?si=abc'))->toBe('album/1DFixLWuPkv3KT3TnV35m3');
        expect(EmbedProvider::embedId('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'))->toBe('playlist/37i9dQZF1DXcBWIGoYBM5M');
        expect(EmbedProvider::embedId('https://open.spotify.com/artist/0OdUWJ0sBjDrqHygGUXeCF'))->toBeNull();
        // A localised web player shares /intl-xx/ links — what a Polish band copies.
        expect(EmbedProvider::embedId('https://open.spotify.com/intl-pl/track/4uLU6hMCjMI75M1A2tKUQC?si=x'))->toBe('track/4uLU6hMCjMI75M1A2tKUQC');
        expect(EmbedProvider::embedId('https://open.spotify.com/intl-pt-br/album/1DFixLWuPkv3KT3TnV35m3'))->toBe('album/1DFixLWuPkv3KT3TnV35m3');
    });

    // SoundCloud's player takes ?url=<page>, so the id is the URL — but only a
    // track/set path; a bare profile names nothing playable.
    it('returns the full url for a soundcloud track and null for a profile', function () {
        expect(EmbedProvider::embedId('https://soundcloud.com/band/live-at-klub-x'))->toBe('https://soundcloud.com/band/live-at-klub-x');
        expect(EmbedProvider::embedId('https://soundcloud.com/band'))->toBeNull();
    });

    it('returns the path for an apple music album or song and null for the root', function () {
        expect(EmbedProvider::embedId('https://music.apple.com/pl/album/some-album/1440857781'))->toBe('/pl/album/some-album/1440857781');
        expect(EmbedProvider::embedId('https://music.apple.com/us/album/song-name/1440857781?i=1440857800'))->toBe('/us/album/song-name/1440857781?i=1440857800');
        expect(EmbedProvider::embedId('https://music.apple.com/'))->toBeNull();
    });
});

describe('EmbedProvider::detect — audio', function () {
    it('detects spotify, soundcloud and apple music', function () {
        expect(EmbedProvider::detect('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC'))->toBe('spotify');
        expect(EmbedProvider::detect('https://soundcloud.com/band/live'))->toBe('soundcloud');
        expect(EmbedProvider::detect('https://music.apple.com/pl/album/x/1'))->toBe('apple_music');
    });

    it('knows which providers are audio', function () {
        expect(EmbedProvider::isAudio('spotify'))->toBeTrue();
        expect(EmbedProvider::isAudio('soundcloud'))->toBeTrue();
        expect(EmbedProvider::isAudio('apple_music'))->toBeTrue();
        expect(EmbedProvider::isAudio('youtube'))->toBeFalse();
        expect(EmbedProvider::isAudio('link'))->toBeFalse();
    });
});
