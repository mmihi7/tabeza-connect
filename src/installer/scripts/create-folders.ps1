# Create Watch Folder Structure
# Sets up the folder hierarchy for receipt monitoring
# v1.7.0 - Fixed subfolder names to match installer-pkg.iss [Dirs] section

param(
    [string]$WatchFolder = "C:\ProgramData\Tabeza\TabezaPrints"
)

Write-Host "Creating Tabeza watch folder structure..." -ForegroundColor Cyan
Write-Host ""

# Main watch folder
if (-not (Test-Path $WatchFolder)) {
    try {
        New-Item -ItemType Directory -Path $WatchFolder -Force | Out-Null
        Write-Host "✅ Created: $WatchFolder" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to create folder: $_" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ Folder exists: $WatchFolder" -ForegroundColor Green
}

# Set folder permissions (allow Everyone and LocalService to write)
# Wrapped separately so a permissions failure doesn't abort the whole step
try {
    $acl = Get-Acl $WatchFolder
    
    # Grant Everyone full control (for POS systems)
    $everyonePermission = "Everyone", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow"
    $everyoneRule = New-Object System.Security.AccessControl.FileSystemAccessRule $everyonePermission
    $acl.SetAccessRule($everyoneRule)
    
    # Grant LocalService full control (for the Tabeza service)
    $localServicePermission = "NT AUTHORITY\LocalService", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow"
    $localServiceRule = New-Object System.Security.AccessControl.FileSystemAccessRule $localServicePermission
    $acl.SetAccessRule($localServiceRule)
    
    Set-Acl $WatchFolder $acl
    Write-Host "✅ Permissions set (Everyone + LocalService: Full Control)" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Could not set ACL on $WatchFolder (non-fatal): $_" -ForegroundColor Yellow
}

# Create subfolders - MUST match [Dirs] section in installer-pkg.iss
$subfolders = @{
    "pending"   = "Receipts queued and waiting to be processed"
    "processed" = "Successfully processed receipts"
    "failed"    = "Receipts that failed processing"
}

foreach ($folder in $subfolders.Keys) {
    $folderPath = Join-Path $WatchFolder $folder
    $description = $subfolders[$folder]
    
    if (-not (Test-Path $folderPath)) {
        try {
            New-Item -ItemType Directory -Path $folderPath -Force | Out-Null
            Write-Host "✅ Created: $folder\ - $description" -ForegroundColor Green
        } catch {
            Write-Host "⚠️  Could not create $folder\: $_" -ForegroundColor Yellow
        }
    } else {
        Write-Host "✅ Exists: $folder\ - $description" -ForegroundColor Gray
    }
}

# Create README file
$readmePath = Join-Path $WatchFolder "README.txt"
$readmeContent = @"
Tabeza Connect - Watch Folder
==============================

This folder is monitored by the Tabeza Connect service for new receipt files.

Folder Structure:
-----------------
- TabezaPrints\         Main folder where POS prints to (order.prn)
- pending\              Receipts queued for upload (offline mode)
- processed\            Successfully uploaded receipts
- failed\               Receipts that failed processing (check these manually)

How It Works:
-------------
1. Your POS prints to "Tabeza POS Printer"
2. Receipt file (order.prn) appears in this folder
3. Tabeza service detects and processes it
4. Receipt is uploaded to Tabeza cloud
5. File is moved to 'processed' folder

Troubleshooting:
-----------------
- If receipts stay in main folder: Service may not be running
- If receipts go to 'failed': Check service logs for parsing issues
- If receipts go to 'pending': Internet connection is offline

Service Status:
---------------
Check service status at: http://localhost:8765/api/status

Support:
--------
Email: support@tabeza.co.ke
Website: https://tabeza.co.ke

Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
"@

try {
    $readmeContent | Out-File -FilePath $readmePath -Encoding UTF8 -Force
    Write-Host "✅ Created: README.txt" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Could not create README.txt (non-fatal): $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Watch folder structure created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Location: $WatchFolder" -ForegroundColor Cyan
Write-Host ""

# Write installation status - use explicit path, NOT $PSScriptRoot (which can be empty in hidden PS sessions)
$writeStatusScript = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "write-status.ps1"
if (Test-Path $writeStatusScript) {
    try {
        & $writeStatusScript -StepNumber 1 -StepName "Folders created" -Success $true -Details "Location: $WatchFolder"
    } catch {
        Write-Host "⚠️  Could not write status (non-fatal): $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "ℹ️  write-status.ps1 not found at: $writeStatusScript (skipping)" -ForegroundColor Gray
}

exit 0
