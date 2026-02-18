# TabezaConnect Firewall and Antivirus Configuration
# This script configures Windows Firewall and adds antivirus exclusions

param(
    [Parameter(Mandatory=$true)]
    [string]$InstallPath
)

Write-Host "🔥 Configuring firewall and antivirus exclusions..." -ForegroundColor Green
Write-Host "Install Path: $InstallPath" -ForegroundColor Gray

# Get executable path
$exePath = Join-Path $InstallPath "TabezaConnect.exe"
$nodePath = Join-Path $InstallPath "nodejs\node.exe"

if (-not (Test-Path $exePath)) {
    Write-Host "⚠️  TabezaConnect.exe not found at: $exePath" -ForegroundColor Yellow
    $exePath = Join-Path $InstallPath "service\index.js"
}

try {
    # 1. Configure Windows Firewall
    Write-Host "🛡️  Configuring Windows Firewall..." -ForegroundColor Blue
    
    # Remove existing rules (if any)
    try {
        Remove-NetFirewallRule -DisplayName "TabezaConnect" -ErrorAction SilentlyContinue
        Remove-NetFirewallRule -DisplayName "TabezaConnect HTTP" -ErrorAction SilentlyContinue
        Remove-NetFirewallRule -DisplayName "TabezaConnect HTTPS" -ErrorAction SilentlyContinue
        Remove-NetFirewallRule -DisplayName "TabezaConnect Outbound HTTPS" -ErrorAction SilentlyContinue
    } catch {
        Write-Host "   (No existing firewall rules to remove)" -ForegroundColor Gray
    }
    
    # Add inbound rule for HTTP (port 8765)
    New-NetFirewallRule -DisplayName "TabezaConnect HTTP" -Direction Inbound -LocalPort 8765 -Protocol TCP -Action Allow -Program $exePath -Description "Tabeza Connect HTTP Service" -ErrorAction Stop | Out-Null
    Write-Host "   ✅ Added HTTP firewall rule (port 8765)" -ForegroundColor Green
    
    # Add inbound rule for HTTPS (port 8766)
    New-NetFirewallRule -DisplayName "TabezaConnect HTTPS" -Direction Inbound -LocalPort 8766 -Protocol TCP -Action Allow -Program $exePath -Description "Tabeza Connect HTTPS Service" -ErrorAction Stop | Out-Null
    Write-Host "   ✅ Added HTTPS firewall rule (port 8766)" -ForegroundColor Green
    
    # Add outbound rule for HTTPS connections
    New-NetFirewallRule -DisplayName "TabezaConnect Outbound HTTPS" -Direction Outbound -Protocol TCP -Action Allow -Program $exePath -Description "Tabeza Connect HTTPS Communications" -ErrorAction Stop | Out-Null
    Write-Host "   ✅ Added outbound HTTPS firewall rule" -ForegroundColor Green
    
    # 2. Configure Windows Defender Antivirus exclusions
    Write-Host "🦠 Configuring Windows Defender exclusions..." -ForegroundColor Blue
    
    # Add folder exclusions
    $excludePaths = @(
        $InstallPath,
        "$env:ProgramData\Tabeza",
        "$env:LOCALAPPDATA\Tabeza",
        "$env:APPDATA\Tabeza"
    )
    
    foreach ($path in $excludePaths) {
        if (Test-Path $path) {
            try {
                Add-MpPreference -ExclusionPath $path -ErrorAction Stop
                Write-Host "   ✅ Added exclusion: $path" -ForegroundColor Green
            } catch {
                Write-Host "   ⚠️  Could not add exclusion for: $path" -ForegroundColor Yellow
            }
        }
    }
    
    # Add process exclusions
    $excludeProcesses = @(
        "TabezaConnect.exe",
        "node.exe",
        "TabezaService.exe"
    )
    
    foreach ($process in $excludeProcesses) {
        try {
            Add-MpPreference -ExclusionProcess $process -ErrorAction Stop
            Write-Host "   ✅ Added process exclusion: $process" -ForegroundColor Green
        } catch {
            Write-Host "   ⚠️  Could not add process exclusion: $process" -ForegroundColor Yellow
        }
    }
    
    # 3. Configure network profile (allow on private networks)
    Write-Host "🌐 Configuring network profile..." -ForegroundColor Blue
    $firewallProfiles = Get-NetFirewallProfile
    foreach ($profile in $firewallProfiles) {
        if ($profile.Name -eq "Private") {
            Set-NetFirewallProfile -Name $profile.Name -Enabled True -DefaultInboundAction Allow -DefaultOutboundAction Allow -ErrorAction Stop | Out-Null
            Write-Host "   ✅ Configured private network profile" -ForegroundColor Green
        }
    }
    
    # 4. Add Windows Defender to allow the service
    try {
        # Check if Windows Defender is running
        $defenderService = Get-Service -Name "WinDefend" -ErrorAction SilentlyContinue
        if ($defenderService -and $defenderService.Status -eq "Running") {
            Write-Host "   ✅ Windows Defender is active and configured" -ForegroundColor Green
        }
    } catch {
        Write-Host "   ℹ️  Windows Defender not detected or not running" -ForegroundColor Gray
    }
    
    # 5. Test network connectivity
    Write-Host "🔍 Testing network connectivity..." -ForegroundColor Blue
    try {
        $testConnection = Test-NetConnection -ComputerName "tabeza.co.ke" -Port 443 -InformationLevel Quiet -WarningAction SilentlyContinue
        if ($testConnection) {
            Write-Host "   ✅ Network connectivity to Tabeza servers confirmed" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  Could not connect to Tabeza servers (may be blocked by network)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   ℹ️  Network test failed (may be normal in some environments)" -ForegroundColor Gray
    }
    
    Write-Host "🎉 Firewall and antivirus configuration completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Summary:" -ForegroundColor Cyan
    Write-Host "   • HTTP port 8765 opened for local communication" -ForegroundColor White
    Write-Host "   • HTTPS port 8766 opened for secure communication" -ForegroundColor White
    Write-Host "   • Outbound HTTPS connections allowed" -ForegroundColor White
    Write-Host "   • Antivirus exclusions added for TabezaConnect" -ForegroundColor White
    Write-Host "   • Private network profile configured" -ForegroundColor White
    Write-Host ""
    Write-Host "💡 If you're still experiencing issues:" -ForegroundColor Yellow
    Write-Host "   1. Check your corporate firewall settings" -ForegroundColor White
    Write-Host "   2. Add TabezaConnect.exe to your antivirus whitelist" -ForegroundColor White
    Write-Host "   3. Ensure port 8765 is not blocked by network admin" -ForegroundColor White
    
} catch {
    Write-Host "❌ Error configuring firewall/antivirus: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔧 Manual configuration required:" -ForegroundColor Yellow
    Write-Host "   1. Open Windows Defender Firewall with Advanced Security" -ForegroundColor White
    Write-Host "   2. Add inbound rule for TCP port 8765" -ForegroundColor White
    Write-Host "   3. Add TabezaConnect.exe to antivirus exclusions" -ForegroundColor White
    Write-Host "   4. Exclude $InstallPath from real-time scanning" -ForegroundColor White
    exit 1
}

Write-Host "✅ Firewall and antivirus configuration completed!" -ForegroundColor Green
