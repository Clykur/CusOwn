// On commit: auto-format staged files with Prettier, then ESLint --fix. Formatted files are re-staged.
module.exports = {
  '*.{js,jsx,ts,tsx,json,css,md}': ['prettier --write --config config/quality/prettier.config.js'],
  '*.{js,jsx,ts,tsx}': ['eslint --fix'],
};
