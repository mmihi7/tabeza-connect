# Automated Test Script for Task 4.1

## Overview

The `test-release-workflow.ps1` script automates the end-to-end testing process for the GitHub release workflow. It performs local validation before pushing a test tag to trigger the workflow.

**Location**: `Tabz/dev-tools/scripts/test-release-workflow.ps1`

**Note**: This script must be copied to the TabezaConnect repository before use.

## Prerequisites

1. **TabezaConnect Repository**: Must be cloned at `C:\Projects\TabezaConnect`
2. **PowerShell**: Version 5.1 or higher
3. **Git**: Installed and configured
4. **Node.js**: Version 18 or higher
5. **npm**: Version 9 or higher
6. **Repository Access**: Write access to TabezaConnect repository

## Installation

### Copy Script to TabezaConnect

```powershell
# From Tabz repository root
Copy-Item "dev-tools/scripts/test-release-workflow.ps1" `
          "C:\Projects\TabezaConnect\scripts\test-release-workflow.ps1"
```

Or manually copy the file to `C:\Projects\TabezaConnect\scripts\`

## Usage

### Basic Usage

```powershell
# Navigate to TabezaConnect repository
cd C:\Projects\TabezaConnect

# Run the test script
.\scripts\test-release-workflow.ps1
```

This will:
1. ✅ Run pre-flight checks
2. ✅ Build the installer locally
3. ✅ Validate the artifact
4. ✅ Create and push test tag (with confirmation)

### Advanced Usage

#### Specify Custom Version

```powershell
# Use a different version number
.\scripts\test-release-workflow.ps1 -Version "1.0.2-test"
```

#### Skip Local Build

```powershell
# Skip build if you already have a valid artifact
.\scripts\test-release-workflow.ps1 -SkipBuild
```

#### Skip Tag Push

```powershell
# Create tag but don't push (for manual push later)
.\scripts\test-release-workflow.ps1 -SkipPush
```

#### Custom Repository Path

```powershell
# Specify different TabezaConnect location
.\scripts\test-release-workflow.ps1 -TabezaConnectPath "D:\Projects\TabezaConnect"
```

#### Combined Options

```powershell
# Custom version, skip build, skip push
.\scripts\test-release-workflow.ps1 `
    -Version "2.0.0-beta" `
    -SkipBuild `
    -SkipPush
```

## Script Phases

### Phase 1: Pre-Flight Checks

The script verifies:
- ✅ TabezaConnect repository exists
- ✅ Git working directory is clean
- ✅ Current branch is main
- ✅ Workflow file exists (`.github/workflows/release.yml`)
- ✅ Validation script exists (`.github/scripts/validate-artifact.ps1`)
- ✅ Release notes script exists (`.github/scripts/generate-release-notes.ps1`)
- ✅ Package.json exists
- ✅ Build script exists (`scripts/build-installer.js`)

**Output Example**:
```
========================================
Phase 1: Pre-Flight Checks
========================================

🔍 Checking TabezaConnect repository path...
✅ Repository found: C:\Projects\TabezaConnect
🔍 Checking git status...
✅ Working directory is clean
🔍 Checking current branch...
✅ On main branch
🔍 Checking workflow file...
✅ Workflow file found
🔍 Checking validation script...
✅ Validation script found
🔍 Checking release notes script...
✅ Release notes script found
🔍 Checking package.json...
✅ package.json found
🔍 Checking build script...
✅ Build script found
✅ All pre-flight checks passed
```

### Phase 2: Local Build Test

The script performs:
- ✅ Clean build environment (remove dist, installer directories)
- ✅ Install root dependencies
- ✅ Install service dependencies
- ✅ Download Node.js runtime
- ✅ Build installer package
- ✅ Verify ZIP file creation

**Output Example**:
```
========================================
Phase 2: Local Build Test
========================================

🔍 Cleaning build environment...
✅ Build environment cleaned
🔍 Installing root dependencies...
✅ Root dependencies installed
🔍 Installing service dependencies...
✅ Service dependencies installed
🔍 Downloading Node.js runtime...
✅ Node.js runtime downloaded
🔍 Building installer package...
✅ Installer package built
🔍 Verifying ZIP file...
✅ ZIP file created: 35.42 MB
```

### Phase 3: Artifact Validation

The script runs the validation script to verify:
- ✅ ZIP file exists
- ✅ Filename matches pattern
- ✅ Version matches tag
- ✅ File size within bounds (20-50 MB)
- ✅ ZIP integrity
- ✅ Required files present

**Output Example**:
```
========================================
Phase 3: Artifact Validation
========================================

🔍 Running validation script...

========================================
TabezaConnect Artifact Validation
========================================
Version: 1.0.1-test

🔍 Checking if ZIP file exists...
✅ ZIP file found: TabezaConnect-Setup-v1.0.1-test.zip
🔍 Validating ZIP filename pattern...
✅ Filename matches expected pattern and version
🔍 Checking file size bounds...
  File size: 35.42 MB (37145600 bytes)
✅ File size within bounds: 35.42 MB (20-50 MB)
🔍 Testing ZIP integrity...
✅ ZIP file integrity verified (extraction successful)
🔍 Verifying presence of required files...
  ✓ install.bat
  ✓ README.txt
  ✓ nodejs/
✅ All required files present

========================================
Validation Summary
========================================

✅ VALIDATION PASSED

✅ Validation passed
```

### Phase 4: Tag Creation and Push

The script:
- ✅ Checks if tag already exists
- ✅ Creates git tag
- ✅ Prompts for confirmation before pushing
- ✅ Pushes tag to remote (triggers workflow)
- ✅ Provides workflow and release URLs

