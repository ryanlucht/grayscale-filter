module.exports = {
  testEnvironment: 'node',
  transform: {},
  moduleFileExtensions: ['js', 'mjs'],
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['./tests/setup.js'],
  // Note: Production files are not ES6 modules and cannot be imported in Jest's Node environment.
  // Coverage is 0% because tests use extracted pure functions in tests/helpers/extractors.js.
  // Phase 4 will refactor production code to be modular, enabling direct testing and coverage.
  collectCoverageFrom: [
    'background.js',
    'content.js',
    'popup/popup.js',
    // Also track test helpers (what we actually test)
    'tests/helpers/**/*.js'
  ],
  // Coverage thresholds removed until Phase 4 refactors code to be testable
  // Current: 0% (production files not modular)
  // Phase 4 goal: 70%+ after refactoring
  verbose: true
};
