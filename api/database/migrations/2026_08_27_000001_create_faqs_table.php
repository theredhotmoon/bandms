<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * FAQ entries, grouped by the public subpage they answer for.
 *
 * `module_slug` mirrors website_modules.slug, so the FAQ categories track the
 * site's sections rather than being a second taxonomy to keep in sync. It is a
 * plain string, not a foreign key: a question must survive its module being
 * disabled (the row is simply not rendered) and modules are addressed by slug
 * everywhere else in this codebase.
 *
 * question/answer are Spatie-translatable JSON, matching website_modules'
 * custom_name/custom_slug. They are `text` rather than `string` because an
 * answer holds a paragraph per locale and the JSON envelope doubles the length.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('faqs', function (Blueprint $table) {
            $table->id();
            $table->string('module_slug', 60)->index();
            $table->text('question');
            $table->text('answer');
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_published')->default(true);
            $table->timestamps();

            // The public endpoint always filters by module + published state and
            // orders by sort_order; this is the only read path that matters.
            $table->index(['module_slug', 'is_published', 'sort_order'], 'faqs_public_read_index');
        });

        // The four questions the design ships, so a fresh install renders a
        // complete Contact page. Copy is lifted verbatim from the design's
        // variants/contact_shared.jsx.
        $now  = now();
        $seed = [
            [
                'q' => ['en' => 'How far ahead should we book you?', 'pl' => 'Z jakim wyprzedzeniem rezerwować?'],
                'a' => [
                    'en' => "Four to eight weeks is ideal for clubs; festivals we'll happily pencil in months out. Tight on time? Ask anyway — we love a last-minute skank.",
                    'pl' => 'Cztery do ośmiu tygodni to ideał dla klubów; festiwale chętnie wpiszemy z wielomiesięcznym wyprzedzeniem. Mniej czasu? I tak pytaj — uwielbiamy skank na ostatnią chwilę.',
                ],
            ],
            [
                'q' => ['en' => 'How big is the band on stage?', 'pl' => 'Ilu was jest na scenie?'],
                'a' => [
                    'en' => 'Six players plus one sound tech — a full brass-and-rhythm line-up. Stage minimum is roughly 6 × 4 m; full input list and stage plan are in the tech rider.',
                    'pl' => 'Sześciu muzyków plus realizator dźwięku — pełna sekcja dęta i rytmiczna. Minimalna scena to ok. 6 × 4 m; pełna lista wejść i plan sceny są w riderze.',
                ],
            ],
            [
                'q' => ['en' => 'Do you travel outside Poland?', 'pl' => 'Czy gracie poza Polską?'],
                'a' => [
                    'en' => "Absolutely. We're Warszawa-based but tour-ready across Europe — sort the logistics with us and we'll bring the upbeat.",
                    'pl' => 'Oczywiście. Bazujemy w Warszawie, ale jesteśmy gotowi na trasę po całej Europie — dogadajmy logistykę, a my przywieziemy upbeat.',
                ],
            ],
            [
                'q' => ['en' => 'Can we get a custom set length?', 'pl' => 'Czy można ustalić długość setu?'],
                'a' => [
                    'en' => "Standard set runs 60–90 minutes. Need a short festival slot or a two-set club night? Tell us in the form and we'll tailor it.",
                    'pl' => 'Standardowy set to 60–90 minut. Potrzebujesz krótkiego slotu festiwalowego albo dwóch setów w klubie? Napisz w formularzu, dopasujemy.',
                ],
            ],
        ];

        foreach ($seed as $i => $row) {
            DB::table('faqs')->insert([
                'module_slug'  => 'contact',
                'question'     => json_encode($row['q'], JSON_UNESCAPED_UNICODE),
                'answer'       => json_encode($row['a'], JSON_UNESCAPED_UNICODE),
                'sort_order'   => $i,
                'is_published' => true,
                'created_at'   => $now,
                'updated_at'   => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('faqs');
    }
};
