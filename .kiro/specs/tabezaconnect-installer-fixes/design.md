# Design Document: TabezaConnect v1.6.1 Installer Bugfixes

## Overview

This design addresses five critical bugs in the TabezaConnect v1.6.1 installer that prevent complete installation tracking and proper configuration. The installer currently has working core functionality (service starts, printer registers in Supabase), but specific components need fixes:

1. **configure-bridge.ps1**: Remove port creation code (regression from working approach)
2. **Status tracking**: Add write-status.ps1 calls to all scripts (only step 1 currently writes)
3. **config.json update**: Fix driverId field not being added despite successful API registration
4. **Installation UI**: Add Inno Setup progress page to show real-time installation status
5. **Upgrade handling**: Preserve configuration and prevent duplicate resources on reinstall

The design maintains the silent bridge architecture where POS prints to a folder port, the bridge captures and uploads receipts, then forwards to the physical printer (POS authority).

## Architecture

### System Components

```
Inno Setup Installer
├── [Files] Section → Copy executables and scripts
├── [Run] Section → Execute PowerShell scripts sequentially
│   ├── create-folders.ps1 (Step 1)
│   ├── detect-thermal-printer.ps1 (Step 2)
│   ├── configure-bridge.ps1 (Step 3) ← FIX NEEDED
│   ├── register-service-pkg.ps1 (Step 4)
│   ├── check-service-started.ps1 (Step 5) ← FIX NEEDED
│   ├── register-printer-with-api.ps1 (Step 6)
│   └── verify-bridge.ps1 (Step 7) ← FIX NEEDED
├── [Code] Section → Progress page with real-time updates ← NEW
└── Status Tracking → installation-status.json
```

### Data Flow

```
Installation Start
    ↓
[Progress Page Displayed] ← NEW
    ↓
Step 1: create-folders.ps1
    → Creates C:\TabezaPrints\
    → Calls write-status.ps1 ← FIX: Add this call
    ↓
Step 2: detect-thermal-printer.ps1
    → Detects thermal printer
    → Saves to detected-printer.json
    → Calls write-status.ps1 ← FIX: Add this call
    ↓
Step 3: configure-bridge.ps1
    → Reads detected-printer.json
    → Creates folder port ← FIX: Remove port creation code
    → Configures printer to use folder port
    → Writes printer name to config.json ← FIX: Add forwarding target
    → Restarts print spooler
    → Calls write-status.ps1 (already exists)
    ↓
Step 4: register-service-pkg.ps1
    → Registers Windows service
    → Calls write-status.ps1 (already exists)
    ↓
Step 5: check-service-started.ps1
    → Verifies service is running
    → Calls write-status.ps1 ← FIX: Add this call
    ↓
Step 6: register-printer-with-api.ps1
    → Generates driverId
    → Registers with Supabase
    → Updates config.json with driverId ← FIX: Ensure this works
    → Calls write-status.ps1 (already exists)
    ↓
Step 7: verify-bridge.ps1
    → Performs test print
    → Verifies forwarding
    → Calls write-status.ps1 ← FIX: Add this call
    ↓
[Progress Page Shows Summary] ← NEW
    ↓
Installation Complete
```

### Upgrade Flow

```
Installer Detects Existing Installation
    ↓
Check for existing service
    → If exists: Stop service
    ↓
Check for existing config.json
    → If exists: Read barId and driverId
    → Preserve these fields
    ↓
Check for existing printer port
    → If exists: Reuse port name
    → Don't create duplicate
    ↓
Proceed with normal installation
    → Merge preserved config with new config
    ↓
Restart service with preserved configuration
```

## Components and Interfaces

### 1. PowerShell Scripts (Fixes)

#### create-folders.ps1 (Fix)
**Current State**: Creates folders but doesn't write status
**Fix Required**: Add write-status.ps1 call at end

```powershell
# At end of script, add:
& "$PSScriptRoot\write-status.ps1" -StepNumber 1 -StepName "Folders created" -Success $true -Details "Location: $WatchFolder"
```

#### detect-thermal-printer.ps1 (Fix)
**Current State**: Detects printer but doesn't write status
**Fix Required**: Add write-status.ps1 call at end

```powershell
# At end of script, add:
& "$PSScriptRoot\write-status.ps1" -StepNumber 2 -StepName "Printer detected" -Success $true -Details "Printer: $printerName"
```

