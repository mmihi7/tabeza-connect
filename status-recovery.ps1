# TabezaConnect Status & Recovery Tool
# Helps users understand current installation state and provides recovery options

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("Check", "Repair", "Reset", "Configure")]
    $Action = $PSBoundParameters.Action
)

# Color scheme for better UX
$Colors = @{
    Success = "Green"
    Warning = "Yellow"
    Error = "Red"
    Info = "Cyan"
    Action = "Magenta"
}

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Colors[$Color]
}

function Test-ServiceStatus {
    Write-ColorOutput "🔍 Checking TabezaConnect service status..." "Info"
    
    $service = Get-Service -Name "TabezaConnect" -ErrorAction SilentlyContinue
    $process = Get-Process -Name "tabeza-service" -ErrorAction SilentlyContinue
    
    $status = @{
        ServiceInstalled = $false
        ServiceRunning = $false
        ProcessRunning = $false
        Configured = $false
        HeartbeatsWorking = $false
        NextSteps = @()
    }
    
    # Check service installation
    if ($service) {
        $status.ServiceInstalled = $true
        Write-ColorOutput "✅ Windows Service: Installed" "Success"
        
        if ($service.Status -eq 'Running') {
            $status.ServiceRunning = $true
            Write-ColorOutput "✅ Windows Service: Running" "Success"
        } else {
            Write-ColorOutput "⚠️  Windows Service: Not Running ($($service.Status))" "Warning"
            $status.NextSteps += "Start the service: Start-Service TabezaConnect"
        }
    } else {
        Write-ColorOutput "❌ Windows Service: Not Installed" "Error"
        $status.NextSteps += "Install TabezaConnect service"
    }
    
    # Check process
    if ($process) {
        $status.ProcessRunning = $true
        Write-ColorOutput "✅ Process: Running (PID: $($process.Id))" "Success"
    } else {
        Write-ColorOutput "❌ Process: Not Running" "Error"
        if ($status.ServiceRunning) {
            Write-ColorOutput "ℹ️  Note: Service is running but process not found - may need restart" "Warning"
            $status.NextSteps += "Restart the service: Restart-Service TabezaConnect"
        }
    }
    
    # Check configuration
    $configFound = $false
    $configPaths = @(
        "C:\Program Files\Tabeza\config.json",
        "C:\Program Files (x86)\Tabeza\config.json",
        "C:\ProgramData\Tabeza\TabezaConnect\config.json"
    )
    
    foreach ($path in $configPaths) {
        if (Test-Path $path) {
            try {
                $config = Get-Content $path -Raw | ConvertFrom-Json
                if ($config.BarId -and $config.BarId -ne "YOUR_BAR_ID_HERE" -and $config.BarId -ne "") {
                    $status.Configured = $true
                    $configFound = $true
                    Write-ColorOutput "✅ Configuration: Found (Bar ID: $($config.BarId.Substring(0, 8))...)" "Success"
                    break
                }
            } catch {
                Write-ColorOutput "⚠️  Config file found but corrupted: $path" "Warning"
            }
        }
    }
    
    if (-not $configFound) {
        # Check registry
        try {
            $regBarId = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Tabeza\TabezaConnect" -Name "BarID" -ErrorAction SilentlyContinue).BarID
            if ($regBarId -and $regBarId -ne "YOUR_BAR_ID_HERE" -and $regBarId -ne "") {
                $status.Configured = $true
                Write-ColorOutput "✅ Registry Configuration: Found (Bar ID: $($regBarId.Substring(0, 8))...)" "Success"
            }
        } catch {
            Write-ColorOutput "❌ Registry Configuration: Not Found" "Error"
        }
    }
    
    # Test heartbeat connectivity
    if ($status.Configured) {
        Write-ColorOutput "🔍 Testing heartbeat connectivity..." "Info"
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:8765/api/status" -Method GET -TimeoutSec 5
            if ($response.StatusCode -eq 200) {
                $status.HeartbeatsWorking = $true
                Write-ColorOutput "✅ Heartbeat API: Responding" "Success"
            } else {
                Write-ColorOutput "❌ Heartbeat API: Not Responding (Status: $($response.StatusCode))" "Error"
            }
        } catch {
            Write-ColorOutput "❌ Heartbeat API: Connection Failed" "Error"
        }
    }
    
    return $status
}

