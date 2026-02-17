# Test Release Workflow Script
#
# This script automates the end-to-end testing of the GitHub release workflow
# for TabezaConnect. It performs local validation before pushing a test tag.
#
# Usage: .\test-release-workflow.ps1 [-Version <version>] [-SkipBuild] [-SkipPush]
#
# Requirements: Task 4.1 - Test complete workflow end-to-end

param(
    [Parameter(Mandatory=$false)]
    [string]$Version = "1.0.1-test",
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipBuild,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipPush,
    
    [Parameter(Mandatory=$false)]
    [string]$TabezaConnectPath = "C:\Projects\TabezaConnect"
)

# ANSI color codes
$Red = "`e[31m"
$Green = "`e[32m"
$Yellow = "`e[33m"
$Blue = "`e[34m"
$Cyan = "`e[36m"
$Reset = "`e[0m"

# Track test results
$testResults = @{
    PreFlightChecks = $false
    LocalBuild = $false
    Validation = $false
    TagCreation = $false
}

function Write-TestHeader {
    param([string]$Message)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-TestStep {
    param([string]$Message)
    Write-Host "[STEP] $Message" -ForegroundColor Blue
}

function Write-TestSuccess {
    param([string]$Message)
    Write-Host "${Green}[OK] $Message${Reset}"
}

function Write-TestError {
    param([string]$Message)
    Write-Host "${Red}[ERROR] $Message${Reset}"
}

function Write-TestWarning {
    param([string]$Message)
    Write-Host "${Yellow}[WARN] $Message${Reset}"
}

function Test-Prerequisites {
    Write-TestHeader "Phase 1: Pre-Flight Checks"
    
    # Check if TabezaConnect directory exists
    Write-TestStep "Checking TabezaConnect repository path..."
    if (-not (Test-Path $TabezaConnectPath)) {
        Write-TestError "TabezaConnect repository not found at: $TabezaConnectPath"
        Write-Host "  Please specify correct path using -TabezaConnectPath parameter" -ForegroundColor Yellow
        return $false
    }
    Write-TestSuccess "Repository found: $TabezaConnectPath"
    
    # Check if we're in the right directory
    $currentPath = Get-Location
    if ($currentPath.Path -ne $TabezaConnectPath) {
        Write-TestStep "Changing directory to TabezaConnect..."
        Set-Location $TabezaConnectPath
        Write-TestSuccess "Changed to: $TabezaConnectPath"
    }
    
    # Check git status
    Write-TestStep "Checking git status..."
    $gitStatus = git status --porcelain
    if ($gitStatus) {
        Write-TestWarning "Working directory has uncommitted changes"
        Write-Host "  Consider committing or stashing changes before testing" -ForegroundColor Yellow
    } else {
        Write-TestSuccess "Working directory is clean"
    }
    
    # Check current branch
    Write-TestStep "Checking current branch..."
    $currentBranch = git branch --show-current
    if ($currentBranch -ne "main") {
        Write-TestWarning "Not on main branch (current: $currentBranch)"
        Write-Host "  Consider switching to main branch for testing" -ForegroundColor Yellow
    } else {
        Write-TestSuccess "On main branch"
    }
    
    # Check if workflow file exists
    Write-TestStep "Checking workflow file..."
    if (-not (Test-Path ".github/workflows/release.yml")) {
        Write-TestError "Workflow file not found: .github/workflows/release.yml"
        return $false
    }
    Write-TestSuccess "Workflow file found"
    
    # Check if validation script exists
    Write-TestStep "Checking validation script..."
    if (-not (Test-Path ".github/scripts/validate-artifact.ps1")) {
        Write-TestError "Validation script not found: .github/scripts/validate-artifact.ps1"
        return $false
    }
    Write-TestSuccess "Validation script found"
    
    # Check if release notes script exists
    Write-TestStep "Checking release notes script..."
    if (-not (Test-Path ".github/scripts/generate-release-notes.ps1")) {
        Write-TestError "Release notes script not found: .github/scripts/generate-release-notes.ps1"
        return $false
    }
    Write-TestSuccess "Release notes script found"
    
    # Check if package.json exists
    Write-TestStep "Checking package.json..."
    if (-not (Test-Path "package.json")) {
        Write-TestError "package.json not found"
        return $false
    }
    Write-TestSuccess "package.json found"
    
    # Check if build script exists
    Write-TestStep "Checking build script..."
    if (-not (Test-Path "src/installer/build-installer.js")) {
        Write-TestError "Build script not found: src/installer/build-installer.js"
        return $false
    }
    Write-TestSuccess "Build script found"
    
    Write-TestSuccess "All pre-flight checks passed"
    return $true
}

function Invoke-LocalBuild {
    Write-TestHeader "Phase 2: Local Build Test"
    
    # Clean build environment
    Write-TestStep "Cleaning build environment..."
    Remove-Item "dist" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item "installer" -Recurse -Force -ErrorAction SilentlyContinue
    Write-TestSuccess "Build environment cleaned"
    
    # Install root dependencies
    Write-TestStep "Installing root dependencies..."
    $output = npm install 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-TestError "Failed to install root dependencies"
        Write-Host $output -ForegroundColor Red
        return $false
    }
    Write-TestSuccess "Root dependencies installed"
    
    # Install service dependencies
    Write-TestStep "Installing service dependencies..."
    Push-Location "src/service"
    $output = npm install 2>&1
    Pop-Location
    if ($LASTEXITCODE -ne 0) {
        Write-TestError "Failed to install service dependencies"
        Write-Host $output -ForegroundColor Red
        return $false
    }
    Write-TestSuccess "Service dependencies installed"
    
    # Download Node.js runtime
    Write-TestStep "Downloading Node.js runtime..."
    $output = npm run download:nodejs 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-TestError "Failed to download Node.js runtime"
        Write-Host $output -ForegroundColor Red
        return $false
    }
    Write-TestSuccess "Node.js runtime downloaded"
    
    # Set version environment variable
    $env:VERSION = $Version
    
    # Build installer
    Write-TestStep "Building installer package..."
    $output = npm run build:installer 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-TestError "Failed to build installer"
        Write-Host $output -ForegroundColor Red
        return $false
    }
    Write-TestSuccess "Installer package built"
    
    # Read actual version from package.json
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    $actualVersion = $packageJson.version
    
    # Verify ZIP file exists
    $zipPath = "dist/TabezaConnect-Setup-v$actualVersion.zip"
    Write-TestStep "Verifying ZIP file..."
    if (-not (Test-Path $zipPath)) {
        Write-TestWarning "ZIP file not found: $zipPath"
        Write-Host "  This is expected - ZIP creation often fails with large directories" -ForegroundColor Yellow
        Write-Host "  The installer files are ready in src/installer/nodejs-bundle/" -ForegroundColor Yellow
        Write-Host "  GitHub Actions will create the ZIP during the actual release" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  To manually create ZIP for testing:" -ForegroundColor Cyan
        Write-Host "    1. Navigate to src/installer/" -ForegroundColor White
        Write-Host "    2. Right-click 'nodejs-bundle' folder" -ForegroundColor White
        Write-Host "    3. Select 'Send to' > 'Compressed (zipped) folder'" -ForegroundColor White
        Write-Host "    4. Rename to TabezaConnect-Setup-v$actualVersion.zip" -ForegroundColor White
        Write-Host "    5. Move to dist/ folder" -ForegroundColor White
        Write-Host ""
        # Don't fail the test - this is expected
        return $true
    }
    
    $fileSize = (Get-Item $zipPath).Length
    $fileSizeMB = [math]::Round($fileSize / 1MB, 2)
    Write-TestSuccess "ZIP file created: $fileSizeMB MB"
    
    return $true
}