**Output Example**:
```
========================================
Phase 4: Tag Creation and Push
========================================

🔍 Checking if tag already exists...
🔍 Creating tag v1.0.1-test...
✅ Tag created: v1.0.1-test

Ready to push tag v1.0.1-test to trigger workflow
Push tag now? (y/n): y

🔍 Pushing tag to remote...
✅ Tag pushed successfully

Workflow triggered! Monitor progress at:
  https://github.com/billoapp/TabezaConnect/actions

After workflow completes, verify release at:
  https://github.com/billoapp/TabezaConnect/releases/tag/v1.0.1-test
```

## Test Summary

At the end, the script provides a summary:

```
========================================
Test Summary
========================================

Test Results:

  ✅ PreFlightChecks
  ✅ LocalBuild
  ✅ Validation
  ✅ TagCreation

✅ ALL TESTS PASSED

Next steps:
1. Monitor workflow execution in GitHub Actions
2. Verify release creation
3. Test download URLs
4. Clean up test release and tag
```

## Exit Codes

- **0**: All tests passed
- **1**: One or more tests failed

## Error Handling

### Common Errors

#### Repository Not Found

```
❌ ERROR: TabezaConnect repository not found at: C:\Projects\TabezaConnect
  Please specify correct path using -TabezaConnectPath parameter
```

**Solution**: Specify correct path with `-TabezaConnectPath` parameter

#### Workflow File Missing

```
❌ ERROR: Workflow file not found: .github/workflows/release.yml
```

**Solution**: Ensure workflow file exists in TabezaConnect repository

#### Build Failure

```
❌ ERROR: Failed to build installer
```

**Solution**: Check build logs, ensure all dependencies are installed

#### Validation Failure

```
❌ ERROR: Validation failed
```

**Solution**: Review validation output, fix issues with artifact

#### Tag Already Exists

```
⚠️  WARNING: Tag v1.0.1-test already exists
Delete existing tag and continue? (y/n):
```

**Solution**: Choose 'y' to delete and recreate, or 'n' to cancel

## Manual Steps After Script

After the script completes successfully, you still need to:

### 1. Monitor Workflow Execution

```powershell
# Open in browser
Start-Process "https://github.com/billoapp/TabezaConnect/actions"
```

Watch for:
- ✅ All workflow steps complete
- ✅ No errors in logs
- ✅ Workflow completes in <10 minutes

### 2. Verify Release Creation

```powershell
# Open release page
Start-Process "https://github.com/billoapp/TabezaConnect/releases/tag/v1.0.1-test"
```

Check:
- ✅ Release is marked as "Pre-release"
- ✅ ZIP file is attached
- ✅ Release notes are present
- ✅ Download URLs are correct

### 3. Test Download URL

```powershell
# Download from release
$url = "https://github.com/billoapp/TabezaConnect/releases/download/v1.0.1-test/TabezaConnect-Setup-v1.0.1-test.zip"
Invoke-WebRequest -Uri $url -OutFile "test-download.zip"

# Verify
Test-Path "test-download.zip"
Expand-Archive -Path "test-download.zip" -DestinationPath "test-extract"
Test-Path "test-extract/install.bat"

# Cleanup
Remove-Item "test-download.zip" -Force
Remove-Item "test-extract" -Recurse -Force
```

### 4. Verify /latest/ URL Behavior

```powershell
# Should fail for pre-release
$latestUrl = "https://github.com/billoapp/TabezaConnect/releases/latest/download/TabezaConnect-Setup-v1.0.1-test.zip"
try {
    Invoke-WebRequest -Uri $latestUrl -OutFile "test-latest.zip" -ErrorAction Stop
    Write-Host "❌ FAIL: Pre-release should not be accessible via /latest/"
} catch {
    Write-Host "✅ PASS: Pre-release correctly not accessible via /latest/"
}
```

### 5. Clean Up Test Release

```powershell
# Delete release (via GitHub UI or CLI)
gh release delete v1.0.1-test --yes

# Delete tag
git tag -d v1.0.1-test
git push origin --delete v1.0.1-test
```

## Integration with Task 4.1

This script automates the first 3 phases of task 4.1:

- ✅ **Phase 1**: Pre-flight checks
- ✅ **Phase 2**: Local build test
- ✅ **Phase 3**: Artifact validation
- ⏭️ **Phase 4**: Tag creation (with confirmation)
- 📋 **Manual**: Workflow monitoring
- 📋 **Manual**: Release verification
- 📋 **Manual**: Download URL testing
- 📋 **Manual**: Cleanup

## Troubleshooting

### Script Hangs During Build

**Cause**: npm install or build process is stuck

**Solution**:
1. Press Ctrl+C to cancel
2. Clear npm cache: `npm cache clean --force`
3. Run script again

### Permission Denied Error

**Cause**: Script execution policy

**Solution**:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Git Push Fails

**Cause**: No write access to repository

**Solution**:
1. Verify you have write access to TabezaConnect
2. Check GitHub authentication: `git config --list`
3. Re-authenticate if needed

## Best Practices

1. **Always run on main branch**: Ensure you're on main before testing
2. **Clean working directory**: Commit or stash changes before testing
3. **Use test versions**: Always use `-test` suffix for test releases
4. **Monitor workflow**: Watch GitHub Actions after pushing tag
5. **Clean up**: Always delete test releases and tags after verification
6. **Document issues**: Note any problems encountered during testing

## See Also

- **Detailed Guide**: `END-TO-END-TEST-GUIDE.md`
- **Quick Checklist**: `QUICK-TEST-CHECKLIST.md`
- **Requirements**: `requirements.md`
- **Design**: `design.md`
- **Workflow**: `.github/workflows/release.yml`
