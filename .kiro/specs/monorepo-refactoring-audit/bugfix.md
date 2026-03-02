# Bugfix Requirements Document: Monorepo Refactoring Audit

## Introduction

This document addresses critical refactoring issues that emerged from splitting the original Tabeza monorepo (C:\Projects\Tabz) into three separate projects: tabeza-customer, tabeza-staff, and tabeza-connect. The split has resulted in workspace misconfigurations, broken module resolution, duplicate packages, and inconsistent dependency management that prevents proper builds and type-checking across the projects.

The bug impacts all three projects and requires a systematic audit and correction of:
- Workspace structure and configuration
- Package dependencies and import paths
- Shared code distribution strategy
- Build and type-checking infrastructure

## Bug Analysis

### Current Behavior (Defect)

#### 1. Workspace Configuration Issues

1.1 WHEN tabeza-customer project is examined THEN the system has pnpm-workspace.yaml but no packages directory, with packages copied to lib/ instead of being workspace-linked

1.2 WHEN tabeza-staff project is examined THEN the system has pnpm-workspace.yaml but packages are nested in lib/packages/ instead of root-level packages/

1.3 WHEN package.json files reference @tabeza/shared: workspace:* THEN the system has locally copied packages instead of proper workspace links, causing module resolution failures

1.4 WHEN both projects claim workspace protocol THEN the system is not properly configured as pnpm workspaces, leading to dependency management issues

#### 2. Package Structure and Duplication

1.5 WHEN shared packages are examined THEN the system has duplicate copies in tabeza-customer/lib/ and tabeza-staff/lib/packages/ instead of a single source of truth

1.6 WHEN node_modules are examined THEN the system has duplicate node_modules in multiple nested packages (lib/shared/node_modules, lib/code-guardrails/node_modules, etc.) instead of hoisted dependencies

1.7 WHEN packages are counted THEN the system has 7 packages duplicated across projects (shared, code-guardrails, database, printer-service, receipt-schema, tax-rules, validation)

#### 3. Import Path and Module Resolution

1.8 WHEN code imports @tabeza/shared THEN the system may fail to resolve the module correctly due to workspace:* references pointing to copied packages

1.9 WHEN relative imports from monorepo are used THEN the system has broken paths due to changed directory structure after the split

1.10 WHEN TypeScript type-checking runs THEN the system may fail due to unresolved module paths and broken import references

#### 4. Missing Shared Infrastructure

1.11 WHEN looking for centralized packages THEN the system has no shared packages directory accessible to all three projects

1.12 WHEN database migrations are examined THEN the system may have duplicated or missing migration files across projects

1.13 WHEN dev-tools and scripts are examined THEN the system has missing or duplicated development utilities that were in the original monorepo

#### 5. Build and Dependency Issues

1.14 WHEN pnpm install is run THEN the system creates nested node_modules instead of properly hoisting dependencies due to workspace misconfiguration

1.15 WHEN turbo build is attempted THEN the system may fail due to incorrect workspace references and missing package dependencies

