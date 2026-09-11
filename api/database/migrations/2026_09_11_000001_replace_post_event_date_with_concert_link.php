<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('post_concerts', function (Blueprint $table) {
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->foreignId('concert_id')->constrained()->cascadeOnDelete();
            $table->primary(['post_id', 'concert_id']);
        });

        Schema::table('posts', function (Blueprint $table) {
            $table->string('event_date_display')->default('range')->after('published_at');
            $table->dropColumn('event_date');
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->date('event_date')->nullable()->after('published_at');
            $table->dropColumn('event_date_display');
        });

        Schema::dropIfExists('post_concerts');
    }
};
