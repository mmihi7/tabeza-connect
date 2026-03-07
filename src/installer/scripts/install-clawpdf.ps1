# install-clawpdf.ps1
# Silently installs clawPDF 0.9.3 for Tabeza Connect
# This script is called by the Inno Setup installer

param(
    [string]$InstallerPath = "$PSScriptRoot\..\clawPDF-0.9.3.msi",
    [string]$LogPath = "$env:TEMP\TabezaConnect-clawPDF-install.log"
)

$ErrorActionPreference = "Stop"

Write-Host "=== Tabeza Connect - clawPDF Installation ===" -ForegroundColor Cyan
Write-Host "Installer: $InstallerPath"
Write-Host "Log: $LogPath"
Write-Host ""

# Check if installer exists
if (-not (Test-Path $InstallerPath)) {
    Write-Host "ERROR: clawPDF installer not found at: $InstallerPath" -ForegroundColor Red
    exit 1
}

# Check if clawPDF is already installed
$clawPDFInstalled = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*" |
    Where-Object { $_.DisplayName -like "*clawPDF*" }

if ($clawPDFInstalled) {
    Write-Host "clawPDF is already installed (Version: $($clawPDFInstalled.DisplayVersion))" -ForegroundColor Yellow
    Write-Host "Skipping installation..." -ForegroundColor Yellow
    exit 0
}

try {
    Write-Host "Installing clawPDF silently..." -ForegroundColor Green
    
    # Install clawPDF silently
    # /i = install
    # /quiet = no user interaction
    # /norestart = do not restart computer
    # /l*v = verbose logging
    $arguments = @(
        "/i"
        "`"$InstallerPath`""
        "/quiet"
        "/norestart"
        "/l*v"
        "`"$LogPath`""
    )
    
    $process = Start-Process -FilePath "msiexec.exe" -ArgumentList $arguments -Wait -PassThru -NoNewWindow
    
    if ($process.ExitCode -eq 0) {
        Write-Host "clawPDF installed successfully!" -ForegroundColor Green
        
        # Verify installation
        $clawPDFInstalled = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*" |
            Where-Object { $_.DisplayName -like "*clawPDF*" }
        
        if ($clawPDFInstalled) {
            Write-Host "Verified: clawPDF version $($clawPDFInstalled.DisplayVersion) is installed" -ForegroundColor Green
            exit 0
        } else {
            Write-Host "WARNING: Installation reported success but clawPDF not found in registry" -ForegroundColor Yellow
            exit 0
        }
    } elseif ($process.ExitCode -eq 3010) {
        Write-Host "clawPDF installed successfully (reboot required)" -ForegroundColor Yellow
        exit 0
    } else {
        Write-Host "ERROR: clawPDF installation failed with exit code: $($process.ExitCode)" -ForegroundColor Red
        Write-Host "Check log file: $LogPath" -ForegroundColor Red
        exit $process.ExitCode
    }
    
} catch {
    Write-Host "ERROR: Exception during clawPDF installation" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "Check log file: $LogPath" -ForegroundColor Red
    exit 1
}
