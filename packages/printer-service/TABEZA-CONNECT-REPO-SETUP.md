# Tabeza Connect Repository Setup Guide

## Overview

The Tabeza Connect repository (https://github.com/billoapp/TabezaConnect) is a standalone repository for the customer-friendly Windows installer that bridges POS systems with Tabeza cloud.

## Repository Structure

```
TabezaConnect/
├── .github/
│   └── workflows/
│       ├── build-installer.yml      # CI/CD for building installer
│       └── release.yml              # Automated releases
├── src/
│   ├── service/                     # Printer service code
│   │   ├── index.js
│   │   ├── package.json
│   │   └── config.example.json
│   ├── installer/                   # Installer build scripts
│   │   ├── download-nodejs.js
│   │   ├── build-installer.js
│   │   └── scripts/
│   │       ├── configure-printer.ps1
│   │       ├── register-service.ps1
│   │       ├── create-folders.ps1
│   │       └── detect-printers.ps1
│   └── public/                      # Web UI files
│       ├── configure.html
│       ├── setup.html
│       └── prompt-manager.html
├── assets/
│   └── icon.ico                     # Application icon
├── docs/
│   ├── README.md                    # Main documentation
│   ├── INSTALLATION.md              # Installation guide
│   ├── TROUBLESHOOTING.md           # Troubleshooting guide
│   └── ARCHITECTURE.md              # Technical architecture
├── .gitignore
├── LICENSE
├── package.json
└── README.md
```

## Initial Setup Steps

### 1. Clone and Initialize Repository

```bash
# Clone the empty repository
git clone https://github.com/billoapp/TabezaConnect.git
cd TabezaConnect

# Initialize with README
echo "# Tabeza Connect" > README.md
git add README.md
git commit -m "Initial commit"
git push origin main
```

### 2. Copy Files from Monorepo

From your Tabz monorepo, copy the following:

```bash
# From Tabz/packages/printer-service/
cp -r Tabz/packages/printer-service/installer TabezaConnect/src/
cp Tabz/packages/printer-service/index.js TabezaConnect/src/service/
cp Tabz/packages/printer-service/package.json TabezaConnect/src/service/
cp Tabz/packages/printer-service/config.example.json TabezaConnect/src/service/
cp -r Tabz/packages/printer-service/public TabezaConnect/src/

# Copy documentation
cp Tabz/packages/printer-service/QUICK-START.md TabezaConnect/docs/INSTALLATION.md
cp Tabz/PRINTER-SYSTEM-ARCHITECTURE.md TabezaConnect/docs/ARCHITECTURE.md
```

### 3. Create Root package.json

```json
{
  "name": "tabeza-connect",
  "version": "1.0.0",
  "description": "Tabeza Connect - Windows installer for POS integration",
  "scripts": {
    "download:nodejs": "node src/installer/download-nodejs.js",
    "build:installer": "node src/installer/build-installer.js",
    "build": "npm run download:nodejs && npm run build:installer",
    "test": "echo \"No tests yet\" && exit 0"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/billoapp/TabezaConnect.git"
  },
  "keywords": [
    "tabeza",
    "connect",
    "printer",
    "pos",
    "receipt",
    "windows",
    "installer"
  ],
  "author": "Tabeza",
  "license": "MIT",
  "bugs": {
    "url": "https://github.com/billoapp/TabezaConnect/issues"
  },
  "homepage": "https://github.com/billoapp/TabezaConnect#readme"
}
```

### 4. Create .gitignore

```gitignore
# Node modules
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build outputs
dist/
*.zip
*.exe

# Installer artifacts
src/installer/nodejs-bundle/

# Environment files
.env
.env.local
config.json

# OS files
.DS_Store
Thumbs.db

# IDE files
.vscode/
.idea/
*.swp
*.swo

# Logs
logs/
*.log

# Temporary files
tmp/
temp/
```

### 5. Create Comprehensive README.md

```markdown
# Tabeza Connect

> Windows installer for seamless POS integration with Tabeza cloud

Tabeza Connect bridges your existing POS system with Tabeza's digital receipt platform, enabling automatic receipt capture and cloud synchronization without modifying your POS workflow.

## Features

- ✅ **Zero POS Modification**: Works with any POS that can print
- ✅ **Dual-Printer Architecture**: Physical printer continues working independently
- ✅ **Automatic Receipt Capture**: Monitors virtual printer output
- ✅ **Offline-First**: Queues receipts when internet is unavailable
- ✅ **Self-Healing**: Automatically recovers from common failures
- ✅ **2-Minute Installation**: Customer-friendly setup wizard

## System Requirements

- Windows 10 or later
- Administrator privileges (for installation only)
- 100 MB free disk space
- Internet connectivity (for cloud sync)

## Quick Start

### For End Users

1. Download `TabezaConnect-Setup.zip` from [Releases](https://github.com/billoapp/TabezaConnect/releases)
2. Extract to a temporary location
3. Right-click `install.bat` and select "Run as administrator"
4. Follow the installation wizard
5. Configure your POS to print to "Tabeza Receipt Printer"

See [Installation Guide](docs/INSTALLATION.md) for detailed instructions.

### For Developers

```bash
# Clone repository
git clone https://github.com/billoapp/TabezaConnect.git
cd TabezaConnect

# Install dependencies
npm install
cd src/service && npm install && cd ../..

# Build installer
npm run build

# Output: dist/TabezaConnect-Setup-v1.0.0.zip
```

## Architecture

Tabeza Connect consists of three components:

1. **Printer Service**: Node.js service that monitors watch folder
2. **Virtual Printer**: Generic/Text Only printer with FILE: port
3. **Installer**: Automated setup with bundled Node.js runtime

See [Architecture Documentation](docs/ARCHITECTURE.md) for details.

## Documentation

- [Installation Guide](docs/INSTALLATION.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Architecture Overview](docs/ARCHITECTURE.md)
- [Contributing Guidelines](CONTRIBUTING.md)

## Support

- Email: support@tabeza.co.ke
- Website: https://tabeza.co.ke
- Issues: https://github.com/billoapp/TabezaConnect/issues

## License

MIT License - see [LICENSE](LICENSE) for details

## Related Projects

- [Tabeza Platform](https://github.com/billoapp/tabeza) - Main Tabeza application
- [Tabeza Docs](https://docs.tabeza.co.ke) - Complete documentation

---

Made with ❤️ by the Tabeza team
```

### 6. Create GitHub Actions Workflow

Create `.github/workflows/build-installer.yml`:

```yaml
name: Build Installer

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  workflow_dispatch:

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
      run: |
        npm install
        cd src/service
        npm install
    
    - name: Download Node.js runtime
      run: npm run download:nodejs
    
    - name: Build installer
      run: npm run build:installer
    
    - name: Upload artifact
      uses: actions/upload-artifact@v3
      with:
        name: tabeza-connect-installer
        path: dist/*.zip
        retention-days: 30
```

### 7. Create Release Workflow

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: windows-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: |
        npm install
        cd src/service
        npm install
    
    - name: Build installer
      run: npm run build
    
    - name: Create Release
      uses: softprops/action-gh-release@v1
      with:
        files: dist/*.zip
        draft: false
        prerelease: false
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Migration Checklist

- [ ] Create repository structure
- [ ] Copy files from monorepo
- [ ] Create package.json
- [ ] Create .gitignore
- [ ] Create comprehensive README.md
- [ ] Set up GitHub Actions workflows
- [ ] Create LICENSE file (MIT)
- [ ] Create CONTRIBUTING.md
- [ ] Test installer build locally
- [ ] Push to GitHub
- [ ] Create first release (v1.0.0)
- [ ] Update download links in main Tabeza app

## Next Steps

1. **Test the build process**:
   ```bash
   npm run build
   ```

2. **Verify installer works**:
   - Extract dist/TabezaConnect-Setup-v1.0.0.zip
   - Run install.bat on a test VM
   - Verify service starts and connects

3. **Create first release**:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

4. **Update main Tabeza app**:
   - Update download link in staff app settings
   - Point to GitHub releases URL

## Benefits of Separate Repository

1. **Independent versioning**: Installer can be updated without main app changes
2. **Cleaner CI/CD**: Dedicated build pipeline for Windows installer
3. **Better distribution**: GitHub releases for easy downloads
4. **Focused development**: Printer service team can work independently
5. **Simpler testing**: Test installer without full Tabeza stack

## Maintenance

- Keep Node.js version in sync with bundled runtime
- Update dependencies regularly
- Test on clean Windows VMs before releases
- Monitor GitHub issues for installation problems
- Update documentation as features are added
