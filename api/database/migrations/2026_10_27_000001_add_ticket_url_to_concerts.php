<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * An external ticket shop is a field of the concert, not a link whose label
 * happens to contain "ticket". The public site used to guess it from the link
 * label (/ticket|buy|bilet/i), so a link labelled "Bilety VIP" or "Buy merch"
 * was a ticket button and one labelled "Kasa" was not.
 *
 * For a show still to come, the first link that guess matched becomes
 * ticket_url and is removed from the links, so it keeps exactly the button it
 * showed before. Past shows are left alone: their page lists such a link under
 * "Links", and renders ticket_url only for an upcoming show — moving it would
 * have deleted it from the page.
 */
return new class extends Migration
{
    private const GUESS = '/ticket|buy|bilet/i';

    public function up(): void
    {
        Schema::table('concerts', function (Blueprint $table) {
            $table->string('ticket_url', 500)->nullable()->after('poster');
        });

        $upcoming = DB::table('concerts')->where('date', '>=', now()->toDateString())->pluck('id');

        DB::table('concert_links')->whereIn('concert_id', $upcoming)->orderBy('id')->get()
            ->groupBy('concert_id')
            ->each(function ($links, $concertId) {
                $link = $links->first(fn ($l) => preg_match(self::GUESS, $l->label));
                if (! $link) {
                    return;
                }
                DB::table('concerts')->where('id', $concertId)->update(['ticket_url' => $link->url]);
                DB::table('concert_links')->where('id', $link->id)->delete();
            });
    }

    public function down(): void
    {
        DB::table('concerts')->whereNotNull('ticket_url')->orderBy('id')->get(['id', 'ticket_url'])
            ->each(fn ($c) => DB::table('concert_links')->insert([
                'concert_id' => $c->id,
                'label'      => 'Buy Tickets',
                'url'        => $c->ticket_url,
                'created_at' => now(),
                'updated_at' => now(),
            ]));

        Schema::table('concerts', function (Blueprint $table) {
            $table->dropColumn('ticket_url');
        });
    }
};
