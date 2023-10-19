module.exports = {
  projects: [
    {
      displayName: 'functional',
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
      testEnvironment: 'node',
      transform: {
        '^.+\\.tsx?$': 'ts-jest',
      },
    },
    {
      displayName: 'message-db',
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
      testRegex: '(/__tests__/.*|(\\.|/)mdb.test.interactive)\\.tsx?$',
      testEnvironment: 'node',
      transform: {
        '^.+\\.tsx?$': 'ts-jest',
      },
    },
  ],
};
