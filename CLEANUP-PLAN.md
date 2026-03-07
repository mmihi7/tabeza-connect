# Tabeza Connect - Electron Removal & PKG Consolidation Plan

**Date:** 2026-03-04  
**Goal:** Remove Electron dependencies and consolidate on PKG + Inno Setup build system

---

## Current State Analysis

### ✅ What We're Keeping (PKG Approach)
- `src/service/index.js` - Main service entry point
- `build-pkg.bat` - PKG build script
- `files/installer-pkg.iss` - Inno Setup installer
- `src/installer/scripts/*.ps1` - PowerShell installation scripts
- `src/server/` - HTTP server and Management UI
- All service components (queue, parser, watcher, heartbeat)

### ⚠️ System Tray Decision Required

**Current State:** `src/tray/standalone-tray.js` uses Electron for system tray

**Options:**

**Option A: Keep Electron ONLY for Tray (Recommended for v1.7.0)**
- Keep Electron as dependency
- Build tray as separate Electron app: `TabezaTray.exe`
- Main service remains PKG-based: `TabezaConnect.exe`
- Installer launches both
- **Pros:** Tray works immediately, minimal code changes
- **Cons:** Still have Electron dependency (~80MB for tray alone)

**Option B: Remove Tray Entirely (Simplest)**
- Remove `src/tray/` directory
- Users access Management UI via browser bookmark
- **Pros:** No Electron dependency, smaller installer
- **Cons:** Less convenient for users

**Option C: Rewrite Tray with Native Solution (Future v1.8.0)**
- Use `node-systray` or similar native library
- Requires rewriting tray logic
- **Pros:** No Electron, smaller footprint
- **Cons:** Significant development time

**RECOMMENDATION:** Choose Option A for now. Ship v1.7.0 with working tray, plan native rewrite for v1.8.0.

### ❌ What We're Removing (Electron Main Process)
- `src/electron-main.js` - Electron main process (duplicate entry point)
- `src/main.js` - Another Electron entry point (duplicate)
- `src/electron-builder.yml` - Electron Builder config (if tray uses separate build)
- `electron-builder.json` - Root-level Electron Builder config
- `electron-builder-standalone.json` - Standalone Electron config

### 🔧 What We're Fixing
- `package.json` - Keep Electron ONLY for tray, add proper PKG config for service
- `build-pkg.bat` - Build both TabezaConnect.exe (PKG) and TabezaTray.exe (Electron)
- `pkg.config.json` - Add proper asset bundling configuration
- `files/installer-pkg.iss` - Ensure both executables are installed

---

## Execution Steps (Option A: Dual Build)

### Phase 1: Remove Duplicate Electron Entry Points

```bash
# Delete main service Electron entry points (keep tray)
rm src/electron-main.js
rm src/main.js

# Keep src/tray/ directory - it needs Electron
```

### Phase 2: Update package.json

**Changes:**
1. Change `main` from `src/electron-main.js` to `src/service/index.js`
2. Keep Electron as devDependency (needed for tray)
3. Add two build scripts:
   - `build:service` - PKG for TabezaConnect.exe
   - `build:tray` - Electron Builder for TabezaTray.exe
4. Add `pkg` configuration section

**New package.json structure:**

```json
{
  "name": "@tabeza/connect",
  "version": "1.7.0",
  "main": "src/service/index.js",
  "scripts": {
    "start": "node src/service/index.js",
    "start:tray": "electron src/tray/standalone-tray.js",
    "build": "npm run build:service && npm run build:tray",
    "build:service": "pkg src/service/index.js --targets node18-win-x64 --output dist/TabezaConnect.exe --compress brotli --config pkg.config.json",
    "build:tray": "electron-builder --config electron-builder-tray.json",
    "test": "jest"
  },
  "dependencies": {
    "better-sqlite3": "^9.2.2",
    "chokidar": "^3.5.3",
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "uuid": "^13.0.0",
    "axios": "^10.0.0"
  },
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-builder": "^24.9.1",
    "pkg": "^5.8.1",
    "eslint": "^8.56.0",
    "jest": "^29.7.0"
  },
  "pkg": {
    "assets": [
      "src/server/public/**/*",
      "assets/**/*"
    ],
    "scripts": [
      "src/service/**/*.js",
      "src/server/**/*.js"
    ],
    "targets": ["node18-win-x64"],
    "outputPath": "dist"
  }
}
```

### Phase 3: Create electron-builder-tray.json

Separate Electron Builder config ONLY for tray:

```json
{
  "appId": "com.tabeza.connect.tray",
  "productName": "Tabeza Tray",
  "directories": {
    "output": "dist",
    "buildResources": "assets"
  },
  "files": [
    "src/tray/**/*",
    "assets/**/*"
  ],
  "win": {
    "target": "portable",
    "icon": "assets/icon-green.ico"
  },
  "portable": {
    "artifactName": "TabezaTray.exe"
  }
}
```

### Phase 4: Update build-pkg.bat

```batch
@echo off
echo Building Tabeza Connect...

REM Build service with PKG
echo [1/2] Building TabezaConnect.exe (service)...
call npm run build:service
if %errorlevel% neq 0 exit /b 1

REM Build tray with Electron
echo [2/2] Building TabezaTray.exe (tray)...
call npm run build:tray
if %errorlevel% neq 0 exit /b 1

REM Build installer
echo [3/3] Building installer...
iscc files\installer-pkg.iss

echo Build complete!
```

### Phase 5: Update Installer

Ensure `files/installer-pkg.iss` installs both executables:

```ini
[Files]
; Main service (PKG)
Source: "dist\TabezaConnect.exe"; DestDir: "{app}"; Flags: ignoreversion

; System tray (Electron)
Source: "dist\TabezaTray.exe"; DestDir: "{app}"; Flags: ignoreversion

; ... rest of files
```

### Phase 6: Test Build

```bash
# Install dependencies
npm install

# Build both executables
npm run build

# Verify outputs
dir dist\TabezaConnect.exe
dir dist\TabezaTray.exe

# Test service
dist\TabezaConnect.exe

# Test tray (in separate terminal)
dist\TabezaTray.exe
```

---

## Alternative: Phase 1B - Remove Tray Entirely (Option B)

If you choose to remove the tray:

```bash
# Remove tray directory
rm -rf src/tray/

# Remove Electron entirely
npm uninstall electron electron-builder

# Update installer to not launch tray
# Users access UI via browser bookmark to http://localhost:8765
```

---

## Success Criteria

- ✅ No duplicate Electron main processes
- ✅ `TabezaConnect.exe` built with PKG (~45MB)
- ✅ `TabezaTray.exe` built with Electron (~80MB) OR removed entirely
- ✅ Service runs as Windows Service
- ✅ Tray monitors service status (if kept)
- ✅ Management UI accessible at http://localhost:8765
- ✅ Installer works on clean Windows machine

---

## Recommended Path Forward

**For v1.7.0 (Ship Now):**
- Execute Option A: Keep Electron for tray only
- Two executables: TabezaConnect.exe (PKG) + TabezaTray.exe (Electron)
- Total installer size: ~125MB (acceptable for infrastructure software)

**For v1.8.0 (Future):**
- Rewrite tray with native Node.js library (node-systray, node-notifier)
- Remove Electron dependency entirely
- Reduce installer to ~50MB

---

**Which option do you prefer?**
- A: Keep Electron for tray (ship faster)
- B: Remove tray entirely (simplest)
- C: Rewrite tray now (more work)

