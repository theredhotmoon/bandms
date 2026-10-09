<?php

use App\Support\PostImageFileBackfill;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `posts.image` becomes a storage path (`post-images/…`) instead of a base64
 * data URL. Existing rows are written to the public disk first, then the
 * column shrinks from mediumText to a plain string. See PostImageFileBackfill.
 */
return new class extends Migration
{
    public function up(): void
    {
        PostImageFileBackfill::run();

        Schema::table('posts', function (Blueprint $table) {
            $table->string('image')->nullable()->change();
        });
    }

    public function down(): void
    {
        // The files stay where they are and the paths still fit; only the
        // column's capacity is restored. The base64 payloads are not
        // reconstructed — they were never anything but the file's bytes.
        Schema::table('posts', function (Blueprint $table) {
            $table->mediumText('image')->nullable()->change();
        });
    }
};