#### configure-bridge.ps1 (Major Fix)
**Current State**: Has port creation code that should be removed
**Fix Required**: 
1. Remove port creation code (lines attempting to create new port)
2. Use folder port approach directly
3. Add printer name to config.json as forwarding target

```powershell
# REMOVE THIS SECTION (port creation):
# Write-Host "Creating NULL port..." -ForegroundColor Yellow
# $portName = "NULL:"
# Write-Host "  Using built-in NULL port" -ForegroundColor Green

# REPLACE WITH: Use folder port directly
$portName = "TabezaCapturePort"  # Or whatever port name is configured

# ADD: Write printer name to config for forwarding
$config = @{
    barId = $BarId
    apiUrl = "https://bkaigyrrzsqbfscyznzw.supabase.co"
    bridge = @{
        enabled = $true
        printerName = $printerInfo.printerName  # ← Forwarding target
        originalPort = $printerInfo.originalPortName
        captureFolder = $captureFolder
        tempFolder = $tempFolder
        autoConfigure = $true
    }
    # ... rest of config
}
```

#### check-service-started.ps1 (Fix)
**Current State**: Checks service but doesn't write status
**Fix Required**: Add write-status.ps1 call at end

```powershell
# At end of script, add:
if ($service.Status -eq 'Running') {
    & "$PSScriptRoot\write-status.ps1" -StepNumber 5 -StepName "Service started" -Success $true -Details "Status: Running"
} else {
    & "$PSScriptRoot\write-status.ps1" -StepNumber 5 -StepName "Service started" -Success $false -Details "Status: $($service.Status)"
}
```

#### register-printer-with-api.ps1 (Fix)
**Current State**: Registers printer but driverId not added to config.json
**Fix Required**: Ensure config.json update preserves existing fields

```powershell
# CURRENT CODE (may have issues):
$config | Add-Member -NotePropertyName "driverId" -NotePropertyValue $driverId -Force
$config | ConvertTo-Json -Depth 10 | Set-Content -Path $ConfigFile -Encoding UTF8

# ENSURE THIS WORKS: Read existing config, add driverId, preserve all fields
$config = Get-Content $ConfigFile | ConvertFrom-Json
$config | Add-Member -NotePropertyName "driverId" -NotePropertyValue $driverId -Force
$config | ConvertTo-Json -Depth 10 | Set-Content -Path $ConfigFile -Encoding UTF8
```

#### verify-bridge.ps1 (Fix)
**Current State**: Verifies installation but doesn't write status
**Fix Required**: Add write-status.ps1 call at end

```powershell
# At end of script, add:
& "$PSScriptRoot\write-status.ps1" -StepNumber 7 -StepName "Installation verified" -Success $true -Details "Test print successful"
```

### 2. Inno Setup Progress Page (New Component)

**Purpose**: Display real-time installation progress to user

**Implementation**: Use Inno Setup Pascal scripting to create custom progress page

```pascal
[Code]
var
  ProgressPage: TOutputProgressWizardPage;
  StatusLabels: array[1..7] of TNewStaticText;
  
procedure InitializeWizard;
begin
  // Create progress page
  ProgressPage := CreateOutputProgressPage('Installing TabezaConnect', 
    'Please wait while Setup installs TabezaConnect on your computer.');
  
  // Create status labels for each step
  StatusLabels[1] := TNewStaticText.Create(ProgressPage);
  StatusLabels[1].Caption := '⏳ Step 1: Creating folders...';
  StatusLabels[1].Parent := ProgressPage.Surface;
  
  // ... repeat for steps 2-7
end;

procedure UpdateStepStatus(StepNumber: Integer; Success: Boolean; StepName: String);
begin
  if Success then
    StatusLabels[StepNumber].Caption := '✅ Step ' + IntToStr(StepNumber) + ': ' + StepName
  else
    StatusLabels[StepNumber].Caption := '❌ Step ' + IntToStr(StepNumber) + ': ' + StepName + ' (FAILED)';
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  StatusFile: String;
  StatusContent: String;
  I: Integer;
begin
  if CurStep = ssPostInstall then
  begin
    ProgressPage.Show;
    
    // Poll installation-status.json and update UI
    StatusFile := ExpandConstant('{commonappdata}\Tabeza\logs\installation-status.json');
    
    repeat
      if FileExists(StatusFile) then
      begin
        LoadStringFromFile(StatusFile, StatusContent);
        // Parse JSON and update status labels
        // (Simplified - actual implementation needs JSON parsing)
      end;
      Sleep(500);  // Poll every 500ms
    until AllStepsComplete;
    
    ProgressPage.Hide;
  end;
end;
```

