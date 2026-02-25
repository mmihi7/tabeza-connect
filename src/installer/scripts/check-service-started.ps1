# Check if TabezaConnect service started successfully
param(
    [string]$ServiceName = "TabezaConnect"
)

Write-Host "Checking service status..." -ForegroundColor Yellow

try {
    $service = Get-Service -Name $ServiceName -ErrorAction Stop
    
    if ($service.Status -eq 'Running') {
        Write-Host "Service is running" -ForegroundColor Green
        
        # Write status
        & "$PSScriptRoot\write-status.ps1" -StepNumber 5 -StepName "Service started" -Success $true -Details "Status: Running"
        
        exit 0
    } else {
        Write-Host "Service is not running" -ForegroundColor Red
        Write-Host "  Status: $($service.Status)" -ForegroundColor Yellow
        
        # Write status
        & "$PSScriptRoot\write-status.ps1" -StepNumber 5 -StepName "Service started" -Success $false -Details "Status: $($service.Status)"
        
        exit 1
    }
} catch {
    Write-Host "Service not found" -ForegroundColor Red
    
    # Write status
    & "$PSScriptRoot\write-status.ps1" -StepNumber 5 -StepName "Service started" -Success $false -Details "Service not found"
    
    exit 1
}
