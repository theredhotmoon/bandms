<?php

use App\Jobs\SendCommentDigest;
use App\Mail\NewPostComments;
use App\Models\ActivityChange;
use App\Models\FanAccount;
use App\Models\Post;
use App\Models\PostComment;
use App\Models\User;
use App\Support\CommentSettings;
use App\Support\ReturnPath;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;

/** A fan with a live session; returns [fan, bearer headers]. */
function commentFan(array $attributes = []): array
{
    static $n = 0;
    $n++;

    $fan = FanAccount::create($attributes + [
        'email'        => "fan{$n}@example.com",
        'name'         => "fan{$n}",
        'display_name' => "Fan {$n}",
    ]);
    $token = "session-{$n}-" . bin2hex(random_bytes(4));
    Cache::put("fan_session:{$token}", $fan->id, now()->addDay());

    return [$fan, ['Authorization' => "Bearer {$token}"]];
}

function commentOn(Post $post, FanAccount $fan, array $attributes = []): PostComment
{
    // forceFill: created_at is not fillable, and the ordering tests set it.
    $comment = (new PostComment)->forceFill($attributes + [
        'post_id'        => $post->id,
        'fan_account_id' => $fan->id,
        'body'           => 'Great show!',
    ]);
    $comment->save();

    return $comment;
}

beforeEach(fn () => Mail::fake());

describe('post resource', function () {
    it('serves comments_enabled, on by default', function () {
        $post = Post::factory()->create();

        $this->getJson("/api/posts/{$post->id}")->assertOk()->assertJsonPath('data.comments_enabled', true);
    });

    it('lets the editor switch comments off', function () {
        $this->actingAsAdmin();
        $post = Post::factory()->create();

        $this->putJson("/api/posts/{$post->id}", ['comments_enabled' => false])->assertOk();

        expect($post->fresh()->comments_enabled)->toBeFalse();
    });
});

describe('GET /api/posts/{post}/comments', function () {
    it('lists visible comments oldest first, without email or fan id', function () {
        $post = Post::factory()->create();
        [$fan] = commentFan(['display_name' => 'Ania']);
        $second = commentOn($post, $fan, ['body' => 'Second', 'created_at' => now()]);
        $first = commentOn($post, $fan, ['body' => 'First', 'created_at' => now()->subHour()]);

        $response = $this->getJson("/api/posts/{$post->id}/comments")->assertOk();

        $response->assertJsonPath('enabled', true)
            ->assertJsonPath('data.0.id', $first->id)
            ->assertJsonPath('data.1.id', $second->id)
            ->assertJsonPath('data.0.author_name', 'Ania')
            ->assertJsonPath('data.0.mine', false);
        expect(array_keys($response->json('data.0')))->toBe(['id', 'author_name', 'body', 'created_at', 'mine'])
            ->and($response->getContent())->not->toContain($fan->email);
    });

    it('leaves out hidden comments and everything a blocked fan wrote', function () {
        $post = Post::factory()->create();
        [$fan] = commentFan();
        [$blocked, $blockedHeaders] = commentFan(['comments_blocked_at' => now()]);
        $shown = commentOn($post, $fan);
        commentOn($post, $fan, ['hidden_at' => now()]);
        commentOn($post, $blocked);

        $this->getJson("/api/posts/{$post->id}/comments")
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $shown->id);

        // The author gets no exception: their own comments are gone for them too.
        $this->getJson("/api/posts/{$post->id}/comments", $blockedHeaders)->assertJsonCount(1, 'data');
    });

    it('marks the signed-in fan\'s own comments', function () {
        $post = Post::factory()->create();
        [$fan, $headers] = commentFan();
        [$other] = commentFan();
        commentOn($post, $fan, ['created_at' => now()->subHour()]);
        commentOn($post, $other);

        $this->getJson("/api/posts/{$post->id}/comments", $headers)
            ->assertJsonPath('data.0.mine', true)
            ->assertJsonPath('data.1.mine', false);
    });

    it('treats a stale token as an anonymous reader, not an error', function () {
        $post = Post::factory()->create();
        [$fan] = commentFan();
        commentOn($post, $fan);

        $this->getJson("/api/posts/{$post->id}/comments", ['Authorization' => 'Bearer long-gone'])
            ->assertOk()->assertJsonPath('data.0.mine', false);
    });

    it('404s for a draft', function () {
        $post = Post::factory()->draft()->create();

        $this->getJson("/api/posts/{$post->id}/comments")->assertNotFound();
    });

    it('says so, and lists nothing, when comments are off for the post', function () {
        $post = Post::factory()->create(['comments_enabled' => false]);
        [$fan] = commentFan();
        commentOn($post, $fan);

        $this->getJson("/api/posts/{$post->id}/comments")
            ->assertOk()->assertExactJson(['data' => [], 'enabled' => false]);
    });
});

