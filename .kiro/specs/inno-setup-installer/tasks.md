# Inno Setup Installer Integration - Tasks

## Phase 1: Inno Setup Script Improvements (OPTIONAL - Already Working)

### 1.1 Review existing Inno Setup scripts
- [x] Review `installer.iss` (Node.js bundle version)
- [x] Review `installer-pkg.iss` (PKG compiled version - RECOMMENDED)
- [x] Review `installer-nssm.iss` (NSSM service wrapper version)
- [x] Confirm all scripts are working locally

### 1.2 Make version dynamic in installer-pkg.iss (OPTIONAL)
- [ ] Replace hardcoded version "1.0.0" with dynamic version from package.json
- [ ] Update OutputBaseFilename to use dynamic version
- [ ] Test compilation with dynamic version

### 1.3 Fix output directory in installer-pkg.iss
- [ ] Change OutputDir from absolute path to "dist"
- [ ] Ensure dist/ directory is created if it doesn't exist
- [ ] Test that output goes to correct location

## Phase 2: GitHub Actions Integration (PRIORITY)

### 2.1 Add PKG compilation to release.yml
- [ ] Add step to install PKG globally (`npm install -g pkg`)
- [ ] Add step to compile service: `pkg src/service/index.js --targets node18-win-x64 --output TabezaService.exe`
- [ ] Verify TabezaService.exe is created
- [ ] Add error handling if compilation fails

### 2.2 Add Inno Setup installation to release.yml
- [ ] Add step to install Inno Setup via chocolatey: `choco install innosetup -y`
- [ ] Set ISCC_PATH environment variable
- [ ] Verify Inno Setup is installed correctly

### 2.3 Add Inno Setup compilation to release.yml
- [ ] Add step to run ISCC.exe on installer-pkg.iss
- [ ] Use full path: `C:\Program Files (x86)\Inno Setup 6\ISCC.exe`
- [ ] Add error handling if compilation fails
- [ ] Verify .exe is created in dist/

### 2.4 Update artifact upload in release.yml
- [ ] Change upload from .zip to .exe
- [ ] Update asset_path to point to .exe file
- [ ] Update asset_name to use .exe extension
- [ ] Update asset_content_type to application/octet-stream

### 2.5 Add .exe validation step
- [x] Add step to verify .exe exists
- [x] Check file size (should be 40-50 MB)
- [x] Display file information
- [x] Fail workflow if .exe not found

## Phase 3: Update Validation Scripts

### 3.1 Update validate-artifact.ps1
- [ ] Change expected file pattern from .zip to .exe
- [ ] Update regex: `^TabezaConnect-Setup-v\d+\.\d+\.\d+(-[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*)?\.exe$`
- [ ] Update file size expectations (40-50 MB for .exe vs 50-60 MB for .zip)
- [ ] Update validation messages
- [ ] Test validation script locally

### 3.2 Update validate-artifact.sh
- [ ] Change expected file pattern from .zip to .exe
- [ ] Update regex pattern for .exe files
- [ ] Update file size expectations
- [ ] Update validation messages
- [ ] Test validation script locally

### 3.3 Update generate-release-notes.ps1
- [x] Change download URL from .zip to .exe
- [x] Update installation instructions for .exe installer
- [x] Update file size references
- [x] Add note about double-clicking .exe vs extracting ZIP
- [x] Test release notes generation

### 3.4 Update generate-release-notes.sh
- [ ] Change download URL from .zip to .exe
- [ ] Update installation instructions
- [ ] Update file size references
- [ ] Test release notes generation

## Phase 4: Testing and Validation

### 4.1 Local build testing
- [ ] Install PKG globally: `npm install -g pkg`
- [ ] Compile service: `pkg src/service/index.js --targets node18-win-x64 --output TabezaService.exe`
- [ ] Run build-pkg.bat
- [ ] Verify .exe is created in dist/
- [ ] Check file size and properties