1.16 WHEN type-checking is performed THEN the system reports errors for unresolved @tabeza/* imports

### Expected Behavior (Correct)

#### 2. Proper Workspace Structure

2.1 WHEN each project is examined THEN the system SHALL have a clear decision: either be a standalone app with copied dependencies OR a proper pnpm workspace with packages/ directory

2.2 WHEN tabeza-customer is configured THEN the system SHALL either remove pnpm-workspace.yaml and use copied packages, OR create proper packages/ directory with workspace links

2.3 WHEN tabeza-staff is configured THEN the system SHALL either remove pnpm-workspace.yaml and use copied packages, OR move lib/packages/ to root packages/ with proper workspace configuration

2.4 WHEN package.json dependencies are defined THEN the system SHALL use workspace:* only for actual workspace packages, or use file: protocol for local packages, or use version numbers for copied packages

#### 3. Module Resolution and Imports

2.5 WHEN @tabeza/shared is imported THEN the system SHALL resolve correctly to either workspace package or local lib/ package with proper TypeScript path mapping

2.6 WHEN relative imports are used THEN the system SHALL have correct paths reflecting the new project structure

2.7 WHEN TypeScript compiles THEN the system SHALL resolve all module paths without errors using proper tsconfig.json paths configuration

#### 4. Dependency Management

2.8 WHEN pnpm install is run THEN the system SHALL hoist dependencies properly with minimal duplication based on the chosen architecture (workspace vs standalone)

2.9 WHEN node_modules are examined THEN the system SHALL have dependencies installed at appropriate levels without unnecessary nesting

2.10 WHEN packages are updated THEN the system SHALL have a clear strategy for keeping shared code synchronized across projects

#### 5. Shared Code Strategy

2.11 WHEN shared code needs to be updated THEN the system SHALL have a documented strategy: either maintain separate copies, use git submodules, use npm packages, or use a monorepo tool

2.12 WHEN database migrations are needed THEN the system SHALL have a single source of truth for schema definitions with clear deployment strategy

2.13 WHEN dev-tools are needed THEN the system SHALL have utilities available in each project or in a shared location with clear access patterns

#### 6. Build Infrastructure

2.14 WHEN builds are executed THEN the system SHALL successfully compile all TypeScript without module resolution errors

2.15 WHEN turbo is used THEN the system SHALL have correct turbo.json configuration matching the actual project structure

2.16 WHEN CI/CD runs THEN the system SHALL have consistent build processes across all three projects

### Unchanged Behavior (Regression Prevention)

#### 3. Functional Behavior Preservation

3.1 WHEN customer app functionality is tested THEN the system SHALL CONTINUE TO provide all customer-facing features (QR scanning, menu browsing, order placement, payments)

3.2 WHEN staff app functionality is tested THEN the system SHALL CONTINUE TO provide all staff management features (order management, payment processing, bar configuration)

3.3 WHEN tabeza-connect service runs THEN the system SHALL CONTINUE TO capture and process POS print jobs correctly

3.4 WHEN runtime code executes THEN the system SHALL CONTINUE TO function identically to the monorepo version despite structural changes

#### 4. Development Workflow

3.5 WHEN developers run pnpm dev THEN the system SHALL CONTINUE TO start development servers on correct ports (customer: 3002, staff: 3003)

3.6 WHEN hot module replacement occurs THEN the system SHALL CONTINUE TO reload changes without requiring full restarts

3.7 WHEN tests are run THEN the system SHALL CONTINUE TO execute all test suites successfully

#### 5. Type Safety and Code Quality

3.8 WHEN TypeScript strict mode is enabled THEN the system SHALL CONTINUE TO enforce type safety across all code

3.9 WHEN linting is performed THEN the system SHALL CONTINUE TO apply consistent code quality rules

3.10 WHEN code is committed THEN the system SHALL CONTINUE TO run pre-commit hooks and validation

#### 6. Deployment and Production

3.11 WHEN production builds are created THEN the system SHALL CONTINUE TO generate optimized bundles with correct code splitting

3.12 WHEN apps are deployed to Vercel THEN the system SHALL CONTINUE TO deploy successfully with proper environment configuration

3.13 WHEN PWA features are used THEN the system SHALL CONTINUE TO provide offline functionality and service workers

## Bug Condition Derivation

### Bug Condition Function

```pascal
FUNCTION isRefactoringBug(ProjectState)
  INPUT: ProjectState containing workspace config, package structure, and imports
  OUTPUT: boolean
  
  // Returns true when refactoring issues from monorepo split are present
  RETURN (
    (hasWorkspaceYaml(ProjectState) AND NOT hasProperWorkspaceStructure(ProjectState)) OR
    (hasDuplicatePackages(ProjectState)) OR
    (hasWorkspaceProtocolWithoutWorkspace(ProjectState)) OR
    (hasBrokenImportPaths(ProjectState)) OR
    (hasNestedNodeModules(ProjectState))
  )
END FUNCTION
```

### Property Specification

```pascal
// Property: Fix Checking - Workspace Configuration Correctness
FOR ALL ProjectState WHERE isRefactoringBug(ProjectState) DO
  fixedState ← applyRefactoringFixes(ProjectState)
  ASSERT (
    (isStandaloneApp(fixedState) AND hasNoDuplicateNodeModules(fixedState)) OR
    (isProperWorkspace(fixedState) AND hasCorrectWorkspaceLinks(fixedState))
  ) AND
  allImportsResolve(fixedState) AND
  typeCheckingPasses(fixedState) AND
  buildSucceeds(fixedState)
END FOR
```

### Preservation Goal

```pascal
// Property: Preservation Checking - Functional Behavior Unchanged
FOR ALL RuntimeBehavior WHERE NOT isRefactoringBug(RuntimeBehavior) DO
  ASSERT originalMonorepo(RuntimeBehavior) = refactoredProjects(RuntimeBehavior)
END FOR
```

This ensures that all runtime functionality, development workflows, type safety, and deployment processes remain identical to the original monorepo despite the structural refactoring.

## Audit Scope

The comprehensive audit must examine:

1. **Project Structure Analysis**
   - Directory layout comparison (monorepo vs split projects)
   - Workspace configuration files (pnpm-workspace.yaml, package.json)
   - Package locations and organization

2. **Dependency Graph Mapping**
   - All @tabeza/* imports across codebases
   - Relative import paths
   - External dependency versions and locations

3. **Module Resolution Testing**
   - TypeScript path resolution
   - Runtime module loading
   - Build-time bundling

4. **Shared Code Strategy**
   - Current duplication assessment
   - Recommended architecture (workspace, submodules, npm packages, or monorepo)
   - Migration path for chosen strategy

5. **Build and CI/CD Pipeline**
   - Build script validation
   - Type-checking configuration
   - Deployment process verification

## Success Criteria

The refactoring audit is complete when:
- All three projects have consistent, documented architecture (workspace or standalone)
- All imports resolve correctly with zero TypeScript errors
- Builds succeed for all projects
- No unnecessary package duplication
- Clear shared code synchronization strategy is documented and implemented
- Development workflow is smooth and efficient
- All functional behavior is preserved from the original monorepo
