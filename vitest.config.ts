import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    // fake-indexeddb installs a spec-compliant in-memory IndexedDB onto
    // globalThis, so the repository is exercised for real rather than mocked.
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
