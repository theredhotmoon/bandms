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

        // A row the disk refused to write still holds its base64 payload —
        // the only copy of that picture. Shrinking the column would truncate
        // it, so stop here and leave the migration to be re-run once the
        // disk is writable again.
        if (($left = PostImageFileBackfill::remaining()) > 0) {
            throw new RuntimeException(
                "{$left} post image(s) could not be written to the public disk; posts.image left as mediumText."
            );
        }

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
