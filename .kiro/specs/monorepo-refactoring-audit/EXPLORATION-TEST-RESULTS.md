# Bug Condition Exploration Test Results

**Test Date**: 2025-01-XX  
**Test Status**: ✗ FAILED (AS EXPECTED - Bug Confirmed)  
**Property Tested**: Property 1 - Fault Condition: Workspace Configuration Validation

## Summary

The exploration test **FAILED on unfixed code**, which is the **CORRECT and EXPECTED outcome**. The failures confirm that the refactoring bug exists and provide concrete counterexamples demonstrating the workspace misconfiguration issues.

## Test Results

### ✗ Test 1.1: tabeza-customer workspace structure
**Status**: FAILED  
**Bug Confirmed**: YES

**Findings**:
- Has `pnpm-workspace.yaml`: ✓ TRUE
- Workspace declares: `packages/*`, `apps/*`, `api`
- Has `packages/` directory: ✗ FALSE
- Packages are in `lib/` instead: ✓ TRUE

**Counterexample**: tabeza-customer has workspace yaml declaring `packages/*` but no packages directory exists. Packages are copied to `lib/` instead of being workspace-linked.

**Validates Requirements**: 1.1, 1.3

---

### ✗ Test 1.2: tabeza-staff workspace structure
**Status**: FAILED  
**Bug Confirmed**: YES

**Findings**:
- Has `pnpm-workspace.yaml`: ✓ TRUE
- Workspace declares: `packages/*`, `apps/*`, `lib/packages/*`, `api`
- Has root `packages/` directory: ✗ FALSE
- Has `lib/packages/` directory: ✓ TRUE
- Uses non-standard location: ✓ TRUE

**Counterexample**: tabeza-staff has workspace yaml with non-standard `lib/packages/*` location instead of root-level `packages/*`.

**Validates Requirements**: 1.2, 1.3

---

### ✓ Test 1.3: tabeza-connect workspace structure
**Status**: PASSED  
**Note**: tabeza-connect actually has NO workspace yaml (the file was found to be missing during test execution)

**Findings**:
- Has `pnpm-workspace.yaml`: ✗ FALSE
- This is actually correct for a standalone Electron app

**Note**: The spec indicated tabeza-connect has workspace yaml, but the test found it doesn't exist. This means tabeza-connect is already in the correct state (no useless workspace yaml).

---

### ✗ Test 1.4: workspace:* protocol usage
**Status**: FAILED  
**Bug Confirmed**: YES

**Violations Found**: 1

**Counterexample - tabeza-customer**:
- Uses `@tabeza/shared: workspace:*` in package.json
- Has workspace yaml declaring `packages/*`
- But packages are NOT in declared workspace locations
- Packages are in `lib/` instead

**tabeza-staff**: No violation (packages are in declared `lib/packages/*` location)

**Validates Requirements**: 1.3, 1.4, 1.8

---

### ✗ Test 1.5: Package duplication
**Status**: FAILED  
**Bug Confirmed**: YES

**Duplicated Packages**: 7 packages, each with 2 copies

**Counterexamples**:
1. **shared**: `tabeza-customer/lib/shared`, `tabeza-staff/lib/packages/shared`
2. **code-guardrails**: `tabeza-customer/lib/code-guardrails`, `tabeza-staff/lib/packages/code-guardrails`
3. **database**: `tabeza-customer/lib/database`, `tabeza-staff/lib/packages/database`
4. **printer-service**: `tabeza-customer/lib/printer-service`, `tabeza-staff/lib/packages/printer-service`
5. **receipt-schema**: `tabeza-customer/lib/receipt-schema`, `tabeza-staff/lib/packages/receipt-schema`
6. **tax-rules**: `tabeza-customer/lib/tax-rules`, `tabeza-staff/lib/packages/tax-rules`
7. **validation**: `tabeza-customer/lib/validation`, `tabeza-staff/lib/packages/validation`

**Impact**: No single source of truth for shared code. Changes must be manually synchronized.

**Validates Requirements**: 1.5, 1.7

---

### ✗ Test 1.6: Nested node_modules
**Status**: FAILED  
**Bug Confirmed**: YES

**Nested node_modules Found**: 12 instances

**Counterexamples**:

**tabeza-customer** (6 instances):
- `lib/code-guardrails/node_modules`
- `lib/printer-service/node_modules`
- `lib/receipt-schema/node_modules`
- `lib/shared/node_modules`
- `lib/tax-rules/node_modules`
- `lib/validation/node_modules`

