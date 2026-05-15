<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('band_profiles', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('bio_short', 280)->nullable();
            $table->text('bio_medium')->nullable();
            $table->text('bio_long')->nullable();
            $table->text('bio_full')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('band_profiles');
    }
};