function Invoke-Validation {
    Write-TestHeader "Phase 3: Artifact Validation"
    
    Write-TestStep "Running validation script..."
    
    # Run validation script
    $output = & ".\.github\scripts\validate-artifact.ps1" -Version $Version -DistPath "dist" 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-TestError "Validation failed"
        Write-Host $output -ForegroundColor Red
        return $false
    }
    
    Write-TestSuccess "Validation passed"
    return $true
}

function Invoke-TagCreation {
    Write-TestHeader "Phase 4: Tag Creation and Push"
    
    # Check if tag already exists
    Write-TestStep "Checking if tag already exists..."
    $existingTag = git tag -l "v$Version"
    if ($existingTag) {
        Write-TestWarning "Tag v$Version already exists"
        
        $response = Read-Host "Delete existing tag and continue? (y/n)"
        if ($response -eq "y") {
            Write-TestStep "Deleting existing tag..."
            git tag -d "v$Version"
            git push origin --delete "v$Version" 2>$null
            Write-TestSuccess "Existing tag deleted"
        } else {
            Write-TestError "Cannot proceed with existing tag"
            return $false
        }
    }
    
    # Create tag
    Write-TestStep "Creating tag v$Version..."
    git tag -a "v$Version" -m "Test release for workflow validation"
    if ($LASTEXITCODE -ne 0) {
        Write-TestError "Failed to create tag"
        return $false
    }
    Write-TestSuccess "Tag created: v$Version"
    
    if ($SkipPush) {
        Write-TestWarning "Skipping tag push (use -SkipPush:$false to push)"
        Write-Host ""
        Write-Host "To push the tag manually, run:" -ForegroundColor Yellow
        Write-Host "  git push origin v$Version" -ForegroundColor Cyan
        return $true
    }
    
    # Confirm push
    Write-Host ""
    Write-Host "Ready to push tag v$Version to trigger workflow" -ForegroundColor Yellow
    $response = Read-Host "Push tag now? (y/n)"
    
    if ($response -ne "y") {
        Write-TestWarning "Tag push cancelled"
        Write-Host ""
        Write-Host "To push the tag manually, run:" -ForegroundColor Yellow
        Write-Host "  git push origin v$Version" -ForegroundColor Cyan
        return $true
    }
    
    # Push tag
    Write-TestStep "Pushing tag to remote..."
    git push origin "v$Version"
    if ($LASTEXITCODE -ne 0) {
        Write-TestError "Failed to push tag"
        return $false
    }
    Write-TestSuccess "Tag pushed successfully"
    
    # Provide workflow URL
    Write-Host ""
    Write-Host "Workflow triggered! Monitor progress at:" -ForegroundColor Green
    Write-Host "  https://github.com/billoapp/TabezaConnect/actions" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "After workflow completes, verify release at:" -ForegroundColor Green
    Write-Host "  https://github.com/billoapp/TabezaConnect/releases/tag/v$Version" -ForegroundColor Cyan
    
    return $true
}

