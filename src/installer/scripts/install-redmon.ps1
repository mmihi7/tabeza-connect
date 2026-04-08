# Install Redmon Port Monitor
# Installs Redmon silently during Tabeza Connect installation
# v1.7.0 - Redmon-based receipt capture implementation

param(
    [string]$RedmonPath = "C:\Program Files\TabezaConnect\redmon19",
    [switch]$Detailed
)

Write-Host "Installing Redmon Port Monitor..." -ForegroundColor Cyan
Write-Host ""

# Detect Windows architecture
$is64Bit = [Environment]::Is64BitOperatingSystem

if ($is64Bit) {
    Write-Host "✅ Detected: 64-bit Windows" -ForegroundColor Green
    $setupExe = "setup64.exe"
} else {
    Write-Host "✅ Detected: 32-bit Windows" -ForegroundColor Green
    $setupExe = "setup.exe"
}

# Verify Redmon installer exists
$installerPath = Join-Path $RedmonPath $setupExe
if (-not (Test-Path $installerPath)) {
    Write-Host "❌ Redmon installer not found: $installerPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "Expected location: $RedmonPath" -ForegroundColor Yellow
    Write-Host "Please ensure Redmon files are included in the installer package." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Found Redmon installer: $setupExe" -ForegroundColor Green

# Check if Redmon is already installed
Write-Host ""
Write-Host "Checking for existing Redmon installation..." -ForegroundColor Cyan

$redmonInstalled = $false
try {
    # Check registry for Redmon installation
    $redmonRegPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Print\Monitors\Redirected Port"
    if (Test-Path $redmonRegPath) {
        Write-Host "✅ Redmon is already installed" -ForegroundColor Green
        $redmonInstalled = $true
        
        if ($Detailed) {
            $driverPath = Get-ItemProperty -Path $redmonRegPath -Name "Driver" -ErrorAction SilentlyContinue
            if ($driverPath) {
                Write-Host "   Driver: $($driverPath.Driver)" -ForegroundColor Gray
            }
        }
    }
} catch {
    Write-Host "⚠️  Could not check registry (non-fatal): $_" -ForegroundColor Yellow
}

# Install Redmon if not already installed
if (-not $redmonInstalled) {
    Write-Host ""
    Write-Host "Installing Redmon..." -ForegroundColor Cyan
    
    try {
        # Run Redmon installer with silent flag (/S)
        $process = Start-Process -FilePath $installerPath -ArgumentList "/S" -Wait -PassThru -NoNewWindow
        
        if ($process.ExitCode -eq 0) {
            Write-Host "✅ Redmon installed successfully" -ForegroundColor Green
        } else {
            Write-Host "❌ Redmon installation failed with exit code: $($process.ExitCode)" -ForegroundColor Red
            Write-Host ""
            Write-Host "Troubleshooting:" -ForegroundColor Yellow
            Write-Host "  1. Ensure you have administrator privileges" -ForegroundColor White
            Write-Host "  2. Check Windows Event Viewer for errors" -ForegroundColor White
            Write-Host "  3. Try running the installer manually: $installerPath" -ForegroundColor White
            exit 1
        }
    } catch {
        Write-Host "❌ Failed to run Redmon installer: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Error details: $($_.Exception.Message)" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "Skipping installation (already installed)" -ForegroundColor Gray
}

# Verify Redmon port monitor is registered
Write-Host ""
Write-Host "Verifying Redmon port monitor registration..." -ForegroundColor Cyan

$verificationAttempts = 0
$maxAttempts = 5
$verified = $false

while ($verificationAttempts -lt $maxAttempts -and -not $verified) {
    $verificationAttempts++
    
    try {
        # Check registry for Redmon port monitor
        $redmonRegPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Print\Monitors\Redirected Port"
        if (Test-Path $redmonRegPath) {
            Write-Host "✅ Redmon port monitor is registered" -ForegroundColor Green
            $verified = $true
            
            if ($Detailed) {
                # Display Redmon DLL path
                $driverPath = Get-ItemProperty -Path $redmonRegPath -Name "Driver" -ErrorAction SilentlyContinue
                if ($driverPath) {
                    Write-Host "   DLL: $($driverPath.Driver)" -ForegroundColor Gray
                }
                
                # Check if DLL file exists
                if ($driverPath -and (Test-Path $driverPath.Driver)) {
                    $dllVersion = (Get-Item $driverPath.Driver).VersionInfo.FileVersion
                    Write-Host "   Version: $dllVersion" -ForegroundColor Gray
                }
            }
        } else {
            if ($verificationAttempts -lt $maxAttempts) {
                Write-Host "⏳ Waiting for registration... (attempt $verificationAttempts/$maxAttempts)" -ForegroundColor Yellow
                Start-Sleep -Seconds 2
            }
        }
    } catch {
        Write-Host "⚠️  Verification check failed: $_" -ForegroundColor Yellow
        if ($verificationAttempts -lt $maxAttempts) {
            Start-Sleep -Seconds 2
        }
    }
}

if (-not $verified) {
    Write-Host "❌ Redmon port monitor registration verification failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Redmon may not be properly installed." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Restart the Print Spooler service: Restart-Service Spooler" -ForegroundColor White
    Write-Host "  2. Check registry path: HKLM:\SYSTEM\CurrentControlSet\Control\Print\Monitors\Redirected Port" -ForegroundColor White
    Write-Host "  3. Try manual installation: $installerPath" -ForegroundColor White
    Write-Host "  4. Check Windows Event Viewer for errors" -ForegroundColor White
    exit 1
}

# Check Print Spooler service
Write-Host ""
Write-Host "Checking Print Spooler service..." -ForegroundColor Cyan

try {
    $spooler = Get-Service -Name "Spooler" -ErrorAction Stop
    
    if ($spooler.Status -eq 'Running') {
        Write-Host "✅ Print Spooler is running" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Print Spooler is not running (Status: $($spooler.Status))" -ForegroundColor Yellow
        Write-Host "   Attempting to start Print Spooler..." -ForegroundColor Cyan
        
        try {
            Start-Service -Name "Spooler" -ErrorAction Stop
            Write-Host "✅ Print Spooler started successfully" -ForegroundColor Green
        } catch {
            Write-Host "❌ Failed to start Print Spooler: $_" -ForegroundColor Red
            Write-Host "   Please start the Print Spooler service manually." -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "❌ Could not check Print Spooler service: $_" -ForegroundColor Red
}

# Summary
Write-Host ""
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ Redmon installation completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Redmon Port Monitor is ready for use." -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Create 'Tabeza Agent' with Generic/Text Only driver" -ForegroundColor White
Write-Host "  2. Configure Redmon port to pipe to capture script" -ForegroundColor White
Write-Host "  3. Test print job capture" -ForegroundColor White
Write-Host ""

# Write installation status
$writeStatusScript = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "write-status.ps1"
if (Test-Path $writeStatusScript) {
    try {
        & $writeStatusScript -StepNumber 2 -StepName "Redmon installed" -Success $true -Details "Architecture: $(if ($is64Bit) { '64-bit' } else { '32-bit' })"
    } catch {
        Write-Host "⚠️  Could not write status (non-fatal): $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "INFO: write-status.ps1 not found (skipping status update)" -ForegroundColor Gray
}

exit 0
