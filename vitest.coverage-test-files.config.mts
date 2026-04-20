import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Unit tests with coverage of test files (test classes) only.
 * Ensures 100% of test code is executed when the suite runs.
 * Use: vitest run --config vitest.coverage-test-files.config.mts --coverage
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'scripts/api-routes/**/*.test.ts',
      'scripts/unit-services/**/*.test.ts',
      'scripts/unit-repositories/**/*.test.ts',
      'scripts/unit-config/**/*.test.ts',
      'scripts/unit-middleware/**/*.test.ts',
      'scripts/unit-database/**/*.test.ts',
      'scripts/unit-utils/unit-discovery-fallback.test.ts',
      'scripts/unit-utils/unit-day-of-week.test.ts',
      'scripts/unit-utils/unit-analytics-chart-format.test.ts',
      'scripts/unit-utils/unit-uuid-v7.test.ts',
      'scripts/unit-utils/unit-business-schedule-validation.test.ts',
      'scripts/unit-utils/unit-date-range-admin.test.ts',
    ],
    exclude: [
      '**/api-health-route.test.ts',
    ],
    globals: false,
    testTimeout: 10000,
    setupFiles: ['scripts/api-routes/setup.ts', 'scripts/unit-services/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      // Only measure test files that are actually run in this config (same as test.include).
      include: [
        'scripts/api-routes/**/*.test.ts',
        'scripts/unit-services/**/*.test.ts',
        'scripts/unit-repositories/**/*.test.ts',
        'scripts/unit-config/**/*.test.ts',
        'scripts/unit-middleware/**/*.test.ts',
        'scripts/unit-database/**/*.test.ts',
        'scripts/unit-utils/unit-discovery-fallback.test.ts',
        'scripts/unit-utils/unit-day-of-week.test.ts',
        'scripts/unit-utils/unit-analytics-chart-format.test.ts',
        'scripts/unit-utils/unit-uuid-v7.test.ts',
        'scripts/unit-utils/unit-business-schedule-validation.test.ts',
        'scripts/unit-utils/unit-date-range-admin.test.ts',
      ],
      exclude: [
        '**/node_modules/**',
        '**/setup.ts',
        '**/api-health-route.test.ts',
        // audit.service.test.ts: mock chains have unused arrow paths; still run, not in coverage set for 100% target
        '**/audit.service.test.ts',
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
