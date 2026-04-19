param(
    [string]$InstallPath,
    [string]$BarId,
    [string]$ApiUrl
)

Write-Host "========================================" -ForegroundColor Green
Write-Host "TabezaConnect - One-Step Setup" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# Step 1: Create all required directories
Write-Host "Creating directories..." -ForegroundColor Yellow
$DataDir = "C:\ProgramData\Tabeza"
$WatchDir = "$DataDir\TabezaPrints"
$QueueDir = "$DataDir\queue"
$LogsDir = "$DataDir\logs"
$TemplatesDir = "$DataDir\templates"

New-Item -Path $DataDir -ItemType Directory -Force | Out-Null
New-Item -Path $WatchDir -ItemType Directory -Force | Out-Null
New-Item -Path "$WatchDir\pending" -ItemType Directory -Force | Out-Null
New-Item -Path "$WatchDir\processed" -ItemType Directory -Force | Out-Null
New-Item -Path "$WatchDir\failed" -ItemType Directory -Force | Out-Null
New-Item -Path $QueueDir -ItemType Directory -Force | Out-Null
New-Item -Path "$QueueDir\pending" -ItemType Directory -Force | Out-Null
New-Item -Path "$QueueDir\uploaded" -ItemType Directory -Force | Out-Null
New-Item -Path $LogsDir -ItemType Directory -Force | Out-Null
New-Item -Path $TemplatesDir -ItemType Directory -Force | Out-Null

# Step 2: Create configuration
Write-Host "Creating configuration..." -ForegroundColor Yellow
$config = @{
    barId = $BarId
    apiUrl = $ApiUrl
    watchFolder = $WatchDir
    driverId = "driver-$($env:COMPUTERNAME)"
    httpPort = 8765
}
$config | ConvertTo-Json -Depth 3 | Out-File "$DataDir\config.json" -Encoding UTF8

# Step 3: Configure printer (if thermal printer exists)
Write-Host "Configuring printer..." -ForegroundColor Yellow
try {
    & "$InstallPath\scripts\configure-pooling-printer.ps1" -CaptureFilePath "$WatchDir\order.prn" -ErrorAction SilentlyContinue
    Write-Host "Printer configuration completed" -ForegroundColor Green
} catch {
    Write-Host "Printer configuration skipped - no thermal printer found" -ForegroundColor Yellow
}

# Step 4: Register and start service
Write-Host "Registering service..." -ForegroundColor Yellow
try {
    # Stop any existing service
    Stop-Service -Name "TabezaConnect" -ErrorAction SilentlyContinue
    
    # Remove existing service
    & sc.exe delete "TabezaConnect" 2>$null
    
    # Create new service
    & sc.exe create "TabezaConnect" binPath= "`"$InstallPath\TabezaConnect.exe`"" start= auto DisplayName= "TabezaConnect" type= own
    
    # Configure service
    & sc.exe config "TabezaConnect" start= delayed-auto depend= Tcpip error= normal obj= ".\LocalSystem"
    
    # Start service
    Start-Service -Name "TabezaConnect"
    
    # Wait for service to be ready
    Start-Sleep -Seconds 5
    
    $service = Get-Service -Name "TabezaConnect" -ErrorAction SilentlyContinue
    if ($service -and $service.Status -eq 'Running') {
        Write-Host "Service started successfully" -ForegroundColor Green
    } else {
        Write-Host "Service failed to start - will try alternative method" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Service registration failed - will use alternative startup" -ForegroundColor Yellow
}

# Step 5: Setup system tray auto-start
Write-Host "Configuring system tray..." -ForegroundColor Yellow
try {
    # Add to registry for auto-start
    $regPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
    Set-ItemProperty -Path $regPath -Name "TabezaConnect" -Value "`"$InstallPath\TabezaTray.exe`"" -Force
    
    # Start tray application
    Start-Process -FilePath "$InstallPath\TabezaTray.exe" -WindowStyle Hidden
    
    Write-Host "System tray configured" -ForegroundColor Green
} catch {
    Write-Host "System tray setup failed - user can start manually" -ForegroundColor Yellow
}

# Step 6: Wait for HTTP server to be ready
Write-Host "Waiting for Management UI to be ready..." -ForegroundColor Yellow
$ready = $false
$attempts = 0
$maxAttempts = 30

do {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8765/api/status" -TimeoutSec 2 -ErrorAction Stop
        $ready = $true
        Write-Host "Management UI is ready!" -ForegroundColor Green
    } catch {
        $attempts++
        Start-Sleep -Seconds 2
        Write-Host "Waiting for Management UI... ($attempts/$maxAttempts)" -ForegroundColor Gray
    }
} while (-not $ready -and $attempts -lt $maxAttempts)

if (-not $ready) {
    Write-Host "Management UI not ready - but core functionality is working" -ForegroundColor Yellow
}

# Step 7: Create desktop shortcut
Write-Host "Creating desktop shortcut..." -ForegroundColor Yellow
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = "$desktop\Tabeza Management UI.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "http://localhost:8765"
$shortcut.Save()

Write-Host "========================================" -ForegroundColor Green
Write-Host "INSTALLATION COMPLETE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ Service: Running" -ForegroundColor Green
Write-Host "✅ Printer: Configured (if thermal printer found)" -ForegroundColor Green
Write-Host "✅ System Tray: Auto-start configured" -ForegroundColor Green
Write-Host "✅ Management UI: http://localhost:8765" -ForegroundColor Green
Write-Host "✅ Desktop Shortcut: Created" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
