# Check for Multiple TabezaConnect Installations
# This script identifies all TabezaConnect installations and running instances

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TabezaConnect Installation Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check running processes
Write-Host "[1/5] Checking running processes..." -ForegroundColor Yellow
$processes = Get-Process -Name "TabezaConnect" -ErrorAction SilentlyContinue
if ($processes) {
    Write-Host "  ⚠ Found $($processes.Count) running instance(s):" -ForegroundColor Red
    foreach ($proc in $processes) {
        Write-Host "    PID: $($proc.Id) | Path: $($proc.Path)" -ForegroundColor White
    }
} else {
    Write-Host "  ✓ No running processes" -ForegroundColor Green
}
Write-Host ""

# 2. Check Windows Service
Write-Host "[2/5] Checking Windows Service..." -ForegroundColor Yellow
$service = Get-Service -Name "TabezaConnect" -ErrorAction SilentlyContinue
if ($service) {
    Write-Host "  ✓ Service found: $($service.Status)" -ForegroundColor Green
    $servicePath = (Get-WmiObject Win32_Service -Filter "Name='TabezaConnect'").PathName
    Write-Host "    Path: $servicePath" -ForegroundColor White
} else {
    Write-Host "  ℹ No service registered" -ForegroundColor Gray
}
Write-Host ""

# 3. Check registry installations
Write-Host "[3/5] Checking registry..." -ForegroundColor Yellow
$regPaths = @(
    "HKLM:\SOFTWARE\Tabeza\Connect",
    "HKLM:\SOFTWARE\WOW6432Node\Tabeza\Connect",
    "HKCU:\SOFTWARE\Tabeza\Connect"
)
$foundReg = $false
foreach ($regPath in $regPaths) {
    if (Test-Path $regPath) {
        $foundReg = $true
        Write-Host "  ✓ Found: $regPath" -ForegroundColor Green
        $installPath = (Get-ItemProperty -Path $regPath -Name "InstallPath" -ErrorAction SilentlyContinue).InstallPath
        if ($installPath) {
            Write-Host "    Install Path: $installPath" -ForegroundColor White
        }
    }
}
if (-not $foundReg) {
    Write-Host "  ℹ No registry entries found" -ForegroundColor Gray
}
Write-Host ""

# 4. Check common installation directories
Write-Host "[4/5] Checking installation directories..." -ForegroundColor Yellow
$installDirs = @(
    "C:\Program Files\TabezaConnect",
    "C:\Program Files (x86)\TabezaConnect",
    "$env:LOCALAPPDATA\Programs\TabezaConnect",
    "C:\Projects\tabeza-connect\dist\win-ia32-unpacked",
    "C:\Projects\tabeza-connect\dist\win-unpacked"
)
$foundDirs = @()
foreach ($dir in $installDirs) {
    if (Test-Path $dir) {
        $exePath = Join-Path $dir "TabezaConnect.exe"
        if (Test-Path $exePath) {
            $foundDirs += $dir
            Write-Host "  ✓ Found: $dir" -ForegroundColor Green
            $fileInfo = Get-Item $exePath
            Write-Host "    Version: $($fileInfo.VersionInfo.FileVersion)" -ForegroundColor White
            Write-Host "    Modified: $($fileInfo.LastWriteTime)" -ForegroundColor White
        }
    }
}
if ($foundDirs.Count -eq 0) {
    Write-Host "  ℹ No installations found in common directories" -ForegroundColor Gray
}
Write-Host ""

# 5. Check queue directory
Write-Host "[5/5] Checking queue status..." -ForegroundColor Yellow
$queuePath = "C:\ProgramData\Tabeza\queue\pending"
if (Test-Path $queuePath) {
    $pendingFiles = Get-ChildItem -Path $queuePath -Filter "*.json" -ErrorAction SilentlyContinue
    if ($pendingFiles) {
        Write-Host "  ⚠ Found $($pendingFiles.Count) pending receipt(s) in queue" -ForegroundColor Yellow
    } else {
        Write-Host "  ✓ Queue is empty" -ForegroundColor Green
    }
} else {
    Write-Host "  ℹ Queue directory not found" -ForegroundColor Gray
}
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($processes -and $processes.Count -gt 1) {
    Write-Host "⚠ ISSUE DETECTED: Multiple instances running!" -ForegroundColor Red
    Write-Host ""
    Write-Host "This causes:" -ForegroundColor Yellow
    Write-Host "  • Duplicate API requests" -ForegroundColor White
    Write-Host "  • PowerShell windows opening repeatedly" -ForegroundColor White
    Write-Host "  • Wasted Supabase resources" -ForegroundColor White
    Write-Host ""
    Write-Host "Solution:" -ForegroundColor Green
    Write-Host "  1. Run: cleanup-and-restart.bat (as Administrator)" -ForegroundColor White
    Write-Host "  2. Uninstall development versions" -ForegroundColor White
    Write-Host "  3. Keep only ONE production installation" -ForegroundColor White
} elseif ($foundDirs.Count -gt 1) {
    Write-Host "⚠ WARNING: Multiple installations detected!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Found installations:" -ForegroundColor White
    foreach ($dir in $foundDirs) {
        Write-Host "  • $dir" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "Recommendation:" -ForegroundColor Green
    Write-Host "  • Keep only the production installation" -ForegroundColor White
    Write-Host "  • Remove development builds" -ForegroundColor White
} else {
    Write-Host "✓ System looks clean" -ForegroundColor Green
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