### 3. Upgrade Handler (New Component)

**Purpose**: Detect existing installation and preserve configuration

**Implementation**: Add to Inno Setup [Code] section

```pascal
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ExistingConfig: String;
  ExistingBarId: String;
  ExistingDriverId: String;
begin
  Result := '';
  
  // Check for existing service
  if ServiceExists('TabezaConnect') then
  begin
    // Stop service
    Exec('sc.exe', 'stop TabezaConnect', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Sleep(2000);
  end;
  
  // Check for existing config
  ExistingConfig := ExpandConstant('{commonappdata}\Tabeza\config.json');
  if FileExists(ExistingConfig) then
  begin
    // Read and preserve barId and driverId
    // (Simplified - actual implementation needs JSON parsing)
    // Store in global variables for later use
  end;
  
  // Check for existing printer port
  // (Would need PowerShell call to check)
end;
```

## Data Models

### installation-status.json

```json
[
  {
    "step": 1,
    "name": "Folders created",
    "success": true,
    "details": "Location: C:\\TabezaPrints",
    "timestamp": "2025-01-15 10:30:15"
  },
  {
    "step": 2,
    "name": "Printer detected",
    "success": true,
    "details": "Printer: EPSON TM-T20III",
    "timestamp": "2025-01-15 10:30:18"
  },
  {
    "step": 3,
    "name": "Bridge configured",
    "success": true,
    "details": "Printer: EPSON TM-T20III",
    "timestamp": "2025-01-15 10:30:25"
  },
  {
    "step": 4,
    "name": "Service registered",
    "success": true,
    "details": "Service: TabezaConnect",
    "timestamp": "2025-01-15 10:30:30"
  },
  {
    "step": 5,
    "name": "Service started",
    "success": true,
    "details": "Status: Running",
    "timestamp": "2025-01-15 10:30:35"
  },
  {
    "step": 6,
    "name": "Printer registered with Tabeza API",
    "success": true,
    "details": "Driver ID: driver-DESKTOP-ABC123-20250115103040",
    "timestamp": "2025-01-15 10:30:40"
  },
  {
    "step": 7,
    "name": "Installation verified",
    "success": true,
    "details": "Test print successful",
    "timestamp": "2025-01-15 10:30:45"
  }
]
```

### config.json (Updated Structure)

```json
{
  "barId": "438c80c1-fe11-4ac5-8a48-2fc45104ba31",
  "driverId": "driver-DESKTOP-ABC123-20250115103040",
  "apiUrl": "https://bkaigyrrzsqbfscyznzw.supabase.co",
  "bridge": {
    "enabled": true,
    "printerName": "EPSON TM-T20III",
    "originalPort": "USB001",
    "captureFolder": "C:\\TabezaPrints",
    "tempFolder": "C:\\TabezaPrints\\temp",
    "autoConfigure": true
  },
  "service": {
    "name": "TabezaConnect",
    "displayName": "Tabeza POS Connect",
    "description": "Captures receipt data from POS and syncs with Tabeza staff app",
    "port": 8765
  },
  "sync": {
    "intervalSeconds": 30,
    "retryAttempts": 3,
    "retryDelaySeconds": 60
  }
}
```

**Key Changes**:
- Added `driverId` at root level (for API identification)
- `bridge.printerName` is the forwarding target (physical printer)
- `bridge.originalPort` preserved for reference

### detected-printer.json

