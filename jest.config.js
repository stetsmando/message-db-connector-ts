module.exports = {
  coverageReporters: [
    'text-summary',
    'lcov',
  ],
  moduleFileExtensions: [
    'ts',
    'js',
    'json',
  ],
  resetMocks: true,
  restoreMocks: true,
  testRegex: '(/__tests__/.*|(\\.|/)test)\\.tsx?$',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  transformIgnorePatterns: [
    '<rootDir>/node_modules/(?!lodash-es)',
  ],
};
