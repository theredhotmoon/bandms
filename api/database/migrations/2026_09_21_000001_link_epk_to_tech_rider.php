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
 * See docs/superpowers/specs/2026-09-21-epk-tech-rider-link-design.md.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (BandProfile::query()->get(['id', 'tech_rider_path', 'stage_plot_path']) as $profile) {
            foreach ([$profile->tech_rider_path, $profile->stage_plot_path] as $path) {
                if ($path) {
                    Storage::disk('public')->delete($path);
                }
            }
        }

        Schema::table('band_profiles', function (Blueprint $table) {
            $table->foreignId('epk_tech_rider_id')->nullable()->after('epk_album_id')
                  ->constrained('tech_riders')->nullOnDelete();
            $table->dropColumn(['tech_rider_path', 'stage_plot_path']);
        });
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
