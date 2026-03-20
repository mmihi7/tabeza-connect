# install-pm2-startup.ps1
# Run in an ADMIN PowerShell terminal.
# Creates a Windows Task Scheduler task that runs "pm2 resurrect" at user login,
# restoring the saved PM2 process list (tabeza-connect service).

$taskName   = "TabezaConnect-PM2-Startup"
$pm2Path    = (Get-Command pm2 -ErrorAction Stop).Source
$nodeExe    = (Get-Command node -ErrorAction Stop).Source
$action     = New-ScheduledTaskAction -Execute $nodeExe -Argument "`"$pm2Path`" resurrect"
$trigger    = New-ScheduledTaskTrigger -AtLogOn
$principal  = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest
$settings   = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 2) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

# Remove existing task if present
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Restores Tabeza Connect PM2 process on login"

Write-Host "Task '$taskName' registered." -ForegroundColor Green
Write-Host "PM2 will resurrect tabeza-connect on next login." -ForegroundColor Cyan
Write-Host ""
Write-Host "To verify: schtasks /query /tn $taskName /fo LIST"
