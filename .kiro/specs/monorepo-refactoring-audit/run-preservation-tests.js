#!/usr/bin/env node

/**
 * Test Runner for Preservation Property Tests
 * 
 * This script runs the preservation tests to validate that all functionality
 * continues to work after the refactoring fix is applied.
 * 
 * Usage: node run-preservation-tests.js
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('='.repeat(80));
console.log('PRESERVATION PROPERTY TESTS');
console.log('Property 2: Functional Behavior Unchanged');
console.log('='.repeat(80));
console.log();

console.log('These tests validate that all runtime functionality, development');
console.log('workflows, type safety, and deployment processes remain unchanged');
console.log('after the refactoring fix is applied.');
console.log();

console.log('EXPECTED OUTCOME: Tests should PASS on both unfixed and fixed code');
console.log('(This confirms no regressions in functionality)');
console.log();
console.log('='.repeat(80));
console.log();

// Check if required dependencies are installed
const specDir = __dirname;
const packageJsonPath = path.join(specDir, 'package.json');

if (!fs.existsSync(packageJsonPath)) {
  console.log('⚠️  No package.json found. Creating one...');
  
  const packageJson = {
    name: "monorepo-refactoring-audit-tests",
    version: "1.0.0",
    description: "Property-based tests for monorepo refactoring audit",
    private: true,
    scripts: {
      test: "jest preservation-tests.test.js --verbose",
      "test:watch": "jest preservation-tests.test.js --watch"
    },
    devDependencies: {
      "jest": "^29.7.0",
      "fast-check": "^3.15.0"
    }
  };
  
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('✅ Created package.json');
  console.log();
}

// Check if node_modules exists
const nodeModulesPath = path.join(specDir, 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
  console.log('📦 Installing dependencies...');
  console.log();
  
  try {
    execSync('pnpm install --force', { 
      cwd: specDir, 
      stdio: 'inherit',
      encoding: 'utf8'
    });
    console.log();
    console.log('✅ Dependencies installed');
    console.log();
  } catch (error) {
    console.error('❌ Failed to install dependencies');
    console.error(error.message);
    process.exit(1);
  }
}

// Create Jest config if it doesn't exist
const jestConfigPath = path.join(specDir, 'jest.config.js');
if (!fs.existsSync(jestConfigPath)) {
  const jestConfig = `module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.js'],
  verbose: true,
  collectCoverage: false,
  testTimeout: 30000
};
`;
  fs.writeFileSync(jestConfigPath, jestConfig);
  console.log('✅ Created jest.config.js');
  console.log();
}

// Run the tests
console.log('🧪 Running preservation property tests...');
console.log();

try {
  execSync('pnpm test', {
    cwd: specDir,
    stdio: 'inherit',
    encoding: 'utf8'
  });
  
  console.log();
  console.log('='.repeat(80));
  console.log('✅ PRESERVATION TESTS PASSED');
  console.log('='.repeat(80));
  console.log();
  console.log('All functionality is preserved! The refactoring maintains:');
  console.log('  ✓ Project structure and configuration');
  console.log('  ✓ Dependencies and package management');
  console.log('  ✓ TypeScript configuration');
  console.log('  ✓ Build and development workflows');
  console.log('  ✓ PWA capabilities');
  console.log('  ✓ Core functional features');
  console.log('  ✓ Code quality tools');
  console.log('  ✓ Deployment configuration');
  console.log();
  console.log('These tests confirm the baseline behavior that must be preserved');
  console.log('after the refactoring fix is applied.');
  console.log();
  
  process.exit(0);
  
} catch (error) {
  console.log();
  console.log('='.repeat(80));
  console.log('❌ PRESERVATION TESTS FAILED');
  console.log('='.repeat(80));
  console.log();
  console.log('Some functionality may be broken or missing.');
  console.log('Review the test output above to identify issues.');
  console.log();
  console.log('Note: If running on UNFIXED code, failures may indicate:');
  console.log('  - Missing dependencies or configuration');
  console.log('  - Structural issues that need to be addressed');
  console.log('  - Tests need adjustment to match actual baseline behavior');
  console.log();
  
  process.exit(1);
}
