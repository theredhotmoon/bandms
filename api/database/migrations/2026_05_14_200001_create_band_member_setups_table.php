<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('band_member_setups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('band_member_id')->constrained()->cascadeOnDelete();
            $table->foreignId('instrument_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name', 255);                // "Festival rig", "Club show"
            $table->string('signal_chain_type', 64);    // see SignalChainType enum

            // Inputs: InputRow[] — same schema as tech_riders.inputs
            $table->json('inputs')->nullable();

            // Monitor preferences
            $table->json('monitor')->nullable();

            // Backline preferences
            $table->json('backline')->nullable();

            // Power requirements
            $table->json('power')->nullable();

            // FOH / PA notes (free text)
            $table->text('foh_notes')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('band_member_setups');
    }
};
