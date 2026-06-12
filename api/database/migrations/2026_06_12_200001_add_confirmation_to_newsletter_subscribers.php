<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('newsletter_subscribers', function (Blueprint $table) {
            $table->string('confirmation_token', 64)->nullable()->unique()->after('source');
            $table->string('unsubscribe_token',  64)->nullable()->unique()->after('confirmation_token');
            $table->timestamp('confirmed_at')->nullable()->after('subscribed_at');
        });

        // Grandfather existing subscribers as confirmed and give them an unsubscribe token.
        DB::statement('UPDATE newsletter_subscribers SET confirmed_at = subscribed_at WHERE confirmed_at IS NULL');

        // Generate unsubscribe tokens for existing rows that don't have one.
        // Using a PHP loop here because SQL has no portable random() for strings.
        DB::table('newsletter_subscribers')->whereNull('unsubscribe_token')->orderBy('id')->each(function ($row) {
            DB::table('newsletter_subscribers')
                ->where('id', $row->id)
                ->update(['unsubscribe_token' => Str::random(64)]);
        });
    }

    public function down(): void
    {
        Schema::table('newsletter_subscribers', function (Blueprint $table) {
            $table->dropColumn(['confirmation_token', 'unsubscribe_token', 'confirmed_at']);
        });
    }
};
