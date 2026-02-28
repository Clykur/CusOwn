// Strict staged-file checks: no auto-fixes, no warnings.

const SOURCE_DIRS = ['app/', 'components/', 'lib/', 'services/', 'repositories/', 'middleware.ts'];

module.exports = {
  '*.{js,jsx,ts,tsx,json,css,md,yml,yaml}': [
    'prettier --check --config config/quality/prettier.config.js',
  ],

  '*.{js,jsx,ts,tsx}': (files) => {
    const lintableFiles = files.filter((file) =>
      SOURCE_DIRS.some((dir) => (dir.endsWith('.ts') ? file === dir : file.startsWith(dir)))
    );

    if (lintableFiles.length === 0) return [];

    const quoted = lintableFiles.map((f) => JSON.stringify(f)).join(' ');
    return [`eslint --max-warnings=0 ${quoted}`];
  },
};
