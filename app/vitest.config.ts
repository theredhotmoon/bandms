import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

/**
 * Unit tests for the pure logic the tech rider stands on: resolution, diffing
 * and the rig contract.
 *
 * Deliberately separate from vite.config.ts and carrying no plugins. Nothing
 * under test renders — these are the modules that decide what a venue is sent,
 * and they are pure functions precisely so they can be tested without a DOM,
 * a server, or a browser. Component and flow coverage stays in Playwright.
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
      include: ['src/utils/riderResolver.ts', 'src/utils/riderDiff.ts', 'src/utils/rigValidation.ts'],
    },
  },
})
