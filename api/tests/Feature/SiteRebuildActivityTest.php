<?php

use App\Models\ActivityChange;
use App\Models\ActivityLog;
use App\Models\SiteDirtyArea;
use App\Models\SiteSetting;
use App\Models\Tag;
use App\Models\User;
use App\Support\SiteRebuild;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Laravel\Passport\Passport;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

beforeEach(function () {
    Http::fake(['http://web:3001/*' => Http::response(['status' => 'started'], 200)]);
});

/** The newest `rebuilt` change, with its log row. */
function latestRebuild(): ActivityChange
{
    return ActivityChange::where('event', 'rebuilt')->latest('id')->firstOrFail();
}

it('logs who pressed Rebuild and which pending areas went out', function () {
    $admin = User::factory()->create(['role' => 'admin', 'first_name' => 'Ada', 'last_name' => 'Lovelace']);
    Passport::actingAs($admin);

    SiteDirtyArea::markDirty('concerts');
    SiteDirtyArea::markDirty('faqs');

    $this->postJson('/api/admin/site/rebuild')->assertOk();

    $change = latestRebuild();
    $log    = ActivityLog::findOrFail($change->activity_log_id);

    expect($log->user_id)->toBe($admin->id)
        ->and($log->user_name)->toBe('Ada Lovelace')
        ->and($log->action)->toBe('rebuilt')
        ->and($log->route)->toBe('api.admin.site.rebuild')
        ->and($log->subject_type)->toBe('PublicSite')
        ->and($change->diff['trigger'])->toBe([null, 'manual'])
        ->and($change->diff['areas'][1])->toEqualCanonicalizing(['concerts', 'faqs']);
});

it('lists the logged edits made since the previous rebuild, and no earlier ones', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $this->postJson('/api/tags', ['name' => ['en' => 'Already live']])->assertCreated();
    $this->postJson('/api/admin/site/rebuild')->assertOk();

    $this->postJson('/api/tags', ['name' => ['en' => 'Ships now']])->assertCreated();
    $tag = Tag::latest('id')->firstOrFail();
    $this->putJson("/api/tags/{$tag->id}", ['name' => ['en' => 'Ships now, renamed']])->assertSuccessful();

    $this->postJson('/api/admin/site/rebuild')->assertOk();

    $included = latestRebuild()->diff['changes'][1];

    expect(array_column($included, 'action'))->toBe(['created', 'updated'])
        ->and(array_column($included, 'subject_type'))->toBe(['Tag', 'Tag'])
        ->and($included[1]['subject_label'])->toBe('Ships now, renamed')
        ->and(array_column($included, 'subject_label'))->not->toContain('Already live');
});

it('does not list a previous rebuild as one of the changes it shipped', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $this->postJson('/api/admin/site/rebuild')->assertOk();
    $this->postJson('/api/admin/site/rebuild')->assertOk();

    expect(latestRebuild()->diff['changes'][1])->toBe([]);
});

it('files an automatic rebuild under the save that fired it', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'true']);

    $this->postJson('/api/admin/faqs', [
        'module_slug' => 'contact',
        'question'    => ['en' => 'Do you play weddings?'],
        'answer'      => ['en' => 'Sometimes.'],
    ])->assertCreated();

    $change = latestRebuild();
    $log    = ActivityLog::with('entries')->findOrFail($change->activity_log_id);

    expect($change->diff['trigger'])->toBe([null, 'auto'])
        ->and($change->diff['areas'][1])->toBe(['faqs'])
        ->and($change->diff)->not->toHaveKey('changes')
        // The save, not the rebuild, names the entry.
        ->and($log->action)->toBe('created')
        ->and($log->entries->pluck('event')->all())->toContain('created', 'rebuilt');
});

it('files one automatic rebuild per save, however many areas the save marks', function () {
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'true']);

    // A clip on a concert and a release marks each owner's area, then posts.
    DB::transaction(function () {
        Tag::create(['name' => ['en' => 'Clip owner'], 'slug' => ['en' => 'clip-owner']]);
        SiteRebuild::markDirty('concerts');
        SiteRebuild::markDirty('releases');
        SiteRebuild::markDirty('posts');
    });

    $rebuilds = ActivityChange::where('event', 'rebuilt')->get();
    expect($rebuilds)->toHaveCount(1)
        ->and($rebuilds[0]->diff['areas'][1])->toBe(['concerts', 'releases', 'posts'])
        // Filed in the same log row as the save's own change.
        ->and(ActivityChange::where('activity_log_id', $rebuilds[0]->activity_log_id)->where('event', 'created')->exists())->toBeTrue();
});

it('keeps the newest edits when there are more than it stores, and says how many there were', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    foreach (range(1, 205) as $i) {
        ActivityLog::create(['action' => 'updated', 'subject_type' => 'Tag', 'subject_label' => "edit {$i}", 'created_at' => now()]);
    }
    // Creating the admin above is logged too (as the system), so count.
    $logged = ActivityLog::count();
    expect($logged)->toBeGreaterThan(205);

    $this->postJson('/api/admin/site/rebuild')->assertOk();

    $diff  = latestRebuild()->diff;
    $label = array_column($diff['changes'][1], 'subject_label');
    expect($label)->toHaveCount(200)
        ->and($label[0])->toBe('edit 6')
        ->and(end($label))->toBe('edit 205')
        ->and($diff['changes_total'][1])->toBe($logged);
});

it('finds automatic rebuilds with the rebuilt filter, though the save names the entry', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'true']);

    $this->postJson('/api/admin/faqs', [
        'module_slug' => 'contact',
        'question'    => ['en' => 'Auto?'],
        'answer'      => ['en' => 'Yes.'],
    ])->assertCreated();

    $this->getJson('/api/admin/activity?action=rebuilt')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.action', 'created');
});

it('filters the log by the rebuilt action', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $this->postJson('/api/tags', ['name' => ['en' => 'Noise']])->assertCreated();
    $this->postJson('/api/admin/site/rebuild')->assertOk();

    $this->getJson('/api/admin/activity?action=rebuilt')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.action', 'rebuilt')
        ->assertJsonPath('data.0.changes.0.event', 'rebuilt');
});
