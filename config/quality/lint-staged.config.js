// Strict staged-file checks: no auto-fixes, no warnings.
module.exports = {
  '*.{js,jsx,ts,tsx,json,css,md,yml,yaml}': [
    'prettier --check --config config/quality/prettier.config.js',
  ],
  '*.{js,jsx,ts,tsx}': (files) => {
    const ignoredSuffixes = ['next.config.js', 'config/quality/lint-staged.config.js'];
    const lintableFiles = files.filter(
      (file) => !ignoredSuffixes.some((suffix) => file.endsWith(suffix))
    );
    if (lintableFiles.length === 0) return [];
    const quotedFiles = lintableFiles.map((file) => JSON.stringify(file)).join(' ');
    return [`eslint --max-warnings=0 ${quotedFiles}`];
  },
};
