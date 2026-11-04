<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The inbox's two ways to say no. "Not now" snoozes one finding until a date
 * (`snoozed_until`, status `snoozed`); "Wrong" dismisses it and may block its
 * whole site, channel or account, so the crawler stops adding anything from
 * there (`assistant_blocked_sites`, keyed by `SiteKey`).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assistant_findings', function (Blueprint $table) {
            $table->timestamp('snoozed_until')->nullable()->after('status')->index();
            // When a snooze last ended: the digest counts a woken finding as
            // news again, though it was found and triaged long before.
            $table->timestamp('woke_at')->nullable()->after('snoozed_until');
        });

        Schema::create('assistant_blocked_sites', function (Blueprint $table) {
            $table->id();
            $table->string('site_key', 255)->unique();
            $table->string('label', 255);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assistant_blocked_sites');
        Schema::table('assistant_findings', function (Blueprint $table) {
            $table->dropIndex(['snoozed_until']);
            $table->dropColumn(['snoozed_until', 'woke_at']);
        });
    }
};
