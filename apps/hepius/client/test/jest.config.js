module.exports = {
  displayName: 'hepiusClient',
  rootDir: '../',
  preset: '../../../jest.preset.js',
  globals: {
    'ts-jest': {
      tsconfig: 'apps/hepius/client/tsconfig.spec.json',
    },
  },
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageDirectory: '../../../coverage/libs/hepiusClient',
  maxWorkers: 1,
  globalSetup: '../../../global-setup.ts',
  coverageReporters: ['json-summary', 'lcov'],
  collectCoverage: true,
};
