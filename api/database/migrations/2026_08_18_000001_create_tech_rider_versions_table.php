<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Freezes a rider at the moment it is sent out.
 *
 * A live rider is derived: its channel list comes from the musicians' saved
 * rigs and changes the instant one of them does. That is right while planning
 * and wrong once a venue has the link — the promoter must keep seeing the sheet
 * they were sent, not whatever the band edited afterwards.
 *
 * A version stores the *inputs* to resolution (the rider, the setups its
 * placements reference, the musicians' names), not the resolved lists. The
 * resolver is pure, so frozen inputs render a frozen sheet — and there is still
 * exactly one implementation of the derivation rules, in
 * app/src/utils/riderResolver.ts, rather than a second one in PHP that would
 * drift from it.
 *
 * Modelled on epk_versions, with two differences: versions are per-rider rather
 * than global, and there is no `pending` state — publishing is one action, so a
 * version only ever exists because someone sent it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tech_rider_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tech_rider_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('version_number');
            $table->text('notes')->nullable();
            $table->longText('snapshot');
            $table->enum('status', ['published', 'archived'])->default('published');
            $table->timestamp('published_at')->nullable();

            // Each version is independently shareable, so a corrected rider can
            // be re-sent without invalidating the link the venue already has.
            $table->string('public_token', 64)->unique();

            $table->timestamps();

            $table->unique(['tech_rider_id', 'version_number']);
            // "the version this rider's QR code resolves to" is the hot lookup.
            $table->index(['tech_rider_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tech_rider_versions');
    }
};
