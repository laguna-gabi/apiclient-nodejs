module.exports = {
  displayName: 'irisClient',
  rootDir: '../',
  preset: '../../../jest.preset.js',
  globals: {
    'ts-jest': {
      tsconfig: 'apps/iris/client/tsconfig.spec.json',
    },
  },
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageDirectory: '../../../coverage/libs/irisClient',
  maxWorkers: 1,
  globalSetup: '../../../global-setup.ts',
  coverageReporters: ['json-summary', 'lcov'],
  collectCoverage: true,
};
