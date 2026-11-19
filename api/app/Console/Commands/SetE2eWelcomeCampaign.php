<?php

namespace App\Console\Commands;

use App\Support\WelcomeSettings;
use Illuminate\Console\Command;
use Illuminate\Console\ConfirmableTrait;

/**
 * Put the welcome screen's campaign back after an E2E run.
 *
 * The welcome specs press *Show to everyone now*, which stamps
 * site_settings.welcome_screen.campaign. site_settings is a content table, so
 * a stamp left on the dev database would travel with `sync_db.py push
 * --content` and show the screen again to every production visitor. The specs
 * capture the campaign first and restore it here; nothing else is touched.
 *
 * --force for the same reason as e2e:seed-ticket: the local backend runs with
 * APP_ENV=production.
 */
class SetE2eWelcomeCampaign extends Command
{
    use ConfirmableTrait;

    protected $signature = 'e2e:set-welcome-campaign
                            {campaign : The campaign timestamp to restore (0 = never stamped)}
                            {--force : Skip the production confirmation}';

    protected $description = 'Restore the welcome screen campaign stamp after the E2E suite';

    public function handle(): int
    {
        $raw = (string) $this->argument('campaign');
        if (! ctype_digit($raw)) {
            $this->error('campaign must be a non-negative integer.');

            return self::FAILURE;
        }

        if (! $this->confirmToProceed()) {
            return self::FAILURE;
        }

        $this->line((string) WelcomeSettings::setCampaign((int) $raw));

        return self::SUCCESS;
    }
}
