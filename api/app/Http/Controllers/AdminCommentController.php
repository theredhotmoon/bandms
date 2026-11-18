<?php

namespace App\Http\Controllers;

use App\Models\FanAccount;
use App\Models\PostComment;
use App\Support\CommentSettings;
use App\Support\Locales;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Moderation of fan comments. Admin-only: every row carries the fan's email.
 *
 * Nothing here rebuilds the public site — comments are read at runtime, so a
 * hide or a block shows on the next page load.
 */
class AdminCommentController extends Controller
{
    // GET /api/admin/comments?post_id=&page=
    public function index(Request $request): JsonResponse
    {
        $request->validate(['post_id' => 'nullable|integer']);

        $page = PostComment::with(['fan', 'post'])
            ->when($request->filled('post_id'), fn ($q) => $q->where('post_id', $request->integer('post_id')))
            ->orderByDesc('created_at')->orderByDesc('id')
            ->paginate(50);

        $page->getCollection()->transform(fn (PostComment $c) => $this->row($c));

        return response()->json($page);
    }

    // PUT /api/admin/comments/{comment}  {hidden: bool}
    public function update(Request $request, PostComment $comment): JsonResponse
    {
        $hidden = $request->validate(['hidden' => 'required|boolean'])['hidden'];

        $comment->update(['hidden_at' => $hidden ? ($comment->hidden_at ?? now()) : null]);

        return response()->json(['data' => $this->row($comment->load(['fan', 'post']))]);
    }

    // DELETE /api/admin/comments/{comment}
    public function destroy(PostComment $comment): JsonResponse
    {
        $comment->delete();

        return response()->json(null, 204);
    }

    // PUT /api/admin/fan-accounts/{fan}/comments-block  {blocked: bool}
    public function block(Request $request, FanAccount $fan): JsonResponse
    {
        $blocked = $request->validate(['blocked' => 'required|boolean'])['blocked'];

        $fan->update(['comments_blocked_at' => $blocked ? ($fan->comments_blocked_at ?? now()) : null]);

        return response()->json(['data' => [
            'id'                  => $fan->id,
            'comments_blocked_at' => $fan->comments_blocked_at,
        ]]);
    }

    // GET /api/admin/comment-settings
    public function settings(): JsonResponse
    {
        return response()->json(['data' => CommentSettings::limit()]);
    }

    // PUT /api/admin/comment-settings  {max: int, minutes: int}
    public function updateSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'max'     => 'required|integer|min:1|max:' . CommentSettings::MAX_COMMENTS,
            'minutes' => 'required|integer|min:1|max:' . CommentSettings::MAX_MINUTES,
        ]);

        CommentSettings::setLimit((int) $data['max'], (int) $data['minutes']);

        return response()->json(['data' => CommentSettings::limit()]);
    }

    private function row(PostComment $c): array
    {
        $titles = $c->post?->getTranslations('title') ?? [];

        return [
            'id'         => $c->id,
            'body'       => $c->body,
            'created_at' => $c->created_at,
            'hidden_at'  => $c->hidden_at,
            'post'       => [
                'id'    => $c->post_id,
                'title' => (string) (Locales::resolve($titles, Locales::default()) ?? ''),
            ],
            'fan'        => [
                'id'                  => $c->fan_account_id,
                'display_name'        => $c->fan?->display_name,
                'email'               => $c->fan?->email,
                'comments_blocked_at' => $c->fan?->comments_blocked_at,
            ],
        ];
    }
}
