module.exports = {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist-electron/',
    '/__tests__/e2e/',
    '/Note-taking app frontend \\(V1\\.1\\)/',
    '/Note-taking app frontend（V2\\.0）/',
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/dist-electron/',
    '<rootDir>/__tests__/e2e/',
    '<rootDir>/Note-taking app frontend (V1.1)/',
    '<rootDir>/Note-taking app frontend（V2.0）/',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(uuid|@aws-sdk)/)'
  ],
  testMatch: ['**/*.test.js', '**/*.property.test.js'],
  collectCoverageFrom: [
    'kg/**/*.js',
    'services/**/*.js',
    '!kg/**/*.test.js',
    '!services/**/*.test.js',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80
    }
  },
  coverageReporters: ['text', 'lcov', 'json', 'html']
};
