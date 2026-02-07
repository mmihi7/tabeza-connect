# Tabeza Printer Driver Investigation Script
# Run this in PowerShell to identify the TABEZA Virtual Printer

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TABEZA Printer Driver Investigation  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "⚠️  WARNING: Not running as Administrator" -ForegroundColor Yellow
    Write-Host "   Some information may be limited. For full details, run PowerShell as Administrator." -ForegroundColor Yellow
    Write-Host ""
}

# 1. Find TABEZA Printer
Write-Host "1️⃣  Searching for TABEZA Printer..." -ForegroundColor Green
Write-Host ""

$tabezaPrinter = Get-Printer | Where-Object {$_.Name -like "*TABEZA*"}

if ($tabezaPrinter) {
    Write-Host "✅ Found TABEZA Printer!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Printer Details:" -ForegroundColor Cyan
    Write-Host "----------------" -ForegroundColor Cyan
    $tabezaPrinter | Format-List Name, DriverName, PortName, PrinterStatus, Shared, Published, Location, Comment
    
    # 2. Get Driver Details
    Write-Host ""
    Write-Host "2️⃣  Driver Information..." -ForegroundColor Green
    Write-Host ""
    
    $driverName = $tabezaPrinter.DriverName
    $driver = Get-PrinterDriver | Where-Object {$_.Name -eq $driverName}
    
    if ($driver) {
        Write-Host "Driver Details:" -ForegroundColor Cyan
        Write-Host "---------------" -ForegroundColor Cyan
        $driver | Format-List Name, Manufacturer, PrinterEnvironment, MajorVersion, InfPath, DataFile, ConfigFile, HelpFile
    } else {
        Write-Host "⚠️  Could not find driver details" -ForegroundColor Yellow
    }
    
    # 3. Get Port Details
    Write-Host ""
    Write-Host "3️⃣  Port Configuration..." -ForegroundColor Green
    Write-Host ""
    
    $portName = $tabezaPrinter.PortName
    $port = Get-PrinterPort | Where-Object {$_.Name -eq $portName}
    
    if ($port) {
        Write-Host "Port Details:" -ForegroundColor Cyan
        Write-Host "-------------" -ForegroundColor Cyan
        $port | Format-List Name, Description, PortMonitor, PrinterHostAddress, Protocol
    } else {
        Write-Host "⚠️  Could not find port details" -ForegroundColor Yellow
    }
    
    # 4. Search for Driver Files
    Write-Host ""
    Write-Host "4️⃣  Searching for Driver Files..." -ForegroundColor Green
    Write-Host ""
    
    $driverPaths = @(
        "C:\Windows\System32\spool\drivers",
        "C:\Windows\System32\DriverStore\FileRepository"
    )
    
    $foundFiles = @()
    foreach ($path in $driverPaths) {
        if (Test-Path $path) {
            $files = Get-ChildItem -Path $path -Recurse -Filter "*tabeza*" -ErrorAction SilentlyContinue
            if ($files) {
                $foundFiles += $files
            }
        }
    }
    
    if ($foundFiles.Count -gt 0) {
        Write-Host "Found Driver Files:" -ForegroundColor Cyan
        Write-Host "-------------------" -ForegroundColor Cyan
        $foundFiles | Format-Table FullName, Length, LastWriteTime -AutoSize
    } else {
        Write-Host "⚠️  No driver files found in standard locations" -ForegroundColor Yellow
        Write-Host "   This might be a manually configured printer or using a generic driver" -ForegroundColor Yellow
    }
    
    # 5. Check if it's a FILE port
    Write-Host ""
    Write-Host "5️⃣  Configuration Analysis..." -ForegroundColor Green
    Write-Host ""
    
    if ($portName -eq "FILE:") {
        Write-Host "📄 This printer uses FILE port" -ForegroundColor Cyan
        Write-Host "   When you print, Windows will ask where to save the file" -ForegroundColor Gray
        Write-Host "   This is likely configured to save to: C:\Users\YourUsername\TabezaPrints" -ForegroundColor Gray
    } elseif ($portName -like "TCP*" -or $portName -like "IP*") {
        Write-Host "🌐 This printer uses network port: $portName" -ForegroundColor Cyan
        Write-Host "   It's configured to send print jobs over the network" -ForegroundColor Gray
    } elseif ($portName -like "USB*") {
        Write-Host "🔌 This printer uses USB port: $portName" -ForegroundColor Cyan
        Write-Host "   It's connected via USB" -ForegroundColor Gray
    } else {
        Write-Host "🔧 This printer uses custom port: $portName" -ForegroundColor Cyan
        Write-Host "   This might be a virtual port or custom driver" -ForegroundColor Gray
    }
    
    # 6. Summary
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Summary & Next Steps                 " -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "Printer Name: " -NoNewline -ForegroundColor White
    Write-Host $tabezaPrinter.Name -ForegroundColor Yellow
    
    Write-Host "Driver Name: " -NoNewline -ForegroundColor White
    Write-Host $driverName -ForegroundColor Yellow
    
    Write-Host "Port: " -NoNewline -ForegroundColor White
    Write-Host $portName -ForegroundColor Yellow
    
    Write-Host ""
    Write-Host "📋 Please share this information with the development team:" -ForegroundColor Green
    Write-Host ""
    Write-Host "1. Where did you download/install this printer from?" -ForegroundColor White
    Write-Host "   - tabeza.co.ke?" -ForegroundColor Gray
    Write-Host "   - Another website?" -ForegroundColor Gray
    Write-Host "   - Manually added in Windows?" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Do you have the installation file?" -ForegroundColor White
    Write-Host "   - .exe installer?" -ForegroundColor Gray
    Write-Host "   - .msi package?" -ForegroundColor Gray
    Write-Host "   - .inf driver file?" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. How does your POS system use this printer?" -ForegroundColor White
    Write-Host "   - Does it appear in POS printer list?" -ForegroundColor Gray
    Write-Host "   - Does POS print directly to it?" -ForegroundColor Gray
    Write-Host "   - Or does POS save files to a folder?" -ForegroundColor Gray
    
} else {
    Write-Host "❌ No TABEZA printer found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Searching for all printers..." -ForegroundColor Yellow
    Write-Host ""
    
    $allPrinters = Get-Printer
    if ($allPrinters) {
        Write-Host "Available Printers:" -ForegroundColor Cyan
        Write-Host "-------------------" -ForegroundColor Cyan
        $allPrinters | Format-Table Name, DriverName, PortName -AutoSize
    } else {
        Write-Host "No printers found on this system" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Investigation Complete                " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "💾 To save this output to a file, run:" -ForegroundColor Green
Write-Host "   .\identify-printer-driver.ps1 > printer-info.txt" -ForegroundColor Gray
Write-Host ""
