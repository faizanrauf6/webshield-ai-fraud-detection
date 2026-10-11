import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    setupFiles: ['tests/offline-env.ts'],
    include: ['packages/**/tests/**/*.test.ts', 'apps/api/tests/**/*.test.ts'],
    testTimeout: 20000,
    fileParallelism: false,
  },
});
