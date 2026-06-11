<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shop_item_video', function (Blueprint $table) {
            $table->foreignId('shop_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('music_video_id')->constrained('music_videos')->cascadeOnDelete();
            $table->primary(['shop_item_id', 'music_video_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shop_item_video');
    }
};
