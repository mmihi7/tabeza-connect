# Helper script to write installation status
param(
    [Parameter(Mandatory=$true)]
    [int]$StepNumber,
    
    [Parameter(Mandatory=$true)]
    [string]$StepName,
    
    [Parameter(Mandatory=$true)]
    [bool]$Success,
    
    [string]$Details = ""
)

$statusFile = "C:\ProgramData\Tabeza\logs\installation-status.json"
$statusDir = Split-Path -Parent $statusFile

# Ensure directory exists
if (-not (Test-Path $statusDir)) {
    New-Item -ItemType Directory -Path $statusDir -Force | Out-Null
}

# Read existing status or create new
$status = @()
if (Test-Path $statusFile) {
    try {
        $content = Get-Content $statusFile | ConvertFrom-Json
        if ($content -is [array]) {
            $status = $content
        } elseif ($content -is [PSCustomObject]) {
            $status = @($content)
        }
    } catch {
        $status = @()
    }
}

# Add new status entry
$entry = @{
    step = $StepNumber
    name = $StepName
    success = $Success
    details = $Details
    timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
}

$status += $entry

# Write back to file
$status | ConvertTo-Json | Set-Content -Path $statusFile -Encoding UTF8
