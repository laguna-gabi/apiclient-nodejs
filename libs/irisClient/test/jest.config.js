module.exports = {
  displayName: 'hepius',
  rootDir: '../',
  preset: '../../jest.preset.js',
  globals: {
    'ts-jest': {
      tsconfig: 'libs/pandora/tsconfig.spec.json',
    },
  },
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageDirectory: '../../coverage/libs/pandora',
  maxWorkers: 1,
  globalSetup: './test/global-setup.ts',
  coverageReporters: ['json-summary', 'lcov'],
  collectCoverage: true,
};
