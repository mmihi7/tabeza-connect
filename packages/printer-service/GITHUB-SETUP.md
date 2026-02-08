# GitHub Repository Setup Guide

## Create New Repository

1. Go to https://github.com/new
2. Repository name: `tabeza-printer-service`
3. Description: `Local Windows service for Tabeza POS printer integration`
4. Visibility: Public
5. Initialize: **Do NOT** initialize with README (we have our own)
6. Click "Create repository"

## Initial Setup

```bash
cd packages/printer-service

# Initialize git (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Tabeza Printer Service v1.0.0"

# Add remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/tabeza-printer-service.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Build the Executable

Before creating a release, build the Windows executable:

```bash
# Install dependencies
npm install

# Build the .exe file
npm run build-installer
```

This creates `dist/tabeza-printer-service.exe` and supporting files.

## Create GitHub Release

### Option 1: Via GitHub Web Interface

1. Go to your repository on GitHub
2. Click "Releases" in the right sidebar
3. Click "Create a new release"
4. Tag version: `v1.0.0`
5. Release title: `Tabeza Printer Service v1.0.0`
6. Description:
   ```markdown
   # Tabeza Printer Service v1.0.0
   
   Windows service for integrating POS systems with Tabeza digital receipts.
   
   ## Installation
   
   1. Download `tabeza-printer-service.exe`
   2. Run as Administrator
   3. Enter your Bar ID when prompted
   4. Service will start on http://localhost:8765
   
   ## Requirements
   
   - Windows 10 or later
   - Administrator privileges
   - Internet connection
   
   ## What's Included
   
   - Standalone executable (no Node.js installation required)
   - Automatic service startup
   - Configuration via web interface
   - Health monitoring
   
   ## Support
   
   - Email: support@tabeza.co.ke
   - Website: https://tabeza.co.ke
   - Documentation: See README.md
   ```
7. Upload files:
   - `dist/tabeza-printer-service.exe` (main executable)
   - `dist/install.bat` (optional installer script)
   - `dist/README.txt` (installation guide)
8. Click "Publish release"

### Option 2: Via GitHub CLI

```bash
# Install GitHub CLI if not already installed
# https://cli.github.com/

# Create release
gh release create v1.0.0 \
  dist/tabeza-printer-service.exe \
  dist/install.bat \
  dist/README.txt \
  --title "Tabeza Printer Service v1.0.0" \
  --notes "Windows service for POS printer integration with Tabeza"
```

## Get Download URL

After creating the release, the download URL will be:

```
https://github.com/YOUR_USERNAME/tabeza-printer-service/releases/download/v1.0.0/tabeza-printer-service.exe
```

## Update App Download Link

Update the download link in your app:

**File:** `apps/staff/app/setup/printer/page.tsx`

```typescript
href="https://github.com/YOUR_USERNAME/tabeza-printer-service/releases/download/v1.0.0/tabeza-printer-service.exe"
```

**File:** `packages/shared/lib/services/driver-detection-service.ts`

```typescript
downloadUrl: `https://github.com/YOUR_USERNAME/tabeza-printer-service/releases/download/v1.0.0/tabeza-printer-service.exe`
```

## Repository Settings

### Topics

Add these topics to help people find your repository:
- `tabeza`
- `pos`
- `printer`
- `receipt`
- `windows`
- `service`
- `nodejs`

### About

Set repository description:
```
Local Windows service for Tabeza POS printer integration. Captures receipts from POS systems and delivers them digitally to customers.
```

### README Badges

Add badges to your README.md:

```markdown
[![GitHub release](https://img.shields.io/github/v/release/YOUR_USERNAME/tabeza-printer-service)](https://github.com/YOUR_USERNAME/tabeza-printer-service/releases)
[![License](https://img.shields.io/github/license/YOUR_USERNAME/tabeza-printer-service)](LICENSE)
[![Downloads](https://img.shields.io/github/downloads/YOUR_USERNAME/tabeza-printer-service/total)](https://github.com/YOUR_USERNAME/tabeza-printer-service/releases)
```

## Continuous Deployment (Optional)

Create `.github/workflows/release.yml` for automatic builds:

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: windows-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build executable
        run: npm run build-installer
      
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            dist/tabeza-printer-service.exe
            dist/install.bat
            dist/README.txt
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Version Updates

When releasing a new version:

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Commit changes
4. Create and push tag:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```
5. GitHub Actions will automatically build and create release (if configured)

## Testing the Release

After creating the release:

1. Download the .exe from GitHub
2. Test on a clean Windows machine
3. Verify it runs without Node.js installed
4. Test the installation process
5. Verify service functionality

## Support and Issues

Enable GitHub Issues for bug reports and feature requests:

1. Go to repository Settings
2. Check "Issues" under Features
3. Create issue templates (optional)

## License

Make sure you have a LICENSE file. The package.json specifies MIT license.

Create `LICENSE` file:

```
MIT License

Copyright (c) 2024 Tabeza

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
