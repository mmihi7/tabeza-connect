# NPM Install Fix for Tabeza Connect

## Problem
The printer-service is part of the pnpm workspace, causing npm install conflicts.

## Solution
Install from the root using pnpm workspace commands:

```bash
# Go to root directory
cd C:\Projects\Tabz

# Install dependencies for printer-service using pnpm
pnpm install --filter @tabeza/connect

# Or install all workspace dependencies
pnpm install
```

## Alternative: Install Directly in Folder

If you want to install just in the printer-service folder:

```bash
cd C:\Projects\Tabz\packages\printer-service

# Use --ignore-workspace flag
npm install --ignore-workspace

# Or use pnpm directly
pnpm install --no-workspace
```

## Test Electron App

After installation:

```bash
cd C:\Projects\Tabz\packages\printer-service

# Test with npm
npm run start:electron

# Or test with pnpm
pnpm start:electron
```

## Build Installer

```bash
cd C:\Projects\Tabz\packages\printer-service

# Build with npm
npm run build:electron

# Or build with pnpm
pnpm build:electron
```

## Quick Fix Command

Run this from the Tabz root:

```bash
cd C:\Projects\Tabz
pnpm install
cd packages\printer-service
pnpm start:electron
```

This should work without errors!
