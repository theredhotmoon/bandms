<?php

use App\Mail\AssistantDigest;
use App\Models\AssistantFinding;
use App\Models\SiteSetting;
use App\Models\User;
use App\Support\CrawlerSettings;
use App\Assistant\Text\NullTextModel;
use App\Assistant\Text\TextModel;
use Illuminate\Support\Facades\Mail;
use Tests\Support\FakeTextModel;

// The Monday digest: the week's best new findings, by mail. Nothing new means
// no mail at all — never an empty Monday message.

beforeEach(function () {
    Mail::fake();
    app()->instance(TextModel::class, new FakeTextModel()); // scoring is on
    config(['assistant.admin_path' => 'backstage', 'newsletter.frontend_url' => 'https://band.example']);
    CrawlerSettings::set(['digest_to' => ['band@example.com', 'manager@example.com']]);
});

it('mails the week\'s best leads by country, every mention and the top news to the digest recipients', function () {
    AssistantFinding::factory()->lead()->create(['title' => 'Klub Pod Minogą', 'country' => 'PL', 'score' => 90, 'triaged_at' => now()]);
    AssistantFinding::factory()->lead()->create(['title' => 'SO36', 'country' => 'DE', 'score' => 70, 'triaged_at' => now()]);
    AssistantFinding::factory()->create(['kind' => 'mention', 'title' => 'Storks live review', 'score' => 60, 'triaged_at' => now()]);
    AssistantFinding::factory()->create(['kind' => 'news', 'title' => 'Ska fest lineup', 'score' => 55, 'triaged_at' => now()]);

    $this->artisan('assistant:digest')->assertSuccessful();

    // One mail each: recipients never see one another's addresses.
    Mail::assertSent(AssistantDigest::class, 2);
    Mail::assertSent(AssistantDigest::class, fn (AssistantDigest $m) => $m->hasTo('band@example.com') && !$m->hasTo('manager@example.com'));
    Mail::assertSent(AssistantDigest::class, function (AssistantDigest $mail) {
        $html = $mail->render();

        return $mail->hasTo('manager@example.com')
            && str_contains($html, 'Klub Pod Minogą') && str_contains($html, 'SO36')
            && str_contains($html, 'Storks live review') && str_contains($html, 'Ska fest lineup')
            && str_contains($html, 'https://band.example/backstage/assistant')
            && array_keys($mail->digest['leads']) === ['PL', 'DE'];
    });
});

it('leaves out what scored under 50, what was dismissed or saved, and what the last digest already had', function () {
    SiteSetting::set('assistant_last_digest_at', now()->subDay()->toIso8601String());
    AssistantFinding::factory()->lead()->create(['title' => 'Low score', 'score' => 30]);
    AssistantFinding::factory()->lead()->dismissed()->create(['title' => 'Dismissed', 'score' => 90]);
    AssistantFinding::factory()->lead()->create(['title' => 'Old news', 'score' => 90, 'triaged_at' => now()->subDays(3)]);
    AssistantFinding::factory()->lead()->create(['title' => 'Fresh lead', 'score' => 80, 'triaged_at' => now()]);

    $this->artisan('assistant:digest')->assertSuccessful();

    Mail::assertSent(AssistantDigest::class, function (AssistantDigest $mail) {
        $html = $mail->render();

        return str_contains($html, 'Fresh lead') && !str_contains($html, 'Low score')
            && !str_contains($html, 'Dismissed') && !str_contains($html, 'Old news');
    });
});

it('caps leads at ten and news at five', function () {
    AssistantFinding::factory()->lead()->count(14)->create(['score' => 80, 'country' => 'PL', 'triaged_at' => now()]);
    AssistantFinding::factory()->count(8)->create(['kind' => 'news', 'score' => 80, 'triaged_at' => now()]);
    AssistantFinding::factory()->count(25)->create(['kind' => 'mention', 'score' => 80, 'triaged_at' => now()]);

    $this->artisan('assistant:digest')->assertSuccessful();

    Mail::assertSent(AssistantDigest::class, fn (AssistantDigest $m) => count($m->digest['leads']['PL']) === 10 && count($m->digest['news']) === 5 && count($m->digest['mentions']) === 20);
});

