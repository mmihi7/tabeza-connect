# Monorepo Refactoring Audit Bugfix Design

## Overview

This design addresses critical architectural issues that emerged from splitting the original Tabeza monorepo (C:\Projects\Tabz) into three separate projects: tabeza-customer, tabeza-staff, and tabeza-connect. The split created workspace misconfigurations, broken module resolution, duplicate packages, and inconsistent dependency management.

The fix strategy involves:
1. Analyzing the current state vs intended architecture
2. Making an architectural decision for each project (workspace vs standalone)
3. Implementing a systematic refactoring plan
4. Establishing a shared code synchronization strategy
5. Fixing all build and type-checking issues

## Glossary

- **Workspace**: A pnpm workspace configuration where multiple packages are linked together using `workspace:*` protocol
- **Standalone App**: A single application with all dependencies copied locally, no workspace configuration
- **@tabeza/shared**: The shared package containing common types, utilities, and business logic
- **Module Resolution**: The process by which TypeScript and Node.js resolve import paths to actual files
- **Hoisting**: pnpm's strategy of installing dependencies at the root level to avoid duplication
- **workspace:* Protocol**: pnpm's special dependency protocol that links to workspace packages
- **Monorepo**: The original Tabz project at C:\Projects\Tabz with proper workspace structure
- **Split Projects**: The three separate repositories (tabeza-customer, tabeza-staff, tabeza-connect)

## Bug Details

### Fault Condition

The bug manifests when the split projects claim to be pnpm workspaces but lack proper workspace structure, causing module resolution failures, duplicate packages, and build errors.

**Formal Specification:**
```
FUNCTION isRefactoringBug(ProjectState)
  INPUT: ProjectState containing workspace config, package structure, and imports
  OUTPUT: boolean
  
  RETURN (
    (hasWorkspaceYaml(ProjectState) AND NOT hasProperWorkspaceStructure(ProjectState)) OR
    (hasDuplicatePackages(ProjectState)) OR
    (hasWorkspaceProtocolWithoutWorkspace(ProjectState)) OR
    (hasBrokenImportPaths(ProjectState)) OR
    (hasNestedNodeModules(ProjectState))
  )
END FUNCTION
```

### Examples

**tabeza-customer:**
- Has `pnpm-workspace.yaml` declaring `packages/*` but no packages directory exists
- Packages are copied to `lib/` instead of being workspace-linked
- References `@tabeza/shared: workspace:*` but shared is in `lib/shared/` not `packages/shared/`
- Has nested `node_modules` in `lib/shared/node_modules`

**tabeza-staff:**
- Has `pnpm-workspace.yaml` declaring `lib/packages/*` (non-standard location)
- Packages are in `lib/packages/` instead of root-level `packages/`
- References `@tabeza/shared: workspace:*` pointing to `lib/packages/shared/`
- Has 7 duplicate packages in `lib/packages/` directory

**tabeza-connect:**
- Has `pnpm-workspace.yaml` but it's essentially empty (only ignoredBuiltDependencies)
- No packages directory, no workspace structure
- Standalone Electron app that doesn't need workspace configuration
- Workspace yaml serves no purpose

**All Projects:**
- Duplicate copies of 7 packages: shared, code-guardrails, database, printer-service, receipt-schema, tax-rules, validation
- No single source of truth for shared code
- No synchronization strategy between projects
- TypeScript may fail to resolve `@tabeza/*` imports

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- All customer app functionality must continue to work (QR scanning, menu browsing, order placement, payments)
- All staff app functionality must continue to work (order management, payment processing, bar configuration, onboarding)
- tabeza-connect service must continue to capture and process POS print jobs correctly
- Development workflow must remain smooth (pnpm dev, hot reload, etc.)
- Type safety must be preserved across all code
- Production builds must generate optimized bundles correctly
- PWA features must continue to provide offline functionality

**Scope:**
All runtime functionality, development workflows, type safety, and deployment processes must remain identical to the original monorepo despite the structural refactoring.

## Hypothesized Root Cause

Based on the bug description and project analysis, the root causes are:

