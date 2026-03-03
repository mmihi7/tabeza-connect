# Build and Deploy Guide

## Prerequisites
- Node.js installed
- Git configured
- Access to GitHub repository

## Step 1: Build the Service Executable

```bash
cd c:\Projects\TabezaConnect
node build-pkg.bat
```

This creates `TabezaService.exe` with all the latest changes including:
- Auto-healing SSL fixes
- Diagnostics endpoints
- Troubleshooting page

## Step 2: Test Locally (Optional)

```bash
# Test the service
.\TabezaService.exe

# In another terminal, test the endpoints
curl http://localhost:8765/api/status
curl http://localhost:8765/api/diagnostics
```

## Step 3: Commit and Push to GitHub

```bash
# Add all changes
git add .

# Commit with descriptive message
git commit -m "Add auto-healing SSL fixes and web-based diagnostics"

# Push to remote
git push origin main
```

## What Gets Deployed

### Source Code:
- `src/service/index.js` - Service with auto-healing
- `collect-diagnostics.bat` - Support tool
- `INSTALLATION-GUIDE.md` - Client documentation
- `README.md` - Project documentation

### Build Artifacts (Not in Git):
- `TabezaService.exe` - Compiled service
- `dist/` - Build output
- `node_modules/` - Dependencies

## For Client Distribution

After building, distribute:
1. `TabezaService.exe` - The service executable
2. `INSTALLATION-GUIDE.md` - Setup instructions
3. `collect-diagnostics.bat` - Troubleshooting tool

Clients will:
1. Download TabezaService.exe
2. Run it (or install as Windows service)
3. Configure via staff app at https://tabeza.co.ke/settings/printer
4. Follow visual setup guide (no terminal needed!)
