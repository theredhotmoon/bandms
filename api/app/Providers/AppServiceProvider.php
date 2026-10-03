<?php

namespace App\Providers;

use App\Support\ClipOwners;
use App\Support\MemberLinks;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        // Short aliases in clippables.clippable_type and memberables.memberable_type
        // — renaming a model class must not orphan pivot rows. One map for both:
        // a class has a single morph alias app-wide.
        Relation::enforceMorphMap([...ClipOwners::MAP, ...MemberLinks::MAP]);

        $this->configureRateLimiting();
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
        RateLimiter::for('login', function (Request $request) {
            return Limit::perMinute(config('auth.login_max_attempts'))
                ->by($request->ip());
        });
    }
}
