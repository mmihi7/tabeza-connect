# Diagnose Print Spooler for TabezaConnect
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Print Spooler Diagnostic Tool" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($isAdmin) {
    Write-Host "[OK] Running as Administrator" -ForegroundColor Green
} else {
    Write-Host "[WARNING] Not running as Administrator - may have permission issues" -ForegroundColor Yellow
}
Write-Host ""

# Check spooler service
Write-Host "Checking Print Spooler service..." -ForegroundColor Cyan
$spoolerService = Get-Service -Name Spooler
Write-Host "  Status: $($spoolerService.Status)" -ForegroundColor $(if ($spoolerService.Status -eq 'Running') { 'Green' } else { 'Red' })
Write-Host ""

# Check spooler directory
$spoolerPath = "C:\Windows\System32\spool\PRINTERS"
Write-Host "Checking spooler directory: $spoolerPath" -ForegroundColor Cyan

if (Test-Path $spoolerPath) {
    Write-Host "  [OK] Directory exists" -ForegroundColor Green
    
    # Check permissions
    try {
        $acl = Get-Acl $spoolerPath
        Write-Host "  [OK] Can read permissions" -ForegroundColor Green
        
        # Try to list files
        $files = Get-ChildItem $spoolerPath -ErrorAction Stop
        Write-Host "  [OK] Can list files ($($files.Count) files)" -ForegroundColor Green
        
        if ($files.Count -gt 0) {
            Write-Host ""
            Write-Host "Current files in spooler:" -ForegroundColor Cyan
            $files | ForEach-Object {
                Write-Host "    $($_.Name) - $($_.Extension) - $($_.Length) bytes - $($_.LastWriteTime)" -ForegroundColor White
            }
        }
    } catch {
        Write-Host "  [ERROR] Cannot access directory: $_" -ForegroundColor Red
    }
} else {
    Write-Host "  [ERROR] Directory does not exist!" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Testing Print Job Detection" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get printers
Write-Host "Available printers:" -ForegroundColor Cyan
$printers = Get-Printer
$printers | ForEach-Object {
    $driverInfo = if ($_.DriverName) { $_.DriverName } else { "Unknown" }
    $portInfo = if ($_.PortName) { $_.PortName } else { "Unknown" }
    Write-Host "  - $($_.Name)" -ForegroundColor White
    Write-Host "      Driver: $driverInfo" -ForegroundColor Gray
    Write-Host "      Port: $portInfo" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Live Monitoring Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will monitor the spooler directory for 30 seconds." -ForegroundColor Yellow
Write-Host "Print something now and watch for file changes..." -ForegroundColor Yellow
Write-Host ""

$startTime = Get-Date
$duration = 30
$lastFileCount = (Get-ChildItem $spoolerPath -ErrorAction SilentlyContinue).Count

Write-Host "Monitoring started at $($startTime.ToString('HH:mm:ss'))" -ForegroundColor Green
Write-Host "Initial file count: $lastFileCount" -ForegroundColor White
Write-Host ""

while ((Get-Date) -lt $startTime.AddSeconds($duration)) {
    Start-Sleep -Milliseconds 500
    
    $currentFiles = Get-ChildItem $spoolerPath -ErrorAction SilentlyContinue
    $currentFileCount = $currentFiles.Count
    
    if ($currentFileCount -ne $lastFileCount) {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] File count changed: $lastFileCount -> $currentFileCount" -ForegroundColor Cyan
        
        # Show new files
        $currentFiles | ForEach-Object {
            Write-Host "    $($_.Name) ($($_.Extension)) - $($_.Length) bytes" -ForegroundColor Yellow
        }
        
        $lastFileCount = $currentFileCount
    }
    
    # Show progress
    $elapsed = ((Get-Date) - $startTime).TotalSeconds
    $remaining = $duration - $elapsed
    Write-Host "`rMonitoring... $([math]::Round($remaining, 0))s remaining" -NoNewline -ForegroundColor Gray
}

Write-Host ""
Write-Host ""
Write-Host "Monitoring complete!" -ForegroundColor Green
Write-Host ""

# Final check
$finalFiles = Get-ChildItem $spoolerPath -ErrorAction SilentlyContinue
Write-Host "Final file count: $($finalFiles.Count)" -ForegroundColor White

if ($finalFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "Files found:" -ForegroundColor Cyan
    $finalFiles | ForEach-Object {
        Write-Host "  $($_.Name) - $($_.Extension) - $($_.Length) bytes" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Diagnosis Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
