module.exports = {
  displayName: 'hepius',
  rootDir: '../',
  preset: '../../jest.preset.js',
  globals: {
    'ts-jest': {
      tsconfig: 'apps/hepius/tsconfig.spec.json',
    },
  },
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageDirectory: '../../coverage/apps/hepius',
  maxWorkers: 1,
  globalSetup: '../../global-setup.ts',
  coverageReporters: ['json-summary', 'lcov'],
  collectCoverage: true,
  coveragePathIgnorePatterns: ['<rootDir>/cmd/', '<rootDir>/scripts/'],
};
