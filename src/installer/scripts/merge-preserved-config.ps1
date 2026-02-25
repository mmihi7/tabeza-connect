# Tabeza Connect - Config Preservation Script
# Merges preserved barId and driverId back into config.json after installation

param(
    [Parameter(Mandatory=$false)]
    [string]$PreservedBarId = "",
    
    [Parameter(Mandatory=$false)]
    [string]$PreservedDriverId = "",
    
    [Parameter(Mandatory=$true)]
    [string]$ConfigFile
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Config Preservation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

try {
    # Check if we have anything to preserve
    if ([string]::IsNullOrEmpty($PreservedBarId) -and [string]::IsNullOrEmpty($PreservedDriverId)) {
        Write-Host "No preserved configuration to merge" -ForegroundColor Gray
        exit 0
    }
    
    # Load current config
    if (-not (Test-Path $ConfigFile)) {
        Write-Host "ERROR: Configuration file not found!" -ForegroundColor Red
        Write-Host "Expected: $ConfigFile" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Loading configuration..." -ForegroundColor Yellow
    $config = Get-Content $ConfigFile | ConvertFrom-Json
    
    # Merge preserved values
    $updated = $false
    
    if (-not [string]::IsNullOrEmpty($PreservedBarId)) {
        Write-Host "  Restoring barId: $PreservedBarId" -ForegroundColor Gray
        $config.barId = $PreservedBarId
        $updated = $true
    }
    
    if (-not [string]::IsNullOrEmpty($PreservedDriverId)) {
        Write-Host "  Restoring driverId: $PreservedDriverId" -ForegroundColor Gray
        
        # Add driverId if it doesn't exist
        if (-not (Get-Member -InputObject $config -Name "driverId" -MemberType Properties)) {
            $config | Add-Member -NotePropertyName "driverId" -NotePropertyValue $PreservedDriverId
        } else {
            $config.driverId = $PreservedDriverId
        }
        $updated = $true
    }
    
    # Save updated config
    if ($updated) {
        Write-Host ""
        Write-Host "Saving updated configuration..." -ForegroundColor Yellow
        $config | ConvertTo-Json -Depth 10 | Set-Content -Path $ConfigFile -Encoding UTF8
        
        Write-Host "✅ Configuration preserved successfully!" -ForegroundColor Green
        Write-Host ""
    }
    
    exit 0
    
} catch {
    Write-Host ""
    Write-Host "ERROR: Failed to merge preserved configuration" -ForegroundColor Red
    Write-Host "Details: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    
    # Don't fail installation - just log the error
    exit 0
}