1. **Incomplete Workspace Migration**: When splitting the monorepo, the workspace configuration files were copied but the actual workspace structure was not properly established
   - tabeza-customer has workspace yaml but packages in wrong location (lib/ instead of packages/)
   - tabeza-staff has workspace yaml with non-standard package location (lib/packages/)
   - tabeza-connect has workspace yaml but no workspace structure at all

2. **Package Duplication Strategy**: Instead of establishing proper workspace links or choosing a standalone approach, packages were simply copied to each project
   - 7 packages duplicated across projects
   - No synchronization mechanism
   - Nested node_modules causing dependency conflicts

3. **Inconsistent Architecture Decision**: No clear decision was made about whether each project should be:
   - A proper pnpm workspace (like the original monorepo)
   - A standalone app with copied dependencies
   - Part of a larger multi-repo setup with shared packages

4. **Import Path Confusion**: The `workspace:*` protocol was kept in package.json but points to copied packages instead of workspace-linked packages
   - TypeScript path resolution may fail
   - Build tools may not find correct modules
   - Runtime module loading may break

## Correctness Properties

Property 1: Fault Condition - Workspace Configuration Correctness

_For any_ project state where refactoring issues exist (workspace yaml without proper structure, duplicate packages, broken imports), the fixed project SHALL have a consistent architecture where either: (a) it is a proper pnpm workspace with packages/ directory and correct workspace links, OR (b) it is a standalone app with no workspace yaml and all dependencies properly copied, AND all imports resolve correctly, AND type-checking passes, AND builds succeed.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.14, 2.15, 2.16**

Property 2: Preservation - Functional Behavior Unchanged

_For any_ runtime behavior, development workflow, type safety check, or deployment process that worked in the original monorepo, the refactored projects SHALL produce exactly the same behavior, preserving all customer features, staff features, tabeza-connect functionality, development experience, and production deployment capabilities.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13**

## Fix Implementation

### Architectural Decision

After analyzing the three projects and their requirements, the recommended architecture is:

**Decision: All three projects should be STANDALONE APPS**

**Rationale:**
1. **Separate Repositories**: Each project is in its own git repository with independent deployment
2. **Independent Development**: Teams can work on each project without coordinating workspace changes
3. **Simpler Dependency Management**: No workspace protocol complexity, standard npm/pnpm dependencies
4. **Clear Ownership**: Each project owns its dependencies, no shared workspace state
5. **Easier CI/CD**: Each project builds independently without workspace coordination
6. **tabeza-connect is Already Standalone**: It's an Electron app with no workspace needs

**Alternative Considered: Keep as Workspaces**
- Would require moving all projects back into a monorepo structure
- Would need shared packages/ directory accessible to all three projects
- Would complicate deployment (three apps from one repo)
- Would require workspace coordination for every change
- **Rejected**: Doesn't match the current multi-repo reality

### Changes Required

#### Phase 1: tabeza-connect (Simplest - Already Standalone)

**File**: `tabeza-connect/pnpm-workspace.yaml`

**Action**: DELETE this file (it serves no purpose)

**File**: `tabeza-connect/package.json`

**Action**: No changes needed (already has no workspace dependencies)

**Verification**:
- Run `pnpm install` - should work without workspace
- Run build scripts - should succeed
- No TypeScript errors

#### Phase 2: tabeza-customer (Convert to Standalone)

**File**: `tabeza-customer/pnpm-workspace.yaml`

**Action**: DELETE this file

**File**: `tabeza-customer/turbo.json`

**Action**: SIMPLIFY - remove workspace-specific configurations

