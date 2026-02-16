#!/usr/bin/env node

/**
 * TabezaConnect Repository Setup Script
 * 
 * This script automates the setup of the TabezaConnect standalone repository
 * by copying all necessary files from the Tabz monorepo.
 * 
 * Usage: node setup-tabezaconnect.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Paths
const TABZ_ROOT = __dirname;
const PRINTER_SERVICE = path.join(TABZ_ROOT, 'packages', 'printer-service');
const TABEZA_CONNECT = path.join(path.dirname(TABZ_ROOT), 'TabezaConnect');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function copyFile(source, dest) {
  try {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(source, dest);
    log(`✅ Copied: ${path.basename(dest)}`, 'green');
    return true;
  } catch (error) {
    log(`❌ Failed to copy ${path.basename(source)}: ${error.message}`, 'red');
    return false;
  }
}

function copyDirectory(source, dest) {
  try {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(source, { withFileTypes: true });
    let fileCount = 0;

    for (const entry of entries) {
      const srcPath = path.join(source, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and other unnecessary directories
        if (['node_modules', '.git', 'dist', 'received-prints', 'test-receipts', '__tests__'].includes(entry.name)) {
          continue;
        }
        fileCount += copyDirectory(srcPath, destPath);
      } else {
        if (copyFile(srcPath, destPath)) {
          fileCount++;
        }
      }
    }

    return fileCount;
  } catch (error) {
    log(`❌ Failed to copy directory ${path.basename(source)}: ${error.message}`, 'red');
    return 0;
  }
}

function createFile(filePath, content) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf8');
    log(`✅ Created: ${path.basename(filePath)}`, 'green');
    return true;
  } catch (error) {
    log(`❌ Failed to create ${path.basename(filePath)}: ${error.message}`, 'red');
    return false;
  }
}

function verifyTabezaConnect() {
  if (!fs.existsSync(TABEZA_CONNECT)) {
    log('❌ TabezaConnect directory not found at: ' + TABEZA_CONNECT, 'red');
    log('Please ensure the repository is cloned at: ' + TABEZA_CONNECT, 'yellow');
    return false;
  }
  log('✅ TabezaConnect directory found', 'green');
  return true;
}

function setupDirectories() {
  logSection('1. Creating Directory Structure');

  const directories = [
    path.join(TABEZA_CONNECT, 'src', 'service'),
    path.join(TABEZA_CONNECT, 'src', 'installer', 'scripts'),
    path.join(TABEZA_CONNECT, 'src', 'public'),
    path.join(TABEZA_CONNECT, 'assets'),
    path.join(TABEZA_CONNECT, 'docs'),
    path.join(TABEZA_CONNECT, '.github', 'workflows')
  ];

  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      log(`✅ Created: ${path.relative(TABEZA_CONNECT, dir)}`, 'green');
    } else {
      log(`⏭️  Already exists: ${path.relative(TABEZA_CONNECT, dir)}`, 'yellow');
    }
  });
}

function copyServiceFiles() {
  logSection('2. Copying Core Service Files');

  const serviceFiles = [
    { src: 'index.js', dest: path.join('src', 'service', 'index.js') },
    { src: 'package.json', dest: path.join('src', 'service', 'package.json') },
    { src: 'config.example.json', dest: path.join('src', 'service', 'config.example.json') },
    { src: 'electron-main.js', dest: path.join('src', 'service', 'electron-main.js') }
  ];

  serviceFiles.forEach(({ src, dest }) => {
    const sourcePath = path.join(PRINTER_SERVICE, src);
    const destPath = path.join(TABEZA_CONNECT, dest);
    copyFile(sourcePath, destPath);
  });
}

function copyPublicFiles() {
  logSection('3. Copying Public HTML Files');

  const publicFiles = [
    'configure.html',
    'prompt-manager.html',
    'setup.html'
  ];

  publicFiles.forEach(file => {
    const sourcePath = path.join(PRINTER_SERVICE, 'public', file);
    const destPath = path.join(TABEZA_CONNECT, 'src', 'public', file);
    
    // Check if file exists in public directory
    if (fs.existsSync(sourcePath)) {
      copyFile(sourcePath, destPath);
    } else {
      // Try root directory
      const altSourcePath = path.join(PRINTER_SERVICE, file);
      if (fs.existsSync(altSourcePath)) {
        copyFile(altSourcePath, destPath);
      } else {
        log(`⚠️  File not found: ${file}`, 'yellow');
      }
    }
  });
}

function copyInstallerFiles() {
  logSection('4. Copying Installer Files');

  // Copy installer scripts
  const installerFiles = [
    { src: path.join('installer', 'download-nodejs.js'), dest: path.join('src', 'installer', 'download-nodejs.js') },
    { src: path.join('installer', 'build-installer.js'), dest: path.join('src', 'installer', 'build-installer.js') }
  ];

  installerFiles.forEach(({ src, dest }) => {
    const sourcePath = path.join(PRINTER_SERVICE, src);
    const destPath = path.join(TABEZA_CONNECT, dest);
    copyFile(sourcePath, destPath);
  });

  // Copy PowerShell scripts
  log('\nCopying PowerShell scripts...', 'blue');
  const scriptsSource = path.join(PRINTER_SERVICE, 'installer', 'scripts');
  const scriptsDest = path.join(TABEZA_CONNECT, 'src', 'installer', 'scripts');
  
  if (fs.existsSync(scriptsSource)) {
    const fileCount = copyDirectory(scriptsSource, scriptsDest);
    log(`Copied ${fileCount} PowerShell script(s)`, 'blue');
  } else {
    log('⚠️  Installer scripts directory not found', 'yellow');
  }
}

function copyAssets() {
  logSection('5. Copying Assets');

  const assetsSource = path.join(PRINTER_SERVICE, 'assets');
  const assetsDest = path.join(TABEZA_CONNECT, 'assets');

  if (fs.existsSync(assetsSource)) {
    const fileCount = copyDirectory(assetsSource, assetsDest);
    log(`Copied ${fileCount} asset file(s)`, 'blue');
  } else {
    log('⚠️  Assets directory not found', 'yellow');
  }
}

function copyDocumentation() {
  logSection('6. Copying Documentation');

  const docs = [
    { src: path.join(PRINTER_SERVICE, 'QUICK-START.md'), dest: path.join(TABEZA_CONNECT, 'docs', 'INSTALLATION.md') },
    { src: path.join(TABZ_ROOT, 'PRINTER-SYSTEM-ARCHITECTURE.md'), dest: path.join(TABEZA_CONNECT, 'docs', 'ARCHITECTURE.md') }
  ];

  docs.forEach(({ src, dest }) => {
    if (fs.existsSync(src)) {
      copyFile(src, dest);
    } else {
      log(`⚠️  Documentation file not found: ${path.basename(src)}`, 'yellow');
    }
  });
}

function createRootPackageJson() {
  logSection('7. Creating Root package.json');

  const packageJson = {
    name: 'tabeza-connect',
    version: '1.0.0',
    description: 'Tabeza Connect - Windows installer for POS integration',
    scripts: {
      'download:nodejs': 'node src/installer/download-nodejs.js',
      'build:installer': 'node src/installer/build-installer.js',
      'build': 'npm run download:nodejs && npm run build:installer',
      'test': 'echo "No tests yet" && exit 0'
    },
    repository: {
      type: 'git',
      url: 'https://github.com/billoapp/TabezaConnect.git'
    },
    keywords: ['tabeza', 'connect', 'printer', 'pos', 'receipt', 'windows', 'installer'],
    author: 'Tabeza',
    license: 'MIT',
    bugs: {
      url: 'https://github.com/billoapp/TabezaConnect/issues'
    },
    homepage: 'https://github.com/billoapp/TabezaConnect#readme'
  };

  const packageJsonPath = path.join(TABEZA_CONNECT, 'package.json');
  createFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

function createGitignore() {
  logSection('8. Creating .gitignore');

  const gitignoreContent = `# Node modules
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
`;

  const gitignorePath = path.join(TABEZA_CONNECT, '.gitignore');
  createFile(gitignorePath, gitignoreContent);
}

function createReadme() {
  logSection('9. Creating README.md');

  const readmeContent = `# Tabeza Connect

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

1. Download \`TabezaConnect-Setup.zip\` from [Releases](https://github.com/billoapp/TabezaConnect/releases)
2. Extract to a temporary location
3. Right-click \`install.bat\` and select "Run as administrator"
4. Follow the installation wizard
5. Configure your POS to print to "Tabeza Receipt Printer"

See [Installation Guide](docs/INSTALLATION.md) for detailed instructions.

### For Developers

\`\`\`bash
# Clone repository
git clone https://github.com/billoapp/TabezaConnect.git
cd TabezaConnect

# Install dependencies
npm install
cd src/service && npm install && cd ../..

# Build installer
npm run build

# Output: dist/TabezaConnect-Setup-v1.0.0.zip
\`\`\`

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
`;

  const readmePath = path.join(TABEZA_CONNECT, 'README.md');
  createFile(readmePath, readmeContent);
}

function createLicense() {
  logSection('10. Creating LICENSE');

  const licenseContent = `MIT License

Copyright (c) ${new Date().getFullYear()} Tabeza

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
`;

  const licensePath = path.join(TABEZA_CONNECT, 'LICENSE');
  createFile(licensePath, licenseContent);
}

function createGitHubWorkflows() {
  logSection('11. Creating GitHub Actions Workflows');

  // Build workflow
  const buildWorkflow = `name: Build Installer

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
`;

  const buildWorkflowPath = path.join(TABEZA_CONNECT, '.github', 'workflows', 'build-installer.yml');
  createFile(buildWorkflowPath, buildWorkflow);

  // Release workflow
  const releaseWorkflow = `name: Release

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
        GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`;

  const releaseWorkflowPath = path.join(TABEZA_CONNECT, '.github', 'workflows', 'release.yml');
  createFile(releaseWorkflowPath, releaseWorkflow);
}

function printNextSteps() {
  logSection('Setup Complete! 🎉');

  log('\nNext Steps:', 'cyan');
  log('\n1. Install service dependencies:', 'yellow');
  log('   cd ' + path.join(TABEZA_CONNECT, 'src', 'service'), 'blue');
  log('   npm install', 'blue');
  log('   cd ..\\..', 'blue');

  log('\n2. Test the build process:', 'yellow');
  log('   cd ' + TABEZA_CONNECT, 'blue');
  log('   npm run build', 'blue');

  log('\n3. Verify the output:', 'yellow');
  log('   Check dist/TabezaConnect-Setup-v1.0.0.zip', 'blue');

  log('\n4. Commit and push to GitHub:', 'yellow');
  log('   git add .', 'blue');
  log('   git commit -m "Complete TabezaConnect setup"', 'blue');
  log('   git push origin main', 'blue');

  log('\n5. Create first release:', 'yellow');
  log('   git tag v1.0.0', 'blue');
  log('   git push origin v1.0.0', 'blue');

  log('\n📚 Documentation:', 'cyan');
  log('   - Installation: docs/INSTALLATION.md', 'blue');
  log('   - Architecture: docs/ARCHITECTURE.md', 'blue');
  log('   - Setup Checklist: ' + path.join(TABZ_ROOT, 'TABEZACONNECT-SETUP-CHECKLIST.md'), 'blue');

  console.log('\n' + '='.repeat(60) + '\n');
}

// Main execution
async function main() {
  log('\n🚀 TabezaConnect Repository Setup Script', 'cyan');
  log('This script will copy all necessary files from Tabz to TabezaConnect\n', 'blue');

  // Verify TabezaConnect exists
  if (!verifyTabezaConnect()) {
    process.exit(1);
  }

  try {
    setupDirectories();
    copyServiceFiles();
    copyPublicFiles();
    copyInstallerFiles();
    copyAssets();
    copyDocumentation();
    createRootPackageJson();
    createGitignore();
    createReadme();
    createLicense();
    createGitHubWorkflows();
    printNextSteps();

    log('✅ Setup completed successfully!', 'green');
    process.exit(0);
  } catch (error) {
    log(`\n❌ Setup failed: ${error.message}`, 'red');
    log(error.stack, 'red');
    process.exit(1);
  }
}

main();