function Show-InstallationStatus {
    $status = Test-ServiceStatus
    
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "     TABEZACONNECT STATUS REPORT" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    # Overall status
    Write-Host "`n📊 OVERALL STATUS:" -ForegroundColor White
    if ($status.ServiceInstalled -and $status.Configured -and $status.ServiceRunning -and $status.HeartbeatsWorking) {
        Write-ColorOutput "🟢 FULLY OPERATIONAL" "Success"
        Write-ColorOutput "   TabezaConnect is working correctly!" "Success"
    } elseif ($status.ServiceInstalled -and $status.Configured) {
        Write-ColorOutput "🟡 CONFIGURED BUT ISSUES" "Warning"
        Write-ColorOutput "   Installed and configured but has problems" "Warning"
    } elseif ($status.ServiceInstalled) {
        Write-ColorOutput "🟠 PARTIALLY INSTALLED" "Warning"
        Write-ColorOutput "   Service exists but configuration incomplete" "Warning"
    } else {
        Write-ColorOutput "🔴 NOT INSTALLED" "Error"
        Write-ColorOutput "   TabezaConnect not found" "Error"
    }
    
    # Detailed breakdown
    Write-Host "`n📋 DETAILED STATUS:" -ForegroundColor White
    Write-Host "   Service Installed: $(if ($status.ServiceInstalled) { '✅ Yes' } else { '❌ No' })" -ForegroundColor $(if ($status.ServiceInstalled) { 'Success' } else { 'Error' })"
    Write-Host "   Service Running:  $(if ($status.ServiceRunning) { '✅ Yes' } else { '❌ No' })" -ForegroundColor $(if ($status.ServiceRunning) { 'Success' } else { 'Error' })"
    Write-Host "   Process Running:   $(if ($status.ProcessRunning) { '✅ Yes' } else { '❌ No' })" -ForegroundColor $(if ($status.ProcessRunning) { 'Success' } else { 'Error' })"
    Write-Host "   Configured:        $(if ($status.Configured) { '✅ Yes' } else { '❌ No' })" -ForegroundColor $(if ($status.Configured) { 'Success' } else { 'Error' })"
    Write-Host "   Heartbeats Working: $(if ($status.HeartbeatsWorking) { '✅ Yes' } else { '❌ No' })" -ForegroundColor $(if ($status.HeartbeatsWorking) { 'Success' } else { 'Error' })"
    
    if ($status.NextSteps.Count -gt 0) {
        Write-Host "`n⚠️  RECOMMENDED ACTIONS:" -ForegroundColor Yellow
        foreach ($step in $status.NextSteps) {
            Write-Host "   • $step" -ForegroundColor Yellow
        }
    }
    
    Write-Host "`n========================================" -ForegroundColor Cyan
}

function Repair-Installation {
    Write-ColorOutput "🔧 Attempting to repair TabezaConnect installation..." "Info"
    
    # Try common fixes
    $fixesAttempted = 0
    
    # Fix 1: Restart service if running but not responding
    $service = Get-Service -Name "TabezaConnect" -ErrorAction SilentlyContinue
    if ($service -and $service.Status -eq 'Running') {
        try {
            Write-ColorOutput "🔄 Restarting TabezaConnect service..." "Info"
            Restart-Service -Name "TabezaConnect" -Force
            $fixesAttempted++
            Write-ColorOutput "✅ Service restarted" "Success"
        } catch {
            Write-ColorOutput "❌ Failed to restart service: $($_.Exception.Message)" "Error"
        }
    }
    
    # Fix 2: Start service if installed but not running
    if ($service -and $service.Status -ne 'Running') {
        try {
            Write-ColorOutput "▶️ Starting TabezaConnect service..." "Info"
            Start-Service -Name "TabezaConnect"
            $fixesAttempted++
            Write-ColorOutput "✅ Service started" "Success"
        } catch {
            Write-ColorOutput "❌ Failed to start service: $($_.Exception.Message)" "Error"
        }
    }
    
    # Fix 3: Check and fix configuration issues
    $configPaths = @(
        "C:\Program Files\Tabeza\config.json",
        "C:\Program Files (x86)\Tabeza\config.json"
    )
    
    foreach ($path in $configPaths) {
        if (Test-Path $path) {
            try {
                $config = Get-Content $path -Raw | ConvertFrom-Json
                if ($config.BarId -eq "YOUR_BAR_ID_HERE" -or $config.BarId -eq "") {
                    Write-ColorOutput "⚠️  Configuration needs Bar ID" "Warning"
                    Write-ColorOutput "   Please run the installer again and enter your Bar ID" "Info"
                    $fixesAttempted++
                }
            } catch {
                Write-ColorOutput "⚠️  Config file corrupted: $path" "Warning"
            }
        }
    }
    
    Write-Host "`n🔧 Repair completed. $fixesAttempted fixes attempted." -ForegroundColor $(if ($fixesAttempted -gt 0) { 'Success' } else { 'Warning' })
}

