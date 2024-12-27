import type { Config } from '@jest/types'; // @jest/types@^29.0.0

/*
 * Jest Configuration for API Gateway Service
 * This configuration ensures comprehensive test coverage and proper TypeScript integration
 * for running unit and integration tests in both development and CI/CD environments.
 */
const config: Config.InitialOptions = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Set Node.js as the test environment
  testEnvironment: 'node',

  // Define root directories for tests and source files
  roots: [
    '<rootDir>/src',
    '<rootDir>/__tests__'
  ],

  // Pattern matching for test files
  testMatch: [
    '**/__tests__/**/*.test.ts'
  ],

  // Enable coverage collection
  collectCoverage: true,

  // Output directory for coverage reports
  coverageDirectory: 'coverage',

  // Enforce strict coverage thresholds as per requirements
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },

  // Module path aliases for cleaner imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // Supported file extensions
  moduleFileExtensions: [
    'ts',
    'js',
    'json'
  ],

  // TypeScript transformation configuration
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },

  // Test setup file for global configurations
  setupFiles: [
    '<rootDir>/src/config/test-setup.ts'
  ],

  // Enable verbose output for detailed test results
  verbose: true,

  // Set timeout for long-running tests (10 seconds)
  testTimeout: 10000,

  // Clear and restore mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Ensure all handles are properly closed after tests
  detectOpenHandles: true,
  forceExit: true
};

export default config;