**Changes**:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "outputs": [".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "start": {
      "cache": false,
      "persistent": true
    },
    "type-check": {},
    "test": {},
    "clean": {
      "cache": false
    }
  }
}
```

**File**: `tabeza-customer/package.json`

**Action**: REPLACE `@tabeza/shared: workspace:*` with local file reference

**Changes**:
```json
{
  "dependencies": {
    "@tabeza/shared": "file:./lib/shared"
  }
}
```

**File**: `tabeza-customer/tsconfig.json`

**Action**: ADD path mapping for @tabeza/* imports

**Changes**:
```json
{
  "compilerOptions": {
    "paths": {
      "@tabeza/shared": ["./lib/shared"],
      "@tabeza/shared/*": ["./lib/shared/*"],
      "@tabeza/tax-rules": ["./lib/tax-rules"],
      "@tabeza/validation": ["./lib/validation"],
      "@tabeza/database": ["./lib/database"],
      "@tabeza/code-guardrails": ["./lib/code-guardrails"],
      "@tabeza/printer-service": ["./lib/printer-service"],
      "@tabeza/receipt-schema": ["./lib/receipt-schema"]
    }
  }
}
```

**Directory Structure Changes**:
- Keep packages in `lib/` (already there)
- Remove nested `node_modules` in lib packages
- Update each package's package.json to use `file:` protocol for cross-package dependencies

**Verification Steps**:
1. Delete `node_modules` and `pnpm-lock.yaml`
2. Run `pnpm install` - should install without workspace
3. Run `pnpm type-check` - should pass
4. Run `pnpm build` - should succeed
5. Run `pnpm dev` - should start on port 3002

#### Phase 3: tabeza-staff (Convert to Standalone)

**File**: `tabeza-staff/pnpm-workspace.yaml`

**Action**: DELETE this file

**File**: `tabeza-staff/turbo.json`

**Action**: SIMPLIFY - remove workspace-specific configurations (same as tabeza-customer)

**File**: `tabeza-staff/package.json`

**Action**: REPLACE `@tabeza/shared: workspace:*` with local file reference

**Changes**:
```json
{
  "dependencies": {
    "@tabeza/shared": "file:./lib/packages/shared"
  }
}
```

**File**: `tabeza-staff/tsconfig.json`

**Action**: ADD path mapping for @tabeza/* imports

**Changes**:
```json
{
  "compilerOptions": {
    "paths": {
      "@tabeza/shared": ["./lib/packages/shared"],
      "@tabeza/shared/*": ["./lib/packages/shared/*"],
      "@tabeza/tax-rules": ["./lib/packages/tax-rules"],
      "@tabeza/validation": ["./lib/packages/validation"],
      "@tabeza/database": ["./lib/packages/database"],
      "@tabeza/code-guardrails": ["./lib/packages/code-guardrails"],
      "@tabeza/printer-service": ["./lib/packages/printer-service"],
      "@tabeza/receipt-schema": ["./lib/packages/receipt-schema"]
    }
  }
}
```

**Directory Structure Changes**:
- Keep packages in `lib/packages/` (already there)
- Remove nested `node_modules` in lib packages
- Update each package's package.json to use `file:` protocol for cross-package dependencies

**Verification Steps**:
1. Delete `node_modules` and `pnpm-lock.yaml`
2. Run `pnpm install` - should install without workspace
3. Run `pnpm type-check` - should pass
4. Run `pnpm build` - should succeed
5. Run `pnpm dev` - should start on port 3003

#### Phase 4: Shared Code Synchronization Strategy

**Problem**: With standalone apps, how do we keep shared code synchronized?

**Recommended Strategy: Manual Sync with Documentation**

**Approach**:
1. **Designate Source of Truth**: Choose one project as the primary source for each shared package
   - `@tabeza/shared` → tabeza-staff (most complete, has onboarding logic)
   - `@tabeza/tax-rules` → tabeza-staff
   - `@tabeza/validation` → tabeza-staff
   - Other packages → tabeza-staff

2. **Create Sync Script**: Add a script to copy packages between projects

**File**: `dev-tools/scripts/sync-shared-packages.js` (in each project)

```javascript
// Script to sync shared packages from source project
// Usage: node dev-tools/scripts/sync-shared-packages.js <source-project-path>

const fs = require('fs-extra');
const path = require('path');

const sourceProject = process.argv[2];
if (!sourceProject) {
  console.error('Usage: node sync-shared-packages.js <source-project-path>');
  process.exit(1);
}

const packages = [
  'shared',
  'tax-rules',
  'validation',
  'database',
  'code-guardrails',
  'printer-service',
  'receipt-schema'
];

