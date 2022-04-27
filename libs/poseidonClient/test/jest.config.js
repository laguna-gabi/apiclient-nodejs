module.exports = {
  displayName: 'poseidonClient',
  rootDir: '../',
  preset: '../../jest.preset.js',
  globals: {
    'ts-jest': {
      tsconfig: 'libs/poseidonClient/tsconfig.spec.json',
    },
  },
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageDirectory: '../../coverage/libs/poseidonClient',
  maxWorkers: 1,
  globalSetup: '../../global-setup.ts',
  coverageReporters: ['json-summary', 'lcov'],
  collectCoverage: true,
};
