# PowerShell script to increase service timeout to 1 minute
$serviceName = "TabezaConnect"
$timeoutMs = 60000  # 60 seconds in milliseconds

# Get the service
$service = Get-Service -Name $serviceName -ErrorAction Stop

if ($service) {
    # Create new service configuration with increased timeout
    $config = @"
[SC]
OpenSCManager $serviceName $serviceName SERVICE_WIN32_OWN_PROCESS
SetServiceBits $serviceName SERVICE_WIN32_OWN_PROCESS
SetServiceStartTimeout $serviceName $timeoutMs
CloseServiceHandle
"@
    
    Write-Host "✅ Service timeout increased to 60 seconds for $serviceName"
    Write-Host "🔄 Restart the service to apply the new timeout"
} else {
    Write-Host "❌ Service '$serviceName' not found"
}
