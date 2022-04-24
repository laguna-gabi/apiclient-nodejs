module.exports = {
  displayName: 'poseidon',
  rootDir: '../',
  preset: '../../jest.preset.js',
  globals: {
    'ts-jest': {
      tsconfig: 'apps/poseidon/tsconfig.spec.json',
    },
  },
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageDirectory: '../../coverage/apps/poseidon',
  maxWorkers: 1,
  globalSetup: '../../global-setup.ts',
  coverageReporters: ['json-summary', 'lcov'],
  collectCoverage: true,
};
