const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

// Custom config for API route tests
const customJestConfig = {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@tabeza/shared$': '<rootDir>/../../packages/shared',
    '^@tabeza/shared/(.*)$': '<rootDir>/../../packages/shared/$1',
  },
  testMatch: [
    '<rootDir>/app/api/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/app/api/**/*.{test,spec}.{js,jsx,ts,tsx}'
  ],
  // Skip the default setup file that requires window
  setupFilesAfterEnv: [],
}

module.exports = createJestConfig(customJestConfig)
