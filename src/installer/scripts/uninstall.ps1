# Tabeza Connect Complete Uninstall Script
# Removes all components and optionally cleans up data

param(
    [string]$InstallPath = "C:\Program Files\Tabeza",
    [string]$WatchFolder = "C:\TabezaPrints",
    [switch]$KeepData,
    [switch]$Silent
)

Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Tabeza Connect - Uninstaller          ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ This script must be run as Administrator" -ForegroundColor Red
    Write-Host ""
    Write-Host "Right-click PowerShell and select 'Run as administrator'" -ForegroundColor Yellow
    exit 1
}

if (-not $Silent) {
    Write-Host "This will remove Tabeza Connect from your system." -ForegroundColor Yellow
    Write-Host ""
    $confirm = Read-Host "Continue with uninstall? (y/n)"
    
    if ($confirm -ne 'y') {
        Write-Host "Uninstall cancelled" -ForegroundColor Gray
        exit 0
    }
    Write-Host ""
}

$errors = @()

# Step 1: Stop and remove Windows service
Write-Host "Step 1: Removing Windows service..." -ForegroundColor Cyan
$service = Get-Service -Name "TabezaConnect" -ErrorAction SilentlyContinue

if ($service) {
    try {
        if ($service.Status -eq 'Running') {
            Write-Host "  Stopping service..." -ForegroundColor Gray
            Stop-Service -Name "TabezaConnect" -Force -ErrorAction Stop
            Start-Sleep -Seconds 2
        }
        
        Write-Host "  Deleting service..." -ForegroundColor Gray
        sc.exe delete TabezaConnect | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ Service removed" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  Service deletion returned code: $LASTEXITCODE" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  ⚠️  Error removing service: $_" -ForegroundColor Yellow
        $errors += "Service removal: $_"
    }
} else {
    Write-Host "  ✅ Service not found (already removed)" -ForegroundColor Green
}

# Step 2: Remove virtual printer
Write-Host ""
Write-Host "Step 2: Removing virtual printer..." -ForegroundColor Cyan
$printer = Get-Printer -Name "Tabeza Receipt Printer" -ErrorAction SilentlyContinue

if ($printer) {
    try {
        Remove-Printer -Name "Tabeza Receipt Printer" -ErrorAction Stop
        Write-Host "  ✅ Printer removed" -ForegroundColor Green
    } catch {
        Write-Host "  ⚠️  Error removing printer: $_" -ForegroundColor Yellow
        $errors += "Printer removal: $_"
    }
} else {
    Write-Host "  ✅ Printer not found (already removed)" -ForegroundColor Green
}

# Step 3: Remove installation directory
Write-Host ""
Write-Host "Step 3: Removing installation files..." -ForegroundColor Cyan

if (Test-Path $InstallPath) {
    try {
        # Kill any running Node.js processes from this installation
        $nodePath = Join-Path $InstallPath "nodejs\node.exe"
        if (Test-Path $nodePath) {
            $processes = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
                $_.Path -like "$InstallPath*"
            }
            
            if ($processes) {
                Write-Host "  Stopping Node.js processes..." -ForegroundColor Gray
                $processes | Stop-Process -Force -ErrorAction SilentlyContinue
                Start-Sleep -Seconds 2
            }
        }
        
        Write-Host "  Removing: $InstallPath" -ForegroundColor Gray
        Remove-Item -Path $InstallPath -Recurse -Force -ErrorAction Stop
        Write-Host "  ✅ Installation files removed" -ForegroundColor Green
    } catch {
        Write-Host "  ⚠️  Error removing installation: $_" -ForegroundColor Yellow
        $errors += "Installation removal: $_"
    }
} else {
    Write-Host "  ✅ Installation directory not found (already removed)" -ForegroundColor Green
}

# Step 4: Remove registry entries
Write-Host ""
Write-Host "Step 4: Removing registry entries..." -ForegroundColor Cyan
$regPath = "HKLM:\Software\Tabeza"

if (Test-Path $regPath) {
    try {
        Remove-Item -Path $regPath -Recurse -Force -ErrorAction Stop
        Write-Host "  ✅ Registry entries removed" -ForegroundColor Green
    } catch {
        Write-Host "  ⚠️  Error removing registry: $_" -ForegroundColor Yellow
        $errors += "Registry removal: $_"
    }
} else {
    Write-Host "  ✅ Registry entries not found (already removed)" -ForegroundColor Green
}

