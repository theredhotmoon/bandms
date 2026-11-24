<?php

namespace App\Console\Commands;

use App\Models\FanAccount;
use App\Support\FanSession;
use Illuminate\Console\Command;
use Illuminate\Console\ConfirmableTrait;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * A signed-in fan for the Playwright comment specs.
 *
 * A fan session is normally reached through an emailed link, and the running
 * backend has APP_DEBUG off, so the magic-link response carries no dev link a
 * browser test could follow. This creates the fan and the session directly —
 * the same session verifyMagicLink() opens.
 *
 * The fan's email is prefixed "e2e-", so e2e:purge removes it (and, by cascade,
 * every comment it wrote). --force for the same reason as e2e:seed-ticket: the
 * local backend runs with APP_ENV=production.
 */
class SeedE2eFanSession extends Command
{
    use ConfirmableTrait;

    protected $signature = 'e2e:seed-fan-session
                            {--display-name= : Give the fan a display name (omit to test the first-comment prompt)}
                            {--password= : Give the fan this password, so it can sign in with it (omit for a link-only account)}
                            {--force : Skip the production confirmation}';

    protected $description = 'Create a fan account with a live session for the E2E suite, and print it as JSON';

    public function handle(): int
    {
        if (! $this->confirmToProceed()) {
            return self::FAILURE;
        }

        // Random, not a timestamp: specs seed in parallel (see SeedE2eTicket).
        $stamp = now()->format('YmdHis') . '-' . Str::lower(Str::random(6));

        $fan = FanAccount::create([
            // Lowercase: the login lookup lowercases what is typed.
            'email'        => Str::lower("e2e-fan-{$stamp}@bandms.test"),
            'name'         => "e2e-fan-{$stamp}",
            'display_name' => $this->option('display-name') ?: null,
            'password_hash' => $this->option('password') ? Hash::make((string) $this->option('password')) : null,
        ]);

        $token = FanSession::open($fan, 'link');

        // stdout is the transport back to Playwright: exactly one line of JSON.
        $this->line(json_encode([
            'fan_id' => $fan->id,
            'email'  => $fan->email,
            'name'   => $fan->name,
            'token'  => $token,
        ]));

        return self::SUCCESS;
    }
}