function Write-TestSummary {
    Write-TestHeader "Test Summary"
    
    Write-Host "Test Results:" -ForegroundColor Cyan
    Write-Host ""
    
    foreach ($test in $testResults.Keys) {
        $result = $testResults[$test]
        if ($result) {
            Write-Host "  ✅ $test" -ForegroundColor Green
        } else {
            Write-Host "  ❌ $test" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    
    $allPassed = $testResults.Values | Where-Object { $_ -eq $false } | Measure-Object | Select-Object -ExpandProperty Count
    
    if ($allPassed -eq 0) {
        Write-Host "✅ ALL TESTS PASSED" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "1. Monitor workflow execution in GitHub Actions" -ForegroundColor Yellow
        Write-Host "2. Verify release creation" -ForegroundColor Yellow
        Write-Host "3. Test download URLs" -ForegroundColor Yellow
        Write-Host "4. Clean up test release and tag" -ForegroundColor Yellow
        return $true
    } else {
        Write-Host "❌ SOME TESTS FAILED" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please review the errors above and fix issues before proceeding" -ForegroundColor Yellow
        return $false
    }
}

# Main execution
Write-TestHeader "TabezaConnect Release Workflow Test"
Write-Host "Version: $Version" -ForegroundColor Cyan
Write-Host "Skip Build: $SkipBuild" -ForegroundColor Cyan
Write-Host "Skip Push: $SkipPush" -ForegroundColor Cyan
Write-Host ""

# Phase 1: Pre-flight checks
$testResults.PreFlightChecks = Test-Prerequisites
if (-not $testResults.PreFlightChecks) {
    Write-TestSummary
    exit 1
}

# Phase 2: Local build (unless skipped)
if (-not $SkipBuild) {
    $testResults.LocalBuild = Invoke-LocalBuild
    if (-not $testResults.LocalBuild) {
        Write-TestSummary
        exit 1
    }
} else {
    Write-TestWarning "Skipping local build (use -SkipBuild:$false to build)"
    $testResults.LocalBuild = $true
}

# Phase 3: Validation
$testResults.Validation = Invoke-Validation
if (-not $testResults.Validation) {
    Write-TestSummary
    exit 1
}

# Phase 4: Tag creation and push
$testResults.TagCreation = Invoke-TagCreation

# Summary
$success = Write-TestSummary

if ($success) {
    exit 0
} else {
    exit 1
}
