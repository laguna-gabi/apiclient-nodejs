module.exports = {
  displayName: 'iris',
  rootDir: '../integration',
  preset: '../../../../jest.preset.js',
  globalSetup: '../global-setup.ts',
  globals: {
    'ts-jest': {
      tsconfig: 'apps/iris/tsconfig.spec.json',
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
