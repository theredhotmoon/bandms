<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// The crawler's triage, scheduled in bootstrap/app.php (the digest is
// App\Console\Commands\AssistantDigestCommand).
Artisan::command('assistant:triage', function () {
    // Without a text model there is nothing to classify with; the inbox then
    // lists findings untriaged, by recency. The binding decides, not the
    // config string: a driver named without its key is the null model, and
    // queuing triage against it would fail every finding until set aside.
    if (app(\App\Assistant\Text\TextModel::class) instanceof \App\Assistant\Text\NullTextModel) {
        $this->line('No text model configured (ASSISTANT_TEXT_MODEL_DRIVER) — skipping triage.');

        return;
    }
    \App\Assistant\Crawler\TriageFindingsJob::dispatch();
    $this->info('Triage queued.');
})->purpose("Classify the assistant's new findings");
