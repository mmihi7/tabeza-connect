# Implementation Changes Required

This document shows exactly what needs to change to integrate the existing Inno Setup installers into GitHub Actions.

## File 1: TabezaConnect/.github/workflows/release.yml

### Location: After the "Build service" step

**ADD THESE STEPS:**

```yaml
      # ============================================================================
      # PKG Compilation - Create standalone executable
      # ============================================================================
      - name: Install PKG globally
        run: npm install -g pkg
        
      - name: Compile service to standalone executable
        run: pkg src/service/index.js --targets node18-win-x64 --output TabezaConnect/TabezaService.exe
        working-directory: ${{ github.workspace }}
        
      - name: Verify TabezaService.exe was created
        run: |
          if (Test-Path "TabezaConnect/TabezaService.exe") {
            $size = (Get-Item "TabezaConnect/TabezaService.exe").Length / 1MB
            Write-Host "✅ TabezaService.exe created: $([math]::Round($size, 2)) MB"
          } else {
            Write-Error "❌ TabezaService.exe not found"
            exit 1
          }
        working-directory: ${{ github.workspace }}

      # ============================================================================
      # Inno Setup - Build Windows installer
      # ============================================================================
      - name: Install Inno Setup
        run: choco install innosetup -y
        
      - name: Build installer with Inno Setup
        run: |
          $isccPath = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
          if (Test-Path $isccPath) {
            Write-Host "Building installer with Inno Setup..."
            & $isccPath "TabezaConnect/installer-pkg.iss"
            if ($LASTEXITCODE -ne 0) {
              Write-Error "Inno Setup compilation failed"
              exit 1
            }
          } else {
            Write-Error "Inno Setup not found at: $isccPath"
            exit 1
          }
        working-directory: ${{ github.workspace }}
        
      - name: Verify installer was created
        run: |
          $version = "${{ steps.extract_version.outputs.version }}"
          $exePath = "TabezaConnect/dist/TabezaConnect-Setup-v$version.exe"
          if (Test-Path $exePath) {
            $size = (Get-Item $exePath).Length / 1MB
            Write-Host "✅ Installer created: $exePath"
            Write-Host "   Size: $([math]::Round($size, 2)) MB"
          } else {
            Write-Error "❌ Installer not found at: $exePath"
            Write-Host "Contents of dist directory:"
            Get-ChildItem "TabezaConnect/dist" -ErrorAction SilentlyContinue
            exit 1
          }
        working-directory: ${{ github.workspace }}
```

### Location: Replace the "Upload ZIP to release" step

**REPLACE THIS:**

```yaml
      - name: Upload ZIP to release
        uses: actions/upload-release-asset@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          upload_url: ${{ steps.create_release.outputs.upload_url }}
          asset_path: ./TabezaConnect/dist/TabezaConnect-Setup-v${{ steps.extract_version.outputs.version }}.zip
          asset_name: TabezaConnect-Setup-v${{ steps.extract_version.outputs.version }}.zip
          asset_content_type: application/zip
```

**WITH THIS:**

```yaml
      - name: Upload installer to release
        uses: actions/upload-release-asset@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          upload_url: ${{ steps.create_release.outputs.upload_url }}
          asset_path: ./TabezaConnect/dist/TabezaConnect-Setup-v${{ steps.extract_version.outputs.version }}.exe
          asset_name: TabezaConnect-Setup-v${{ steps.extract_version.outputs.version }}.exe
          asset_content_type: application/octet-stream
```

## File 2: Tabz/.github/scripts/validate-artifact.ps1

### Change 1: Expected file pattern (around line 106)

**REPLACE:**

```powershell
$expectedPattern = "^TabezaConnect-Setup-v\d+\.\d+\.\d+(-[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*)?\.zip$"
```

**WITH:**

```powershell
$expectedPattern = "^TabezaConnect-Setup-v\d+\.\d+\.\d+(-[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*)?\.exe$"
```

### Change 2: File size expectations (around line 140)

**REPLACE:**

```powershell
$minSizeMB = 50
$maxSizeMB = 100
```

**WITH:**

```powershell
$minSizeMB = 40
$maxSizeMB = 60
```

### Change 3: File type description (around line 150)

**REPLACE:**

```powershell
Write-Host "  File type: ZIP archive"
```

**WITH:**

```powershell
Write-Host "  File type: Windows Installer (.exe)"
```

## File 3: Tabz/.github/scripts/generate-release-notes.ps1

### Change 1: Download URL (around line 50)

**REPLACE:**

```powershell
$downloadUrl = "https://github.com/billoapp/TabezaConnect/releases/latest/download/TabezaConnect-Setup-v$version.zip"
```

**WITH:**

```powershell
$downloadUrl = "https://github.com/billoapp/TabezaConnect/releases/latest/download/TabezaConnect-Setup-v$version.exe"
```

### Change 2: Installation instructions (around line 80)

**REPLACE:**

```markdown
## Installation

1. Download the ZIP file from the link above
2. Extract the ZIP file to a temporary location
3. Right-click `install.bat` and select "Run as administrator"
4. Follow the prompts to complete installation
```

**WITH:**

```markdown
## Installation

1. Download the installer from the link above
2. Double-click `TabezaConnect-Setup-v$version.exe`
3. Follow the installation wizard
4. The service will start automatically after installation
```