describe('POST /api/fan/posts/{post}/comments', function () {
    it('requires a fan session', function () {
        $post = Post::factory()->create();

        $this->postJson("/api/fan/posts/{$post->id}/comments", ['body' => 'Hi'])->assertUnauthorized();
    });

    it('publishes the comment at once', function () {
        $post = Post::factory()->create();
        [$fan, $headers] = commentFan(['display_name' => 'Ania']);

        $this->postJson("/api/fan/posts/{$post->id}/comments", ['body' => "  Line one\nLine two  "], $headers)
            ->assertCreated()
            ->assertJsonPath('data.body', "Line one\nLine two")
            ->assertJsonPath('data.author_name', 'Ania')
            ->assertJsonPath('data.mine', true);

        $this->getJson("/api/posts/{$post->id}/comments")->assertJsonCount(1, 'data');
    });

    it('asks for a display name once, and keeps it', function () {
        $post = Post::factory()->create();
        [$fan, $headers] = commentFan(['display_name' => null]);

        $this->postJson("/api/fan/posts/{$post->id}/comments", ['body' => 'Hi'], $headers)
            ->assertStatus(422)->assertJsonValidationErrors('display_name');

        $this->postJson("/api/fan/posts/{$post->id}/comments", ['body' => 'Hi', 'display_name' => '  Ania   K. '], $headers)
            ->assertCreated()->assertJsonPath('data.author_name', 'Ania K.');

        // A later comment needs no name, and cannot quietly rename the fan.
        $this->postJson("/api/fan/posts/{$post->id}/comments", ['body' => 'Again', 'display_name' => 'Someone Else'], $headers)
            ->assertCreated()->assertJsonPath('data.author_name', 'Ania K.');

        expect($fan->fresh()->display_name)->toBe('Ania K.');
    });

    it('never publishes the account name, which may be half an email address', function () {
        $post = Post::factory()->create();
        [$fan, $headers] = commentFan(['name' => 'jan.kowalski', 'display_name' => null]);

        $this->postJson("/api/fan/posts/{$post->id}/comments", ['body' => 'Hi', 'display_name' => 'Janek'], $headers)
            ->assertCreated();

        expect($this->getJson("/api/posts/{$post->id}/comments")->getContent())->not->toContain('jan.kowalski');
    });

    it('rejects a blank body or name and saves nothing', function (array $payload, string $field) {
        $post = Post::factory()->create();
        [$fan, $headers] = commentFan(['display_name' => null]);

        $this->postJson("/api/fan/posts/{$post->id}/comments", $payload, $headers)
            ->assertStatus(422)->assertJsonValidationErrors($field);

        expect(PostComment::count())->toBe(0)->and($fan->fresh()->display_name)->toBeNull();
    })->with([
        'whitespace body' => [['body' => "  \n ", 'display_name' => 'Ania'], 'body'],
        'whitespace name' => [['body' => 'Hi', 'display_name' => '   '], 'display_name'],
        'body too long'   => [['body' => str_repeat('a', 2001), 'display_name' => 'Ania'], 'body'],
        'name too long'   => [['body' => 'Hi', 'display_name' => str_repeat('a', 51)], 'display_name'],
        'body not text'   => [['body' => ['x'], 'display_name' => 'Ania'], 'body'],
    ]);

    it('will not let a fan post as the band', function () {
        $this->createProfile(['name' => 'Skanking Storks']);
        $post = Post::factory()->create();
        [$fan, $headers] = commentFan(['display_name' => null]);

        $this->postJson("/api/fan/posts/{$post->id}/comments", ['body' => 'Hi', 'display_name' => ' skanking  STORKS '], $headers)
            ->assertStatus(422)->assertJsonValidationErrors('display_name');

        expect(PostComment::count())->toBe(0);
    });

    it('sees through invisible characters and spacing in a band-name lookalike', function (string $name) {
        $this->createProfile(['name' => 'Skanking Storks']);
        $post = Post::factory()->create();
        [$fan, $headers] = commentFan(['display_name' => null]);

        $this->postJson("/api/fan/posts/{$post->id}/comments", ['body' => 'Hi', 'display_name' => $name], $headers)
            ->assertStatus(422)->assertJsonValidationErrors('display_name');
    })->with([
        'zero-width space' => ["Skanking\u{200B} Storks"],
        'soft hyphen'      => ["Skan\u{00AD}king Storks"],
        'no-break space'   => ["Skanking\u{00A0}Storks"],
        'no space at all'  => ['skankingstorks'],
    ]);

    it('strips invisible characters from a name it accepts', function () {
        $post = Post::factory()->create();
        [$fan, $headers] = commentFan(['display_name' => null]);

        $this->postJson("/api/fan/posts/{$post->id}/comments", ['body' => 'Hi', 'display_name' => "An\u{200B}ia\u{00A0}\u{00A0}K."], $headers)
            ->assertCreated()->assertJsonPath('data.author_name', 'Ania K.');
    });

    it('keeps the joiners that emoji and some scripts need', function () {
        $post = Post::factory()->create();
        [$fan, $headers] = commentFan(['display_name' => null]);
        $name = "Ania \u{1F469}\u{200D}\u{1F3A4}";

        $this->postJson("/api/fan/posts/{$post->id}/comments", ['body' => 'Hi', 'display_name' => $name], $headers)
            ->assertCreated()->assertJsonPath('data.author_name', $name);
    });

    it('refuses a comment that shows nothing', function (string $body) {
        $post = Post::factory()->create();
        [$fan, $headers] = commentFan();

        $this->postJson("/api/fan/posts/{$post->id}/comments", ['body' => $body], $headers)
            ->assertStatus(422)->assertJsonValidationErrors('body');

        expect(PostComment::count())->toBe(0);
        Mail::assertNothingQueued();
    })->with([
        'zero-width space' => ["\u{200B}"],
        'word joiner'      => ["\u{2060}\u{2060}"],
        'soft hyphens'     => ["\u{00AD} \u{00AD}"],
        'no-break spaces'  => ["\u{00A0}\u{00A0}"],
    ]);

    it('refuses a name made only of joiners, which would print as a blank author', function () {
        $post = Post::factory()->create();
        [$fan, $headers] = commentFan(['display_name' => null]);
        $joiners = json_decode('"\u200d\u200c\u200d"');

        $this->postJson("/api/fan/posts/{$post->id}/comments", ['body' => 'Hi', 'display_name' => $joiners], $headers)
            ->assertStatus(422)->assertJsonValidationErrors('display_name');

        [$named, $namedHeaders] = commentFan(['display_name' => 'Ania']);
        $this->putJson('/api/fan/me', ['display_name' => $joiners], $namedHeaders)
            ->assertStatus(422)->assertJsonValidationErrors('display_name');

        expect(PostComment::count())->toBe(0)->and($named->fresh()->display_name)->toBe('Ania');
    });

    it('does not judge a name it is going to ignore', function () {
        $post = Post::factory()->create();
        [$fan, $headers] = commentFan(['display_name' => 'Ania']);

        $this->postJson("/api/fan/posts/{$post->id}/comments", ['body' => 'Hi', 'display_name' => str_repeat('a', 200)], $headers)
            ->assertCreated()->assertJsonPath('data.author_name', 'Ania');
    });

    it('refuses a blocked fan, a closed post and a draft', function () {
        [$fan, $headers] = commentFan();
        [$blocked, $blockedHeaders] = commentFan(['comments_blocked_at' => now()]);
        $open = Post::factory()->create();
        $closed = Post::factory()->create(['comments_enabled' => false]);
        $draft = Post::factory()->draft()->create();

        $this->postJson("/api/fan/posts/{$open->id}/comments", ['body' => 'Hi'], $blockedHeaders)
            ->assertForbidden()->assertJsonPath('message', 'You cannot comment on this site.');
        $this->postJson("/api/fan/posts/{$closed->id}/comments", ['body' => 'Hi'], $headers)
            ->assertForbidden()->assertJsonPath('message', 'Comments are closed for this post.');
        $this->postJson("/api/fan/posts/{$draft->id}/comments", ['body' => 'Hi'], $headers)->assertNotFound();

        expect(PostComment::count())->toBe(0);
    });

    it('answers a Polish fan in Polish', function () {
        [$blocked, $headers] = commentFan(['comments_blocked_at' => now()]);
        $post = Post::factory()->create();

        $this->postJson("/api/fan/posts/{$post->id}/comments", ['body' => 'Hi'], $headers + ['Accept-Language' => 'pl'])
            ->assertForbidden()->assertJsonPath('message', 'Nie możesz komentować na tej stronie.');
    });

    it('stops a fan at the band\'s limit and says when they can comment again', function () {
        CommentSettings::setLimit(2, 15);
        $post = Post::factory()->create();
        [$fan, $headers] = commentFan();
        [$other, $otherHeaders] = commentFan();

        $this->postJson("/api/fan/posts/{$post->id}/comments", ['body' => 'One'], $headers)->assertCreated();
        $this->postJson("/api/fan/posts/{$post->id}/comments", ['body' => 'Two'], $headers)->assertCreated();

        $this->postJson("/api/fan/posts/{$post->id}/comments", ['body' => 'Three'], $headers)
            ->assertStatus(429)
            ->assertJsonPath('code', 'comment_limit')
            ->assertJsonPath('message', 'You have posted a lot in a short time. You can comment again in 15 minutes.');
        $this->postJson("/api/fan/posts/{$post->id}/comments", ['body' => 'Three'], $headers + ['Accept-Language' => 'pl'])
            ->assertStatus(429)
            ->assertJsonPath('message', 'Napisałeś dużo w krótkim czasie. Kolejny komentarz dodasz za 15 minut.');

        expect(PostComment::count())->toBe(2);

        // Per fan, not per address: another fan on the same connection is unaffected,
        // and so is the rest of this fan's account.
        $this->postJson("/api/fan/posts/{$post->id}/comments", ['body' => 'Mine'], $otherHeaders)->assertCreated();
        $this->getJson('/api/fan/me', $headers)->assertOk();
    });

    it('lets the fan comment again once the period has passed', function () {
        CommentSettings::setLimit(1, 10);
        $post = Post::factory()->create();
        [$fan, $headers] = commentFan();

        $this->postJson("/api/fan/posts/{$post->id}/comments", ['body' => 'One'], $headers)->assertCreated();
        $this->postJson("/api/fan/posts/{$post->id}/comments", ['body' => 'Two'], $headers)->assertStatus(429);

        $this->travel(11)->minutes();

        $this->postJson("/api/fan/posts/{$post->id}/comments", ['body' => 'Two'], $headers)->assertCreated();
    });

    it('does not count a rejected comment against the limit', function () {
        CommentSettings::setLimit(1, 10);
        $post = Post::factory()->create();
        [$fan, $headers] = commentFan();

        $this->postJson("/api/fan/posts/{$post->id}/comments", ['body' => '   '], $headers)->assertStatus(422);
        $this->postJson("/api/fan/posts/{$post->id}/comments", ['body' => 'Real'], $headers)->assertCreated();
    });

    it('schedules one delayed digest per post, however many comments arrive meanwhile', function () {
        Queue::fake();
        config(['comments.mail_delay_seconds' => 120]);
        $post = Post::factory()->create();
        $other = Post::factory()->create();
        [$fan, $headers] = commentFan();

        $first = $this->postJson("/api/fan/posts/{$post->id}/comments", ['body' => 'One'], $headers)->json('data.id');
        $this->postJson("/api/fan/posts/{$post->id}/comments", ['body' => 'Two'], $headers)->assertCreated();
        $this->postJson("/api/fan/posts/{$other->id}/comments", ['body' => 'Elsewhere'], $headers)->assertCreated();

        Queue::assertPushed(SendCommentDigest::class, 2);
        Queue::assertPushed(SendCommentDigest::class, fn (SendCommentDigest $job) =>
            $job->postId === $post->id && $job->fromCommentId === $first && $job->delay === 120);
        Queue::assertPushed(SendCommentDigest::class, fn (SendCommentDigest $job) => $job->postId === $other->id);
    });

    it('keeps the comment when the digest cannot be scheduled, and tries again next time', function () {
        Queue::shouldReceive('connection')->andThrow(new RuntimeException('queue down'));
        $post = Post::factory()->create();
        [$fan, $headers] = commentFan();

        $this->postJson("/api/fan/posts/{$post->id}/comments", ['body' => 'Hi'], $headers)->assertCreated();

        expect(PostComment::count())->toBe(1)
            ->and(Cache::has(SendCommentDigest::marker($post->id)))->toBeFalse();
    });
});

