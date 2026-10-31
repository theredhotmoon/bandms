<?php

namespace App\Console\Commands;

use App\Assistant\Crawler\DigestBuilder;
use App\Mail\AssistantDigest;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

/**
 * The Monday digest (scheduled in bootstrap/app.php). Nothing new means no
 * mail and no stamp; `--preview` prints what would go out now and changes
 * nothing. One mail per recipient, so nobody sees the others' addresses.
 */
class AssistantDigestCommand extends Command
{
    protected $signature = 'assistant:digest {--preview : Print the digest instead of sending it}';

    protected $description = "Send the assistant's weekly digest";

    public function handle(DigestBuilder $builder): int
    {
        $until  = now();
        $digest = $builder->build($until);
        if ($digest === null) {
            $this->line('Nothing new worth a look — no digest sent.');

            return self::SUCCESS;
        }

        if ($this->option('preview')) {
            $this->line((new AssistantDigest($digest))->render());

            return self::SUCCESS;
        }

        $to = $builder->recipients();
        if ($to === []) {
            $this->warn('No digest recipients and no superadmin with an email — nothing sent.');

            return self::SUCCESS;
        }

        foreach ($to as $address) {
            Mail::to($address)->send(new AssistantDigest($digest));
        }
        $builder->stamp($until);
        $this->info('Digest sent to ' . count($to) . " recipient(s): {$digest['total']} finding(s).");

        return self::SUCCESS;
    }
}
