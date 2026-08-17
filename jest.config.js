module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  // .ts only. Matching .js too made ts-jest try to compile test/global-setup.js
  // and warn about allowJs; plain JS needs no transform here.
  transform: { '^.+\\.ts$': 'ts-jest' },
  testEnvironment: 'node',
  // Sets DB_AVAILABLE before collection so DB-backed specs skip visibly instead
  // of passing vacuously when Postgres is not running. See test/global-setup.js.
  globalSetup: '<rootDir>/test/global-setup.js',
  // Resolve the TS path aliases (@common, @modules, @providers) in tests.
  moduleNameMapper: {
    '^@common/(.*)$': '<rootDir>/src/common/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@providers/(.*)$': '<rootDir>/src/providers/$1',
  },
};
