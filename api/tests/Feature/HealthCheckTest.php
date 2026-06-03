<?php

// ── GET /api/health ────────────────────────────────────────────────────────────

describe('GET /api/health', function () {
    it('returns a 200 with healthy status when the database is reachable', function () {
        $this->getJson('/api/health')
            ->assertSuccessful()
            ->assertJsonPath('status', 'healthy')
            ->assertJsonPath('checks.database.status', 'ok')
            ->assertJsonStructure(['service', 'status', 'environment', 'version', 'timestamp', 'checks']);
    });

    it('is publicly accessible without authentication', function () {
        $this->getJson('/api/health')->assertSuccessful();
    });
});