const sourceBase = path.join(sourceProject, 'lib/packages');
const targetBase = path.join(__dirname, '../../lib/packages');

packages.forEach(pkg => {
  const source = path.join(sourceBase, pkg);
  const target = path.join(targetBase, pkg);
  
  if (fs.existsSync(source)) {
    console.log(`Syncing ${pkg}...`);
    fs.copySync(source, target, { overwrite: true });
  } else {
    console.warn(`Warning: ${pkg} not found in source`);
  }
});

console.log('Sync complete!');
```

3. **Document Sync Process**: Create SHARED_CODE_SYNC.md in each project

**File**: `SHARED_CODE_SYNC.md`

```markdown
# Shared Code Synchronization

## Source of Truth

The **tabeza-staff** project is the primary source for all shared packages.

## Packages

- @tabeza/shared
- @tabeza/tax-rules
- @tabeza/validation
- @tabeza/database
- @tabeza/code-guardrails
- @tabeza/printer-service
- @tabeza/receipt-schema

## Syncing Changes

### From tabeza-staff to other projects:

```bash
# In tabeza-customer or other project
node dev-tools/scripts/sync-shared-packages.js ../tabeza-staff
pnpm install
```

### Making Changes:

1. Make changes in tabeza-staff first
2. Test thoroughly in tabeza-staff
3. Sync to other projects
4. Test in other projects
5. Commit changes in all projects

## Alternative: Git Submodules (Future)

If synchronization becomes too complex, consider:
- Moving shared packages to a separate git repository
- Using git submodules in each project
- Or publishing packages to a private npm registry
```

**Alternative Strategies Considered**:

**A. Git Submodules**
- Pros: Single source of truth, automatic sync via git
- Cons: Complex workflow, submodule management overhead
- Decision: Keep as future option if manual sync becomes problematic

**B. Private npm Registry**
- Pros: Standard npm workflow, versioning
- Cons: Infrastructure overhead, publishing workflow
- Decision: Overkill for current team size

**C. Monorepo with Turborepo**
- Pros: Proper workspace management, build caching
- Cons: Requires moving all projects back together
- Decision: Rejected - doesn't match multi-repo reality

#### Phase 5: Fix Package Dependencies

**Problem**: Packages reference each other with `workspace:*` protocol

**Solution**: Update all package.json files in lib/ directories to use `file:` protocol

**Example**: `tabeza-staff/lib/packages/shared/package.json`

**Current**:
```json
{
  "dependencies": {
    "@tabeza/tax-rules": "workspace:*"
  }
}
```

**Fixed**:
```json
{
  "dependencies": {
    "@tabeza/tax-rules": "file:../tax-rules"
  }
}
```

**Apply to all packages in**:
- `tabeza-customer/lib/`
- `tabeza-staff/lib/packages/`

#### Phase 6: Clean Up Nested node_modules

**Problem**: Packages have their own node_modules causing conflicts

**Solution**: 
1. Delete all nested node_modules in lib/ directories
2. Let pnpm hoist dependencies to root
3. If packages need specific dependencies, keep them in package.json but let pnpm manage installation

**Commands**:
```bash
# In each project
find lib -name "node_modules" -type d -exec rm -rf {} +
pnpm install
```

#### Phase 7: Update Next.js Configuration

**File**: `tabeza-customer/next.config.js` and `tabeza-staff/next.config.js`

**Action**: Ensure transpilePackages includes local packages

**Changes**:
```javascript
const nextConfig = {
  transpilePackages: [
    '@tabeza/shared',
    '@tabeza/tax-rules',
    '@tabeza/validation',
    '@tabeza/database'
  ],
  // ... rest of config
};
```

## Testing Strategy

### Validation Approach

The testing strategy follows a systematic verification approach: first validate the architectural changes don't break anything, then verify all functionality is preserved.

### Exploratory Fault Condition Checking

**Goal**: Verify that the refactoring fixes resolve all workspace configuration issues, module resolution problems, and build errors.

**Test Plan**: Apply fixes to each project incrementally and verify at each step that the issues are resolved.

**Test Cases**:
1. **tabeza-connect Workspace Removal**: Delete pnpm-workspace.yaml, verify build still works
2. **tabeza-customer Standalone Conversion**: Remove workspace config, update dependencies, verify type-checking and build
3. **tabeza-staff Standalone Conversion**: Remove workspace config, update dependencies, verify type-checking and build
4. **Module Resolution Test**: Verify all @tabeza/* imports resolve correctly in TypeScript
5. **Dependency Hoisting Test**: Verify no nested node_modules after pnpm install
6. **Build Test**: Verify all three projects build successfully

**Expected Results**:
- No workspace configuration errors
- All TypeScript imports resolve correctly
- No duplicate node_modules
- All builds succeed
- No module resolution errors at runtime

### Fix Checking

**Goal**: Verify that for all project states where refactoring bugs existed, the fixed projects have correct architecture and all functionality works.

**Pseudocode:**
```
FOR ALL ProjectState WHERE isRefactoringBug(ProjectState) DO
  fixedState := applyRefactoringFixes(ProjectState)
  ASSERT (
    (isStandaloneApp(fixedState) AND hasNoDuplicateNodeModules(fixedState)) OR
    (isProperWorkspace(fixedState) AND hasCorrectWorkspaceLinks(fixedState))
  ) AND
  allImportsResolve(fixedState) AND
  typeCheckingPasses(fixedState) AND
  buildSucceeds(fixedState)
