<?php

use App\Models\ActivityChange;
use App\Models\ActivityLog;
use App\Models\Post;
use App\Models\PostBlock;
use App\Models\Tag;
use App\Models\User;
use App\Support\Activity\ActivityRecorder;
use Illuminate\Support\Facades\Http;
use Laravel\Passport\Passport;

/** The newest log row, with its itemised changes. */
function latestActivity(): ActivityLog
{
    return ActivityLog::with('entries')->latest('id')->firstOrFail();
}

// ── Recording ─────────────────────────────────────────────────────────────────

describe('recording', function () {
    it('records who created a record, through which route, with its values', function () {
        $admin = $this->actingAsAdmin();

        $id = $this->postJson('/api/tags', ['name' => ['en' => 'Live Music']])->assertCreated()->json('data.id');

        $log = latestActivity();
        expect($log->user_id)->toBe($admin->id)
            ->and($log->user_name)->toBe(trim("{$admin->first_name} {$admin->last_name}"))
            ->and($log->action)->toBe('created')
            ->and($log->route)->toBe('api.tags.store')
            ->and($log->subject_type)->toBe('Tag')
            ->and($log->subject_id)->toBe($id)
            ->and($log->subject_label)->toBe('Live Music');

        $change = $log->entries->firstWhere('subject_type', 'Tag');
        expect($change->event)->toBe('created')
            ->and($change->diff['name'])->toBe([null, ['en' => 'Live Music']]);
    });

    it('records only what an update changed, old and new', function () {
        $this->actingAsAdmin();
        $tag = Tag::create(['name' => ['en' => 'Before'], 'slug' => ['en' => 'before']]);

        $this->putJson("/api/tags/{$tag->id}", ['name' => ['en' => 'After']])->assertSuccessful();

        $log    = latestActivity();
        $change = $log->entries->firstWhere('subject_type', 'Tag');
        expect($log->action)->toBe('updated')
            ->and($log->subject_id)->toBe($tag->id)
            ->and($change->diff['name'])->toBe([['en' => 'Before'], ['en' => 'After']])
            ->and($change->diff)->not->toHaveKey('updated_at');
    });

    it('keeps the label of a deleted record', function () {
        $this->actingAsAdmin();
        $tag = Tag::create(['name' => ['en' => 'Gone soon'], 'slug' => ['en' => 'gone-soon']]);

        $this->deleteJson("/api/tags/{$tag->id}")->assertSuccessful();

        $log = latestActivity();
        expect($log->action)->toBe('deleted')
            ->and($log->subject_label)->toBe('Gone soon')
            ->and($log->entries->firstWhere('event', 'deleted')?->subject_label)->toBe('Gone soon');
    });

    it('never stores a password, but says it changed', function () {
        $this->actingAsAdmin();
        $user = User::factory()->create(['role' => 'member']);

        $this->putJson("/api/users/{$user->id}", [
            'password' => 'NewSecret99', 'password_confirmation' => 'NewSecret99',
        ])->assertSuccessful();

        $diff = latestActivity()->entries->firstWhere('subject_type', 'User')->diff;
        expect($diff['password'])->toBe(['***', '***']);
        expect(json_encode($diff))->not->toContain('NewSecret99');
    });

    it('skips an update that only touched timestamps', function () {
        $tag    = Tag::create(['name' => ['en' => 'Still'], 'slug' => ['en' => 'still']]);
        $before = ActivityChange::count();

        $tag->touch();

        expect(ActivityChange::count())->toBe($before);
    });

    it('files every change of one request under one log row', function () {
        $this->actingAsAdmin();
        $first = $this->postJson('/api/tags', ['name' => ['en' => 'One']])->json('data.id');
        $this->postJson('/api/tags', ['name' => ['en' => 'Two']]);

        $logs = ActivityLog::where('route', 'api.tags.store')->get();
        expect($logs)->toHaveCount(2)
            ->and($logs->first()->subject_id)->toBe($first);
    });

    it('records an authenticated write that itemised nothing', function () {
        $this->actingAsAdmin();
        $tag = Tag::create(['name' => ['en' => 'Same'], 'slug' => ['en' => 'same']]);
        $before = ActivityLog::count();

        // Same values: Eloquent sees nothing dirty and fires no `updated`.
        $this->putJson("/api/tags/{$tag->id}", ['name' => ['en' => 'Same']])->assertSuccessful();

        expect(ActivityLog::count())->toBe($before + 1);
        expect(latestActivity()->subject_label)->toBe('Same');
    });

    it('records nothing for a failed request', function () {
        $this->actingAsAdmin();
        $before = ActivityLog::count();

        $this->postJson('/api/tags', [])->assertUnprocessable();

        expect(ActivityLog::count())->toBe($before);
    });

    it('records nothing a visitor writes', function () {
        $before = ActivityLog::count();

        // An anonymous public write: the newsletter sign-up.
        $this->postJson('/api/newsletter/subscribe', ['email' => 'fan@example.com']);

        expect(ActivityLog::count())->toBe($before);
        expect(ActivityChange::where('subject_label', 'like', '%fan@example.com%')->exists())->toBeFalse();
    });

    it('keeps field names but no values for people who are not users', function () {
        $this->actingAsAdmin();
        $sub = \App\Models\NewsletterSubscriber::create(['email' => 'private@example.com']);

        $change = ActivityChange::where('subject_type', 'NewsletterSubscriber')->latest('id')->first();
        expect($change->subject_id)->toBe($sub->id)
            ->and($change->subject_label)->toBeNull()
            ->and($change->diff['email'])->toBe(['***', '***']);
        expect(json_encode($change->diff))->not->toContain('private@example.com');
    });

    it('records no action for a write that names no record and changed nothing', function () {
        $this->actingAsAdmin();
        $before = ActivityLog::count();

        $this->postJson('/api/auth/logout')->assertSuccessful();

        expect(ActivityLog::count())->toBe($before);
    });

    // A retry is the same thing twice: the failed attempt's rows are dropped
    // with its transaction. (Laravel only retries the outermost transaction,
    // which RefreshDatabase already holds, so the retry itself is not testable
    // here — the rollback half is what matters.)
    it('logs nothing from a rolled-back transaction', function () {
        try {
            \Illuminate\Support\Facades\DB::transaction(function () {
                Tag::create(['name' => ['en' => 'Rolled back'], 'slug' => ['en' => 'rolled-back']]);
                throw new \RuntimeException('fail');
            });
        } catch (\RuntimeException) {
        }
        Tag::create(['name' => ['en' => 'Committed'], 'slug' => ['en' => 'committed']]);

        $labels = ActivityChange::where('subject_type', 'Tag')->pluck('subject_label')->all();
        expect($labels)->toContain('Committed')->not->toContain('Rolled back');
    });
});

