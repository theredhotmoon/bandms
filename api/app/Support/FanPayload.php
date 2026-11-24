<?php

namespace App\Support;

use App\Models\FanAccount;
use App\Models\FanSessionRow;

class FanPayload
{
    /** The fan as their own browser sees them — one shape for sign-in, me and updateMe. */
    public static function for(FanAccount $fan, ?FanSessionRow $session = null): array
    {
        return [
            'id'                    => $fan->id,
            'email'                 => $fan->email,
            'name'                  => $fan->name,
            'newsletter_subscribed' => $fan->newsletter_subscribed,
            'display_name'          => $fan->display_name,
            'comments_blocked'      => $fan->isCommentBlocked(),
            'has_password'          => $fan->password_hash !== null,
            'password_needs_current' => self::needsCurrent($fan, $session),
        ];
    }

    /**
     * Changing an existing password needs the old one — unless this session is a
     * link opened moments ago (a forgotten password is recovered that way).
     */
    public static function needsCurrent(FanAccount $fan, ?FanSessionRow $session): bool
    {
        if ($fan->password_hash === null) {
            return false;
        }

        $fresh = $session !== null
            && $session->method === 'link'
            && $session->created_at->gt(now()->subMinutes(config('fan_auth.fresh_link_minutes')));

        return ! $fresh;
    }
}
