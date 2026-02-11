module.exports = {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
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