```json
{
  "printerName": "EPSON TM-T20III",
  "originalPortName": "USB001",
  "driverName": "EPSON TM-T20III Receipt",
  "status": "Normal",
  "timestamp": "2025-01-15T10:30:18.123Z"
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Complete Installation Status Tracking

*For any* complete installation run, the installation-status.json file should contain exactly 7 status entries (one for each step)

**Validates: Requirements 2.8**

### Property 2: Config Field Preservation on Update

*For any* existing config.json with fields (barId, apiUrl, bridge, service, sync, driverId), updating the config should preserve all existing fields with their original values

**Validates: Requirements 3.3, 7.2**

## Error Handling

### Script-Level Error Handling

Each PowerShell script must:
1. Use `try-catch` blocks around all operations
2. Write error details to installation-status.json on failure
3. Exit with code 1 on critical failures (steps 1-5)
4. Exit with code 0 on non-critical failures (steps 6-7) to allow installation to continue

Example error handling pattern:

```powershell
try {
    # Script operations
    
    # Success status write
    & "$PSScriptRoot\write-status.ps1" -StepNumber X -StepName "Step name" -Success $true -Details "Success details"
    exit 0
    
} catch {
    # Error status write
    & "$PSScriptRoot\write-status.ps1" -StepNumber X -StepName "Step name" -Success $false -Details $_.Exception.Message
    
    # Exit with appropriate code
    if ($IsCriticalStep) {
        exit 1  # Stop installation
    } else {
        exit 0  # Continue installation
    }
}
```

### Installer-Level Error Handling

Inno Setup [Run] section must:
1. Check exit codes from each script
2. Stop installation if critical step fails (exit code 1)
3. Continue installation if non-critical step fails (exit code 0 with error logged)
4. Display error summary on progress page

```pascal
[Run]
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\create-folders.ps1"""; \
  StatusMsg: "Creating folders..."; \
  Flags: runhidden waituntilterminated; \
  Check: CheckPreviousStepSuccess; \
  Components: core
```

### Upgrade Error Handling

If upgrade detection fails:
1. Log the error but proceed with fresh installation
2. Don't attempt to preserve config if it's malformed
3. Create new service registration if old one can't be removed

## Testing Strategy

### Dual Testing Approach

This bugfix requires both unit tests and property-based tests:

**Unit Tests**: Verify specific scenarios and edge cases
- Test each script writes correct status entry
- Test config.json update preserves fields
- Test upgrade preserves barId and driverId
- Test error handling writes error details
- Test non-critical step failure allows continuation

**Property Tests**: Verify universal properties across all inputs
- Property 1: Complete installation always has 7 status entries
- Property 2: Config updates always preserve existing fields

### Property-Based Testing Configuration

- Use **Pester** for PowerShell property-based testing
- Minimum **100 iterations** per property test
- Each property test must reference its design document property
- Tag format: **Feature: tabezaconnect-installer-fixes, Property {number}: {property_text}**

### Unit Test Examples

**Test: create-folders.ps1 writes status**
```powershell
Describe "create-folders.ps1" {
    It "Should write step 1 status to installation-status.json" {
        # Arrange
        $statusFile = "C:\ProgramData\Tabeza\logs\installation-status.json"
        Remove-Item $statusFile -ErrorAction SilentlyContinue
        
        # Act
        & ".\create-folders.ps1" -WatchFolder "C:\TabezaPrints"
        
        # Assert
        $statusFile | Should -Exist
        $status = Get-Content $statusFile | ConvertFrom-Json
        $status[0].step | Should -Be 1
        $status[0].name | Should -Be "Folders created"
        $status[0].success | Should -Be $true
    }
}
```

**Test: config.json update preserves fields**
```powershell
Describe "register-printer-with-api.ps1" {
    It "Should preserve existing config fields when adding driverId" {
        # Arrange
        $configFile = "C:\ProgramData\Tabeza\config.json"
        $originalConfig = @{
            barId = "test-bar-123"
            apiUrl = "https://test.supabase.co"
            bridge = @{ enabled = $true }
        }
        $originalConfig | ConvertTo-Json | Set-Content $configFile
        
        # Act
        & ".\register-printer-with-api.ps1" -BarId "test-bar-123" -ConfigFile $configFile
        
        # Assert
        $updatedConfig = Get-Content $configFile | ConvertFrom-Json
        $updatedConfig.barId | Should -Be "test-bar-123"
        $updatedConfig.apiUrl | Should -Be "https://test.supabase.co"
        $updatedConfig.bridge.enabled | Should -Be $true
        $updatedConfig.driverId | Should -Not -BeNullOrEmpty
    }
}
```

### Property Test Examples

**Property 1: Complete Installation Status Tracking**
```powershell
Describe "Installation Status Tracking Property" {
    It "Should have exactly 7 status entries after complete installation" -Tag "Feature: tabezaconnect-installer-fixes, Property 1: Complete installation has 7 status entries" {
        # Run full installation
        & ".\run-full-installation.ps1" -BarId "test-bar-123"
        
        # Verify property
        $statusFile = "C:\ProgramData\Tabeza\logs\installation-status.json"
        $status = Get-Content $statusFile | ConvertFrom-Json
        $status.Count | Should -Be 7
        
        # Verify all steps present
        1..7 | ForEach-Object {
            $status | Where-Object { $_.step -eq $_ } | Should -Not -BeNullOrEmpty
        }
    }
}
```

**Property 2: Config Field Preservation**
```powershell
Describe "Config Field Preservation Property" {
    It "Should preserve all existing fields when updating config" -Tag "Feature: tabezaconnect-installer-fixes, Property 2: Config updates preserve fields" -ForEach @(
        @{ barId = "bar-1"; apiUrl = "https://url1.com"; driverId = "driver-1" }
        @{ barId = "bar-2"; apiUrl = "https://url2.com"; driverId = "driver-2" }
        @{ barId = "bar-3"; apiUrl = "https://url3.com"; driverId = $null }
    ) {
        # Arrange
        $configFile = "C:\ProgramData\Tabeza\config.json"
        $originalConfig = @{
            barId = $barId
            apiUrl = $apiUrl
            bridge = @{ enabled = $true; printerName = "Test Printer" }
            service = @{ name = "TabezaConnect" }
        }
        if ($driverId) {
            $originalConfig.driverId = $driverId
        }
        $originalConfig | ConvertTo-Json -Depth 10 | Set-Content $configFile
        
        # Act - Update config (simulate adding/updating driverId)
        $config = Get-Content $configFile | ConvertFrom-Json
        $config | Add-Member -NotePropertyName "driverId" -NotePropertyValue "new-driver-id" -Force
        $config | ConvertTo-Json -Depth 10 | Set-Content $configFile
        
        # Assert - All original fields preserved
        $updatedConfig = Get-Content $configFile | ConvertFrom-Json
        $updatedConfig.barId | Should -Be $barId
        $updatedConfig.apiUrl | Should -Be $apiUrl
        $updatedConfig.bridge.enabled | Should -Be $true
        $updatedConfig.bridge.printerName | Should -Be "Test Printer"
        $updatedConfig.service.name | Should -Be "TabezaConnect"
    }
}
```

### Integration Testing

**End-to-End Installation Test**:
1. Clean test environment (remove existing installation)
2. Run installer with test Bar ID
3. Verify all 7 steps complete successfully
4. Verify service is running
5. Verify config.json has all required fields
6. Verify printer is registered in Supabase
7. Perform test print and verify forwarding

**Upgrade Test**:
1. Install v1.6.0 with test Bar ID
2. Run v1.6.1 installer (upgrade)
3. Verify Bar ID preserved
4. Verify service still running
5. Verify no duplicate ports created
6. Verify config.json has driverId added

### Manual Testing

**UI Testing**:
- Verify progress page displays during installation
- Verify each step updates in real-time
- Verify success/failure indicators display correctly
- Verify no PowerShell windows flash during installation
- Verify summary page shows all step statuses

**Error Scenario Testing**:
- Disconnect network during step 6 (API registration) - should continue
- Stop print spooler during step 3 - should fail gracefully
- Delete config.json during step 6 - should handle error
- Run installer twice - should preserve configuration

## Implementation Notes

### Critical Code Changes

1. **configure-bridge.ps1**: Remove lines 30-35 (port creation code)
2. **create-folders.ps1**: Add line at end calling write-status.ps1
3. **detect-thermal-printer.ps1**: Add line at end calling write-status.ps1
4. **check-service-started.ps1**: Add line at end calling write-status.ps1
5. **verify-bridge.ps1**: Add line at end calling write-status.ps1
6. **register-printer-with-api.ps1**: Verify config update logic preserves fields
7. **installer-pkg-v1.6.1.iss**: Add Pascal code for progress page

### Deployment Considerations

- Test on clean Windows 10/11 machines
- Test upgrade from v1.5.1 and v1.6.0
- Verify with different thermal printer models
- Test with and without internet connection
- Verify Bar ID validation still works

### Rollback Plan

If v1.6.1 fixes cause issues:
1. Revert to v1.6.0 installer
2. Document specific failure scenarios
3. Fix issues in v1.6.2
4. Re-test with same scenarios

### Success Metrics

- 100% of installations complete all 7 steps
- 100% of installations write complete status JSON
- 100% of upgrades preserve Bar ID and driver ID
- 0 PowerShell windows visible during installation
- Progress page displays correctly on all test machines
