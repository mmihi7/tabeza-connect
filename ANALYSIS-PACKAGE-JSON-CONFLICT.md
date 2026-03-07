# Package.json Conflict Analysis

## Problem Statement
The installer is creating nested directories and not working correctly because there are **THREE conflicting package.json files** in the project.

## Current Structure

### 1. Root `/package.json`
- **Location**: `tabeza-connect/package.json`
- **Main entry**: `"main": "src/main.js"` (we just changed this)
- **Product name**: `"TabezaConnect"` (no space)
- **Shortcut name**: `"TabezaConnect"` (no space)
- **Build output**: `dist/`
- **NSIS config**: Includes custom installer.nsh
- **Status**: ✅ Correctly configured (after our fixes)

### 2. Src `/src/package.json`
- **Location**: `tabeza-connect/src/package.json`
- **Main entry**: `"main": "main.js"` (relative path)
- **Product name**: `"Tabeza Connect"` (WITH SPACE) ⚠️
- **Shortcut name**: `"Tabeza Connect"` (WITH SPACE) ⚠️
- **Build output**: `dist/`
- **NSIS config**: Different settings, no custom installer.nsh
- **Status**: ❌ CONFLICTING - This is causing the nested directory!

### 3. Service `/src/service/package.json`
- **Location**: `tabeza-connect/src/service/package.json`
- **Main entry**: `"main": "index.js"`
- **Product name**: `"Tabeza Connect"` (WITH SPACE)
- **Purpose**: Service-specific config for standalone builds
- **Status**: ⚠️ Not used by Electron Builder, but confusing

## The Root Cause

When Electron Builder runs, it's finding **BOTH** package.json files:
1. Root package.json (correct config)
2. src/package.json (conflicting config with spaces in names)

The `src/package.json` has:
```json
{
  "productName": "Tabeza Connect",  // ← WITH SPACE
  "shortcutName": "Tabeza Connect"  // ← WITH SPACE
}
```

This is why we're getting:
- `C:\Program Files\TabezaConnect\Tabeza Connect\Tabeza Connect.exe` (nested!)
- Multiple installer files with different names

## Decision Required

We need to decide which package.json should be the **single source of truth**:

### Option A: Use Root package.json ONLY ✅ RECOMMENDED
**Pros:**
- Clean separation: root for Electron app, src/service for standalone service
- Already has correct NSIS config with installer.nsh
- Has all the fixes we just applied
- Follows standard Electron project structure

**Cons:**
- Need to delete or rename src/package.json

**Action:**
1. Delete or rename `src/package.json` to `src/package.json.backup`
2. Keep root `package.json` as the only Electron Builder config
3. Keep `src/service/package.json` for service-specific builds (PKG, etc.)

### Option B: Use src/package.json ONLY
**Pros:**
- Keeps build config closer to source code

**Cons:**
- Need to merge all our fixes into src/package.json
- Need to update paths in NSIS config
- More complex structure
- Not standard Electron practice

## Recommended Solution

**DELETE `src/package.json`** and use only the root package.json.

Here's why:
1. Root package.json already has all our fixes
2. Root package.json has correct NSIS config with installer.nsh
3. Standard Electron projects have package.json at root
4. src/service/package.json can stay for standalone service builds

## Files to Modify

### 1. Delete (or backup)
```
src/package.json  ← DELETE THIS
```

### 2. Keep as-is
```
package.json                    ← Main Electron Builder config
src/service/package.json        ← Service-specific config (for PKG builds)
```

## Expected Result After Fix

After deleting `src/package.json`:
- ✅ Single source of truth for Electron Builder
- ✅ No conflicting product names
- ✅ No nested directories
- ✅ Installer creates: `C:\Program Files\TabezaConnect\TabezaConnect.exe`
- ✅ Single installer file: `TabezaConnect-Setup-1.7.0.exe`
- ✅ Bar ID setup flow works (main.js entry point)
- ✅ System tray appears after installation

## Next Steps

1. **Backup** `src/package.json` (just in case)
2. **Delete** `src/package.json`
3. **Rebuild** installer: `pnpm build:installer`
4. **Test** installation
5. **Verify** no nested directories
6. **Verify** Bar ID setup appears on first run
