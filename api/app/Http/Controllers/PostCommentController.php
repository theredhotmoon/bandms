<?php

namespace App\Http\Controllers;

use App\Http\Resources\PostCommentResource;
use App\Jobs\SendCommentDigest;
use App\Models\FanAccount;
use App\Models\Post;
use App\Models\PostComment;
use App\Support\CommentSettings;
use App\Support\DisplayName;
use App\Support\FanSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;

/**
 * Comments under a news post: the public list and what a signed-in fan may do.
 *
 * Read and written by the browser at runtime — never by the Astro build — so a
 * comment needs no site rebuild and marks nothing dirty. Moderation lives in
 * AdminCommentController.
 */
class PostCommentController extends Controller
{
    public const BODY_MAX = 2000;

    // GET /api/posts/{post}/comments — public; a fan token is optional.
    public function index(Request $request, Post $post): JsonResponse
    {
        abort_if($post->published_at === null, 404);

        if (! $post->comments_enabled) {
            return response()->json(['data' => [], 'enabled' => false]);
        }

        $viewerId = FanSession::fan($request)?->id;

        $comments = $post->comments()->visible()->with('fan')
            ->orderBy('created_at')->orderBy('id')->get();

        return response()->json([
            'data'    => $comments->map(fn (PostComment $c) => $this->shape($c, $viewerId, $request))->all(),
            'enabled' => true,
        ]);
    }

    // POST /api/fan/posts/{post}/comments  (fan.auth)
    public function store(Request $request, Post $post): JsonResponse
    {
        /** @var FanAccount $fan */
        $fan = $request->attributes->get('fan');

        abort_if($post->published_at === null, 404);
        abort_if(! $post->comments_enabled, 403, __('api.fan.comments_disabled'));
        abort_if($fan->isCommentBlocked(), 403, __('api.fan.comments_blocked'));

        // The band's own limit, per fan account (CommentSettings). `code` is
        // how the page tells this 429 — worded for the fan — from the route
        // throttle's, which carries a framework string in English.
        if (CommentSettings::exhausted($fan)) {
            return response()->json([
                'message' => trans_choice('api.fan.comment_limit', CommentSettings::minutesLeft($fan)),
                'code'    => 'comment_limit',
            ], 429);
        }

        $body = $request->input('body');
        $request->merge([
            'body'         => is_string($body) ? trim($body) : $body,
            'display_name' => DisplayName::clean($request->input('display_name')),
        ]);

        // The name is asked for once. Afterwards whatever a client sends is
        // ignored — so it is not validated either, or a stale page could have
        // its comment refused over a field the server throws away.
        $needsName = ! filled($fan->display_name);
        $data = $request->validate([
            'body' => ['required', 'string', 'max:' . self::BODY_MAX],
        ] + ($needsName ? ['display_name' => DisplayName::rules()] : []));

        // trim() leaves a zero-width space standing, and a comment that shows
        // nothing would still be published, counted and mailed to the band.
        if (DisplayName::isBlank($data['body'])) {
            throw ValidationException::withMessages(['body' => [__('validation.required', ['attribute' => 'body'])]]);
        }

        if ($needsName) {
            DisplayName::assertAllowed($data['display_name']);
            $fan->update(['display_name' => $data['display_name']]);
        }

        $comment = $post->comments()->create([
            'fan_account_id' => $fan->id,
            'body'           => $data['body'],
        ]);
        $comment->setRelation('fan', $fan);
        $comment->setRelation('post', $post);

        CommentSettings::count($fan);
        $this->notify($comment);

        return response()->json(['data' => $this->shape($comment, $fan->id, $request)], 201);
    }

    // DELETE /api/fan/comments/{comment}  (fan.auth) — own comment only.
    public function destroy(Request $request, PostComment $comment): JsonResponse
    {
        $fan = $request->attributes->get('fan');

        // 404, not 403: someone else's comment id is none of this fan's business.
        abort_unless($comment->fan_account_id === $fan->id, 404);

        $comment->delete();

        return response()->json(null, 204);
    }

    private function shape(PostComment $comment, ?int $viewerId, Request $request): array
    {
        return (new PostCommentResource($comment))->forViewer($viewerId)->resolve($request);
    }

    /**
     * Tell the band. Nothing is held for approval, so this mail is how a
     * comment gets seen at all — but it must never cost the fan their comment.
     */
    private function notify(PostComment $comment): void
    {
        try {
            // One digest per post at a time: the first comment schedules it,
            // the ones that follow during the wait ride along. SendCommentDigest
            // clears the marker when it runs; the TTL is only for a job that
            // never does, so a lost job cannot silence a post for good.
            $delay = (int) config('comments.mail_delay_seconds');
            if (Cache::add(SendCommentDigest::marker($comment->post_id), 1, $delay + 3600)) {
                SendCommentDigest::dispatch($comment->post_id, $comment->id)->delay($delay);
            }
        } catch (\Throwable $e) {
            Cache::forget(SendCommentDigest::marker($comment->post_id));
            Log::warning("New-comment mail for comment {$comment->id} failed: {$e->getMessage()}");
        }
    }
}
