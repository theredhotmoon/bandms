<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('site_dirty_areas', function (Blueprint $table) {
            $table->string('area')->primary();
            $table->timestamp('changed_at', 3);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('site_dirty_areas');
    }
};
