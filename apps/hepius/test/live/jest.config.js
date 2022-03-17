module.exports = {
  displayName: 'hepius',
  rootDir: '../live',
  preset: '../../../../jest.preset.js',
  globalSetup: '../global-setup.ts',
  globals: {
    'ts-jest': {
      tsconfig: 'apps/hepius/tsconfig.spec.json',
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
