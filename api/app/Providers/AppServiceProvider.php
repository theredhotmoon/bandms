<?php

namespace App\Providers;

use App\Support\Activity\ActivityRecorder;
use App\Support\ClipOwners;
use App\Support\MemberLinks;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // One per request or queued job: everything it writes shares one log row.
        $this->app->scoped(ActivityRecorder::class);
    }

    public function boot(): void
    {
        // Short aliases in clippables.clippable_type and memberables.memberable_type
        // — renaming a model class must not orphan pivot rows. One map for both:
        // a class has a single morph alias app-wide.
        Relation::enforceMorphMap([...ClipOwners::MAP, ...MemberLinks::MAP]);

        $this->configureRateLimiting();
        $this->recordActivity();
    }

    /**
     * Every Eloquent write, on every model — present and future — goes to the
     * activity log. Seeding and migrating are skipped: a fresh database would
     * otherwise open with thousands of entries nobody made.
     */
    private function recordActivity(): void
    {
        if ($this->app->runningConsoleCommand('db:seed', 'migrate', 'migrate:fresh', 'migrate:refresh', 'migrate:reset')) {
            return;
        }

        foreach (['created', 'updated', 'deleted'] as $event) {
            Event::listen("eloquent.{$event}: *", function (string $name, array $payload) use ($event) {
                if (($payload[0] ?? null) instanceof Model) {
                    $this->app->make(ActivityRecorder::class)->record($event, $payload[0]);
                }
            });
        }
    }

    /**
     * Named rate limiters.
     *
     * "login" is keyed by IP and sized from config so the E2E suite can raise
     * it locally without weakening the production default. See the
     * auth.login_max_attempts config block.
     */
    private function configureRateLimiting(): void
    {
        RateLimiter::for('post-search', function (Request $request) {
            return $request->filled('search')
                ? Limit::perMinute(60)->by($request->ip())
                : Limit::none();
        });

        RateLimiter::for('login', function (Request $request) {
            return Limit::perMinute(config('auth.login_max_attempts'))
                ->by($request->ip());
        });
    }
}
