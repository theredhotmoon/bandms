import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * Unit tests for the plain-TypeScript half of the public site — `src/lib`, where
 * the build's data fetching, caching and slug resolution live. Astro components
 * are covered by E2E against the built output instead.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
