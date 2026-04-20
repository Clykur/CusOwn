import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Unit-only Vitest config for CI. Excludes integration and e2e (require live DB).
 * Use: vitest run --config vitest.unit.config.mts
 */
export default defineConfig({
  test: {
    environment: 'node',
    // forks pool cold-starts a process per file; threads start faster for many small test files.
    pool: 'threads',
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
      // Only measure coverage for API routes that have full unit-test coverage (target 100%).
      // Additional routes/services can be added to include as their tests reach full coverage.
      include: [
        'app/api/admin/users/route.ts',
        'app/api/auth/session/route.ts',
        'app/api/business-categories/route.ts',
        'app/api/cron/health-check/route.ts',
        'lib/utils/day-of-week.ts',
        'lib/utils/analytics-chart-format.ts',
        'lib/uuid.ts',
        'lib/utils/business-schedule-validation.ts',
        'lib/utils/date-range-admin.ts',
      ],
      exclude: ['**/*.test.*', '**/*.spec.*', '**/node_modules/**', '**/.next/**'],
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
