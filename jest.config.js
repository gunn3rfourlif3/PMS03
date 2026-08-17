module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  // .ts only. Matching .js too made ts-jest try to compile test/global-setup.js
  // and warn about allowJs; plain JS needs no transform here.
  transform: { '^.+\\.ts$': 'ts-jest' },
  testEnvironment: 'node',
  // Every suite pulls in a slice of the Nest graph, and ts-jest compiles it per
  // worker — so memory scales with worker count, not suite size. Unbounded, a
  // full run OOMs on a normal dev machine. Half the cores, and a worker that
  // creeps past 512 MB is restarted between suites rather than growing until
  // V8 gives up.
  maxWorkers: '50%',
  workerIdleMemoryLimit: '512MB',
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
