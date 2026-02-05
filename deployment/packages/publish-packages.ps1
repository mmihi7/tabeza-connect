# TABEZA Package Publishing Script (PowerShell)
# Publishes shared packages to npm registry in correct dependency order

param(
    [switch]$DryRun = $false,
    [string]$Registry = "https://registry.npmjs.org/"
)

# Configuration
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Resolve-Path "$ScriptDir\..\.."
$ConfigFile = "$ScriptDir\npm-publishing-config.json"

# Logging functions
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check if npm is available
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm is not installed or not in PATH"
    exit 1
}

# Check if npm is logged in
try {
    $null = npm whoami 2>$null
} catch {
    Write-Error "Not logged in to npm. Please run 'npm login' first."
    exit 1
}

# Read configuration
if (-not (Test-Path $ConfigFile)) {
    Write-Error "Configuration file not found: $ConfigFile"
    exit 1
}

$Config = Get-Content $ConfigFile | ConvertFrom-Json
$PublishOrder = $Config.publishOrder

Write-Info "Starting package publishing process..."
Write-Info "Publish order: $($PublishOrder -join ', ')"

if ($DryRun) {
    Write-Warning "DRY RUN MODE - No packages will actually be published"
}

# Change to root directory
Set-Location $RootDir

# Install dependencies
Write-Info "Installing dependencies..."
& pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to install dependencies"
    exit 1
}

# Build all packages first
Write-Info "Building all packages..."
& pnpm run build:packages
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to build packages"
    exit 1
}

# Function to publish a single package
function Publish-Package {
    param([string]$PackageName)
    
    $PackageDir = "packages\$($PackageName -replace '@tabeza/', '')"
    
    Write-Info "Processing $PackageName..."
    
    if (-not (Test-Path $PackageDir)) {
        Write-Error "Package directory $PackageDir not found"
        return $false
    }
    
    Push-Location $PackageDir
    
    try {
        # Check if package is publishable
        $PackageConfig = $Config.packages.$PackageName
        if (-not $PackageConfig.publishable) {
            Write-Warning "Package $PackageName is not marked as publishable, skipping..."
            return $true
        }
        
        # Run pre-publish checks
        Write-Info "Running pre-publish checks for $PackageName..."
        
        # Build
        Write-Info "Building $PackageName..."
        & npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Build failed for $PackageName"
            return $false
        }
        
        # Test
        Write-Info "Testing $PackageName..."
        & npm test
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Tests failed for $PackageName"
            return $false
        }
        
        # Lint (if available)
        $PackageJson = Get-Content "package.json" | ConvertFrom-Json
        if ($PackageJson.scripts.lint) {
            Write-Info "Linting $PackageName..."
            & npm run lint
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Linting failed for $PackageName"
                return $false
            }
        }
        
        # Check if package version already exists
        $CurrentVersion = $PackageJson.version
        try {
            $null = npm view "$PackageName@$CurrentVersion" version 2>$null
            Write-Warning "Version $CurrentVersion of $PackageName already exists on npm, skipping..."
            return $true
        } catch {
            # Version doesn't exist, continue with publish
        }
        
        # Publish package
        if ($DryRun) {
            Write-Info "DRY RUN: Would publish $PackageName@$CurrentVersion"
            return $true
        } else {
            Write-Info "Publishing $PackageName@$CurrentVersion..."
            & npm publish --access public --registry $Registry
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Successfully published $PackageName@$CurrentVersion"
                return $true
            } else {
                Write-Error "Failed to publish $PackageName"
                return $false
            }
        }
    }
    finally {
        Pop-Location
    }
}

# Publish packages in order
$FailedPackages = @()
foreach ($Package in $PublishOrder) {
    if (-not (Publish-Package $Package)) {
        $FailedPackages += $Package
    }
    
    # Wait a bit between publishes to avoid rate limiting
    if (-not $DryRun) {
        Start-Sleep -Seconds 2
    }
}

# Report results
if ($FailedPackages.Count -eq 0) {
    Write-Success "All packages processed successfully!"
} else {
    Write-Error "Failed to publish the following packages:"
    foreach ($Package in $FailedPackages) {
        Write-Error "  - $Package"
    }
    exit 1
}

Write-Info "Package publishing completed successfully!"