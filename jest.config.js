module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/__tests__/**',
    '!src/tray/**', // Exclude Electron tray app
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 10000,
};
