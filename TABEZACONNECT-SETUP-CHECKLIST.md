# TabezaConnect Repository Setup Checklist

## Current Status
✅ Repository initialized at `c:\Projects\TabezaConnect`
✅ Basic README created
✅ Some installer files copied (build-installer.js, download-nodejs.js, scripts)
✅ Public HTML files copied (configure.html, prompt-manager.html)

## Remaining Setup Tasks

### 1. Core Service Files (PRIORITY)
- [ ] Copy `index.js` (main service file)
- [ ] Copy `package.json` (service dependencies)
- [ ] Copy `config.example.json` (configuration template)
- [ ] Copy `electron-main.js` (system tray application)
- [ ] Copy `setup.html` (setup wizard)

### 2. Assets
- [ ] Copy `assets/icon.ico` (application icon)
- [ ] Copy `assets/logo-green.svg` (branding)

### 3. Installer Scripts (verify completeness)
- [x] `installer/build-installer.js` (already copied)
- [x] `installer/download-nodejs.js` (already copied)
- [ ] Verify `installer/scripts/` directory has all PowerShell scripts:
  - [ ] configure-printer.ps1
  - [ ] register-service.ps1
  - [ ] create-folders.ps1
  - [ ] detect-printers.ps1

### 4. Root Configuration Files
- [ ] Create root `package.json` with build scripts
- [ ] Create `.gitignore`
- [ ] Create `LICENSE` (MIT)
- [ ] Update `README.md` with comprehensive documentation

### 5. Documentation
- [ ] Create `docs/INSTALLATION.md`
- [ ] Create `docs/TROUBLESHOOTING.md`
- [ ] Create `docs/ARCHITECTURE.md`
- [ ] Create `CONTRIBUTING.md`

### 6. GitHub Actions Workflows
- [ ] Create `.github/workflows/build-installer.yml`
- [ ] Create `.github/workflows/release.yml`

### 7. Directory Structure
```
TabezaConnect/
├── .github/
│   └── workflows/
│       ├── build-installer.yml
│       └── release.yml
├── src/
│   ├── service/              # ← Need to create and populate
│   │   ├── index.js
│   │   ├── package.json
│   │   ├── config.example.json
│   │   └── electron-main.js
│   ├── installer/            # ← Partially complete
│   │   ├── download-nodejs.js
│   │   ├── build-installer.js
│   │   └── scripts/
│   └── public/               # ← Complete
│       ├── configure.html
│       ├── prompt-manager.html
│       └── setup.html
├── assets/                   # ← Need to create
│   └── icon.ico
├── docs/                     # ← Need to create
│   ├── INSTALLATION.md
│   ├── TROUBLESHOOTING.md
│   └── ARCHITECTURE.md
├── .gitignore
├── LICENSE
├── package.json
└── README.md
```

### 8. Testing & Verification
- [ ] Test `npm run download:nodejs` in TabezaConnect
- [ ] Test `npm run build:installer` in TabezaConnect
- [ ] Verify installer package is created
- [ ] Test installer on clean Windows VM

### 9. Git & GitHub
- [ ] Commit all files
- [ ] Push to GitHub
- [ ] Create first release (v1.0.0)
- [ ] Update download links in Tabz staff app

## Manual File Copy Commands

Run these commands from `c:\Projects\` directory:

```cmd
REM Create directories
mkdir TabezaConnect\src\service
mkdir TabezaConnect\assets
mkdir TabezaConnect\docs
mkdir TabezaConnect\.github\workflows

REM Core service files
copy Tabz\packages\printer-service\index.js TabezaConnect\src\service\
copy Tabz\packages\printer-service\package.json TabezaConnect\src\service\
copy Tabz\packages\printer-service\config.example.json TabezaConnect\src\service\
copy Tabz\packages\printer-service\electron-main.js TabezaConnect\src\service\
copy Tabz\packages\printer-service\setup.html TabezaConnect\src\public\

REM Assets
xcopy Tabz\packages\printer-service\assets TabezaConnect\assets\ /E /I

REM Installer scripts (verify completeness)
xcopy Tabz\packages\printer-service\installer\scripts TabezaConnect\src\installer\scripts\ /E /I /Y

REM Documentation
copy Tabz\packages\printer-service\QUICK-START.md TabezaConnect\docs\INSTALLATION.md
copy Tabz\PRINTER-SYSTEM-ARCHITECTURE.md TabezaConnect\docs\ARCHITECTURE.md
```

## Files to Create in TabezaConnect

### Root package.json
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
  "keywords": ["tabeza", "connect", "printer", "pos", "receipt", "windows", "installer"],
  "author": "Tabeza",
  "license": "MIT",
  "bugs": {
    "url": "https://github.com/billoapp/TabezaConnect/issues"
  },
  "homepage": "https://github.com/billoapp/TabezaConnect#readme"
}
```

### .gitignore
```
# Node modules
node_modules/
npm-debug.log*

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

# Logs
logs/
*.log

# Temporary files
tmp/
temp/
```

## Next Steps After Manual Copy

1. **Install dependencies in service directory:**
   ```cmd
   cd c:\Projects\TabezaConnect\src\service
   npm install
   cd ..\..
   ```

2. **Install root dependencies (if any):**
   ```cmd
   cd c:\Projects\TabezaConnect
   npm install
   ```

3. **Test build process:**
   ```cmd
   npm run build
   ```

4. **Verify output:**
   - Check `dist/TabezaConnect-Setup-v1.0.0.zip` exists
   - Extract and verify contents

5. **Commit and push:**
   ```cmd
   git add .
   git commit -m "Complete TabezaConnect setup with all service files"
   git push origin main
   ```

6. **Create first release:**
   ```cmd
   git tag v1.0.0
   git push origin v1.0.0
   ```

## Success Criteria

- [ ] All files copied successfully
- [ ] `npm run build` completes without errors
- [ ] Installer ZIP created in `dist/` directory
- [ ] Installer size is reasonable (~30-40 MB with Node.js)
- [ ] Can extract and see all expected files
- [ ] Service files have correct structure
- [ ] Documentation is complete

## Troubleshooting

**If build fails:**
1. Check Node.js download completed: `dir src\installer\nodejs-bundle\nodejs\node.exe`
2. Check service dependencies installed: `dir src\service\node_modules`
3. Check PowerShell scripts exist: `dir src\installer\scripts\*.ps1`

**If files are missing:**
1. Verify source files exist in Tabz monorepo
2. Check file paths in copy commands
3. Ensure directories are created before copying

**If Git push fails:**
1. Check remote is configured: `git remote -v`
2. Verify authentication: `git config user.name` and `git config user.email`
3. Try: `git push -u origin main`