### Change 3: File size reference (around line 100)

**REPLACE:**

```powershell
Write-Host "  File size: ~50-60 MB (ZIP archive)"
```

**WITH:**

```powershell
Write-Host "  File size: ~40-50 MB (Windows Installer)"
```

## File 4: TabezaConnect/installer-pkg.iss (OPTIONAL)

### Change 1: Output directory (line 24)

**REPLACE:**

```pascal
OutputDir=C:\Temp\TabezaConnect-Build
```

**WITH:**

```pascal
OutputDir=dist
```

### Change 2: Dynamic version (OPTIONAL - requires Inno Setup preprocessor)

**REPLACE:**

```pascal
AppVersion=1.0.0
OutputBaseFilename=TabezaConnect-Setup-v1.0.0
```

**WITH:**

```pascal
#define MyAppVersion GetStringFileInfo("TabezaService.exe", "ProductVersion")

AppVersion={#MyAppVersion}
OutputBaseFilename=TabezaConnect-Setup-v{#MyAppVersion}
```

**NOTE**: This requires TabezaService.exe to have version info embedded. Simpler approach is to keep version hardcoded and update manually.

## File 5: Staff App Download Link

### Location: Wherever the download link is displayed

**REPLACE:**

```typescript
const downloadUrl = `https://github.com/billoapp/TabezaConnect/releases/latest/download/TabezaConnect-Setup-v${version}.zip`;
const instructions = "Download the ZIP file, extract it, and run install.bat as administrator";
```

**WITH:**

```typescript
const downloadUrl = `https://github.com/billoapp/TabezaConnect/releases/latest/download/TabezaConnect-Setup-v${version}.exe`;
const instructions = "Download and run the installer. Follow the installation wizard.";
```

## Summary of Changes

### Critical Changes (Required):
1. ✅ Add PKG compilation to GitHub Actions
2. ✅ Add Inno Setup installation to GitHub Actions
3. ✅ Add Inno Setup compilation to GitHub Actions
4. ✅ Change upload from .zip to .exe
5. ✅ Update validate-artifact.ps1 (pattern + size)
6. ✅ Update generate-release-notes.ps1 (URL + instructions)

### Optional Changes:
7. 💡 Fix output directory in installer-pkg.iss
8. 💡 Make version dynamic in installer-pkg.iss
9. 💡 Update staff app download link

### No Changes Needed:
- ✅ installer-pkg.iss (works as-is)
- ✅ build-pkg.bat (for local builds)
- ✅ PowerShell scripts (already fixed)
- ✅ Service registration logic
- ✅ Printer configuration logic

## Testing After Changes

### 1. Local Test (Before Pushing)

```bash
# Test PKG compilation
npm install -g pkg
cd C:\Projects\TabezaConnect
pkg src/service/index.js --targets node18-win-x64 --output TabezaService.exe

# Test Inno Setup compilation
"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer-pkg.iss

# Verify output
dir dist\TabezaConnect-Setup-*.exe
```

### 2. GitHub Actions Test

```bash
# Create test branch
git checkout -b test/inno-setup-integration

# Commit changes
git add .
git commit -m "Add Inno Setup integration to GitHub Actions"

# Push and tag
git push origin test/inno-setup-integration
git tag v1.0.1-test
git push origin v1.0.1-test

# Monitor: https://github.com/billoapp/TabezaConnect/actions
```

### 3. Download and Test

```bash
# Download from release
# URL: https://github.com/billoapp/TabezaConnect/releases/tag/v1.0.1-test

# Run installer
TabezaConnect-Setup-v1.0.1-test.exe

# Verify service
sc query TabezaConnect

# Check status page
# http://localhost:8765/api/status
```

## Rollback Plan

If something goes wrong:

1. **Revert GitHub Actions changes** - Remove PKG and Inno Setup steps
2. **Keep ZIP upload** - Revert to ZIP-based distribution
3. **Fix issues** - Debug locally before trying again
4. **Test thoroughly** - Use test releases before production

## Success Criteria

After implementing these changes:

✅ GitHub Actions workflow completes successfully  
✅ TabezaService.exe is created (~40-50 MB)  
✅ Installer .exe is created (~40-50 MB)  
✅ Installer is uploaded to release  
✅ Download URL works  
✅ Installer runs on Windows 10/11  
✅ Service installs and starts automatically  
✅ No errors in workflow logs  

## Estimated Time

- **File 1** (GitHub Actions): 30 minutes
- **File 2** (validate-artifact.ps1): 5 minutes
- **File 3** (generate-release-notes.ps1): 5 minutes
- **File 4** (installer-pkg.iss): 10 minutes (optional)
- **File 5** (Staff app): 10 minutes
- **Testing**: 1 hour

**Total**: 2 hours

## Next Steps

1. Make changes to files 1-3 (critical)
2. Test locally with PKG and Inno Setup
3. Push to test branch and create test tag
4. Verify workflow succeeds
5. Download and test installer
6. Make changes to files 4-5 (optional)
7. Create production release

---

**Ready to implement?** Start with File 1 (GitHub Actions workflow) and work through the list. Test locally first, then push to GitHub.
