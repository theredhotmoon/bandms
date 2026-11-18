<?php

use App\Models\FanAccount;
use App\Models\Post;
use App\Models\PostComment;
use App\Models\User;
use App\Support\CommentSettings;
use Laravel\Passport\Passport;

function moderatedComment(array $attributes = [], array $fanAttributes = []): PostComment
{
    static $n = 0;
    $n++;

    $fan = FanAccount::create($fanAttributes + [
        'email' => "mod-fan{$n}@example.com", 'name' => "modfan{$n}", 'display_name' => "Mod Fan {$n}",
    ]);

    $comment = (new PostComment)->forceFill($attributes + [
        'post_id'        => Post::factory()->create(['title' => ['en' => "Post {$n}"]])->id,
        'fan_account_id' => $fan->id,
        'body'           => "Comment {$n}",
    ]);
    $comment->save();

    return $comment;
}

describe('who may moderate', function () {
    it('turns away guests', function () {
        $comment = moderatedComment();

        $this->getJson('/api/admin/comments')->assertUnauthorized();
        $this->putJson("/api/admin/comments/{$comment->id}", ['hidden' => true])->assertUnauthorized();
        $this->deleteJson("/api/admin/comments/{$comment->id}")->assertUnauthorized();
        $this->putJson("/api/admin/fan-accounts/{$comment->fan_account_id}/comments-block", ['blocked' => true])
            ->assertUnauthorized();
    });

    it('turns away a publisher — the list carries fan emails', function () {
        Passport::actingAs(User::factory()->create(['role' => 'publisher']));
        $comment = moderatedComment();

        $this->getJson('/api/admin/comments')->assertForbidden();
        $this->putJson("/api/admin/comments/{$comment->id}", ['hidden' => true])->assertForbidden();
        $this->deleteJson("/api/admin/comments/{$comment->id}")->assertForbidden();
        $this->putJson("/api/admin/fan-accounts/{$comment->fan_account_id}/comments-block", ['blocked' => true])
            ->assertForbidden();

        expect($comment->fresh()->hidden_at)->toBeNull();
    });
});

describe('GET /api/admin/comments', function () {
    beforeEach(fn () => $this->actingAsAdmin());

    it('lists every comment newest first, hidden ones included, with post and fan', function () {
        $old = moderatedComment(['created_at' => now()->subDay()]);
        $new = moderatedComment(['hidden_at' => now()], ['comments_blocked_at' => now()]);

        $response = $this->getJson('/api/admin/comments')->assertOk();

        $response->assertJsonPath('data.0.id', $new->id)
            ->assertJsonPath('data.1.id', $old->id)
            ->assertJsonPath('data.0.post.id', $new->post_id)
            ->assertJsonPath('data.0.fan.email', $new->fan->email)
            ->assertJsonPath('data.0.fan.display_name', $new->fan->display_name)
            ->assertJsonPath('total', 2);
        expect($response->json('data.0.hidden_at'))->not->toBeNull()
            ->and($response->json('data.0.fan.comments_blocked_at'))->not->toBeNull()
            ->and($response->json('data.1.hidden_at'))->toBeNull()
            ->and($response->json('data.1.post.title'))->toBe($old->post->getTranslation('title', 'en'));
    });

    it('filters by post', function () {
        $a = moderatedComment();
        moderatedComment();

        $this->getJson("/api/admin/comments?post_id={$a->post_id}")
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $a->id);
    });
});

