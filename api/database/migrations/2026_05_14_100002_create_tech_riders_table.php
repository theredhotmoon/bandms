<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tech_riders', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('profile_id')->default(1)->index();
            $table->string('name', 255);
            $table->boolean('is_active')->default(false);

            // Section 2 – Stage plot: array of { id, type, label, x, y, inputNumber? }
            $table->json('stage_plot_data')->nullable();

            // Section 3 – Inputs list
            $table->json('inputs')->nullable();

            // Section 4 – Monitors / IEMs
            $table->json('monitors')->nullable();

            // Section 5 – Backline
            $table->json('backline')->nullable();

            // Section 6 – PA / FOH
            $table->json('pa_foh')->nullable();

            // Section 7 – Power requirements
            $table->json('power')->nullable();

            // Section 8 – RF / Wireless
            $table->json('rf_wireless')->nullable();

            $table->timestamps();

            $table->foreign('profile_id')->references('id')->on('band_profiles')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tech_riders');
    }
};
