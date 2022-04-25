module.exports = {
  displayName: 'poseidon',
  rootDir: '../unit',
  preset: '../../../../jest.preset.js',
  globalSetup: '../../../../global-setup.ts',
  globals: {
    'ts-jest': {
      tsconfig: 'apps/poseidon/tsconfig.spec.json',
    },
  },
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  maxWorkers: 1,
  transform: {
    '^.+\\.[tj]s$': 'ts-jest',
  },
  collectCoverage: false,
};