**tabeza-staff** (6 instances):
- `lib/packages/code-guardrails/node_modules`
- `lib/packages/printer-service/node_modules`
- `lib/packages/receipt-schema/node_modules`
- `lib/packages/shared/node_modules`
- `lib/packages/tax-rules/node_modules`
- `lib/packages/validation/node_modules`

**Impact**: Dependencies not properly hoisted, causing conflicts and duplication.

**Validates Requirements**: 1.6, 1.14

---

### ✗ Test 1.7: TypeScript module resolution
**Status**: FAILED  
**Bug Confirmed**: YES

**Resolution Issues Found**: 2

**Counterexample - tabeza-customer**:
- Uses `@tabeza/shared: workspace:*` dependency
- Has NO TypeScript path mappings for `@tabeza/*`
- Only has `@/*` path mapping
- TypeScript cannot resolve `@tabeza/*` imports correctly

**Counterexample - tabeza-staff**:
- Uses `@tabeza/shared: workspace:*` dependency
- Has NO TypeScript path mappings for `@tabeza/*`
- Only has `@/*` path mapping
- TypeScript cannot resolve `@tabeza/*` imports correctly

**Impact**: Module resolution failures, type-checking errors, broken imports.

**Validates Requirements**: 1.8, 1.9, 1.10, 1.15, 1.16

---

## Bug Condition Function Validation

The test validates the bug condition function:

```
isRefactoringBug(ProjectState) = (
  (hasWorkspaceYaml AND NOT hasProperWorkspaceStructure) OR
  (hasDuplicatePackages) OR
  (hasWorkspaceProtocolWithoutWorkspace) OR
  (hasBrokenImportPaths) OR
  (hasNestedNodeModules)
)
```

**Result**: TRUE (Bug exists)

### Evidence:
- ✓ `hasWorkspaceYaml AND NOT hasProperWorkspaceStructure` - TRUE (tabeza-customer, tabeza-staff)
- ✓ `hasDuplicatePackages` - TRUE (7 packages duplicated)
- ✓ `hasWorkspaceProtocolWithoutWorkspace` - TRUE (tabeza-customer)
- ✓ `hasBrokenImportPaths` - TRUE (both projects missing TypeScript paths)
- ✓ `hasNestedNodeModules` - TRUE (12 instances)

## Root Cause Analysis

Based on the counterexamples, the root causes are:

1. **Incomplete Workspace Migration**: Workspace yaml files were copied during the split but the actual workspace structure was not properly established
   - tabeza-customer: workspace yaml declares `packages/*` but packages are in `lib/`
   - tabeza-staff: workspace yaml uses non-standard `lib/packages/*` location

2. **Package Duplication**: Instead of establishing proper workspace links or choosing a standalone approach, packages were simply copied to each project
   - All 7 shared packages duplicated across both projects
   - No synchronization mechanism

3. **Dependency Management Issues**: Nested node_modules indicate workspace misconfiguration
   - 12 nested node_modules directories
   - Dependencies not properly hoisted

4. **Import Path Confusion**: `workspace:*` protocol used but TypeScript can't resolve imports
   - No TypeScript path mappings for `@tabeza/*`
   - Module resolution will fail

## Expected Behavior After Fix

After implementing the fix (converting to standalone apps), this **SAME TEST** should **PASS** with:
- No workspace yaml in standalone apps (or proper workspace structure if workspace approach chosen)
- No duplicate packages (clear sync strategy documented)
- No nested node_modules (dependencies properly hoisted)
- TypeScript path mappings configured for all `@tabeza/*` imports
- All imports resolving correctly

## Next Steps

1. ✓ Bug condition exploration test written and run
2. ✓ Counterexamples documented (this file)
3. ⏭ Write preservation property tests (Task 2)
4. ⏭ Implement fix (Task 3)
5. ⏭ Re-run this test to verify fix (should PASS after fix)

## Conclusion

The exploration test successfully **FAILED on unfixed code**, confirming the bug exists. The test provides concrete counterexamples demonstrating:
- Workspace misconfiguration in both projects
- 7 duplicated packages
- 12 nested node_modules
- Missing TypeScript path mappings
- Broken import resolution

These counterexamples validate the bug condition function and provide clear evidence for the fix implementation.