function Reset-Installation {
    Write-ColorOutput "🔄 Resetting TabezaConnect to factory defaults..." "Warning"
    
    try {
        # Stop and remove service
        $service = Get-Service -Name "TabezaConnect" -ErrorAction SilentlyContinue
        if ($service) {
            Stop-Service -Name "TabezaConnect" -Force
            Remove-Service -Name "TabezaConnect"
            Write-ColorOutput "✅ Service removed" "Success"
        }
        
        # Remove registry entries
        if (Test-Path "HKLM:\SOFTWARE\Tabeza") {
            Remove-Item -Path "HKLM:\SOFTWARE\Tabeza" -Recurse -Force
            Write-ColorOutput "✅ Registry entries removed" "Success"
        }
        
        # Remove application files (ask user first)
        $response = Read-Host "Remove application files? (y/N): " -ForegroundColor Yellow
        if ($response -eq 'y') {
            $paths = @("C:\Program Files\Tabeza", "C:\Program Files (x86)\Tabeza")
            foreach ($path in $paths) {
                if (Test-Path $path) {
                    Remove-Item -Path $path -Recurse -Force
                    Write-ColorOutput "✅ Removed: $path" "Success"
                }
            }
        }
        
        Write-ColorOutput "🔄 Reset completed. Please reinstall TabezaConnect." "Success"
        
    } catch {
        Write-ColorOutput "❌ Reset failed: $($_.Exception.Message)" "Error"
    }
}

function Configure-Manually {
    Write-ColorOutput "⚙️  Manual Configuration Guide" "Info"
    
    Write-Host "`n📋 STEP 1: Get Your Bar ID" -ForegroundColor Cyan
    Write-Host "   1. Go to Tabeza Staff App" -ForegroundColor White
    Write-Host "   2. Navigate to Settings → Printer Setup" -ForegroundColor White
    Write-Host "   3. Copy your Bar ID (click the copy button)" -ForegroundColor White
    Write-Host "   4. Your Bar ID looks like: 438c80c1-fe11-4ac5-8a48-2fc45104ba31" -ForegroundColor Gray
    
    Write-Host "`n📋 STEP 2: Configure TabezaConnect" -ForegroundColor Cyan
    Write-Host "   Option A: Run the installer again and paste your Bar ID" -ForegroundColor White
    Write-Host "   Option B: Edit the configuration file manually:" -ForegroundColor White
    
    $configPaths = @(
        "C:\Program Files\Tabeza\config.json",
        "C:\Program Files (x86)\Tabeza\config.json"
    )
    
    foreach ($path in $configPaths) {
        if (Test-Path $path) {
            Write-Host "           📁 Edit: $path" -ForegroundColor Green
            Write-Host "           📝 Replace YOUR_BAR_ID_HERE with your actual Bar ID" -ForegroundColor Yellow
            break
        }
    }
    
    Write-Host "`n📋 STEP 3: Restart Service" -ForegroundColor Cyan
    Write-Host "   After configuration, restart the service:" -ForegroundColor White
    Write-Host "   • Open Services.msc" -ForegroundColor Gray
    Write-Host "   • Find 'TabezaConnect' service" -ForegroundColor Gray
    Write-Host "   • Right-click → Restart" -ForegroundColor Gray
    Write-Host "   • Or run: Restart-Service TabezaConnect" -ForegroundColor Gray
    
    Write-Host "`n✅ After these steps, TabezaConnect should start sending heartbeats!" -ForegroundColor Success
}

# Main execution
switch ($Action) {
    "Check" {
        Show-InstallationStatus
    }
    "Repair" {
        Repair-Installation
        Write-Host "`n🔄 Running status check after repair..." -ForegroundColor Info
        Start-Sleep -Seconds 3
        Show-InstallationStatus
    }
    "Reset" {
        Reset-Installation
    }
    "Configure" {
        Configure-Manually
    }
    default {
        Write-Host "Usage: .\status-recovery.ps1 -Action <Check|Repair|Reset|Configure>" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Actions:" -ForegroundColor Cyan
        Write-Host "  Check    - Show detailed installation status and health" -ForegroundColor Green
        Write-Host "  Repair   - Attempt to fix common issues automatically" -ForegroundColor Yellow
        Write-Host "  Reset    - Reset to factory defaults (requires reinstall)" -ForegroundColor Red
        Write-Host "  Configure- Show step-by-step manual configuration guide" -ForegroundColor Cyan
        exit 1
    }
}

Write-Host "`n💡 For best results, run this script as Administrator" -ForegroundColor Cyan
Write-Host "💡 This tool helps diagnose and fix any TabezaConnect installation issues" -ForegroundColor Cyan
