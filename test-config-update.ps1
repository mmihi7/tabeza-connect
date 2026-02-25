# Test script to verify config.json update preserves all fields

Write-Host "Testing config.json update logic..." -ForegroundColor Cyan
Write-Host ""

# Create test config directory
$testDir = "C:\TabezaTest"
$testConfigFile = "$testDir\config.json"

if (Test-Path $testDir) {
    Remove-Item $testDir -Recurse -Force
}
New-Item -ItemType Directory -Path $testDir -Force | Out-Null

# Create initial config (simulating configure-bridge.ps1 output)
$initialConfig = @{
    barId = "test-bar-123"
    apiUrl = "https://bkaigyrrzsqbfscyznzw.supabase.co"
    bridge = @{
        enabled = $true
        printerName = "Test Printer"
        originalPort = "USB001"
        captureFolder = "C:\TabezaPrints"
        tempFolder = "C:\TabezaPrints\temp"
        autoConfigure = $true
    }
    service = @{
        name = "TabezaConnect"
        displayName = "Tabeza POS Connect"
        description = "Captures receipt data from POS and syncs with Tabeza staff app"
        port = 8765
    }
    sync = @{
        intervalSeconds = 30
        retryAttempts = 3
        retryDelaySeconds = 60
    }
}

Write-Host "1. Writing initial config..." -ForegroundColor Yellow
$initialConfig | ConvertTo-Json -Depth 10 | Set-Content -Path $testConfigFile -Encoding UTF8
Write-Host "   Initial config written" -ForegroundColor Green
Write-Host ""

# Display initial config
Write-Host "2. Initial config content:" -ForegroundColor Yellow
Get-Content $testConfigFile | Write-Host
Write-Host ""

# Simulate register-printer-with-api.ps1 logic
Write-Host "3. Reading config and adding driverId..." -ForegroundColor Yellow
$config = Get-Content $testConfigFile | ConvertFrom-Json

Write-Host "   Config type: $($config.GetType().Name)" -ForegroundColor Gray
Write-Host "   Bridge type: $($config.bridge.GetType().Name)" -ForegroundColor Gray
Write-Host ""

# Add driverId
$driverId = "driver-TEST-20250115120000"
$config | Add-Member -NotePropertyName "driverId" -NotePropertyValue $driverId -Force

Write-Host "   driverId added: $driverId" -ForegroundColor Green
Write-Host ""

# Write back to file
Write-Host "4. Writing updated config..." -ForegroundColor Yellow
$config | ConvertTo-Json -Depth 10 | Set-Content -Path $testConfigFile -Encoding UTF8
Write-Host "   Updated config written" -ForegroundColor Green
Write-Host ""

# Display updated config
Write-Host "5. Updated config content:" -ForegroundColor Yellow
Get-Content $testConfigFile | Write-Host
Write-Host ""

# Verify all fields preserved
Write-Host "6. Verifying field preservation..." -ForegroundColor Yellow
$verifyConfig = Get-Content $testConfigFile | ConvertFrom-Json

$allFieldsPresent = $true

# Check root level fields
if ($verifyConfig.barId -ne "test-bar-123") {
    Write-Host "   ❌ barId missing or incorrect" -ForegroundColor Red
    $allFieldsPresent = $false
} else {
    Write-Host "   ✅ barId preserved" -ForegroundColor Green
}

if ($verifyConfig.apiUrl -ne "https://bkaigyrrzsqbfscyznzw.supabase.co") {
    Write-Host "   ❌ apiUrl missing or incorrect" -ForegroundColor Red
    $allFieldsPresent = $false
} else {
    Write-Host "   ✅ apiUrl preserved" -ForegroundColor Green
}

if ($verifyConfig.driverId -ne $driverId) {
    Write-Host "   ❌ driverId missing or incorrect" -ForegroundColor Red
    $allFieldsPresent = $false
} else {
    Write-Host "   ✅ driverId added correctly" -ForegroundColor Green
}

# Check bridge fields
if (-not $verifyConfig.bridge) {
    Write-Host "   ❌ bridge object missing" -ForegroundColor Red
    $allFieldsPresent = $false
} else {
    Write-Host "   ✅ bridge object preserved" -ForegroundColor Green
    
    if ($verifyConfig.bridge.printerName -ne "Test Printer") {
        Write-Host "   ❌ bridge.printerName missing or incorrect" -ForegroundColor Red
        $allFieldsPresent = $false
    } else {
        Write-Host "   ✅ bridge.printerName preserved" -ForegroundColor Green
    }
    
    if ($verifyConfig.bridge.enabled -ne $true) {
        Write-Host "   ❌ bridge.enabled missing or incorrect" -ForegroundColor Red
        $allFieldsPresent = $false
    } else {
        Write-Host "   ✅ bridge.enabled preserved" -ForegroundColor Green
    }
}

# Check service fields
if (-not $verifyConfig.service) {
    Write-Host "   ❌ service object missing" -ForegroundColor Red
    $allFieldsPresent = $false
} else {
    Write-Host "   ✅ service object preserved" -ForegroundColor Green
    
    if ($verifyConfig.service.name -ne "TabezaConnect") {
        Write-Host "   ❌ service.name missing or incorrect" -ForegroundColor Red
        $allFieldsPresent = $false
    } else {
        Write-Host "   ✅ service.name preserved" -ForegroundColor Green
    }
}

# Check sync fields
if (-not $verifyConfig.sync) {
    Write-Host "   ❌ sync object missing" -ForegroundColor Red
    $allFieldsPresent = $false
} else {
    Write-Host "   ✅ sync object preserved" -ForegroundColor Green
    
    if ($verifyConfig.sync.intervalSeconds -ne 30) {
        Write-Host "   ❌ sync.intervalSeconds missing or incorrect" -ForegroundColor Red
        $allFieldsPresent = $false
    } else {
        Write-Host "   ✅ sync.intervalSeconds preserved" -ForegroundColor Green
    }
}

Write-Host ""
if ($allFieldsPresent) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ✅ ALL TESTS PASSED!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "The config update logic works correctly." -ForegroundColor Green
    Write-Host "All fields are preserved when adding driverId." -ForegroundColor Green
} else {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  ❌ TESTS FAILED!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Some fields were not preserved correctly." -ForegroundColor Red
}

Write-Host ""
Write-Host "Test files location: $testDir" -ForegroundColor Gray
Write-Host ""
