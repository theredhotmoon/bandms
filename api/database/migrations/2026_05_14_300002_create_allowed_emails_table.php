<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('allowed_emails', function (Blueprint $table) {
            $table->id();
            $table->string('email', 255)->unique();
            $table->string('role', 32)->default('member');
            $table->foreignId('band_member_id')->nullable()
                ->constrained('band_members')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('allowed_emails');
    }
};
