import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Unit tests for the pure logic (CSV import, goals, alerts, error scrubbing).
// No database or browser needed, so they run in plain Node on every push.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