// ── GET /api/admin/activity ───────────────────────────────────────────────────

describe('GET /api/admin/activity', function () {
    it('returns 401 without authentication', function () {
        $this->getJson('/api/admin/activity')->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->getJson('/api/admin/activity')->assertForbidden();
    });

    it('lists actions newest first with their changes', function () {
        $this->actingAsAdmin();
        $this->postJson('/api/tags', ['name' => ['en' => 'Older']]);
        $this->postJson('/api/tags', ['name' => ['en' => 'Newer']]);

        $data = $this->getJson('/api/admin/activity')->assertSuccessful()->json('data');

        expect($data[0]['subject_label'])->toBe('Newer')
            ->and($data[0]['changes'][0]['diff']['name'][1])->toBe(['en' => 'Newer']);
    });

    it('filters to one record\'s history', function () {
        $this->actingAsAdmin();
        $a = $this->postJson('/api/tags', ['name' => ['en' => 'Alpha']])->json('data.id');
        $this->postJson('/api/tags', ['name' => ['en' => 'Beta']]);
        $this->putJson("/api/tags/{$a}", ['name' => ['en' => 'Alpha 2']]);

        $data = $this->getJson("/api/admin/activity?subject_type=Tag&subject_id={$a}")->json('data');

        expect($data)->toHaveCount(2)
            ->and(collect($data)->pluck('action')->all())->toBe(['updated', 'created']);
    });

    it('filters by user, action and label search', function () {
        $admin = $this->actingAsAdmin();
        $this->postJson('/api/tags', ['name' => ['en' => 'Findable']]);
        $other = User::factory()->create(['role' => 'admin']);
        Passport::actingAs($other);
        $this->postJson('/api/tags', ['name' => ['en' => 'Elsewhere']]);
        Passport::actingAs($admin);

        expect($this->getJson("/api/admin/activity?user_id={$other->id}")->json('data.0.subject_label'))->toBe('Elsewhere');
        expect($this->getJson('/api/admin/activity?q=Findab')->json('data'))->toHaveCount(1);
        expect($this->getJson('/api/admin/activity?action=deleted')->json('data'))->toBe([]);
    });

    it('lists the users and entity types that occur', function () {
        $admin = $this->actingAsAdmin();
        $this->postJson('/api/tags', ['name' => ['en' => 'X']]);

        $data = $this->getJson('/api/admin/activity/filters')->assertSuccessful()->json('data');

        expect($data['subject_types'])->toContain('Tag')
            ->and(collect($data['users'])->pluck('id')->all())->toContain($admin->id);
    });
});

// ── News bodies: written by a bulk insert, logged explicitly ───────────────────

