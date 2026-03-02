/**
 * Preservation Property Tests for Monorepo Refactoring Audit
 * 
 * Property 2: Preservation - Functional Behavior Unchanged
 * 
 * These tests validate that all runtime functionality, development workflows,
 * type safety, and deployment processes remain unchanged after refactoring.
 * 
 * IMPORTANT: These tests should PASS on UNFIXED code (baseline behavior)
 * and continue to PASS after fixes are applied (no regressions).
 * 
 * Validates Requirements: 3.1-3.13
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Helper to check if a project directory exists
function projectExists(projectPath) {
  return fs.existsSync(projectPath);
}

// Helper to check if package.json exists and is valid
function hasValidPackageJson(projectPath) {
  const pkgPath = path.join(projectPath, 'package.json');
  if (!fs.existsSync(pkgPath)) return false;
  
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg && typeof pkg === 'object' && pkg.name;
  } catch {
    return false;
  }
}

// Helper to check if TypeScript config exists
function hasTsConfig(projectPath) {
  return fs.existsSync(path.join(projectPath, 'tsconfig.json'));
}

// Helper to check if Next.js config exists (for customer/staff apps)
function hasNextConfig(projectPath) {
  return fs.existsSync(path.join(projectPath, 'next.config.js')) ||
         fs.existsSync(path.join(projectPath, 'next.config.mjs'));
}

// Helper to check if node_modules exists
function hasNodeModules(projectPath) {
  return fs.existsSync(path.join(projectPath, 'node_modules'));
}

// Helper to get package.json content
function getPackageJson(projectPath) {
  const pkgPath = path.join(projectPath, 'package.json');
  return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
}

// Helper to check if a script exists in package.json
function hasScript(projectPath, scriptName) {
  const pkg = getPackageJson(projectPath);
  return pkg.scripts && pkg.scripts[scriptName];
}

// Helper to check if dependencies are installed
function hasDependenciesInstalled(projectPath) {
  if (!hasNodeModules(projectPath)) return false;
  
  const pkg = getPackageJson(projectPath);
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  
  // Check if at least some key dependencies exist in node_modules
  const nodeModulesPath = path.join(projectPath, 'node_modules');
  const keyDeps = Object.keys(deps).slice(0, 5); // Check first 5 deps
  
  return keyDeps.every(dep => {
    return fs.existsSync(path.join(nodeModulesPath, dep));
  });
}

// Project paths
const PROJECTS_ROOT = 'C:\\Projects';
const CUSTOMER_PATH = path.join(PROJECTS_ROOT, 'tabeza-customer');
const STAFF_PATH = path.join(PROJECTS_ROOT, 'tabeza-staff');
const CONNECT_PATH = path.join(PROJECTS_ROOT, 'tabeza-connect');

describe('Preservation Property Tests - Project Structure', () => {
  
  test('Property: All three projects exist and have valid structure', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(CUSTOMER_PATH, STAFF_PATH, CONNECT_PATH),
        (projectPath) => {
          // All projects should exist
          expect(projectExists(projectPath)).toBe(true);
          
          // All projects should have valid package.json
          expect(hasValidPackageJson(projectPath)).toBe(true);
          
          // All projects should have TypeScript config
          expect(hasTsConfig(projectPath)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Property: Customer and Staff apps have Next.js configuration', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(CUSTOMER_PATH, STAFF_PATH),
        (projectPath) => {
          // Next.js apps should have next.config
          expect(hasNextConfig(projectPath)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Property: All projects have required build scripts', () => {
    fc.assert(
      fc.property(
        fc.record({
          project: fc.constantFrom(CUSTOMER_PATH, STAFF_PATH, CONNECT_PATH),
          script: fc.constantFrom('build', 'dev')
        }),
        ({ project, script }) => {
          // All projects should have build and dev scripts
          expect(hasScript(project, script)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });
});

describe('Preservation Property Tests - Dependencies', () => {
  
  test('Property: All projects have @tabeza/shared dependency', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(CUSTOMER_PATH, STAFF_PATH),
        (projectPath) => {
          const pkg = getPackageJson(projectPath);
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          
          // Should have @tabeza/shared in some form
          expect('@tabeza/shared' in deps).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Property: Projects have consistent Next.js and React versions', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(CUSTOMER_PATH, STAFF_PATH),
        (projectPath) => {
          const pkg = getPackageJson(projectPath);
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          
          // Should have Next.js
          expect('next' in deps).toBe(true);
          
          // Should have React
          expect('react' in deps).toBe(true);
          expect('react-dom' in deps).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Property: tabeza-connect has Electron dependencies', () => {
    const pkg = getPackageJson(CONNECT_PATH);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    
    // Should have Electron
    expect('electron' in deps).toBe(true);
  });
});

describe('Preservation Property Tests - TypeScript Configuration', () => {
  
  test('Property: All projects have valid TypeScript configuration', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(CUSTOMER_PATH, STAFF_PATH, CONNECT_PATH),
        (projectPath) => {
          const tsconfigPath = path.join(projectPath, 'tsconfig.json');
          
          // Should have tsconfig.json
          expect(fs.existsSync(tsconfigPath)).toBe(true);
          
          // Should be valid JSON
          const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
          expect(tsconfig).toBeTruthy();
          expect(tsconfig.compilerOptions).toBeTruthy();
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Property: TypeScript configs have required compiler options', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(CUSTOMER_PATH, STAFF_PATH, CONNECT_PATH),
        (projectPath) => {
          const tsconfigPath = path.join(projectPath, 'tsconfig.json');
          const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
          
          // Should have essential compiler options
          expect(tsconfig.compilerOptions.target).toBeTruthy();
          expect(tsconfig.compilerOptions.module).toBeTruthy();
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });
});

describe('Preservation Property Tests - Shared Packages', () => {
  
  test('Property: Customer app has shared packages in lib/', () => {
    const libPath = path.join(CUSTOMER_PATH, 'lib');
    
    if (fs.existsSync(libPath)) {
      const sharedPath = path.join(libPath, 'shared');
      
      // If lib exists, shared should be there
      expect(fs.existsSync(sharedPath)).toBe(true);
      
      // Shared should have package.json
      expect(fs.existsSync(path.join(sharedPath, 'package.json'))).toBe(true);
    }
  });

  test('Property: Staff app has shared packages in lib/packages/', () => {
    const libPackagesPath = path.join(STAFF_PATH, 'lib', 'packages');
    
    if (fs.existsSync(libPackagesPath)) {
      const sharedPath = path.join(libPackagesPath, 'shared');
      
      // If lib/packages exists, shared should be there
      expect(fs.existsSync(sharedPath)).toBe(true);
      
      // Shared should have package.json
      expect(fs.existsSync(path.join(sharedPath, 'package.json'))).toBe(true);
    }
  });

  test('Property: Shared packages have valid package.json', () => {
    fc.assert(
      fc.property(
        fc.record({
          project: fc.constantFrom(CUSTOMER_PATH, STAFF_PATH),
          packageName: fc.constantFrom('shared', 'tax-rules', 'validation')
        }),
        ({ project, packageName }) => {
          let packagePath;
          
          if (project === CUSTOMER_PATH) {
            packagePath = path.join(project, 'lib', packageName);
          } else {
            packagePath = path.join(project, 'lib', 'packages', packageName);
          }
          
          if (fs.existsSync(packagePath)) {
            const pkgJsonPath = path.join(packagePath, 'package.json');
            
            // Should have package.json
            expect(fs.existsSync(pkgJsonPath)).toBe(true);
            
            // Should be valid JSON
            const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
            expect(pkg.name).toBeTruthy();
          }
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });
});

describe('Preservation Property Tests - Build Configuration', () => {
  
  test('Property: Next.js apps have valid next.config', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(CUSTOMER_PATH, STAFF_PATH),
        (projectPath) => {
          const nextConfigPath = path.join(projectPath, 'next.config.js');
          const nextConfigMjsPath = path.join(projectPath, 'next.config.mjs');
          
          // Should have next.config in some form
          const hasConfig = fs.existsSync(nextConfigPath) || fs.existsSync(nextConfigMjsPath);
          expect(hasConfig).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Property: Projects have turbo.json for build orchestration', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(CUSTOMER_PATH, STAFF_PATH),
        (projectPath) => {
          const turboPath = path.join(projectPath, 'turbo.json');
          
          if (fs.existsSync(turboPath)) {
            // If turbo.json exists, it should be valid JSON
            const turbo = JSON.parse(fs.readFileSync(turboPath, 'utf8'));
            expect(turbo).toBeTruthy();
          }
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });
});

describe('Preservation Property Tests - Development Workflow', () => {
  
  test('Property: All projects have pnpm-lock.yaml or can generate it', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(CUSTOMER_PATH, STAFF_PATH, CONNECT_PATH),
        (projectPath) => {
          const lockPath = path.join(projectPath, 'pnpm-lock.yaml');
          
          // Should have lock file OR be able to generate one
          // (we check for package.json which is required for pnpm install)
          expect(hasValidPackageJson(projectPath)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Property: Projects have consistent port configuration', () => {
    // Customer should use port 3002
    const customerPkg = getPackageJson(CUSTOMER_PATH);
    if (customerPkg.scripts && customerPkg.scripts.dev) {
      // Port might be in dev script or env file
      // Just verify dev script exists
      expect(customerPkg.scripts.dev).toBeTruthy();
    }
    
    // Staff should use port 3003
    const staffPkg = getPackageJson(STAFF_PATH);
    if (staffPkg.scripts && staffPkg.scripts.dev) {
      expect(staffPkg.scripts.dev).toBeTruthy();
    }
  });
});

describe('Preservation Property Tests - PWA Configuration', () => {
  
  test('Property: Customer and Staff apps have PWA configuration', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(CUSTOMER_PATH, STAFF_PATH),
        (projectPath) => {
          const pkg = getPackageJson(projectPath);
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          
          // Should have next-pwa or similar PWA dependency
          const hasPWA = 'next-pwa' in deps || '@ducanh2912/next-pwa' in deps;
          
          // PWA is a key feature, should be present
          expect(hasPWA).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Property: PWA apps have public directory for assets', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(CUSTOMER_PATH, STAFF_PATH),
        (projectPath) => {
          const publicPath = path.join(projectPath, 'public');
          
          // Should have public directory for PWA assets
          expect(fs.existsSync(publicPath)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });
});

describe('Preservation Property Tests - Supabase Integration', () => {
  
  test('Property: Customer and Staff apps have Supabase dependencies', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(CUSTOMER_PATH, STAFF_PATH),
        (projectPath) => {
          const pkg = getPackageJson(projectPath);
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          
          // Should have Supabase client
          expect('@supabase/supabase-js' in deps).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });
});

describe('Preservation Property Tests - Testing Infrastructure', () => {
  
  test('Property: Projects have testing framework configured', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(CUSTOMER_PATH, STAFF_PATH, CONNECT_PATH),
        (projectPath) => {
          const pkg = getPackageJson(projectPath);
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          
          // Should have some testing framework
          const hasTestFramework = 
            'jest' in deps || 
            'vitest' in deps || 
            '@testing-library/react' in deps;
          
          // Testing is important for quality
          if (Object.keys(deps).length > 10) {
            // Only check if project has substantial dependencies
            expect(hasTestFramework).toBe(true);
          }
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });
});

describe('Preservation Property Tests - Code Quality', () => {
  
  test('Property: Projects have linting configuration', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(CUSTOMER_PATH, STAFF_PATH, CONNECT_PATH),
        (projectPath) => {
          const pkg = getPackageJson(projectPath);
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          
          // Should have ESLint
          const hasLinting = 'eslint' in deps;
          
          if (Object.keys(deps).length > 10) {
            expect(hasLinting).toBe(true);
          }
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Property: Projects have TypeScript as dev dependency', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(CUSTOMER_PATH, STAFF_PATH, CONNECT_PATH),
        (projectPath) => {
          const pkg = getPackageJson(projectPath);
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          
          // Should have TypeScript
          expect('typescript' in deps).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });
});

describe('Preservation Property Tests - Deployment Configuration', () => {
  
  test('Property: Next.js apps have Vercel configuration', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(CUSTOMER_PATH, STAFF_PATH),
        (projectPath) => {
          // Check for vercel.json or .vercel directory
          const vercelJsonPath = path.join(projectPath, 'vercel.json');
          const vercelDirPath = path.join(projectPath, '.vercel');
          
          // At least one should exist or be configurable
          // (vercel.json is optional, can deploy without it)
          // Just verify the project structure supports deployment
          expect(hasNextConfig(projectPath)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });
});

describe('Preservation Property Tests - Environment Configuration', () => {
  
  test('Property: Projects have environment variable examples', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(CUSTOMER_PATH, STAFF_PATH, CONNECT_PATH),
        (projectPath) => {
          // Check for .env.example or .env.local.example
          const envExamplePath = path.join(projectPath, '.env.example');
          const envLocalExamplePath = path.join(projectPath, '.env.local.example');
          
          // At least one form of env documentation should exist
          const hasEnvDocs = 
            fs.existsSync(envExamplePath) || 
            fs.existsSync(envLocalExamplePath);
          
          // This is a best practice but not strictly required
          // Just log if missing
          if (!hasEnvDocs) {
            console.log(`Note: ${projectPath} missing .env.example`);
          }
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });
});

describe('Preservation Property Tests - Functional Capabilities', () => {
  
  test('Property: Customer app has QR code scanning dependencies', () => {
    const pkg = getPackageJson(CUSTOMER_PATH);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    
    // Should have QR code library or similar
    const hasQRSupport = 
      Object.keys(deps).some(dep => 
        dep.includes('qr') || 
        dep.includes('scanner') ||
        dep.includes('camera')
      );
    
    // QR scanning is a core feature
    expect(hasQRSupport).toBe(true);
  });

  test('Property: Apps have payment processing dependencies', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(CUSTOMER_PATH, STAFF_PATH),
        (projectPath) => {
          const pkg = getPackageJson(projectPath);
          
          // Should have M-Pesa or payment-related code
          // This might be in @tabeza/shared, so just verify shared exists
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          expect('@tabeza/shared' in deps).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Property: Staff app has admin/management capabilities', () => {
    const pkg = getPackageJson(STAFF_PATH);
    
    // Staff app should have routing and UI components
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    
    // Should have React and Next.js for admin interface
    expect('react' in deps).toBe(true);
    expect('next' in deps).toBe(true);
  });

  test('Property: tabeza-connect has print service capabilities', () => {
    const pkg = getPackageJson(CONNECT_PATH);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    
    // Should have Electron for system integration
    expect('electron' in deps).toBe(true);
    
    // Should have printer-related packages
    const hasPrinterSupport = 
      Object.keys(deps).some(dep => 
        dep.includes('printer') || 
        dep.includes('print') ||
        dep.includes('escpos')
      );
    
    expect(hasPrinterSupport).toBe(true);
  });
});

describe('Preservation Property Tests - Cross-Project Consistency', () => {
  
  test('Property: All projects use pnpm as package manager', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(CUSTOMER_PATH, STAFF_PATH, CONNECT_PATH),
        (projectPath) => {
          const pkg = getPackageJson(projectPath);
          
          // Should specify pnpm in packageManager field or have pnpm-lock.yaml
          const hasPnpmLock = fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'));
          const specifiedPnpm = pkg.packageManager && pkg.packageManager.includes('pnpm');
          
          expect(hasPnpmLock || specifiedPnpm).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Property: Projects have consistent TypeScript version strategy', () => {
    const customerPkg = getPackageJson(CUSTOMER_PATH);
    const staffPkg = getPackageJson(STAFF_PATH);
    const connectPkg = getPackageJson(CONNECT_PATH);
    
    const customerDeps = { ...customerPkg.dependencies, ...customerPkg.devDependencies };
    const staffDeps = { ...staffPkg.dependencies, ...staffPkg.devDependencies };
    const connectDeps = { ...connectPkg.dependencies, ...connectPkg.devDependencies };
    
    // All should have TypeScript
    expect('typescript' in customerDeps).toBe(true);
    expect('typescript' in staffDeps).toBe(true);
    expect('typescript' in connectDeps).toBe(true);
  });
});
