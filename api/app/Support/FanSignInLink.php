<?php

namespace App\Support;

use App\Models\FanAccount;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/** The emailed sign-in link, shared by every route that mails one. */
class FanSignInLink
{
    /**
     * The fan opens the account page, which exchanges the token itself. FRONTEND_URL,
     * not APP_URL: the same rule as every other emailed link.
     */
    public static function url(string $token, mixed $returnTo): string
    {
        $url = rtrim((string) config('newsletter.frontend_url'), '/') . "/account?token={$token}";

        if ($returnTo = ReturnPath::clean($returnTo)) {
            $url .= '&return=' . rawurlencode($returnTo);
        }

        return $url;
    }

    /**
     * Mail the link and return it. On failure the token is forgotten and the
     * exception rethrown. The log carries the exception class only: an SMTP
     * message can contain the recipient's address.
     */
    public static function send(FanAccount $fan, string $token, mixed $returnTo): string
    {
        $url = self::url($token, $returnTo);

        try {
            Mail::raw("Sign in to your fan account: {$url}", fn ($m) => $m->to($fan->email)->subject('Your Sign-In Link'));
        } catch (\Throwable $e) {
            FanMagicToken::forget($token);
            Log::warning('Fan sign-in mail to ' . $fan->id . ' failed: ' . $e::class);

            throw $e;
        }

        return $url;
    }
}
