// jest.config.ts
// Version information for key dependencies:
// ts-jest: ^29.1.0
// jest-environment-jsdom: ^29.7.0
// identity-obj-proxy: ^3.0.0
// jest-watch-typeahead: ^2.2.0
// @testing-library/jest-dom: ^6.1.0

import type { Config } from '@jest/types';
import { pathsToModuleNameMapper } from 'ts-jest';
import { compilerOptions } from './tsconfig.json';

/**
 * Creates a comprehensive Jest configuration for React/TypeScript testing environment
 * with enhanced settings for coverage, module resolution, and developer experience.
 * 
 * @returns {Config.InitialOptions} Complete Jest configuration object
 */
const createJestConfig = (): Config.InitialOptions => {
  return {
    // Use ts-jest as the primary preset for TypeScript handling
    preset: 'ts-jest',

    // Configure JSDOM environment for React component testing
    testEnvironment: 'jest-environment-jsdom',

    // Setup files to run after Jest is initialized
    setupFilesAfterEnv: [
      '@testing-library/jest-dom'
    ],

    // Module name mapping for path aliases and static assets
    moduleNameMapper: {
      // Map TypeScript path aliases from tsconfig
      ...pathsToModuleNameMapper(compilerOptions.paths, {
        prefix: '<rootDir>/'
      }),
      // Handle static asset imports
      '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
      '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js'
    },

    // Configure TypeScript transformation with source maps
    transform: {
      '^.+\\.tsx?$': [
        'ts-jest',
        {
          tsconfig: 'tsconfig.json',
          sourceMap: true
        }
      ]
    },

    // Test file patterns
    testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.[jt]sx?$',

    // File extensions to consider for testing
    moduleFileExtensions: [
      'ts',
      'tsx',
      'js',
      'jsx',
      'json',
      'node'
    ],

    // Files to collect coverage from
    collectCoverageFrom: [
      'src/**/*.{ts,tsx}',
      '!src/**/*.d.ts',
      '!src/main.tsx',
      '!src/vite-env.d.ts',
      '!src/**/*.stories.{ts,tsx}',
      '!src/test/**/*',
      '!src/**/*.mock.{ts,tsx}'
    ],

    // Coverage thresholds enforcement
    coverageThreshold: {
      global: {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90
      }
    },

    // Paths to ignore during testing
    testPathIgnorePatterns: [
      '/node_modules/',
      '/dist/',
      '/.next/',
      '/build/',
      '/coverage/'
    ],

    // Watch mode plugins for better developer experience
    watchPlugins: [
      'jest-watch-typeahead/filename',
      'jest-watch-typeahead/testname'
    ],

    // Additional configuration for optimal testing experience
    verbose: true,
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
    errorOnDeprecated: true,
    maxWorkers: '50%',
    
    // Handle static file imports in tests
    moduleDirectories: ['node_modules', '<rootDir>/src'],
    
    // Time out for test execution
    testTimeout: 10000
  };
};

// Export the configuration
const config = createJestConfig();
export default config;