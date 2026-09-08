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

    // facebook is deliberately NOT a provider: the old post_links.type column
    // carried it, and the backfill re-detects rather than mapping that column.
    it('falls back to link for any other host, facebook included', function () {
        expect(EmbedProvider::detect('https://www.facebook.com/band/posts/123'))->toBe('link');
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
});