it('sends nothing when there is nothing new, and does not move the stamp', function () {
    AssistantFinding::factory()->lead()->create(['score' => 10]);

    $this->artisan('assistant:digest')->assertSuccessful();

    Mail::assertNothingSent();
    expect(SiteSetting::get('assistant_last_digest_at'))->toBeNull();
});

it('stamps the time of the digest it sent', function () {
    $this->travelTo(\Carbon\Carbon::parse('2026-11-02 07:00', 'UTC'));
    AssistantFinding::factory()->lead()->create(['score' => 80, 'triaged_at' => now()]);

    $this->artisan('assistant:digest')->assertSuccessful();

    expect(\Carbon\Carbon::parse(SiteSetting::get('assistant_last_digest_at'))->equalTo(now()))->toBeTrue();
});

it('goes to the superadmins when no recipients are set', function () {
    CrawlerSettings::set(['digest_to' => []]);
    User::factory()->create(['role' => 'admin', 'is_superadmin' => true, 'email' => 'boss@example.com']);
    User::factory()->create(['role' => 'admin', 'is_superadmin' => false, 'email' => 'helper@example.com']);
    AssistantFinding::factory()->lead()->create(['score' => 80, 'triaged_at' => now()]);

    $this->artisan('assistant:digest')->assertSuccessful();

    Mail::assertSent(AssistantDigest::class, fn (AssistantDigest $m) => $m->hasTo('boss@example.com') && !$m->hasTo('helper@example.com'));
});

it('has no score floor when no text model is bound — a driver set without its key included', function () {
    config(['assistant.text_model' => 'anthropic']); // configured, but the key is missing:
    app()->instance(TextModel::class, new NullTextModel());
    AssistantFinding::factory()->lead()->create(['title' => 'Unscored lead', 'score' => 0]);

    $this->artisan('assistant:digest')->assertSuccessful();

    Mail::assertSent(AssistantDigest::class, fn (AssistantDigest $m) => str_contains($m->render(), 'Unscored lead'));
});

it('prints the digest with --preview, without sending or stamping', function () {
    AssistantFinding::factory()->lead()->create(['title' => 'Preview lead', 'score' => 80, 'triaged_at' => now()]);

    $this->artisan('assistant:digest', ['--preview' => true])
        ->expectsOutputToContain('Preview lead')
        ->assertSuccessful();

    Mail::assertNothingSent();
    expect(SiteSetting::get('assistant_last_digest_at'))->toBeNull();
});

it('includes a finding triaged after the last digest, even when it was found before it', function () {
    SiteSetting::set('assistant_last_digest_at', now()->subDays(6)->toIso8601String());
    // Found last Sunday, scored only on Tuesday (triage was down on Monday).
    AssistantFinding::factory()->lead()->create(['title' => 'Late-scored lead', 'score' => 85,
        'found_at' => now()->subDays(8), 'triaged_at' => now()->subDays(5)]);

    $this->artisan('assistant:digest')->assertSuccessful();

    Mail::assertSent(AssistantDigest::class, fn (AssistantDigest $m) => str_contains($m->render(), 'Late-scored lead'));
});

it('covers only the last week the first time it runs', function () {
    AssistantFinding::factory()->lead()->create(['title' => 'Ancient lead', 'score' => 90, 'triaged_at' => now()->subWeeks(5)]);
    AssistantFinding::factory()->lead()->create(['title' => 'This week lead', 'score' => 90, 'triaged_at' => now()->subDay()]);

    $this->artisan('assistant:digest')->assertSuccessful();

    Mail::assertSent(AssistantDigest::class, fn (AssistantDigest $m) => !str_contains($m->render(), 'Ancient lead') && str_contains($m->render(), 'This week lead'));
});
