# uninstall-service.ps1
# Stops and removes the TabezaConnect Windows service.
# Called from Inno Setup [UninstallRun] section (US-4, TR-4).
#
# Usage:
#   .\uninstall-service.ps1 -ServiceName "TabezaConnect" [-Silent]
#
# Exit codes:
#   0  - Success (including service not found — idempotent)
#   1  - Error during removal

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)] [string]$ServiceName = 'TabezaConnect',
    [switch]$Silent
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'SilentlyContinue'

function Write-Log {
    param([string]$Message, [string]$Level = 'INFO')
    $ts   = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $line = "[$ts][$Level] $Message"
    if (-not $Silent) { Write-Host $line }
}

try {
    $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if (-not $svc) {
        Write-Log "Service '$ServiceName' not found — nothing to remove"
        exit 0
    }

    # Stop if running
    if ($svc.Status -eq 'Running') {
        Write-Log "Stopping service '$ServiceName'..."
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
        $timeout = 15
        $elapsed = 0
        while ($elapsed -lt $timeout) {
            Start-Sleep -Seconds 1
            $elapsed++
            $svc.Refresh()
            if ($svc.Status -ne 'Running') { break }
        }
    }

    # Delete the service
    Write-Log "Deleting service '$ServiceName'..."
    & sc.exe delete $ServiceName | Out-Null

    if ($LASTEXITCODE -eq 0) {
        Write-Log "Service '$ServiceName' removed successfully"
    } else {
        Write-Log "sc.exe delete returned $LASTEXITCODE — service may have been already removed" 'WARN'
    }

    exit 0

} catch {
    Write-Log "Error during service removal: $_" 'ERROR'
    exit 1
}
