# TabezaConnect Antivirus Exclusions Manager
# Run as Administrator to prevent antivirus warnings

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("Add", "Remove", "List", "Status")]
    $Action = $PSBoundParameters.Action
)

function Add-Exclusions {
    Write-Host "🛡️  Adding TabezaConnect to Windows Defender exclusions..." -ForegroundColor Green
    
    $paths = @(
        "C:\Program Files\Tabeza",
        "C:\Program Files (x86)\Tabeza", 
        "C:\TabezaPrints",
        "C:\ProgramData\Tabeza\TabezaPrints",
        "$env:TEMP",
        "$env:TMP"
    )
    
    foreach ($path in $paths) {
        if (Test-Path $path) {
            try {
                Add-MpPreference -ExclusionPath $path -ErrorAction Stop
                Write-Host "✅ Added exclusion: $path" -ForegroundColor Green
            } catch {
                Write-Host "⚠️  Could not add exclusion: $path" -ForegroundColor Yellow
            }
        } else {
            Write-Host "ℹ️  Path does not exist: $path" -ForegroundColor Gray
        }
    }
    
    # Add process exclusions
    $processes = @("tabeza-service.exe", "TabezaConnect.exe", "node.exe")
    foreach ($process in $processes) {
        try {
            Add-MpPreference -ExclusionProcess $process -ErrorAction Stop
            Write-Host "✅ Added process exclusion: $process" -ForegroundColor Green
        } catch {
            Write-Host "⚠️  Could not add process exclusion: $process" -ForegroundColor Yellow
        }
    }
}

function Remove-Exclusions {
    Write-Host "🗑️  Removing TabezaConnect from Windows Defender exclusions..." -ForegroundColor Yellow
    
    try {
        # Get all exclusions and filter for Tabeza-related ones
        $exclusions = Get-MpPreference | Where-Object { $_.ExclusionPath -like "*Tabeza*" -or $_.ExclusionPath -like "*TabezaPrints*" }
        
        foreach ($exclusion in $exclusions) {
            try {
                Remove-MpPreference -ExclusionPath $exclusion.ExclusionPath
                Write-Host "✅ Removed exclusion: $($exclusion.ExclusionPath)" -ForegroundColor Green
            } catch {
                Write-Host "⚠️  Could not remove exclusion: $($exclusion.ExclusionPath)" -ForegroundColor Yellow
            }
        }
        
        # Remove process exclusions
        $processExclusions = Get-MpPreference | Where-Object { $_.ExclusionProcess -like "*tabeza*" -or $_.ExclusionProcess -eq "node.exe" }
        foreach ($procExclusion in $processExclusions) {
            try {
                Remove-MpPreference -ExclusionProcess $procExclusion.ExclusionProcess
                Write-Host "✅ Removed process exclusion: $($procExclusion.ExclusionProcess)" -ForegroundColor Green
            } catch {
                Write-Host "⚠️  Could not remove process exclusion: $($procExclusion.ExclusionProcess)" -ForegroundColor Yellow
            }
        }
    } catch {
        Write-Host "❌ Error removing exclusions: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Get-ExclusionStatus {
    Write-Host "📊 Current Windows Defender Exclusions Status:" -ForegroundColor Cyan
    
    try {
        $exclusions = Get-MpPreference
        
        Write-Host "`n=== PATH EXCLUSIONS ===" -ForegroundColor White
        $tabezaExclusions = $exclusions | Where-Object { $_.ExclusionPath -like "*Tabeza*" -or $_.ExclusionPath -like "*TabezaPrints*" }
        if ($tabezaExclusions.Count -gt 0) {
            foreach ($exclusion in $tabezaExclusions) {
                Write-Host "📁 $($exclusion.ExclusionPath)" -ForegroundColor Green
            }
        } else {
            Write-Host "❌ No Tabeza path exclusions found" -ForegroundColor Red
        }
        
        Write-Host "`n=== PROCESS EXCLUSIONS ===" -ForegroundColor White
        $processExclusions = $exclusions | Where-Object { $_.ExclusionProcess -like "*tabeza*" -or $_.ExclusionProcess -eq "node.exe" }
        if ($processExclusions.Count -gt 0) {
            foreach ($procExclusion in $processExclusions) {
                Write-Host "⚙️  $($procExclusion.ExclusionProcess)" -ForegroundColor Green
            }
        } else {
            Write-Host "❌ No Tabeza process exclusions found" -ForegroundColor Red
        }
        
    } catch {
        Write-Host "❌ Error checking exclusions: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Main execution
switch ($Action) {
    "Add" {
        Add-Exclusions
        Write-Host "`n✅ Exclusions added successfully!" -ForegroundColor Green
        Write-Host "💡 Restart TabezaConnect service to apply changes" -ForegroundColor Cyan
    }
    "Remove" {
        Remove-Exclusions
        Write-Host "`n✅ Exclusions removed successfully!" -ForegroundColor Green
    }
    "List" {
        Get-ExclusionStatus
    }
    "Status" {
        Get-ExclusionStatus
    }
    default {
        Write-Host "Usage: .\manage-antivirus-exclusions.ps1 -Action <Add|Remove|List|Status>" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Actions:" -ForegroundColor Cyan
        Write-Host "  Add    - Add TabezaConnect to Windows Defender exclusions" -ForegroundColor Green
        Write-Host "  Remove - Remove TabezaConnect from Windows Defender exclusions" -ForegroundColor Yellow
        Write-Host "  List   - Show current TabezaConnect exclusions" -ForegroundColor Cyan
        Write-Host "  Status - Show current exclusion status (same as List)" -ForegroundColor Cyan
        exit 1
    }
}

Write-Host "`n💡 For restaurant users: Run this script as Administrator to prevent antivirus warnings" -ForegroundColor Cyan
Write-Host "💡 Consider adding TabezaConnect to your antivirus vendor's whitelist/safe list" -ForegroundColor Cyan