# Step 5: Handle data directories
Write-Host ""
Write-Host "Step 5: Handling data directories..." -ForegroundColor Cyan

if ($KeepData) {
    Write-Host "  ℹ️  Keeping data directories (--KeepData specified)" -ForegroundColor Cyan
    Write-Host "  Watch folder: $WatchFolder" -ForegroundColor Gray
    Write-Host "  Logs: $env:APPDATA\Tabeza\logs" -ForegroundColor Gray
} else {
    if (-not $Silent) {
        Write-Host ""
        Write-Host "  Do you want to delete receipt data and logs?" -ForegroundColor Yellow
        Write-Host "  This includes:" -ForegroundColor Gray
        Write-Host "    - Watch folder: $WatchFolder" -ForegroundColor Gray
        Write-Host "    - Logs: $env:APPDATA\Tabeza\logs" -ForegroundColor Gray
        Write-Host ""
        $deleteData = Read-Host "  Delete data? (y/n)"
        Write-Host ""
    } else {
        $deleteData = 'y'
    }
    
    if ($deleteData -eq 'y') {
        # Remove watch folder
        if (Test-Path $WatchFolder) {
            try {
                Remove-Item -Path $WatchFolder -Recurse -Force -ErrorAction Stop
                Write-Host "  ✅ Watch folder removed: $WatchFolder" -ForegroundColor Green
            } catch {
                Write-Host "  ⚠️  Error removing watch folder: $_" -ForegroundColor Yellow
                $errors += "Watch folder removal: $_"
            }
        }
        
        # Remove log directory
        $logPath = Join-Path $env:APPDATA "Tabeza"
        if (Test-Path $logPath) {
            try {
                Remove-Item -Path $logPath -Recurse -Force -ErrorAction Stop
                Write-Host "  ✅ Log directory removed: $logPath" -ForegroundColor Green
            } catch {
                Write-Host "  ⚠️  Error removing logs: $_" -ForegroundColor Yellow
                $errors += "Log removal: $_"
            }
        }
    } else {
        Write-Host "  ℹ️  Data directories preserved" -ForegroundColor Cyan
        Write-Host "  You can manually delete them later if needed" -ForegroundColor Gray
    }
}

# Step 6: Clean up printer registry settings
Write-Host ""
Write-Host "Step 6: Cleaning printer registry..." -ForegroundColor Cyan
$printerRegPath = "HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Devices"

if (Test-Path $printerRegPath) {
    try {
        $printerReg = Get-ItemProperty -Path $printerRegPath -Name "Tabeza Receipt Printer" -ErrorAction SilentlyContinue
        if ($printerReg) {
            Remove-ItemProperty -Path $printerRegPath -Name "Tabeza Receipt Printer" -ErrorAction Stop
            Write-Host "  ✅ Printer registry cleaned" -ForegroundColor Green
        } else {
            Write-Host "  ✅ No printer registry entries found" -ForegroundColor Green
        }
    } catch {
        Write-Host "  ⚠️  Error cleaning printer registry: $_" -ForegroundColor Yellow
    }
}

# Summary
Write-Host ""
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan

if ($errors.Count -eq 0) {
    Write-Host "✅ Uninstall completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Tabeza Connect has been removed from your system." -ForegroundColor White
    
    if ($KeepData -or ($deleteData -ne 'y')) {
        Write-Host ""
        Write-Host "Data directories were preserved:" -ForegroundColor Cyan
        if (Test-Path $WatchFolder) {
            Write-Host "  - $WatchFolder" -ForegroundColor White
        }
        $logPath = Join-Path $env:APPDATA "Tabeza"
        if (Test-Path $logPath) {
            Write-Host "  - $logPath" -ForegroundColor White
        }
        Write-Host ""
        Write-Host "You can manually delete these if no longer needed." -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "Thank you for using Tabeza Connect!" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "⚠️  Uninstall completed with warnings" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "The following errors occurred:" -ForegroundColor Yellow
    foreach ($error in $errors) {
        Write-Host "  - $error" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "Most components were removed successfully." -ForegroundColor White
    Write-Host "You may need to manually clean up remaining items." -ForegroundColor Gray
    Write-Host ""
    Write-Host "If you need assistance, contact support@tabeza.co.ke" -ForegroundColor Gray
    exit 1
}
