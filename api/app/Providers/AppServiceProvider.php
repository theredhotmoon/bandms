<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
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
