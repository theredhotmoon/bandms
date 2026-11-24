<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fan_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('fan_account_id')->constrained()->cascadeOnDelete();
            $table->char('token_hash', 64)->unique();
            $table->string('method', 16);
            $table->timestamp('last_used_at');
            $table->timestamp('expires_at')->index();
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fan_sessions');
    }
};