describe('post blocks', function () {
    it('records an article body edit as before and after on the post', function () {
        Http::fake();
        $this->actingAsAdmin();
        $post = Post::factory()->create();
        PostBlock::factory()->for($post)->text('Old body')->create();

        $this->putJson("/api/posts/{$post->id}", [
            'title'  => ['en' => $post->title],
            'blocks' => [['type' => 'text', 'payload' => ['body' => ['en' => 'New body']]]],
        ])->assertSuccessful();

        $log  = latestActivity();
        $diff = $log->entries->first(fn ($c) => $c->subject_type === 'Post' && isset($c->diff['blocks.0']))?->diff['blocks.0'];
        expect($log->subject_type)->toBe('Post')
            ->and($log->subject_id)->toBe($post->id)
            ->and($diff[0]['payload']['body']['en'])->toBe('Old body')
            ->and($diff[1]['payload']['body']['en'])->toBe('New body');
    });

    it('records nothing about blocks re-saved unchanged', function () {
        Http::fake();
        $this->actingAsAdmin();
        $post = Post::factory()->create();
        PostBlock::factory()->for($post)->text('Same')->create();

        $this->putJson("/api/posts/{$post->id}", [
            'title'  => ['en' => $post->title],
            'blocks' => [['type' => 'text', 'payload' => ['body' => ['en' => 'Same']]]],
        ])->assertSuccessful();

        $hasBlocks = ActivityChange::all()->contains(fn ($c) => isset($c->diff['blocks.0']));
        expect($hasBlocks)->toBeFalse();
    });
});

describe('redaction', function () {
    it('redacts secret-looking columns by pattern, not by a list of names', function () {
        $model = new class extends \Illuminate\Database\Eloquent\Model {
            protected $table = 'anything';
        };
        $model->forceFill([
            'id' => 1, 'name' => 'Visible', 'token' => 'abc', 'password_hash' => 'h',
            'ticket_code' => 'DOOR', 'musical_key' => 'C minor', 'postcode' => '00-001',
        ]);

        app(ActivityRecorder::class)->record('created', $model);

        $diff = ActivityChange::latest('id')->first()->diff;
        expect($diff['token'])->toBe(['***', '***'])
            ->and($diff['password_hash'])->toBe(['***', '***'])
            ->and($diff['ticket_code'])->toBe(['***', '***'])
            ->and($diff['musical_key'][1])->toBe('C minor')
            ->and($diff['postcode'][1])->toBe('00-001')
            ->and($diff['name'][1])->toBe('Visible');
    });

    it('redacts a secret nested inside a JSON bag', function () {
        $tag = Tag::create(['name' => ['en' => 'Bag'], 'slug' => ['en' => 'bag']]);

        app(ActivityRecorder::class)->recordField($tag, 'settings', [], ['label' => 'ok', 'api_key' => 'sk-123']);

        $diff = ActivityChange::latest('id')->first()->diff['settings'];
        expect($diff[1])->toBe(['label' => 'ok', 'api_key' => '***']);
    });
});

describe('post blocks, item by item', function () {
    it('stores only the paragraph that changed', function () {
        $tag = Tag::create(['name' => ['en' => 'Host'], 'slug' => ['en' => 'host']]);
        $a = ['type' => 'text', 'payload' => ['body' => ['en' => 'Same']]];

        app(ActivityRecorder::class)->recordField($tag, 'blocks', [$a, $a], [$a, ['type' => 'text', 'payload' => ['body' => ['en' => 'Fixed']]]]);

        $diff = ActivityChange::latest('id')->first()->diff;
        expect(array_keys($diff))->toBe(['blocks.1'])
            ->and($diff['blocks.1'][1]['payload']['body']['en'])->toBe('Fixed');
    });
});

it('reads From/To as days in the admin\'s time zone', function () {
    $this->actingAsAdmin();
    // 23:30 UTC on the 29th is 00:30 on the 30th in Warsaw (UTC+1, offset -60).
    ActivityLog::create(['action' => 'other', 'subject_label' => 'Late night', 'created_at' => '2026-10-29 23:30:00']);

    $warsaw = $this->getJson('/api/admin/activity?from=2026-10-30&to=2026-10-30&tz_offset=-60')->json('data');
    $utc    = $this->getJson('/api/admin/activity?from=2026-10-30&to=2026-10-30')->json('data');

    expect(collect($warsaw)->pluck('subject_label'))->toContain('Late night')
        ->and(collect($utc)->pluck('subject_label'))->not->toContain('Late night');
});

it('ignores what the nightly crawler writes', function () {
    $before = ActivityChange::count();

    app(ActivityRecorder::class)->record('created', (new \App\Models\AssistantFinding())->forceFill(['id' => 1, 'title' => 'Found']));

    expect(ActivityChange::count())->toBe($before);
});
