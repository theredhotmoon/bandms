<?php

use App\Support\PostPublishedAtBackfill;
use Illuminate\Database\Migrations\Migration;

/**
 * GET /api/posts and /api/posts/{post} now hide drafts (null published_at).
 * Every existing dateless post gets its created_at as published_at so that
 * what was visible yesterday stays visible today. See PostPublishedAtBackfill.
 */
return new class extends Migration
{
    public function up(): void
    {
        PostPublishedAtBackfill::run();
    }

    public function down(): void
    {
        // Irreversible by design: once stamped there is no record of which
        // rows were null. Nothing structural changed, so there is nothing to
        // undo either.
    }
};
