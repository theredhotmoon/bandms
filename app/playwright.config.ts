import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  /**
   * Two, not four — a smaller footprint, not a fix.
   *
   * Each worker costs a Chromium instance and a share of the Vite dev server's
   * heap, so halving them halves the peak. That is worth having: at four, a
   * busy machine fails two or three specs a run and a *different* set each
   * time, as 30-second timeouts and Chromium `GPU process launch failed`.
   *
   * But the failures are a symptom of the machine, not of the suite. Both
   * counts fall over when free RAM runs out — the dev server dies with
   * `FATAL ERROR: Zone Allocation failed - process out of memory`, which is the
   * OS refusing an allocation, not V8 hitting its heap cap. If that appears,
   * close some Chrome windows; no worker count survives it.
   *
   * Override per run when there is room: `pnpm test:e2e --workers=4`.
   */
  workers: process.env.CI ? 1 : 2,

  /**
   * Stop early locally, so a dead browser reads as a dead browser.
   *
   * When Chromium cannot start — Windows STATUS_DLL_INIT_FAILED, code
   * 3221225794, seen with ~7 GB of Chrome resident and under 2 GB physical
   * free — the first worker dies and every remaining spec is reported as
   * "worker process exited unexpectedly". A run in Sep 2026 produced 129 of
   * those in 60 seconds with 145 specs never started: a wall of red that looks
   * like 129 broken tests and is actually one broken process launch.
   *
   * Aborting at five keeps that signal legible. It costs nothing real: past
   * five genuine failures you are debugging, not gathering a full report.
   *
   * CI keeps 0 (unlimited) — there the complete list is the point, and CI is
   * not sharing a desktop with a browser.
   */
  maxFailures: process.env.CI ? 0 : 5,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: { storageState: undefined },
      // Runs once every project depending on 'setup' has finished — the only
      // safe moment to clear fixtures that are shared across parallel workers.
      teardown: 'cleanup',
    },
    {
      name: 'cleanup',
      testMatch: /.*\.teardown\.ts/,
      use: { storageState: undefined },
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
