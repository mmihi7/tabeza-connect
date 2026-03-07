# rollback-clawpdf.ps1
# Rolls back clawPDF installation if Tabeza Connect installation fails
# This script is called by the Inno Setup installer on failure

param(
    [string]$LogPath = "$env:TEMP\TabezaConnect-clawPDF-rollback.log"
)

$ErrorActionPreference = "Continue"

Write-Host "=== Tabeza Connect - clawPDF Rollback ===" -ForegroundColor Yellow
Write-Host "Log: $LogPath"
Write-Host ""

# Start logging
Start-Transcript -Path $LogPath -Append

try {
    # Check if clawPDF is installed
    $clawPDFInstalled = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*" |
        Where-Object { $_.DisplayName -like "*clawPDF*" }
    
    if (-not $clawPDFInstalled) {
        Write-Host "clawPDF is not installed, nothing to rollback" -ForegroundColor Green
        Stop-Transcript
        exit 0
    }
    
    Write-Host "Found clawPDF installation: $($clawPDFInstalled.DisplayName)" -ForegroundColor Yellow
    Write-Host "Version: $($clawPDFInstalled.DisplayVersion)" -ForegroundColor Yellow
    
    # Get the uninstall string
    $uninstallString = $clawPDFInstalled.UninstallString
    
    if ($uninstallString -match "msiexec") {
        # Extract product code from uninstall string
        if ($uninstallString -match "\{[A-F0-9-]+\}") {
            $productCode = $matches[0]
            Write-Host "Product Code: $productCode" -ForegroundColor Yellow
            
            Write-Host "Uninstalling clawPDF..." -ForegroundColor Yellow
            
            # Uninstall silently
            $arguments = @(
                "/x"
                $productCode
                "/quiet"
                "/norestart"
                "/l*v"
                "`"$LogPath`""
            )
            
            $process = Start-Process -FilePath "msiexec.exe" -ArgumentList $arguments -Wait -PassThru -NoNewWindow
            
            if ($process.ExitCode -eq 0 -or $process.ExitCode -eq 3010) {
                Write-Host "clawPDF uninstalled successfully" -ForegroundColor Green
                
                # Verify uninstallation
                $stillInstalled = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*" |
                    Where-Object { $_.DisplayName -like "*clawPDF*" }
                
                if (-not $stillInstalled) {
                    Write-Host "Verified: clawPDF has been removed" -ForegroundColor Green
                } else {
                    Write-Host "WARNING: clawPDF may still be partially installed" -ForegroundColor Yellow
                }
                
                Stop-Transcript
                exit 0
            } else {
                Write-Host "ERROR: clawPDF uninstallation failed with exit code: $($process.ExitCode)" -ForegroundColor Red
                Stop-Transcript
                exit $process.ExitCode
            }
        } else {
            Write-Host "ERROR: Could not extract product code from uninstall string" -ForegroundColor Red
            Stop-Transcript
            exit 1
        }
    } else {
        Write-Host "ERROR: Uninstall string does not use msiexec: $uninstallString" -ForegroundColor Red
        Stop-Transcript
        exit 1
    }
    
} catch {
    Write-Host "ERROR: Exception during clawPDF rollback" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Stop-Transcript
    exit 1
}
