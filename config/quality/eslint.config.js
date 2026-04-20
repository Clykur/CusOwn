module.exports = {
  extends: [
    'next/core-web-vitals',
    'plugin:security/recommended-legacy',
    'plugin:sonarjs/recommended-legacy',
  ],
  ignorePatterns: ['.next/', 'node_modules/', '*.config.js', '*.config.ts'],
  rules: {
    'security/detect-unsafe-regex': 'off',
    'security/detect-non-literal-regexp': 'off',
    'security/detect-object-injection': 'off',
    'security/detect-non-literal-fs-filename': 'off',
    'security/detect-possible-timing-attacks': 'off',

    // SonarJS: turn off high-volume style rules; keep bug / correctness rules from recommended-legacy
    'sonarjs/cognitive-complexity': 'off',
    'sonarjs/todo-tag': 'off',
    'sonarjs/fixme-tag': 'off',
    'sonarjs/no-nested-conditional': 'off',
    'sonarjs/no-nested-template-literals': 'off',
    'sonarjs/no-nested-functions': 'off',
    'sonarjs/no-ignored-exceptions': 'off',
    'sonarjs/void-use': 'off',
    'sonarjs/pseudo-random': 'off',
    'sonarjs/concise-regex': 'off',
    'sonarjs/slow-regex': 'off',
    'sonarjs/no-commented-code': 'off',
    'sonarjs/no-small-switch': 'off',
    'sonarjs/no-intrusive-permissions': 'off',
  },
};
