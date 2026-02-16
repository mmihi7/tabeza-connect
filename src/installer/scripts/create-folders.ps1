# Create Watch Folder Structure
# Sets up the folder hierarchy for receipt monitoring

param(
    [string]$WatchFolder = "C:\TabezaPrints"
)

Write-Host "Creating Tabeza watch folder structure..." -ForegroundColor Cyan
Write-Host ""

# Main watch folder
if (-not (Test-Path $WatchFolder)) {
    try {
        New-Item -ItemType Directory -Path $WatchFolder -Force | Out-Null
        Write-Host "✅ Created: $WatchFolder" -ForegroundColor Green
        
        # Set folder permissions (allow Everyone to write)
        $acl = Get-Acl $WatchFolder
        $permission = "Everyone", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow"
        $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule $permission
        $acl.SetAccessRule($accessRule)
        Set-Acl $WatchFolder $acl
        
        Write-Host "✅ Permissions set (Everyone: Full Control)" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to create folder: $_" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ Folder exists: $WatchFolder" -ForegroundColor Green
}

# Create subfolders
$subfolders = @{
    "processed" = "Successfully processed receipts"
    "errors" = "Receipts that failed processing"
    "queue" = "Receipts waiting to upload (offline mode)"
}

foreach ($folder in $subfolders.Keys) {
    $folderPath = Join-Path $WatchFolder $folder
    $description = $subfolders[$folder]
    
    if (-not (Test-Path $folderPath)) {
        New-Item -ItemType Directory -Path $folderPath -Force | Out-Null
        Write-Host "✅ Created: $folder\ - $description" -ForegroundColor Green
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
- TabezaPrints\         Main folder where POS prints receipts
- processed\            Successfully uploaded receipts (moved here after processing)
- errors\               Receipts that failed to process (check these manually)
- queue\                Receipts waiting to upload when offline

How It Works:
-------------
1. Your POS prints to "Tabeza Receipt Printer"
2. Receipt file appears in this folder
3. Tabeza service detects and processes it
4. Receipt is uploaded to Tabeza cloud
5. File is moved to 'processed' folder

Troubleshooting:
----------------
- If receipts stay in main folder: Service may not be running
- If receipts go to 'errors': Check service logs for parsing issues
- If receipts go to 'queue': Internet connection is offline

Service Status:
---------------
Check service status at: http://localhost:8765/api/status

Support:
--------
Email: support@tabeza.co.ke
Website: https://tabeza.co.ke

Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
"@

$readmeContent | Out-File -FilePath $readmePath -Encoding UTF8 -Force
Write-Host "✅ Created: README.txt" -ForegroundColor Green

Write-Host ""
Write-Host "Watch folder structure created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Location: $WatchFolder" -ForegroundColor Cyan
Write-Host ""

exit 0
