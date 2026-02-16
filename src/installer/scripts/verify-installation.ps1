# Verify Tabeza Connect Installation
# Checks that all components are properly installed and configured

param(
    [string]$InstallPath = "C:\Program Files\Tabeza",
    [string]$WatchFolder = "C:\TabezaPrints",
    [switch]$Detailed
)

Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Tabeza Connect - Installation Check  ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# Check 1: Installation Directory
Write-Host "1. Installation Directory" -ForegroundColor Cyan
if (Test-Path $InstallPath) {
    Write-Host "   ✅ Found: $InstallPath" -ForegroundColor Green
    
    if ($Detailed) {
        $size = (Get-ChildItem $InstallPath -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
        Write-Host "   Size: $([math]::Round($size, 2)) MB" -ForegroundColor Gray
    }
} else {
    Write-Host "   ❌ Not found: $InstallPath" -ForegroundColor Red
    $allGood = $false
}

# Check 2: Node.js Runtime
Write-Host ""
Write-Host "2. Node.js Runtime" -ForegroundColor Cyan
$nodePath = Join-Path $InstallPath "nodejs\node.exe"
if (Test-Path $nodePath) {
    Write-Host "   ✅ Found: node.exe" -ForegroundColor Green
    
    if ($Detailed) {
        $version = & $nodePath --version 2>&1
        Write-Host "   Version: $version" -ForegroundColor Gray
    }
} else {
    Write-Host "   ❌ Not found: node.exe" -ForegroundColor Red
    $allGood = $false
}

# Check 3: Service Files
Write-Host ""
Write-Host "3. Service Files" -ForegroundColor Cyan
$servicePath = Join-Path $InstallPath "service\index.js"
if (Test-Path $servicePath) {
    Write-Host "   ✅ Found: service\index.js" -ForegroundColor Green
    
    if ($Detailed) {
        $nodeModules = Join-Path $InstallPath "service\node_modules"
        if (Test-Path $nodeModules) {
            $depCount = (Get-ChildItem $nodeModules -Directory).Count
            Write-Host "   Dependencies: $depCount packages" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "   ❌ Not found: service\index.js" -ForegroundColor Red
    $allGood = $false
}

# Check 4: Configuration File
Write-Host ""
Write-Host "4. Configuration" -ForegroundColor Cyan
$configPath = Join-Path $InstallPath "config.json"
if (Test-Path $configPath) {
    Write-Host "   ✅ Found: config.json" -ForegroundColor Green
    
    if ($Detailed) {
        try {
            $config = Get-Content $configPath | ConvertFrom-Json
            Write-Host "   Bar ID: $($config.barId)" -ForegroundColor Gray
            Write-Host "   API URL: $($config.apiUrl)" -ForegroundColor Gray
        } catch {
            Write-Host "   ⚠️  Could not parse config file" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "   ⚠️  Not found: config.json" -ForegroundColor Yellow
    Write-Host "   (Will be created on first run)" -ForegroundColor Gray
}

# Check 5: Windows Service
Write-Host ""
Write-Host "5. Windows Service" -ForegroundColor Cyan
$service = Get-Service -Name "TabezaConnect" -ErrorAction SilentlyContinue
if ($service) {
    $statusColor = if ($service.Status -eq 'Running') { 'Green' } else { 'Yellow' }
    Write-Host "   ✅ Service registered" -ForegroundColor Green
    Write-Host "   Status: $($service.Status)" -ForegroundColor $statusColor
    Write-Host "   Startup: $($service.StartType)" -ForegroundColor Gray
    
    if ($service.Status -ne 'Running') {
        Write-Host "   ⚠️  Service is not running" -ForegroundColor Yellow
        $allGood = $false
    }
} else {
    Write-Host "   ❌ Service not registered" -ForegroundColor Red
    $allGood = $false
}

# Check 6: Virtual Printer
Write-Host ""
Write-Host "6. Virtual Printer" -ForegroundColor Cyan
$printer = Get-Printer -Name "Tabeza Receipt Printer" -ErrorAction SilentlyContinue
if ($printer) {
    Write-Host "   ✅ Printer configured" -ForegroundColor Green
    Write-Host "   Driver: $($printer.DriverName)" -ForegroundColor Gray
    Write-Host "   Port: $($printer.PortName)" -ForegroundColor Gray
} else {
    Write-Host "   ⚠️  Printer not configured" -ForegroundColor Yellow
    Write-Host "   (Optional component)" -ForegroundColor Gray
}

# Check 7: Watch Folder
Write-Host ""
Write-Host "7. Watch Folder" -ForegroundColor Cyan
if (Test-Path $WatchFolder) {
    Write-Host "   ✅ Found: $WatchFolder" -ForegroundColor Green
    
    # Check subfolders
    $subfolders = @("processed", "errors", "queue")
    $missingFolders = @()
    
    foreach ($subfolder in $subfolders) {
        $subfolderPath = Join-Path $WatchFolder $subfolder
        if (-not (Test-Path $subfolderPath)) {
            $missingFolders += $subfolder
        }
    }
    
    if ($missingFolders.Count -gt 0) {
        Write-Host "   ⚠️  Missing subfolders: $($missingFolders -join ', ')" -ForegroundColor Yellow
    } else {
        Write-Host "   ✅ All subfolders present" -ForegroundColor Green
    }
    
    if ($Detailed) {
        $fileCount = (Get-ChildItem $WatchFolder -File -Recurse).Count
        Write-Host "   Files: $fileCount" -ForegroundColor Gray
    }
} else {
    Write-Host "   ❌ Not found: $WatchFolder" -ForegroundColor Red
    $allGood = $false
}

# Check 8: Log Directory
Write-Host ""
Write-Host "8. Log Directory" -ForegroundColor Cyan
$logPath = Join-Path $env:APPDATA "Tabeza\logs"
if (Test-Path $logPath) {
    Write-Host "   ✅ Found: $logPath" -ForegroundColor Green
    
    if ($Detailed) {
        $logFiles = Get-ChildItem $logPath -File -ErrorAction SilentlyContinue
        if ($logFiles) {
            Write-Host "   Log files: $($logFiles.Count)" -ForegroundColor Gray
            $latestLog = $logFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1
            Write-Host "   Latest: $($latestLog.Name) ($($latestLog.LastWriteTime))" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "   ⚠️  Not found: $logPath" -ForegroundColor Yellow
    Write-Host "   (Will be created on first run)" -ForegroundColor Gray
}

# Check 9: Network Connectivity
Write-Host ""
Write-Host "9. Network Connectivity" -ForegroundColor Cyan
try {
    $response = Test-NetConnection -ComputerName "staff.tabeza.co.ke" -Port 443 -InformationLevel Quiet -WarningAction SilentlyContinue
    if ($response) {
        Write-Host "   ✅ Can reach staff.tabeza.co.ke" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Cannot reach staff.tabeza.co.ke" -ForegroundColor Yellow
        Write-Host "   (Check firewall/internet connection)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ⚠️  Network check failed" -ForegroundColor Yellow
}

# Check 10: Registry Entries
Write-Host ""
Write-Host "10. Registry Entries" -ForegroundColor Cyan
$regPath = "HKLM:\Software\Tabeza\Connect"
if (Test-Path $regPath) {
    Write-Host "   ✅ Registry keys present" -ForegroundColor Green
    
    if ($Detailed) {
        $version = Get-ItemProperty -Path $regPath -Name "Version" -ErrorAction SilentlyContinue
        if ($version) {
            Write-Host "   Version: $($version.Version)" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "   ⚠️  Registry keys not found" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan

if ($allGood) {
    Write-Host "✅ Installation verified successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Tabeza Connect is ready to use." -ForegroundColor White
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Configure your POS to print to 'Tabeza Receipt Printer'" -ForegroundColor White
    Write-Host "  2. Test by printing a receipt" -ForegroundColor White
    Write-Host "  3. Check that receipt appears in Tabeza staff app" -ForegroundColor White
    exit 0
} else {
    Write-Host "⚠️  Installation has issues" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please review the errors above and:" -ForegroundColor White
    Write-Host "  1. Try reinstalling Tabeza Connect" -ForegroundColor White
    Write-Host "  2. Check the installation logs" -ForegroundColor White
    Write-Host "  3. Contact support if issues persist" -ForegroundColor White
    Write-Host ""
    Write-Host "Support: support@tabeza.co.ke" -ForegroundColor Gray
    exit 1
}
