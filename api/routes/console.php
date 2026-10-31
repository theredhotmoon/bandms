<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// The crawler's triage (slice 3) and digest (slice 4) are scheduled already
// (bootstrap/app.php) and do nothing until their slices land.
Artisan::command('assistant:triage', function () {
    $this->line('Triage arrives with the next crawler slice — nothing to do yet.');
})->purpose("Classify the assistant's new findings");

Artisan::command('assistant:digest {--preview}', function () {
    $this->line('The digest arrives with a later crawler slice — nothing to send yet.');
})->purpose("Send the assistant's weekly digest");
