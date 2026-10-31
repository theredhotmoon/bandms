<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// The crawler's triage and digest are scheduled in bootstrap/app.php. The
// digest does nothing until its slice lands.
Artisan::command('assistant:triage', function () {
    // Without a text model there is nothing to classify with; the inbox then
    // lists findings untriaged, by recency.
    if (config('assistant.text_model') === 'none') {
        $this->line('No text model configured (ASSISTANT_TEXT_MODEL_DRIVER) — skipping triage.');

        return;
    }
    \App\Assistant\Crawler\TriageFindingsJob::dispatch();
    $this->info('Triage queued.');
})->purpose("Classify the assistant's new findings");

Artisan::command('assistant:digest {--preview}', function () {
    $this->line('The digest arrives with a later crawler slice — nothing to send yet.');
})->purpose("Send the assistant's weekly digest");
