<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Separate from the create-and-backfill migration on purpose: this half is the
 * irreversible one, so it can be held back or reverted on its own if the
 * backfill turns out wrong.
 *
 * post_tours is deliberately NOT dropped. With `tour` removed as a ref target
 * there is nowhere to backfill it to, so dropping the table would destroy the
 * only record of each post-tour association. Nothing renders those rows today;
 * removing the table is a separate, explicit decision.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('post_links');
        Schema::dropIfExists('post_concerts');
        Schema::dropIfExists('post_albums');
        Schema::dropIfExists('post_releases');
        Schema::dropIfExists('post_music_videos');

        Schema::table('posts', function (Blueprint $table) {
            $table->dropColumn('content');
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->longText('content')->nullable()->after('slug_pl');
        });

        foreach ([
            'post_concerts'     => ['concert_id', 'concerts'],
            'post_albums'       => ['album_id', 'albums'],
            'post_releases'     => ['release_id', 'releases'],
            'post_music_videos' => ['music_video_id', 'music_videos'],
        ] as $name => [$column, $target]) {
            Schema::create($name, function (Blueprint $table) use ($column, $target) {
                $table->id();
                $table->foreignId('post_id')->constrained()->cascadeOnDelete();
                $table->foreignId($column)->constrained($target)->cascadeOnDelete();
                $table->timestamps();
            });
        }

        Schema::create('post_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->string('type');
            $table->string('url');
            $table->string('label')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
            $table->index(['post_id', 'sort_order']);
        });
    }
};
