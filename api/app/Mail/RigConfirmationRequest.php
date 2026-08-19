<?php

declare(strict_types=1);

namespace App\Mail;

use App\Models\BandMember;
use App\Models\TechRider;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Asks one musician to check their saved rig before a gig.
 *
 * Deliberately not a magic-token link: it points at My Setups, which is behind
 * the login they already have. A token link that edits a rig would be a
 * credential in an inbox, and the confirmation is worth less than the rig it
 * confirms.
 */
class RigConfirmationRequest extends Mailable
{
    use Queueable, SerializesModels;

    public string $setupsUrl;

    public string $gigLabel;

    public function __construct(
        public readonly BandMember $member,
        public readonly TechRider $rider,
    ) {
        $base = rtrim(config('newsletter.frontend_url'), '/');

        $this->setupsUrl = "{$base}/admin/my-setups";
        $this->gigLabel  = self::gigLabel($rider);
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: "Confirm your stage setup for {$this->gigLabel}");
    }

    public function content(): Content
    {
        return new Content(view: 'mail.rider.confirm-rig');
    }

    /** "Off Festival, 12 Sep" when a concert is linked; the rider's name otherwise. */
    private static function gigLabel(TechRider $rider): string
    {
        $rider->loadMissing('concert.venue');
        $concert = $rider->concert;

        if (! $concert) {
            return $rider->name;
        }

        $venue = $concert->venue?->name;
        $date  = $concert->date?->format('j M');

        return trim(implode(', ', array_filter([$venue ?: $rider->name, $date])));
    }
}
