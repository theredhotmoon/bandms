<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hero_images', function (Blueprint $table) {
            $table->dropForeign(['photo_id']);
        });

        // Confirmed with the band: nothing real is set yet, so the table is
        // reset rather than migrated. A photo_id row has no meaning under the
        // new schema — hero images are no longer gallery photos.
        DB::table('hero_images')->truncate();

        Schema::table('hero_images', function (Blueprint $table) {
            $table->dropColumn('photo_id');
            $table->string('image')->after('scope');
            $table->string('caption')->nullable()->after('image');
            $table->boolean('active')->default(true)->after('position');
        });
    }

    public function down(): void
    {
        Schema::table('hero_images', function (Blueprint $table) {
            $table->dropColumn(['image', 'caption', 'active']);
        });

        DB::table('hero_images')->truncate();

        Schema::table('hero_images', function (Blueprint $table) {
            $table->foreignId('photo_id')->after('id')->constrained()->cascadeOnDelete();
        });
    }
};
