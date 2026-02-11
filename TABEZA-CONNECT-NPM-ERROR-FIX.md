# Tabeza Connect - NPM Error Fix

## ❌ The Problem

You're seeing this error:
```
npm warn workspaces @tabeza/connect in filter set, but no workspace folder present
npm error Invalid Version:
```

**Root Cause:** You're using `npm` commands in a `pnpm` workspace. They're not compatible.

## ✅ The Solution

**Always use `pnpm` commands from the root directory.**

### Wrong Commands (Don't Use):
```bash
cd C:\Projects\Tabz\packages\printer-service
npm install                    # ❌ Wrong
npm run start:electron         # ❌ Wrong
npm run build:electron         # ❌ Wrong
```

### Correct Commands (Use These):
```bash
cd C:\Projects\Tabz             # Go to root first
pnpm --filter @tabeza/connect start:electron   # ✅ Correct
pnpm --filter @tabeza/connect build:electron   # ✅ Correct
```

## 🎯 Quick Start Guide

### Step 1: Go to Root Directory
```bash
cd C:\Projects\Tabz
```

### Step 2: Test Electron App
```bash
pnpm --filter @tabeza/connect start:electron
```

**What will happen:**
1. pnpm will ask you to approve the electron build script
2. You'll see: `? Choose which packages to build`
3. Press `SPACE` to select electron (● appears)
4. Press `ENTER` to confirm
5. Type `y` when asked "Do you approve?"
6. Press `ENTER`
7. The setup window should launch

### Step 3: Create Icon File

Before building the installer, create the Windows icon:

1. Open browser: https://convertio.co/svg-ico/
2. Upload: `C:\Projects\Tabz\packages\printer-service\assets\logo-green.svg`
3. Download as `icon.ico`
4. Save to: `C:\Projects\Tabz\packages\printer-service\assets\icon.ico`

### Step 4: Build Installer
```bash
cd C:\Projects\Tabz
pnpm --filter @tabeza/connect build:electron
```

Installer will be in: `packages/printer-service/dist/`

## 📋 Command Reference

All commands run from `C:\Projects\Tabz`:

```bash
# Test the Electron app
pnpm --filter @tabeza/connect start:electron

# Build the installer
pnpm --filter @tabeza/connect build:electron

# Run the Node.js service directly (for testing)
pnpm --filter @tabeza/connect start

# Install dependencies (if needed)
pnpm install
```

## 🔍 Why This Happens

- This is a **pnpm workspace** monorepo
- npm doesn't understand pnpm workspace structure
- pnpm uses `workspace:*` protocol for internal packages
- npm sees `@tabeza/connect` but can't find it in npm registry
- Solution: Always use pnpm commands from root

## ✅ Next Steps

1. **Close any terminal windows in `packages/printer-service/`**
2. **Open new terminal in `C:\Projects\Tabz`**
3. **Run:** `pnpm --filter @tabeza/connect start:electron`
4. **Approve the build when prompted**
5. **Test the setup window**
6. **Create icon.ico file**
7. **Build installer**

## 🎉 You're Ready!

Just use the correct pnpm commands from the root directory and everything will work.