describe('SendCommentDigest', function () {
    it('mails every superadmin once, with everything since the first comment', function () {
        $boss = User::factory()->create(['role' => 'admin', 'is_superadmin' => true]);
        $admin = User::factory()->create(['role' => 'admin']);
        $post = Post::factory()->create(['title' => ['en' => 'Tour news']]);
        [$ania] = commentFan(['display_name' => 'Ania']);
        [$marek] = commentFan(['display_name' => 'Marek']);
        commentOn($post, $ania, ['body' => 'Before the window']);
        $first = commentOn($post, $ania, ['body' => 'First']);
        commentOn($post, $marek, ['body' => 'Second']);
        commentOn(Post::factory()->create(), $marek, ['body' => 'Another post']);
        config(['newsletter.frontend_url' => 'https://band.example/', 'assistant.admin_path' => 'backstage']);
        Cache::put(SendCommentDigest::marker($post->id), 1, 600);

        (new SendCommentDigest($post->id, $first->id))->handle();

        Mail::assertQueued(NewPostComments::class, 1);
        Mail::assertQueued(NewPostComments::class, function (NewPostComments $mail) use ($boss) {
            $html = $mail->render();

            return $mail->hasTo($boss->email)
                && $mail->envelope()->subject === '2 new comments: Tour news'
                && $mail->moderationUrl() === 'https://band.example/backstage/comments'
                && str_contains($html, 'First') && str_contains($html, 'Second')
                && str_contains($html, 'Ania') && str_contains($html, 'Marek')
                && ! str_contains($html, 'Before the window') && ! str_contains($html, 'Another post');
        });
        Mail::assertNotQueued(NewPostComments::class, fn (NewPostComments $mail) => $mail->hasTo($admin->email));
        // The next comment on this post schedules a digest of its own.
        expect(Cache::has(SendCommentDigest::marker($post->id)))->toBeFalse();
    });

    it('says "New comment" for one, and leaves out a comment deleted during the wait', function () {
        User::factory()->create(['role' => 'admin', 'is_superadmin' => true]);
        $post = Post::factory()->create(['title' => ['en' => 'Tour news']]);
        [$fan] = commentFan();
        $gone = commentOn($post, $fan, ['body' => 'Thought better of it']);
        commentOn($post, $fan, ['body' => 'Still here']);
        $gone->delete();

        (new SendCommentDigest($post->id, $gone->id))->handle();

        Mail::assertQueued(NewPostComments::class, fn (NewPostComments $mail) =>
            $mail->envelope()->subject === 'New comment: Tour news'
            && ! str_contains($mail->render(), 'Thought better of it'));
    });

    it('sends nothing when every comment, or the post itself, is gone', function () {
        User::factory()->create(['role' => 'admin', 'is_superadmin' => true]);
        $post = Post::factory()->create();
        [$fan] = commentFan();
        $comment = commentOn($post, $fan);
        $comment->delete();

        (new SendCommentDigest($post->id, $comment->id))->handle();
        (new SendCommentDigest(999999, 1))->handle();

        Mail::assertNothingQueued();
    });

    it('escapes what a fan wrote', function () {
        User::factory()->create(['role' => 'admin', 'is_superadmin' => true]);
        $post = Post::factory()->create();
        [$fan] = commentFan(['display_name' => '<b>Ania</b>']);
        $comment = commentOn($post, $fan, ['body' => '<script>alert(1)</script>']);

        (new SendCommentDigest($post->id, $comment->id))->handle();

        Mail::assertQueued(NewPostComments::class, fn (NewPostComments $mail) =>
            ! str_contains($mail->render(), '<script>') && ! str_contains($mail->render(), '<b>Ania</b>'));
    });
});

