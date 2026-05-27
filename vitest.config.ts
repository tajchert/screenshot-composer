import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 180_000, // first Chromium download + render
    hookTimeout: 180_000,
    setupFiles: ['tests/setup.ts'],
  },
});
