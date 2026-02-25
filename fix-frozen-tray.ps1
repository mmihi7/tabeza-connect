# Fix Frozen Tray App - Quick Recovery Script
# This script fixes missing config fields and restarts the tray app

Write-Host "🔧 TabezaConnect Tray App Quick Fix" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Kill any running TabezaConnect processes
Write-Host "1. Stopping any running TabezaConnect processes..." -ForegroundColor Yellow
Get-Process | Where-Object { $_.Name -like "*TabezaConnect*" -or $_.Name -like "*electron*" } | ForEach-Object {
    $processName = $_.Name
    $processId = $_.Id
    Write-Host "   Killing process: $processName with ID $processId" -ForegroundColor Gray
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2
Write-Host "   ✅ Processes stopped" -ForegroundColor Green
Write-Host ""

# Step 2: Update config.json
Write-Host "2. Updating config.json with missing fields..." -ForegroundColor Yellow
$configPath = "$PSScriptRoot\config.json"

if (Test-Path $configPath) {
    try {
        # Read existing config
        $config = Get-Content $configPath -Raw | ConvertFrom-Json
        
        # Add missing fields
        $hostname = $env:COMPUTERNAME
        
        if (-not $config.driverId) {
            $config | Add-Member -NotePropertyName "driverId" -NotePropertyValue "driver-$hostname" -Force
            Write-Host "   Added driverId: driver-$hostname" -ForegroundColor Gray
        }
        
        if (-not $config.captureMode) {
            $config | Add-Member -NotePropertyName "captureMode" -NotePropertyValue "bridge" -Force
            Write-Host "   Added captureMode: bridge" -ForegroundColor Gray
        }
        
        # Ensure bridge section exists
        if (-not $config.bridge) {
            $bridgeConfig = @{
                enabled = $true
                captureFolder = $config.watchFolder
                tempFolder = "$($config.watchFolder)\temp"
                autoConfigure = $true
            }
            $config | Add-Member -NotePropertyName "bridge" -NotePropertyValue $bridgeConfig -Force
            Write-Host "   Added bridge configuration" -ForegroundColor Gray
        }
        
        # Save updated config
        $config | ConvertTo-Json -Depth 10 | Set-Content $configPath -Encoding UTF8
        Write-Host "   ✅ Config updated successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "   ❌ Error updating config: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}
else {
    Write-Host "   ❌ Config file not found: $configPath" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 3: Kill port 8765 if in use
Write-Host "3. Checking port 8765..." -ForegroundColor Yellow
$portProcess = Get-NetTCPConnection -LocalPort 8765 -ErrorAction SilentlyContinue | Select-Object -First 1
if ($portProcess) {
    $pid = $portProcess.OwningProcess
    Write-Host "   Port 8765 is in use by PID: $pid" -ForegroundColor Gray
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "   ✅ Port 8765 freed" -ForegroundColor Green
}
else {
    Write-Host "   ✅ Port 8765 is available" -ForegroundColor Green
}
Write-Host ""

# Step 4: Start the tray app
Write-Host "4. Starting TabezaConnect tray app..." -ForegroundColor Yellow
$trayExe = "$PSScriptRoot\dist-tray\win-unpacked\TabezaConnect.exe"

if (Test-Path $trayExe) {
    Start-Process $trayExe -WorkingDirectory "$PSScriptRoot\dist-tray\win-unpacked"
    Write-Host "   ✅ Tray app started" -ForegroundColor Green
    Write-Host ""
    Write-Host "✅ Fix complete! Check your system tray for the TabezaConnect icon." -ForegroundColor Green
}
else {
    Write-Host "   ❌ Tray app not found: $trayExe" -ForegroundColor Red
    Write-Host "   Please build the tray app first: build-tray-app.bat" -ForegroundColor Yellow
    exit 1
}
Write-Host ""
Write-Host "📊 You can check the status at: http://localhost:8765/api/status" -ForegroundColor Cyan
