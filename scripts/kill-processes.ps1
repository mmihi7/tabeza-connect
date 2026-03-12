# Kill all TabezaConnect processes
# This script forcefully terminates all TabezaConnect.exe processes

Write-Host "========================================"
Write-Host "Killing TabezaConnect Processes"
Write-Host "========================================"
Write-Host ""

# Find all TabezaConnect processes
$processes = Get-Process -Name "TabezaConnect" -ErrorAction SilentlyContinue

if ($processes) {
    Write-Host "Found $($processes.Count) TabezaConnect process(es)"
    
    foreach ($process in $processes) {
        Write-Host "  - Killing process ID: $($process.Id)"
        try {
            Stop-Process -Id $process.Id -Force -ErrorAction Stop
            Write-Host "    OK Process $($process.Id) terminated"
        }
        catch {
            Write-Host "    ERROR Failed to kill process $($process.Id): $($_.Exception.Message)"
        }
    }
    
    # Wait a moment for processes to fully terminate
    Start-Sleep -Seconds 2
    
    # Verify all processes are gone
    $remainingProcesses = Get-Process -Name "TabezaConnect" -ErrorAction SilentlyContinue
    if ($remainingProcesses) {
        Write-Host ""
        Write-Host "WARNING: Some processes could not be terminated:"
        foreach ($process in $remainingProcesses) {
            Write-Host "  - Process ID: $($process.Id)"
        }
        Write-Host ""
        Write-Host "You may need to restart your computer or manually end these processes."
        exit 1
    }
    else {
        Write-Host ""
        Write-Host "OK All TabezaConnect processes terminated successfully"
    }
}
else {
    Write-Host "OK No TabezaConnect processes found"
}

Write-Host ""
Write-Host "========================================"
Write-Host "Process cleanup complete"
Write-Host "========================================"
