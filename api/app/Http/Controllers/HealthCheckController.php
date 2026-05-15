<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class HealthCheckController extends Controller
{
    /**
     * Return the health status of the API.
     *
     * Checks: application status, database connectivity.
     */
    public function __invoke(): JsonResponse
    {
        $checks = [
            'database' => $this->checkDatabase(),
        ];

        $healthy = collect($checks)->every(fn ($check) => $check['status'] === 'ok');

        return response()->json([
            'service'     => config('app.name'),
            'status'      => $healthy ? 'healthy' : 'degraded',
            'environment' => config('app.env'),
            'version'     => config('app.version', '1.0.0'),
            'timestamp'   => now()->toIso8601String(),
            'checks'      => $checks,
        ], $healthy ? 200 : 503);
    }

    /**
     * Verify the database connection is alive.
     */
    private function checkDatabase(): array
    {
        try {
            DB::connection()->getPdo();

            return ['status' => 'ok', 'message' => 'Database connection established'];
        } catch (\Exception $e) {
            return ['status' => 'fail', 'message' => 'Database unreachable: ' . $e->getMessage()];
        }
    }
}
