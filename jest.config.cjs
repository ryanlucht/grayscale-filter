module.exports = {
  testEnvironment: 'node',
  transform: {},
  moduleFileExtensions: ['js', 'mjs'],
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['./tests/setup.js'],
  // v8 (not the default babel provider) is required for content.js's
  // coverage to be collected at all: content.js is a classic script loaded
  // in tests via `vm.Script`/`runInContext` (see tests/unit/content.test.js),
  // which babel-plugin-istanbul never instruments. V8's coverage provider
  // attributes executed lines back to the source file via the `filename`
  // passed to `vm.Script`, so it works for both real ESM imports and the
  // vm-loaded content.js.
  coverageProvider: 'v8',
  // Note: utils/ modules are ES6 and fully unit-testable with high coverage.
  // background.js, content.js, and popup/popup.js are now also unit-tested
  // (see tests/unit/background.test.js, content.test.js, popup.test.js),
  // in addition to being covered end-to-end (tests/e2e/).
  collectCoverageFrom: [
    'utils/**/*.js',
    'background.js',
    'content.js',
    'popup/popup.js',
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
    'utils/messaging.js': {
      statements: 80,
      branches: 90,
      functions: 100,
      lines: 80,
    },
    'background.js': {
      statements: 60,
      branches: 70,
      functions: 80,
      lines: 60,
    },
    'content.js': {
      statements: 70,
      branches: 70,
      functions: 100,
      lines: 70,
    },
    'popup/popup.js': {
      statements: 60,
      branches: 75,
      functions: 65,
      lines: 60,
    },
    // No global threshold - thresholds are set per-file, just below the
    // coverage actually achieved (see `npm run test:coverage`).
  },
  verbose: true
};
