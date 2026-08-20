<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tickets', function (Blueprint $table) {
            $table->id();
            $table->char('uuid', 36)->unique();
            $table->foreignId('order_item_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('concert_ticket_type_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('status', ['active', 'transferred', 'scanned', 'voided'])->default('active');
            $table->string('holder_email');
            $table->string('holder_name');
            $table->foreignId('fan_account_id')->nullable()->constrained('fan_accounts')->nullOnDelete();
            $table->string('wallet_pass_serial')->nullable();
            $table->timestamp('scanned_at')->nullable();
            $table->timestamp('transferred_at')->nullable();
            $table->foreignId('transferred_from_id')->nullable()->constrained('tickets')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tickets');
    }
};
