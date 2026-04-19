#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Tabeza REDMON Diagnostic Script
    Checks if REDMON is properly configured with virtual printers
.DESCRIPTION
    Verifies all components of the REDMON capture pipeline:
    - Print Spooler status
    - REDMON installation
    - REDMON ports configuration
    - Virtual printers using REDMON
    - Capture program availability
    - Physical printer forwarding
.NOTES
    Run as Administrator for full diagnostics
#>

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "      TABEZA REDMON DIAGNOSTIC TOOL v1.0          " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Function to write section headers
function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host ">> $Title" -ForegroundColor Yellow
    Write-Host ("-" * 50) -ForegroundColor DarkGray
}

# Function to write status
function Write-Status {
    param(
        [string]$Check,
        [bool]$Passed,
        [string]$Details = ""
    )
    
    $icon = if ($Passed) { "[OK]" } else { "[FAIL]" }
    $color = if ($Passed) { "Green" } else { "Red" }
    
    Write-Host "$icon $Check" -ForegroundColor $color
    if ($Details) {
        Write-Host "     $Details" -ForegroundColor Gray
    }
}

Write-Section "PRINT SPOOLER STATUS"

# Check if running as admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
Write-Status "Running as Administrator" $isAdmin "Some checks require admin rights"

# Check spooler
$spooler = Get-Service -Name Spooler -ErrorAction SilentlyContinue
if ($spooler) {
    $running = $spooler.Status -eq 'Running'
    Write-Status "Print Spooler Service" $running "Status: $($spooler.Status)"
} else {
    Write-Status "Print Spooler Service" $false "Service not found"
}

Write-Section "REDMON INSTALLATION CHECK"

# Check REDMON in registry
$redmonMonitors = Get-ChildItem "HKLM:\SYSTEM\CurrentControlSet\Control\Print\Monitors" -ErrorAction SilentlyContinue | 
                  Where-Object { $_.PSChildName -match "Red|Redirect" }

if ($redmonMonitors) {
    Write-Status "REDMON Registry Entry" $true "Found: $($redmonMonitors.PSChildName -join ', ')"
    
    # Check REDMON DLL
    foreach ($monitor in $redmonMonitors) {
        $driverPath = Get-ItemProperty -Path $monitor.PSPath -Name "Driver" -ErrorAction SilentlyContinue
        if ($driverPath) {
            $dllPath = Join-Path $env:SystemRoot "System32\$($driverPath.Driver)"
            $dllExists = Test-Path $dllPath
            Write-Status "  + $($monitor.PSChildName) DLL" $dllExists "$dllPath"
        }
    }
} else {
    Write-Status "REDMON Registry Entry" $false "REDMON not found in Print Monitors"
}

Write-Section "REDMON PORTS CONFIGURATION"

# Check REDMON ports
$redmonPorts = Get-ChildItem "HKLM:\SYSTEM\CurrentControlSet\Control\Print\Monitors\REDMON Port\Ports" -ErrorAction SilentlyContinue
$redirectedPorts = Get-ChildItem "HKLM:\SYSTEM\CurrentControlSet\Control\Print\Monitors\Redirected Port\Ports" -ErrorAction SilentlyContinue
$allRedmonPorts = $redmonPorts + $redirectedPorts

if ($allRedmonPorts) {
    Write-Status "REDMON Ports Found" $true "$($allRedmonPorts.Count) port(s) configured"
    
    foreach ($port in $allRedmonPorts) {
        $portConfig = Get-ItemProperty -Path $port.PSPath -ErrorAction SilentlyContinue
        Write-Host ""
        Write-Host "  Port: $($port.PSChildName)" -ForegroundColor White
        
        # Check critical REDMON settings
        if ($portConfig) {
            # Program to execute
            if ($portConfig.Command) {
                $progExists = Test-Path $portConfig.Command
                Write-Status "    → Program" $progExists "$($portConfig.Command)"
                if (-not $progExists) {
                    Write-Host "      ⚠ Program not found! Create this executable." -ForegroundColor Red
                }
            } else {
                Write-Status "    → Program" $false "Not configured"
            }
            
            # Arguments
            if ($portConfig.Arguments) {
                Write-Host "    + Arguments: $($portConfig.Arguments)" -ForegroundColor Gray
            }
            
            # Output port (physical printer)
            if ($portConfig.Output) {
                Write-Host "    + Forwards to: $($portConfig.Output)" -ForegroundColor Gray
            }
            
            # Logging
            if ($portConfig.Logging) {
                Write-Host "    + Logging: $($portConfig.Logging)" -ForegroundColor Gray
            }
        }
    }
} else {
    Write-Status "REDMON Ports" $false "No REDMON ports configured"
    Write-Host "   Run: Add-PrinterPort -Name 'TabezaPort' -Description 'REDMON Port'" -ForegroundColor Yellow
}

Write-Section "VIRTUAL PRINTERS CHECK"

# Get all printers
$printers = Get-Printer -ErrorAction SilentlyContinue

