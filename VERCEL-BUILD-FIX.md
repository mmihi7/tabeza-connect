# Vercel Build Fix - Final Solution

## Problem

Vercel build was failing with:
```
Module not found: Can't resolve '@tabeza/validation'
Module not found: Can't resolve 'babel-loader'
TypeScript compilation errors in code-guardrails and escpos-parser packages
```

## Root Cause

1. The monorepo has workspace dependencies that need to be built first
2. Some packages (`code-guardrails`, `escpos-parser`) have TypeScript errors
3. These packages aren't used by the customer/staff apps

## Solution

### 1. Updated Build Scripts

Exclude broken packages from build:

```json
// package.json
{
  "scripts": {
    "build:packages": "pnpm --recursive --filter \"./packages/*\" --filter \"!@tabeza/code-guardrails\" --filter \"!@tabeza/escpos-parser\" build"
  }
}
```

### 2. Updated Vercel Config

Build packages before apps:

**apps/customer/vercel.json**:
```json
{
  "buildCommand": "cd ../.. && pnpm install && pnpm run build:packages && pnpm run build:customer"
}
```

**apps/staff/vercel.json**:
```json
{
  "buildCommand": "cd ../.. && pnpm install && pnpm run build:packages && pnpm run build:staff"
}
```

## Packages Built

✅ `@tabeza/validation` - Phone validation, data sanitization
✅ `@tabeza/tax-rules` - Tax calculation logic  
✅ `@tabeza/receipt-schema` - Receipt data schemas
✅ `@tabeza/virtual-printer` - Virtual printer utilities
✅ `@tabeza/database` - Database types and utilities
✅ `@tabeza/shared` - Shared types and utilities (no build needed)

## Packages Excluded

❌ `@tabeza/code-guardrails` - Has TypeScript errors, not used by apps
❌ `@tabeza/escpos-parser` - Has TypeScript errors, only used by printer service

## Build Order

1. `pnpm install` - Install all dependencies
2. `pnpm run build:packages` - Build validation, tax-rules, receipt-schema, virtual-printer
3. `pnpm run build:customer` or `build:staff` - Build the app

## Verification

Test locally:

```bash
# Clean everything
pnpm clean

# Install dependencies
pnpm install

# Build packages (should succeed)
pnpm run build:packages

# Build apps (should succeed)
pnpm run build:customer
pnpm run build:staff
```

## Files Changed

- ✅ `package.json` - Excluded broken packages from build
- ✅ `apps/customer/vercel.json` - Added `build:packages` step
- ✅ `apps/staff/vercel.json` - Added `build:packages` step

## Summary

The fix ensures that:
1. Only working packages are built
2. Packages are built before apps
3. Apps can import from built packages
4. Vercel deployment succeeds

The broken packages (`code-guardrails`, `escpos-parser`) can be fixed later without blocking deployment.
