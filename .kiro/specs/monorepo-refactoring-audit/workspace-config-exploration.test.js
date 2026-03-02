/**
 * Bug Condition Exploration Test: Workspace Configuration Validation
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.14, 1.15, 1.16**
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * DO NOT attempt to fix the test or the code when it fails
 * 
 * This test encodes the expected behavior - it will validate the fix when it passes after implementation
 * 
 * GOAL: Surface counterexamples that demonstrate workspace misconfiguration exists
 * 
 * Bug Condition Function:
 * isRefactoringBug(ProjectState) = (
 *   (hasWorkspaceYaml(ProjectState) AND NOT hasProperWorkspaceStructure(ProjectState)) OR
 *   (hasDuplicatePackages(ProjectState)) OR
 *   (hasWorkspaceProtocolWithoutWorkspace(ProjectState)) OR
 *   (hasBrokenImportPaths(ProjectState)) OR
 *   (hasNestedNodeModules(ProjectState))
 * )
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// CORE TRUTH: Manual service always exists. 
// Digital authority is singular. 
// Tabeza adapts to the venue — never the reverse.

// Project paths
const PROJECTS = {
  'tabeza-connect': path.resolve(__dirname, '../../../..'),
  'tabeza-customer': path.resolve(__dirname, '../../../../tabeza-customer'),
  'tabeza-staff': path.resolve(__dirname, '../../../../tabeza-staff')
};

describe('Workspace Configuration Bug Exploration', () => {
  describe('Property 1: Fault Condition - Workspace Configuration Validation', () => {
    
    test('1.1 - tabeza-customer has workspace yaml but no packages/ directory', () => {
      const projectPath = PROJECTS['tabeza-customer'];
      const workspaceYamlPath = path.join(projectPath, 'pnpm-workspace.yaml');
      const packagesPath = path.join(projectPath, 'packages');
      
      // Check if workspace yaml exists
      const hasWorkspaceYaml = fs.existsSync(workspaceYamlPath);
      
      // Check if packages directory exists
      const hasPackagesDir = fs.existsSync(packagesPath) && fs.statSync(packagesPath).isDirectory();
      
      // Read workspace yaml to see what it declares
      let workspaceConfig = null;
      if (hasWorkspaceYaml) {
        const yamlContent = fs.readFileSync(workspaceYamlPath, 'utf8');
        workspaceConfig = yaml.load(yamlContent);
      }
      
      console.log('\n=== tabeza-customer Analysis ===');
      console.log('Has pnpm-workspace.yaml:', hasWorkspaceYaml);
      console.log('Workspace config:', JSON.stringify(workspaceConfig, null, 2));
      console.log('Has packages/ directory:', hasPackagesDir);
      console.log('Packages are in lib/ instead:', fs.existsSync(path.join(projectPath, 'lib')));
      
      // EXPECTED BEHAVIOR: Either no workspace yaml OR proper packages/ directory
      // BUG CONDITION: Has workspace yaml but no packages/ directory
      expect(hasWorkspaceYaml && !hasPackagesDir).toBe(false);
    });
    
    test('1.2 - tabeza-staff has workspace yaml but packages in lib/packages/ instead of root', () => {
      const projectPath = PROJECTS['tabeza-staff'];
      const workspaceYamlPath = path.join(projectPath, 'pnpm-workspace.yaml');
      const packagesPath = path.join(projectPath, 'packages');
      const libPackagesPath = path.join(projectPath, 'lib/packages');
      
      const hasWorkspaceYaml = fs.existsSync(workspaceYamlPath);
      const hasRootPackages = fs.existsSync(packagesPath) && fs.statSync(packagesPath).isDirectory();
      const hasLibPackages = fs.existsSync(libPackagesPath) && fs.statSync(libPackagesPath).isDirectory();
      
      // Read workspace yaml
      let workspaceConfig = null;
      if (hasWorkspaceYaml) {
        const yamlContent = fs.readFileSync(workspaceYamlPath, 'utf8');
        workspaceConfig = yaml.load(yamlContent);
      }
      
      console.log('\n=== tabeza-staff Analysis ===');
      console.log('Has pnpm-workspace.yaml:', hasWorkspaceYaml);
      console.log('Workspace config:', JSON.stringify(workspaceConfig, null, 2));
      console.log('Has packages/ directory:', hasRootPackages);
      console.log('Has lib/packages/ directory:', hasLibPackages);
      console.log('Workspace declares lib/packages/*:', workspaceConfig?.packages?.includes('lib/packages/*'));
      
      // EXPECTED BEHAVIOR: If workspace, packages should be at root level (packages/*)
      // BUG CONDITION: Has workspace yaml with non-standard lib/packages/* location
      const hasNonStandardPackageLocation = hasWorkspaceYaml && 
                                           !hasRootPackages && 
                                           hasLibPackages &&
                                           workspaceConfig?.packages?.includes('lib/packages/*');
      
      expect(hasNonStandardPackageLocation).toBe(false);
    });
    
    test('1.3 - tabeza-connect has workspace yaml but no workspace structure', () => {
      const projectPath = PROJECTS['tabeza-connect'];
      const workspaceYamlPath = path.join(projectPath, 'pnpm-workspace.yaml');
      const packagesPath = path.join(projectPath, 'packages');
      
      const hasWorkspaceYaml = fs.existsSync(workspaceYamlPath);
      const hasPackagesDir = fs.existsSync(packagesPath) && fs.statSync(packagesPath).isDirectory();
      
      // Read workspace yaml
      let workspaceConfig = null;
      if (hasWorkspaceYaml) {
        const yamlContent = fs.readFileSync(workspaceYamlPath, 'utf8');
        workspaceConfig = yaml.load(yamlContent);
      }
      
      console.log('\n=== tabeza-connect Analysis ===');
      console.log('Has pnpm-workspace.yaml:', hasWorkspaceYaml);
      console.log('Workspace config:', JSON.stringify(workspaceConfig, null, 2));
      console.log('Has packages/ directory:', hasPackagesDir);
      console.log('Has meaningful workspace config:', workspaceConfig?.packages?.length > 0);
      
      // EXPECTED BEHAVIOR: Standalone app should not have workspace yaml
      // BUG CONDITION: Has workspace yaml but no actual workspace structure
      const hasUselessWorkspaceYaml = hasWorkspaceYaml && 
                                     !hasPackagesDir && 
                                     (!workspaceConfig?.packages || workspaceConfig.packages.length === 0);
      
      expect(hasUselessWorkspaceYaml).toBe(false);
    });
    
    test('1.4 - workspace:* protocol used without proper workspace links', () => {
      const projects = ['tabeza-customer', 'tabeza-staff'];
      const violations = [];
      
      for (const projectName of projects) {
        const projectPath = PROJECTS[projectName];
        const packageJsonPath = path.join(projectPath, 'package.json');
        
        if (!fs.existsSync(packageJsonPath)) continue;
        
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        // Find workspace:* dependencies
        const workspaceDeps = Object.entries(deps).filter(([_, version]) => 
          typeof version === 'string' && version.startsWith('workspace:')
        );
        
        if (workspaceDeps.length > 0) {
          // Check if packages actually exist in workspace structure
          const workspaceYamlPath = path.join(projectPath, 'pnpm-workspace.yaml');
          const hasWorkspaceYaml = fs.existsSync(workspaceYamlPath);
          
          let workspaceConfig = null;
          if (hasWorkspaceYaml) {
            const yamlContent = fs.readFileSync(workspaceYamlPath, 'utf8');
            workspaceConfig = yaml.load(yamlContent);
          }
          
          // Check if packages are in declared workspace locations
          const declaredPackages = workspaceConfig?.packages || [];
          const hasProperWorkspace = declaredPackages.some(pattern => {
            const globPath = pattern.replace('/*', '');
            const fullPath = path.join(projectPath, globPath);
            return fs.existsSync(fullPath);
          });
          
          console.log(`\n=== ${projectName} workspace:* usage ===`);
          console.log('Workspace dependencies:', workspaceDeps.map(([name]) => name));
          console.log('Has workspace yaml:', hasWorkspaceYaml);
          console.log('Declared packages:', declaredPackages);
          console.log('Has proper workspace structure:', hasProperWorkspace);
          
          if (!hasProperWorkspace) {
            violations.push({
              project: projectName,
              workspaceDeps: workspaceDeps.map(([name]) => name),
              issue: 'Uses workspace:* protocol but packages not in declared workspace locations'
            });
          }
        }
      }
      
      console.log('\n=== workspace:* violations ===');
      console.log(JSON.stringify(violations, null, 2));
      
      // EXPECTED BEHAVIOR: workspace:* should only be used with proper workspace structure
      // BUG CONDITION: workspace:* used but packages are copied to lib/ instead of workspace-linked
      expect(violations.length).toBe(0);
    });
    
    test('1.5 - Duplicate packages without sync strategy', () => {
      const sharedPackages = [
        'shared',
        'code-guardrails',
        'database',
        'printer-service',
        'receipt-schema',
        'tax-rules',
        'validation'
      ];
      
      const packageLocations = {};
      
      // Check tabeza-customer lib/
      const customerLibPath = path.join(PROJECTS['tabeza-customer'], 'lib');
      if (fs.existsSync(customerLibPath)) {
        sharedPackages.forEach(pkg => {
          const pkgPath = path.join(customerLibPath, pkg);
          if (fs.existsSync(pkgPath)) {
            if (!packageLocations[pkg]) packageLocations[pkg] = [];
            packageLocations[pkg].push(`tabeza-customer/lib/${pkg}`);
          }
        });
      }
      
      // Check tabeza-staff lib/packages/
      const staffLibPackagesPath = path.join(PROJECTS['tabeza-staff'], 'lib/packages');
      if (fs.existsSync(staffLibPackagesPath)) {
        sharedPackages.forEach(pkg => {
          const pkgPath = path.join(staffLibPackagesPath, pkg);
          if (fs.existsSync(pkgPath)) {
            if (!packageLocations[pkg]) packageLocations[pkg] = [];
            packageLocations[pkg].push(`tabeza-staff/lib/packages/${pkg}`);
          }
        });
      }
      
      // Find duplicates
      const duplicates = Object.entries(packageLocations).filter(([_, locations]) => locations.length > 1);
      
      console.log('\n=== Package Duplication Analysis ===');
      console.log('Shared packages checked:', sharedPackages);
      console.log('Package locations:', JSON.stringify(packageLocations, null, 2));
      console.log('Duplicated packages:', duplicates.map(([name, locs]) => `${name} (${locs.length} copies)`));
      
      // Check if sync strategy exists
      const hasSyncStrategy = 
        fs.existsSync(path.join(PROJECTS['tabeza-customer'], 'SHARED_CODE_SYNC.md')) &&
        fs.existsSync(path.join(PROJECTS['tabeza-staff'], 'SHARED_CODE_SYNC.md')) &&
        fs.existsSync(path.join(PROJECTS['tabeza-customer'], 'dev-tools/scripts/sync-shared-packages.js')) &&
        fs.existsSync(path.join(PROJECTS['tabeza-staff'], 'dev-tools/scripts/sync-shared-packages.js'));
      
      console.log('Has sync strategy documentation:', hasSyncStrategy);
      
      // EXPECTED BEHAVIOR: Standalone architecture allows duplicates IF sync strategy exists
      // BUG CONDITION: Packages are duplicated WITHOUT a clear sync strategy
      const hasDuplicatesWithoutStrategy = duplicates.length > 0 && !hasSyncStrategy;
      
      expect(hasDuplicatesWithoutStrategy).toBe(false);
    });
    
    test('1.6 - Nested node_modules in packages', () => {
      const nestedNodeModules = [];
      
      // Check tabeza-customer lib/
      const customerLibPath = path.join(PROJECTS['tabeza-customer'], 'lib');
      if (fs.existsSync(customerLibPath)) {
        const packages = fs.readdirSync(customerLibPath).filter(item => {
          const itemPath = path.join(customerLibPath, item);
          return fs.statSync(itemPath).isDirectory();
        });
        
        packages.forEach(pkg => {
          const nodeModulesPath = path.join(customerLibPath, pkg, 'node_modules');
          if (fs.existsSync(nodeModulesPath)) {
            nestedNodeModules.push(`tabeza-customer/lib/${pkg}/node_modules`);
          }
        });
      }
      
      // Check tabeza-staff lib/packages/
      const staffLibPackagesPath = path.join(PROJECTS['tabeza-staff'], 'lib/packages');
      if (fs.existsSync(staffLibPackagesPath)) {
        const packages = fs.readdirSync(staffLibPackagesPath).filter(item => {
          const itemPath = path.join(staffLibPackagesPath, item);
          return fs.statSync(itemPath).isDirectory();
        });
        
        packages.forEach(pkg => {
          const nodeModulesPath = path.join(staffLibPackagesPath, pkg, 'node_modules');
          if (fs.existsSync(nodeModulesPath)) {
            nestedNodeModules.push(`tabeza-staff/lib/packages/${pkg}/node_modules`);
          }
        });
      }
      
      console.log('\n=== Nested node_modules Analysis ===');
      console.log('Found nested node_modules:', nestedNodeModules);
      console.log('Count:', nestedNodeModules.length);
      
      // EXPECTED BEHAVIOR: Dependencies should be hoisted to root, no nested node_modules
      // BUG CONDITION: Packages have their own node_modules causing conflicts
      expect(nestedNodeModules.length).toBe(0);
    });
    
    test('1.7 - TypeScript module resolution for @tabeza/* imports', () => {
      const projects = ['tabeza-customer', 'tabeza-staff'];
      const resolutionIssues = [];
      
      for (const projectName of projects) {
        const projectPath = PROJECTS[projectName];
        const tsconfigPath = path.join(projectPath, 'tsconfig.json');
        
        if (!fs.existsSync(tsconfigPath)) {
          resolutionIssues.push({
            project: projectName,
            issue: 'No tsconfig.json found'
          });
          continue;
        }
        
        const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
        const paths = tsconfig.compilerOptions?.paths || {};
        
        // Check if @tabeza/* paths are configured
        const hasTabezaPaths = Object.keys(paths).some(key => key.startsWith('@tabeza/'));
        
        console.log(`\n=== ${projectName} TypeScript paths ===`);
        console.log('Has @tabeza/* path mappings:', hasTabezaPaths);
        console.log('Configured paths:', Object.keys(paths));
        
        // If using workspace:* protocol, TypeScript paths should be configured
        const packageJsonPath = path.join(projectPath, 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        const hasWorkspaceDeps = Object.values(deps).some(v => 
          typeof v === 'string' && v.startsWith('workspace:')
        );
        
        if (hasWorkspaceDeps && !hasTabezaPaths) {
          resolutionIssues.push({
            project: projectName,
            issue: 'Uses workspace:* dependencies but no TypeScript path mappings for @tabeza/*'
          });
        }
      }
      
      console.log('\n=== TypeScript Resolution Issues ===');
      console.log(JSON.stringify(resolutionIssues, null, 2));
      
      // EXPECTED BEHAVIOR: TypeScript should have path mappings for @tabeza/* imports
      // BUG CONDITION: workspace:* used but TypeScript can't resolve imports
      expect(resolutionIssues.length).toBe(0);
    });
    
  });
  
  describe('Summary: Bug Condition Counterexamples', () => {
    test('Document all discovered issues', () => {
      console.log('\n');
      console.log('='.repeat(80));
      console.log('BUG CONDITION EXPLORATION SUMMARY');
      console.log('='.repeat(80));
      console.log('\nThis test suite validates the bug condition function:');
      console.log('isRefactoringBug(ProjectState) = (');
      console.log('  (hasWorkspaceYaml AND NOT hasProperWorkspaceStructure) OR');
      console.log('  (hasDuplicatePackages) OR');
      console.log('  (hasWorkspaceProtocolWithoutWorkspace) OR');
      console.log('  (hasBrokenImportPaths) OR');
      console.log('  (hasNestedNodeModules)');
      console.log(')');
      console.log('\nEXPECTED OUTCOME: This test FAILS on unfixed code');
      console.log('Failures confirm the bug exists and provide counterexamples');
      console.log('\nAfter fix implementation, this same test should PASS');
      console.log('='.repeat(80));
      
      // This test always passes - it's just for documentation
      expect(true).toBe(true);
    });
  });
});
