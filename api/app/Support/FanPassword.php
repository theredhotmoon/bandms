<?php

namespace App\Support;

use App\Mail\FanPasswordChanged;
use App\Models\FanAccount;
use Closure;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * The one definition of a fan password.
 *
 * Length only, no composition rules and no breach lookup. The ceiling is in
 * bytes, not characters: bcrypt reads 72 bytes and ignores the rest, so a
 * longer password would be silently truncated, and "ż" is two bytes.
 */
class FanPassword
{
    public const MIN = 8;
    public const MAX_BYTES = 72;

    public static function rules(): array
    {
        return [
            'required', 'string', 'min:' . self::MIN,
            function (string $attribute, mixed $value, Closure $fail) {
                if (! is_string($value)) {
                    return;
                }
                if (strlen($value) > self::MAX_BYTES) {
                    $fail(__('api.fan.password_too_long', ['max' => self::MAX_BYTES]));
                } elseif (str_contains($value, "\0")) {
                    // bcrypt refuses to hash one.
                    $fail(__('api.fan.password_character'));
                }
            },
        ];
    }

    /**
     * Tell the fan a first password was set, or theirs was changed. A mail failure
     * never fails the request; the log carries the fan id and exception class only,
     * because an SMTP message can contain the address.
     */
    public static function notify(FanAccount $fan, bool $isFirst): void
    {
        try {
            Mail::to($fan->email)->send(new FanPasswordChanged($isFirst));
        } catch (\Throwable $e) {
            Log::warning("Fan password mail to {$fan->id} failed: " . $e::class);
        }
    }
}
