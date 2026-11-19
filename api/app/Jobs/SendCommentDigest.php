<?php

namespace App\Jobs;

use App\Mail\NewPostComments;
use App\Models\Post;
use App\Models\PostComment;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;

/**
 * Tells the band about new comments on one post — one mail for everything
 * posted since the first comment that scheduled it.
 *
 * PostCommentController dispatches this with a delay when a post gets a
 * comment and no digest is already waiting (the cache marker below). Comments
 * arriving during the wait find the marker and schedule nothing; this job then
 * clears the marker and mails whatever exists from `$fromCommentId` on. So a
 * burst is one mail per superadmin, not one per comment.
 *
 * It carries ids, not models: a comment deleted during the wait is simply not
 * in the mail, and if none are left there is no mail.
 *
 * The marker is cleared BEFORE the comments are read. The other order loses a
 * comment that lands between the two (not read, marker still there, nothing
 * scheduled). This order can at worst mail one comment twice.
 */
class SendCommentDigest implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;

    public array $backoff = [30, 120];

    public function __construct(public readonly int $postId, public readonly int $fromCommentId)
    {
    }

    public static function marker(int $postId): string
    {
        return "comment-digest-pending:{$postId}";
    }

    public function handle(): void
    {
        Cache::forget(self::marker($this->postId));

        $post = Post::find($this->postId);
        if ($post === null) {
            return;
        }

        $comments = PostComment::with('fan')
            ->where('post_id', $this->postId)
            ->where('id', '>=', $this->fromCommentId)
            ->orderBy('id')
            ->get();
        if ($comments->isEmpty()) {
            return;
        }

        // Each mail is queued on its own. Sent in a loop here, one failed
        // recipient would fail the job, and its retry would mail everyone who
        // had already received it a second time.
        User::where('is_superadmin', true)->get()->each(
            fn (User $user) => Mail::to($user->email)->queue(new NewPostComments($post, $comments)),
        );
    }
}
