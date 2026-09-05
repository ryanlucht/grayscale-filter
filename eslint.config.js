// eslint.config.js
// Flat ESLint config for the Grayscale Filter extension.
import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['coverage/**', 'icons/**'],
  },

  js.configs.recommended,

  // background.js and popup/popup.js are ES modules that can `import` from
  // utils/. utils/**/*.js are plain shared ES modules.
  {
    files: ['background.js', 'popup/popup.js', 'utils/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.webextensions,
      },
    },
  },

  // content.js is a classic (non-module) content script - it cannot use
  // import/export, so it's parsed as a plain script.
  {
    files: ['content.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.webextensions,
      },
    },
  },

  // Tests run under Node with Jest (ESM, `@jest/globals`), and exercise a
  // `global.chrome` mock. The e2e helpers also pass `page.evaluate()`
  // callbacks that execute inside the browser (Puppeteer serializes and
  // runs those in-page), so browser globals like `document` are allowed too.
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.jest,
        ...globals.browser,
        ...globals.webextensions,
      },
    },
  },
];
