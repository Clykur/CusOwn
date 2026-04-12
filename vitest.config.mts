import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vitest config for API route tests and service-level tests.
 * ESM config to avoid Vite CJS deprecation warning.
 * Uses path alias @/ to match Next.js app resolution.
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
      'scripts/unit-utils/unit-slot-capacity-timeline.test.ts',
      'scripts/integration/**/*.test.ts',
      'scripts/security/**/*.test.ts',
      'scripts/e2e/**/*.test.ts',
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
      include: ['app/**/*.ts', 'app/**/*.tsx', 'lib/**/*.ts', 'services/**/*.ts', 'components/**/*.ts', 'components/**/*.tsx'],
      exclude: ['**/*.test.*', '**/*.spec.*', '**/node_modules/**', '**/.next/**'],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