describe('DELETE /api/fan/comments/{comment}', function () {
    it('deletes the fan\'s own comment', function () {
        $post = Post::factory()->create();
        [$fan, $headers] = commentFan();
        $comment = commentOn($post, $fan);

        $this->deleteJson("/api/fan/comments/{$comment->id}", [], $headers)->assertNoContent();

        expect(PostComment::find($comment->id))->toBeNull();
    });

    it('404s on someone else\'s comment and leaves it alone', function () {
        $post = Post::factory()->create();
        [$fan, $headers] = commentFan();
        [$other] = commentFan();
        $comment = commentOn($post, $other);

        $this->deleteJson("/api/fan/comments/{$comment->id}", [], $headers)->assertNotFound();
        $this->deleteJson("/api/fan/comments/{$comment->id}")->assertUnauthorized();

        expect(PostComment::find($comment->id))->not->toBeNull();
    });
});

describe('the fan\'s own profile', function () {
    it('reports the display name and whether commenting is blocked', function () {
        [$fan, $headers] = commentFan(['display_name' => 'Ania', 'comments_blocked_at' => now()]);

        $this->getJson('/api/fan/me', $headers)->assertOk()
            ->assertJsonPath('display_name', 'Ania')
            ->assertJsonPath('comments_blocked', true);
    });

    it('lets the fan change their display name, which renames their comments', function () {
        $post = Post::factory()->create();
        [$fan, $headers] = commentFan(['display_name' => 'Ania']);
        commentOn($post, $fan);

        $this->putJson('/api/fan/me', ['display_name' => ' Anna '], $headers)
            ->assertOk()->assertJsonPath('display_name', 'Anna');

        $this->getJson("/api/posts/{$post->id}/comments")->assertJsonPath('data.0.author_name', 'Anna');
    });

    it('rejects an empty, overlong or reserved name', function () {
        $this->createProfile(['name' => 'Test Band']);
        [$fan, $headers] = commentFan(['display_name' => 'Ania']);

        foreach (['', '   ', str_repeat('a', 51), 'test band'] as $name) {
            $this->putJson('/api/fan/me', ['display_name' => $name], $headers)
                ->assertStatus(422)->assertJsonValidationErrors('display_name');
        }
        $this->putJson('/api/fan/me', ['display_name' => 'Ok'])->assertUnauthorized();

        expect($fan->fresh()->display_name)->toBe('Ania');
    });
});