describe('moderation actions', function () {
    beforeEach(fn () => $this->actingAsAdmin());

    it('hides and shows a comment', function () {
        $comment = moderatedComment();

        $this->putJson("/api/admin/comments/{$comment->id}", ['hidden' => true])->assertOk();
        expect($comment->fresh()->hidden_at)->not->toBeNull();
        $this->getJson("/api/posts/{$comment->post_id}/comments")->assertJsonCount(0, 'data');

        $this->putJson("/api/admin/comments/{$comment->id}", ['hidden' => false])
            ->assertOk()->assertJsonPath('data.hidden_at', null);
        $this->getJson("/api/posts/{$comment->post_id}/comments")->assertJsonCount(1, 'data');
    });

    it('requires an explicit boolean', function () {
        $comment = moderatedComment();

        $this->putJson("/api/admin/comments/{$comment->id}", [])->assertStatus(422);
        $this->putJson("/api/admin/fan-accounts/{$comment->fan_account_id}/comments-block", ['blocked' => 'maybe'])
            ->assertStatus(422);
    });

    it('deletes a comment', function () {
        $comment = moderatedComment();

        $this->deleteJson("/api/admin/comments/{$comment->id}")->assertNoContent();

        expect(PostComment::find($comment->id))->toBeNull();
    });

    it('blocks a fan, which hides all their comments, and unblocks them again', function () {
        $comment = moderatedComment();
        $fan = $comment->fan;

        $this->putJson("/api/admin/fan-accounts/{$fan->id}/comments-block", ['blocked' => true])->assertOk();
        expect($fan->fresh()->isCommentBlocked())->toBeTrue();
        $this->getJson("/api/posts/{$comment->post_id}/comments")->assertJsonCount(0, 'data');

        $this->putJson("/api/admin/fan-accounts/{$fan->id}/comments-block", ['blocked' => false])
            ->assertOk()->assertJsonPath('data.comments_blocked_at', null);
        $this->getJson("/api/posts/{$comment->post_id}/comments")->assertJsonCount(1, 'data');
    });
});

describe('comment limit setting', function () {
    it('is admin-only', function () {
        $this->getJson('/api/admin/comment-settings')->assertUnauthorized();
        $this->putJson('/api/admin/comment-settings', ['max' => 3, 'minutes' => 5])->assertUnauthorized();

        Passport::actingAs(User::factory()->create(['role' => 'publisher']));
        $this->getJson('/api/admin/comment-settings')->assertForbidden();
        $this->putJson('/api/admin/comment-settings', ['max' => 3, 'minutes' => 5])->assertForbidden();
    });

    it('starts at five comments in ten minutes', function () {
        $this->actingAsAdmin();

        $this->getJson('/api/admin/comment-settings')->assertOk()
            ->assertExactJson(['data' => ['max' => 5, 'minutes' => 10]]);
    });

    it('saves a new limit, which the fan API then applies', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/admin/comment-settings', ['max' => 3, 'minutes' => 60])
            ->assertOk()->assertExactJson(['data' => ['max' => 3, 'minutes' => 60]]);

        expect(CommentSettings::limit())->toBe(['max' => 3, 'minutes' => 60]);
        $this->getJson('/api/admin/comment-settings')->assertJsonPath('data.max', 3);
    });

    it('rejects a limit outside the bounds and keeps the old one', function (array $payload) {
        $this->actingAsAdmin();
        CommentSettings::setLimit(4, 20);

        $this->putJson('/api/admin/comment-settings', $payload)->assertStatus(422);

        expect(CommentSettings::limit())->toBe(['max' => 4, 'minutes' => 20]);
    })->with([
        'zero comments'   => [['max' => 0, 'minutes' => 10]],
        'too many'        => [['max' => 101, 'minutes' => 10]],
        'zero minutes'    => [['max' => 5, 'minutes' => 0]],
        'over a day'      => [['max' => 5, 'minutes' => 1441]],
        'not a number'    => [['max' => 'lots', 'minutes' => 10]],
        'a fraction'      => [['max' => 2.5, 'minutes' => 10]],
        'minutes missing' => [['max' => 5]],
    ]);

    it('falls back to the default when the stored row is nonsense', function () {
        \App\Models\SiteSetting::set(CommentSettings::SETTING_KEY, '{"max":"many","minutes":-3}');
        expect(CommentSettings::limit())->toBe(['max' => 5, 'minutes' => 10]);

        \App\Models\SiteSetting::set(CommentSettings::SETTING_KEY, 'not json');
        expect(CommentSettings::limit())->toBe(['max' => 5, 'minutes' => 10]);
    });
});
