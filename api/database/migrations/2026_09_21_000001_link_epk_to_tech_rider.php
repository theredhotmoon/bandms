<?php

use App\Models\BandProfile;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

/**
 * The EPK links a tech rider from the tech-rider module instead of carrying
 * an uploaded PDF and stage-plot image. The rider's public page already
 * renders both documents, so the two file columns go — and the files they
 * point at go with them, which is why down() cannot bring them back.
 *
 * The files are only deleted once the schema change that makes them
 * unreachable has actually landed: a failed ALTER must leave the still-
 * existing columns pointing at files that are still there.
 * See docs/superpowers/specs/2026-09-21-epk-tech-rider-link-design.md.
 */
return new class extends Migration
{
    public function up(): void
    {
        $paths = BandProfile::query()
            ->get(['tech_rider_path', 'stage_plot_path'])
            ->flatMap(fn ($profile) => [$profile->tech_rider_path, $profile->stage_plot_path])
            ->filter()
            ->values();

        Schema::table('band_profiles', function (Blueprint $table) {
            $table->foreignId('epk_tech_rider_id')->nullable()->after('epk_album_id')
                  ->constrained('tech_riders')->nullOnDelete();
            $table->dropColumn(['tech_rider_path', 'stage_plot_path']);
        });

        // Only once the columns are gone: a failed ALTER above must leave the
        // files where the still-existing columns point.
        foreach ($paths as $path) {
            Storage::disk('public')->delete($path);
        }
    }

    public function down(): void
    {
        Schema::table('band_profiles', function (Blueprint $table) {
            $table->dropForeign(['epk_tech_rider_id']);
            $table->dropColumn('epk_tech_rider_id');
            // The columns return; the files they held do not.
            $table->string('tech_rider_path')->nullable()->after('stat_facebook_followers');
            $table->string('stage_plot_path')->nullable()->after('tech_rider_path');
        });
    }
};
