module.exports = {
  displayName: 'clinicalEngine',
  rootDir: '../unit',
  preset: '../../../../jest.preset.js',
  globalSetup: '../../../../global-setup.ts',
  globals: {
    'ts-jest': {
      tsconfig: 'apps/clinicalEngine/tsconfig.spec.json',
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
