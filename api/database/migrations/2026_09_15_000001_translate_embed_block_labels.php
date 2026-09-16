<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Every other block payload field ({body}, {alt}, {caption}) is a {en, pl}
 * bag; the embed block's `label` was validated and stored as a plain string
 * instead, so it never resolved per-locale and the admin never offered a
 * Polish input for it. This converts existing rows to match; the write path
 * (PostRules, PostBlockResource, PostBlockBackfill) was fixed alongside it.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('post_blocks')->where('type', 'embed')->orderBy('id')
            ->chunkById(200, function ($blocks) {
                foreach ($blocks as $block) {
                    $payload = json_decode($block->payload, true) ?? [];
                    $label   = $payload['label'] ?? null;

                    if (!is_string($label)) {
                        continue;
                    }

                    $payload['label'] = trim($label) !== '' ? ['en' => $label, 'pl' => null] : null;

                    DB::table('post_blocks')->where('id', $block->id)
                        ->update(['payload' => json_encode($payload, JSON_UNESCAPED_UNICODE)]);
                }
            });
    }

    public function down(): void
    {
        DB::table('post_blocks')->where('type', 'embed')->orderBy('id')
            ->chunkById(200, function ($blocks) {
                foreach ($blocks as $block) {
                    $payload = json_decode($block->payload, true) ?? [];
                    $label   = $payload['label'] ?? null;

                    if (!is_array($label)) {
                        continue;
                    }

                    $payload['label'] = $label['en'] ?? $label['pl'] ?? null;

                    DB::table('post_blocks')->where('id', $block->id)
                        ->update(['payload' => json_encode($payload, JSON_UNESCAPED_UNICODE)]);
                }
            });
    }
};