### 4.2 Local installation testing
- [ ] Test installation on Windows 10
- [ ] Test installation on Windows 11
- [ ] Verify all components install correctly
- [ ] Verify service starts automatically
- [ ] Test status page accessibility (http://localhost:8765/api/status)

### 4.3 GitHub Actions workflow testing
- [ ] Create test branch with workflow changes
- [ ] Push test tag: `v1.0.1-test`
- [ ] Monitor workflow execution
- [ ] Verify PKG compilation succeeds
- [ ] Verify Inno Setup installation succeeds
- [ ] Verify .exe compilation succeeds
- [ ] Verify .exe is uploaded to release

### 4.4 Download and test release artifact
- [ ] Download .exe from test release
- [ ] Verify file size (40-50 MB)
- [ ] Test installation on clean Windows VM
- [ ] Verify service registration
- [ ] Verify printer configuration
- [ ] Test uninstallation

### 4.5 Upgrade testing
- [ ] Install previous version (if available)
- [ ] Install new version (.exe)
- [ ] Verify upgrade preserves configuration
- [ ] Verify service continues working

### 4.6 Silent installation testing
- [ ] Test /SILENT flag
- [ ] Test /VERYSILENT flag
- [ ] Verify silent install completes successfully
- [ ] Verify service starts after silent install

## Phase 5: Documentation and Production Release

### 5.1 Update TabezaConnect README.md
- [ ] Add .exe installation instructions
- [ ] Document system requirements
- [ ] Add troubleshooting section
- [ ] Update download links

### 5.2 Update staff app download link
- [ ] Update download URL in staff app to point to .exe
- [ ] Change from `/releases/latest/download/TabezaConnect-Setup-v{version}.zip`
- [ ] To: `/releases/latest/download/TabezaConnect-Setup-v{version}.exe`
- [ ] Update installation instructions in staff app

### 5.3 Create release checklist
- [ ] Document release process with .exe
- [ ] Create testing checklist for releases
- [ ] Document rollback procedure

### 5.4 Production release
- [ ] Create production release tag
- [ ] Verify workflow runs successfully
- [ ] Verify .exe is uploaded
- [ ] Test download URL
- [ ] Monitor for installation issues
- [ ] Gather user feedback

## Phase 6: Cleanup and Future Improvements (OPTIONAL)

### 6.1 Remove ZIP-based build process (OPTIONAL)
- [ ] Archive or remove `src/installer/build-installer.js`
- [ ] Remove ZIP creation logic from workflows
- [ ] Update documentation to remove ZIP references
- [ ] Keep for 1-2 releases as fallback

### 6.2 Code signing (FUTURE)
- [ ] Obtain code signing certificate
- [ ] Configure Inno Setup for code signing
- [ ] Add signing step to workflow
- [ ] Test signed installer

### 6.3 Performance optimization (FUTURE)
- [ ] Optimize compression settings
- [ ] Reduce installer size if possible
- [ ] Optimize installation speed
- [ ] Add progress indicators

## Notes

- ✅ **Existing Inno Setup scripts are already working** - No need to create from scratch
- ✅ **PowerShell scripts are fixed** - Unicode characters removed
- ✅ **Local build process works perfectly** - Just needs GitHub Actions integration
- 🎯 **Priority: Phase 2 (GitHub Actions Integration)** - This is the missing piece
- 📦 **Recommended: Use installer-pkg.iss** - Fastest compilation, smallest size
- ⚡ **Quick win: 2-3 hours to complete** - Most work is already done

## Task Status Legend

- [ ] Not started
- [x] Completed
- [-] In progress
- [~] Queued

## Dependencies

- Phase 2 (GitHub Actions) is the PRIORITY - do this first
- Phase 3 (Validation Scripts) depends on Phase 2
- Phase 4 (Testing) depends on Phase 2 and 3
- Phase 5 (Documentation) depends on Phase 4
- Phase 1 (Script Improvements) is OPTIONAL - existing scripts work fine
- Phase 6 (Cleanup) is OPTIONAL - can be done later

## Key Files

### Already Working (No Changes Needed):
- ✅ `TabezaConnect/installer-pkg.iss` - Production ready
- ✅ `TabezaConnect/build-pkg.bat` - Works perfectly locally
- ✅ `TabezaConnect/src/installer/scripts/*.ps1` - All fixed

### Need Updates:
- ⚠️ `TabezaConnect/.github/workflows/release.yml` - Add PKG + Inno Setup
- ⚠️ `Tabz/.github/scripts/validate-artifact.ps1` - Change .zip to .exe
- ⚠️ `Tabz/.github/scripts/generate-release-notes.ps1` - Update URLs

### Optional Improvements:
- 💡 `TabezaConnect/installer-pkg.iss` - Make version dynamic
- 💡 `TabezaConnect/installer-pkg.iss` - Fix output directory path
