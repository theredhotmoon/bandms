<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('setlists', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->date('event_date')->nullable();
            $table->string('venue')->nullable();
            $table->string('setlistfm_id')->nullable()->unique();
            $table->text('foh_notes')->nullable();
            $table->text('lighting_notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('setlists');
    }
};
