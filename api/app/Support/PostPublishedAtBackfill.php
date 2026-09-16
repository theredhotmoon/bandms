<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/**
 * Stamps every dateless post with its created_at.
 *
 * Runs once, from the migration that starts hiding drafts from the public
 * site. Before that filter existed a post with no date was still served, and
 * on every database this project has — dev and production alike — that was
 * all of them. Without this step the filter would have emptied the news
 * section overnight. Dated by created_at, so the public date is the day the
 * post was written, which is what the fallback `published_at ?? created_at`
 * on the public site had been displaying all along.
 *
 * updated_at is deliberately left alone: nothing about the content changed.
 */
final class PostPublishedAtBackfill
{
    /** @return int rows changed */
    public static function run(): int
    {
        return DB::table('posts')
            ->whereNull('published_at')
            ->update(['published_at' => DB::raw('created_at')]);
    }
}
