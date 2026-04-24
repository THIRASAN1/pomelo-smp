import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    globals: false,
    environment: 'node',
    // Most unit tests here don't touch the DB — set stub env vars so `env.ts`
    // doesn't crash at module load during test imports.
    env: {
      NODE_ENV: 'test',
      APP_SECRET: 'x'.repeat(48),
      ALLOWED_ORIGINS: 'http://localhost:4321',
      DATABASE_URL: 'file::memory:?cache=shared',
    },
  },
});
