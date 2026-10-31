<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The crawler's findings and run log, plus the lead columns it saves into.
 *
 * A finding holds a URL, a title, a short snippet and the source's own id —
 * never a page body or another person's post. `unique(source, external_key)`
 * makes a nightly re-run an upsert; the upsert never resets `status`, so a
 * finding the band dismissed stays dismissed.
 *
 * Venues and bands gain a country: a worldwide crawler groups by it, and a
 * saved lead without one loses the field it was found by. `bands.kind` lets
 * the table that already holds "other bands and promoters" hold festivals.
 * `source` marks a row that came from the crawler (`assistant:<finding id>`).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assistant_findings', function (Blueprint $table) {
            $table->id();
            $table->string('kind', 10);                 // mention | news | lead
            $table->string('source', 40);
            $table->string('external_key', 255);
            $table->text('url');
            $table->string('title', 500);
            $table->string('snippet', 500)->default('');
            $table->string('language', 8)->nullable();
            $table->char('country', 2)->nullable()->index();
            $table->string('lead_type', 12)->nullable(); // venue|promoter|festival|band|media|profile
            $table->unsignedTinyInteger('score')->default(0);
            $table->string('status', 10)->default('new')->index(); // new | saved | dismissed
            $table->json('triage')->nullable();
            $table->string('saved_type', 20)->nullable();
            $table->unsignedBigInteger('saved_id')->nullable();
            $table->json('payload')->nullable();
            $table->timestamp('found_at')->nullable();
            $table->timestamp('triaged_at')->nullable();
            $table->timestamps();

            $table->unique(['source', 'external_key']);
            $table->index(['kind', 'status']);
        });

        Schema::create('assistant_runs', function (Blueprint $table) {
            $table->id();
            $table->string('source', 40)->index();
            $table->timestamp('started_at');
            $table->timestamp('finished_at')->nullable();
            $table->string('status', 10)->default('ok'); // ok | capped | failed
            $table->unsignedInteger('queries')->default(0);
            $table->unsignedInteger('found')->default(0);
            $table->unsignedInteger('new')->default(0);
            $table->text('error')->nullable();
            $table->timestamps();
        });

        Schema::table('venues', function (Blueprint $table) {
            $table->char('country', 2)->nullable()->after('postcode');
            $table->string('website', 500)->nullable()->after('country');
            $table->string('source', 40)->nullable();
        });
        Schema::table('bands', function (Blueprint $table) {
            $table->string('kind', 12)->default('band')->after('name');
            $table->char('country', 2)->nullable()->after('kind');
            $table->string('source', 40)->nullable();
        });
        Schema::table('authors', function (Blueprint $table) {
            $table->string('source', 40)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('authors', fn (Blueprint $t) => $t->dropColumn('source'));
        Schema::table('bands', fn (Blueprint $t) => $t->dropColumn(['kind', 'country', 'source']));
        Schema::table('venues', fn (Blueprint $t) => $t->dropColumn(['country', 'website', 'source']));
        Schema::dropIfExists('assistant_runs');
        Schema::dropIfExists('assistant_findings');
    }
};
