<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * "Has everyone confirmed their rig for this gig?"
 *
 * The completeness bar already answers whether a musician's rig *looks* filled
 * in. It cannot answer whether the musician has actually looked at it — a rig
 * saved in March is complete and may still be wrong for tonight. This records
 * the asking and the answering, per rider and per musician, so the question has
 * somewhere to live other than a group chat.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tech_rider_confirmations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tech_rider_id')->constrained()->cascadeOnDelete();
            $table->foreignId('band_member_id')->constrained()->cascadeOnDelete();

            $table->timestamp('requested_at')->nullable();
            // Null until the musician says yes. Re-asking clears it, because a
            // confirmation of the rider as it stood two weeks ago is not a
            // confirmation of the rider as it stands now.
            $table->timestamp('confirmed_at')->nullable();

            $table->timestamps();

            // One standing question per musician per rider — asking again
            // updates the row rather than growing a log nobody reads.
            $table->unique(['tech_rider_id', 'band_member_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tech_rider_confirmations');
    }
};
