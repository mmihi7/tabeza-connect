#!/usr/bin/env node

/**
 * Test runner for DriverInstallationGuidance component
 * Runs the test suite and reports results
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🧪 Running DriverInstallationGuidance tests...\n');

try {
  const staffDir = path.join(__dirname, 'apps', 'staff');
  
  execSync(
    'npx jest components/onboarding/__tests__/DriverInstallationGuidance.test.tsx --verbose',
    {
      cwd: staffDir,
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'test' }
    }
  );
  
  console.log('\n✅ All tests passed!');
  process.exit(0);
} catch (error) {
  console.error('\n❌ Tests failed');
  process.exit(1);
}
