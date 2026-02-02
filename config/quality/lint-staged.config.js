module.exports = {
  '*.{js,jsx,ts,tsx,json,css,md}': ['prettier --write --config config/quality/prettier.config.js'],
  '*.{js,jsx,ts,tsx}': ['eslint --fix'],
};
