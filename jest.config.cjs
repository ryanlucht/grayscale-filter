module.exports = {
  testEnvironment: 'node',
  transform: {},
  moduleFileExtensions: ['js', 'mjs'],
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['./tests/setup.js'],
  // Note: utils/ modules are ES6 and fully unit-testable with 70%+ coverage.
  // Production files (popup.js, background.js, content.js) import from utils/
  // but are primarily tested via E2E tests due to Chrome API dependencies.
  collectCoverageFrom: [
    'utils/**/*.js',        // Shared utilities (testable)
    'background.js',        // Service worker (E2E tested)
    'content.js',           // Content script (E2E tested)
    'popup/popup.js',       // Popup UI (E2E tested)
  ],
  coverageThreshold: {
    'utils/domain.js': {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80,
    },
    'utils/filter.js': {
      statements: 80,
      branches: 70,
      functions: 100,
      lines: 80,
    },
    // No global threshold - production files tested via E2E, utils tested via unit tests
  },
  verbose: true
};
