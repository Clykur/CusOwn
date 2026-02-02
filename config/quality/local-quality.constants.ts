export const EXIT_OK = 0;
export const EXIT_LINT = 1;
export const EXIT_TYPECHECK = 2;
export const EXIT_BUILD = 3;
export const EXIT_ENV = 4;
export const EXIT_FORMAT = 5;

export const MSG = {
  LINT_FAIL: 'Lint failed.',
  TYPECHECK_FAIL: 'Type check failed.',
  BUILD_FAIL: 'Build failed.',
  ENV_FAIL: 'Environment validation failed.',
  FORMAT_FAIL: 'Format failed.',
  GATE_PASS: 'Quality gate passed.',
} as const;
