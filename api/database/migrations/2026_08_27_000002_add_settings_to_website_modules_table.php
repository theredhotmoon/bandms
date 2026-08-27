<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Per-module editable copy, as a generic bag rather than named columns.
 *
 * The Contact page needs a kicker, a lead paragraph, a reply-time badge and a
 * note per contact channel. Adding six translatable columns to website_modules
 * would put one module's fields on every module's row — fine for this band,
 * wrong for a CMS meant to serve many.
 *
 * Shape is {"<field>": {"en": "...", "pl": "..."}}. Spatie is deliberately NOT
 * used here: it maps one column to one translatable value, and this column
 * holds a map of them. site-config resolves the active locale before serving,
 * so the public site never sees the envelope.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('website_modules', function (Blueprint $table) {
            $table->json('settings')->nullable()->after('custom_slug');
        });

        // Seed the Contact module with the copy the design ships, so a fresh
        // install renders a complete page instead of an empty hero. Wording is
        // lifted from the design's COPY object (variants/shared.jsx).
        DB::table('website_modules')->where('slug', 'contact')->update([
            'settings' => json_encode([
                'kicker' => [
                    'en' => 'GET IN TOUCH',
                    'pl' => 'SKONTAKTUJ SIĘ',
                ],
                'lead' => [
                    'en' => 'Booking a show, a press request, or just want to say BIG UP SKA? Drop us a line — we reply within 48 hours.',
                    'pl' => 'Booking koncertu, zapytanie prasowe, a może po prostu chcesz powiedzieć BIG UP SKA? Napisz do nas — odpowiadamy w 48 godzin.',
                ],
                'reply_time_label' => [
                    'en' => 'Replies within 48h',
                    'pl' => 'Odpowiedź w 48h',
                ],
                'booking_note' => [
                    'en' => 'Shows, festivals, private parties',
                    'pl' => 'Koncerty, festiwale, imprezy prywatne',
                ],
                'press_note' => [
                    'en' => 'Interviews, premieres, reviews',
                    'pl' => 'Wywiady, premiery, recenzje',
                ],
                'general_note' => [
                    'en' => 'Everything else — say hi!',
                    'pl' => 'Wszystko inne — cześć!',
                ],
            ], JSON_UNESCAPED_UNICODE),
        ]);
    }

    public function down(): void
    {
        Schema::table('website_modules', function (Blueprint $table) {
            $table->dropColumn('settings');
        });
    }
};