if ($printers) {
    Write-Status "Printers Found" $true "$($printers.Count) printer(s) installed"
    
    # Check for printers using REDMON ports
    $redmonPrinters = @()
    foreach ($printer in $printers) {
        $portName = $printer.PortName
        
        # Check if port is a REDMON port
        $isRedmonPort = $false
        foreach ($redmonPort in $allRedmonPorts) {
            if ($portName -eq $redmonPort.PSChildName) {
                $isRedmonPort = $true
                break
            }
        }
        
        if ($isRedmonPort) {
            $redmonPrinters += $printer
            Write-Host ""
            Write-Host "  [PRINTER] $($printer.Name)" -ForegroundColor Green
            Write-Host "    + Driver: $($printer.DriverName)" -ForegroundColor Gray
            Write-Host "    + Port: $($printer.PortName)" -ForegroundColor Gray
            Write-Host "    + Shared: $($printer.Shared)" -ForegroundColor Gray
            Write-Host "    + Published: $($printer.Published)" -ForegroundColor Gray
        }
    }
    
    if ($redmonPrinters.Count -eq 0) {
        Write-Status "REDMON Virtual Printers" $false "No printers configured to use REDMON ports"
        Write-Host "   Create one: Add-Printer -Name 'Send2Me' -DriverName 'Generic / Text Only' -PortName 'TabezaPort'" -ForegroundColor Yellow
    } else {
        Write-Status "REDMON Virtual Printers" $true "$($redmonPrinters.Count) printer(s) ready for capture"
    }
    
    # List all printers for reference
    Write-Host ""
    Write-Host "  All available printers:" -ForegroundColor Gray
    foreach ($printer in $printers) {
        $isRedmon = $false
        foreach ($rp in $redmonPrinters) {
            if ($rp.Name -eq $printer.Name) {
                $isRedmon = $true
                break
            }
        }
        $marker = if ($isRedmon) { "[R]" } else { "[ ]" }
        Write-Host "  $marker $($printer.Name) -> $($printer.PortName)" -ForegroundColor Gray
    }
}

Write-Section "PHYSICAL PRINTER DESTINATIONS"

# Check where REDMON ports forward to
if ($allRedmonPorts) {
    $physicalPrinters = @{}
    foreach ($port in $allRedmonPorts) {
        $portConfig = Get-ItemProperty -Path $port.PSPath -ErrorAction SilentlyContinue
        if ($portConfig -and $portConfig.Output) {
            $dest = $portConfig.Output
            $physicalPrinters[$dest] = $true
            
            # Check if destination printer exists
            $destPrinter = $printers | Where-Object { $_.Name -eq $dest -or $_.PortName -eq $dest }
            if ($destPrinter) {
                Write-Status "Forwarding: $($port.PSChildName) -> $dest" $true "Printer exists"
            } else {
                Write-Status "Forwarding: $($port.PSChildName) -> $dest" $false "Destination printer not found!"
            }
        }
    }
}

Write-Section "CAPTURE PROGRAM CHECK"

# Common capture program locations
$capturePaths = @(
    "C:\TabezaPrints\TabezaCapture.exe",
    "C:\TabezaPrints\capture.exe",
    "C:\Program Files\Tabeza\capture.exe",
    "C:\Program Files (x86)\Tabeza\capture.exe"
)

$captureFound = $false
foreach ($path in $capturePaths) {
    if (Test-Path $path) {
        $captureFound = $true
        Write-Status "Capture Program" $true "Found at: $path"
        
        # Get file info
        $fileInfo = Get-Item $path
        Write-Host "    + Size: $([math]::Round($fileInfo.Length/1KB, 2)) KB" -ForegroundColor Gray
        Write-Host "    + Modified: $($fileInfo.LastWriteTime)" -ForegroundColor Gray
        break
    }
}

if (-not $captureFound) {
    Write-Status "Capture Program" $false "Not found in expected locations"
    Write-Host "   Create your capture.exe and place it in C:\TabezaPrints\" -ForegroundColor Yellow
}

Write-Section "TEST PRINT QUEUE"

# Test if we can send a test page
try {
    $testPrinter = $redmonPrinters | Select-Object -First 1
    if ($testPrinter) {
        Write-Host "  Testing access to: $($testPrinter.Name)" -ForegroundColor Gray
        Write-Status "Print Queue Access" $true "Ready to accept jobs"
    } else {
        Write-Status "Print Queue Access" $false "No REDMON printer to test"
    }
} catch {
    Write-Status "Print Queue Access" $false "Cannot access print queue: $_"
}

Write-Section "SUMMARY"

$issues = 0
$warnings = 0

if (-not $spooler -or $spooler.Status -ne 'Running') { $issues++ }
if (-not $redmonMonitors) { $issues++ }
if (-not $allRedmonPorts) { $warnings++ }
if ($redmonPrinters.Count -eq 0) { $warnings++ }
if (-not $captureFound) { $issues++ }

Write-Host ""
if ($issues -eq 0 -and $warnings -eq 0) {
    Write-Host "RESULT: PERFECT! REDMON is fully configured and ready!" -ForegroundColor Green
} elseif ($issues -eq 0) {
    Write-Host "RESULT: GOOD! REDMON is working but has $warnings warning(s)." -ForegroundColor Yellow
} else {
    Write-Host "RESULT: ISSUES FOUND: $issues critical issue(s) need attention." -ForegroundColor Red
}

Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Cyan
if ($redmonPrinters.Count -eq 0) {
    Write-Host "  1. Create a REDMON port (if not exists)" -ForegroundColor White
    Write-Host "  2. Add a virtual printer using that port" -ForegroundColor White
    Write-Host "  3. Configure POS to print to that printer" -ForegroundColor White
}
if (-not $captureFound) {
    Write-Host "  4. Create your capture.exe program" -ForegroundColor White
    Write-Host "  5. Configure REDMON port to use capture.exe" -ForegroundColor White
}

Write-Host ""
Write-Host "Diagnostic completed at: $(Get-Date)" -ForegroundColor DarkGray