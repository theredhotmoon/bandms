import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

/**
 * Unit tests for the pure logic the admin stands on: tech rider resolution,
 * diffing and the rig contract, plus the venue gate behind concert creation.
 *
 * Deliberately separate from vite.config.ts and carrying no plugins. Nothing
 * under test renders — these are the modules that decide what a venue is sent,
 * and they are pure functions precisely so they can be tested without a DOM,
 * a server, or a browser. Component and flow coverage stays in Playwright.
 *
 * Note: Vitest strips types rather than checking them, so a spec can pass here
 * and still break `pnpm build`, which type-checks everything under src/. Run
 * the build before trusting a green run on a new spec file.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/utils/riderResolver.ts',
        'src/utils/riderDiff.ts',
        'src/utils/rigValidation.ts',
        'src/utils/venueGate.ts',
      ],
    },
  },
})