describe('cleanup and logging', function () {
    it('removes comments with their post and with their fan', function () {
        $post = Post::factory()->create();
        $other = Post::factory()->create();
        [$fan] = commentFan();
        [$keeper] = commentFan();
        commentOn($post, $fan);
        commentOn($other, $fan);
        $kept = commentOn($other, $keeper);

        $post->delete();
        expect(PostComment::count())->toBe(2);

        $fan->delete();
        expect(PostComment::pluck('id')->all())->toBe([$kept->id]);
    });

    it('logs a moderator\'s edit by field name only — never the comment text', function () {
        $this->actingAsAdmin();
        $post = Post::factory()->create();
        [$fan] = commentFan();
        $comment = commentOn($post, $fan, ['body' => 'Something private-ish']);

        $this->putJson("/api/admin/comments/{$comment->id}", ['hidden' => true])->assertOk();
        $this->deleteJson("/api/admin/comments/{$comment->id}")->assertNoContent();

        $logged = ActivityChange::where('subject_type', 'PostComment')->get();
        expect($logged)->not->toBeEmpty()
            ->and($logged->toJson())->not->toContain('Something private-ish');
    });
});

describe('ReturnPath', function () {
    it('keeps a path on this site', function (string $path) {
        expect(ReturnPath::clean($path))->toBe($path);
    })->with(['/en/news/tour-dates#comments', '/pl/aktualnosci/nowa-plyta', '/']);

    it('drops anything that could leave the site', function (mixed $value) {
        expect(ReturnPath::clean($value))->toBeNull();
    })->with([
        'protocol-relative' => ['//evil.example/x'],
        'backslash host'    => ['/\\evil.example'],
        'absolute url'      => ['https://evil.example/'],
        'no leading slash'  => ['en/news'],
        'scheme'            => ['javascript:alert(1)'],
        'control char'      => ["/en/news\n//evil.example"],
        'too long'          => ['/' . str_repeat('a', 300)],
        'empty'             => [''],
        'null'              => [null],
        'array'             => [['/en']],
    ]);
});

describe('sign-in link return path', function () {
    it('carries a site path back through the emailed link', function () {
        config(['newsletter.frontend_url' => 'https://band.example', 'app.debug' => true]);

        $link = $this->postJson('/api/fan/auth/magic-link', [
            'email' => 'fan@example.com', 'return_to' => '/en/news/tour dates#comments',
        ])->assertOk()->json('dev_link');

        expect($link)->toEndWith('&return=%2Fen%2Fnews%2Ftour%20dates%23comments');
    });

    it('drops an off-site return path and still sends a working link', function (mixed $returnTo) {
        config(['newsletter.frontend_url' => 'https://band.example', 'app.debug' => true]);

        $link = $this->postJson('/api/fan/auth/magic-link', [
            'email' => 'fan@example.com', 'return_to' => $returnTo,
        ])->assertOk()->json('dev_link');

        expect($link)->toStartWith('https://band.example/account?token=')->not->toContain('return=');
    })->with(['//evil.example', 'https://evil.example', '/\\evil.example', [['/en']]]);
});
