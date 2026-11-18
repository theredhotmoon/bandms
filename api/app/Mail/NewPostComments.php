<?php

namespace App\Mail;

use App\Models\Post;
use App\Models\PostComment;
use App\Support\Locales;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Support\Collection;

/**
 * The band's notice of new comments on one post (SendCommentDigest decides
 * which). Comments publish at once, so this is the band's only prompt to look.
 * The link follows ADMIN_PATH (see AssistantDigest).
 *
 * Queued per recipient, and it holds strings rather than models, so a comment
 * deleted before the worker sends it cannot fail the job.
 */
class NewPostComments extends Mailable
{
    use Queueable;

    public string $postTitle;

    /** @var list<array{author: string, body: string}> */
    public array $comments;

    /** @param  Collection<int, PostComment>  $comments  with `fan` loaded */
    public function __construct(Post $post, Collection $comments)
    {
        $this->postTitle = (string) (Locales::resolve($post->getTranslations('title'), Locales::default()) ?? '');
        $this->comments = $comments->map(fn (PostComment $c) => [
            'author' => (string) $c->fan?->display_name,
            'body'   => (string) $c->body,
        ])->values()->all();
    }

    public function moderationUrl(): string
    {
        $base = rtrim((string) config('newsletter.frontend_url'), '/');
        $path = trim((string) config('assistant.admin_path', 'admin'), '/') ?: 'admin';

        return "{$base}/{$path}/comments";
    }

    public function envelope(): Envelope
    {
        $count = count($this->comments);
        $lead = $count === 1 ? 'New comment' : "{$count} new comments";

        return new Envelope(subject: "{$lead}: {$this->postTitle}");
    }

    public function content(): Content
    {
        return new Content(view: 'mail.comments.new', with: [
            'postTitle'     => $this->postTitle,
            'comments'      => $this->comments,
            'moderationUrl' => $this->moderationUrl(),
        ]);
    }
}