END FOR
```

### Preservation Checking

**Goal**: Verify that all runtime functionality, development workflows, and deployment processes remain unchanged.

**Pseudocode:**
```
FOR ALL RuntimeBehavior WHERE NOT isRefactoringBug(RuntimeBehavior) DO
  ASSERT originalMonorepo(RuntimeBehavior) = refactoredProjects(RuntimeBehavior)
END FOR
```

**Testing Approach**: Manual testing and automated tests to verify behavior preservation.

**Test Plan**: Test all critical user flows and development workflows in each project.

**Test Cases**:

**tabeza-customer Preservation Tests**:
1. **QR Code Scanning**: Verify customers can scan QR codes and open tabs
2. **Menu Browsing**: Verify menu displays correctly with all items
3. **Order Placement**: Verify customers can place orders
4. **Payment Processing**: Verify M-Pesa payments work correctly
5. **PWA Features**: Verify offline functionality and service workers
6. **Development Workflow**: Verify `pnpm dev` starts correctly on port 3002
7. **Hot Reload**: Verify changes trigger hot module replacement
8. **Production Build**: Verify `pnpm build` creates optimized bundle

**tabeza-staff Preservation Tests**:
1. **Order Management**: Verify staff can view and manage orders
2. **Payment Processing**: Verify staff can process payments
3. **Bar Configuration**: Verify venue settings and configuration work
4. **Onboarding Flow**: Verify mode selection and setup wizard work
5. **Menu Management**: Verify staff can create and edit menu items
6. **PWA Features**: Verify offline functionality for staff app
7. **Development Workflow**: Verify `pnpm dev` starts correctly on port 3003
8. **Hot Reload**: Verify changes trigger hot module replacement
9. **Production Build**: Verify `pnpm build` creates optimized bundle

**tabeza-connect Preservation Tests**:
1. **Print Job Capture**: Verify POS print jobs are captured correctly
2. **Receipt Processing**: Verify receipts are parsed and uploaded
3. **Service Installation**: Verify Windows service installs correctly
4. **Tray Application**: Verify system tray app works correctly
5. **Configuration**: Verify config.json is read and applied correctly
6. **Build Process**: Verify all build scripts work correctly

### Unit Tests

- Test TypeScript path resolution with sample imports
- Test package.json dependency resolution
- Test Next.js transpilePackages configuration
- Test that no workspace protocol remains in any package.json

### Integration Tests

- Test full development workflow (install, dev, build) for each project
- Test that all three projects can run simultaneously
- Test that changes in shared packages can be synced between projects
- Test production deployment process for each project

### Regression Tests

- Run existing test suites in each project
- Verify all tests pass after refactoring
- Check for any new TypeScript errors
- Verify no runtime errors in development or production
