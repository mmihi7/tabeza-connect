# Restart Tabeza Connect
# Kills any existing printer service and starts Tabeza Connect

Write-Host "🔧 Tabeza Connect - Restart Script" -ForegroundColor Green
Write-Host ""

# Kill any process using port 8765
Write-Host "Checking for existing printer service on port 8765..." -ForegroundColor Yellow
try {
    $connection = Get-NetTCPConnection -LocalPort 8765 -ErrorAction SilentlyContinue
    if ($connection) {
        $pid = $connection.OwningProcess
        Write-Host "Found process $pid using port 8765" -ForegroundColor Yellow
        Write-Host "Killing process..." -ForegroundColor Yellow
        Stop-Process -Id $pid -Force
        Write-Host "✅ Process killed" -ForegroundColor Green
        Start-Sleep -Seconds 1
    } else {
        Write-Host "✅ Port 8765 is free" -ForegroundColor Green
    }
} catch {
    Write-Host "✅ Port 8765 is free" -ForegroundColor Green
}

Write-Host ""
Write-Host "Starting Tabeza Connect..." -ForegroundColor Yellow
Write-Host ""

# Change to root directory
Set-Location "C:\Projects\Tabz"

# Run Tabeza Connect
pnpm --filter @tabeza/connect start:electron
