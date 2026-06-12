<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->char('uuid', 36)->unique();
            $table->string('email');
            $table->string('name');
            $table->enum('status', ['pending', 'paid', 'shipped', 'cancelled'])->default('pending');
            $table->string('stripe_session_id')->unique()->nullable();
            $table->string('stripe_payment_intent_id')->nullable();
            $table->char('currency', 3);
            $table->decimal('total', 10, 2);
            $table->json('shipping_address');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
