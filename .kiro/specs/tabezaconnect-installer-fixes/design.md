# TabezaConnect Installer Fixes - Design

## Overview
This design addresses critical installer issues preventing successful deployment of TabezaConnect v1.2.0. The solution focuses on fixing admin rights handling, adding terms acceptance, improving branding, and handling antivirus interference.

## Architecture

### Current Installer Stack
- **Inno Setup 6.x**: Windows installer compiler
- **Node.js Service**: TabezaConnect background service
- **Windows Service Wrapper**: NSSM or similar for service management
- **Configuration**: JSON config file with Bar ID

### Installation Flow
```
User Downloads Installer
    ↓
Run as Administrator (UAC Prompt)
    ↓
Welcome Screen
    ↓
Terms & Conditions Acceptance ← NEW
    ↓
Bar ID Input
    ↓
Install Files
    ↓
Configure Service
    ↓
Start Service
    ↓
Completion
```

## Component Design

### 1. Admin Rights Handling

#### Problem Analysis
The "Error 5: Access is denied" occurs when:
- Installer tries to write to protected directories without proper elevation
- Temp directory is locked by antivirus
- UAC elevation is not properly requested
- Installer runs with insufficient privileges

#### Solution: Proper UAC Elevation

**Inno Setup Configuration:**
```pascal
[Setup]
; Request admin privileges
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog

; Use system temp directory with fallback
UsePreviousAppDir=yes
DirExistsWarning=auto

; Disable directory page for simpler flow
DisableDirPage=no
DefaultDirName={autopf}\TabezaConnect

; Compression settings
Compression=lzma2
SolidCompression=yes
```

**Key Changes:**
1. `PrivilegesRequired=admin` - Forces UAC elevation
2. `PrivilegesRequiredOverridesAllowed=dialog` - Shows clear error if user declines
3. Use `{autopf}` (Program Files) instead of custom directories
4. Use `{tmp}` for temporary files with proper cleanup

#### Temp Directory Handling

**Strategy:**
```pascal
[Code]
function GetSafeTempDir(): String;
var
  TempDir: String;
begin
  // Try system temp first
  TempDir := ExpandConstant('{tmp}');
  
  // Verify write access
  if DirExists(TempDir) and IsAdminInstallMode then
    Result := TempDir
  else
    // Fallback to user temp
    Result := ExpandConstant('{usertmp}');
end;
```

### 2. Terms and Conditions Acceptance

#### UI Design

**Custom Page in Installer:**
```pascal
[Code]
var
  TermsPage: TOutputMsgMemoWizardPage;
  AcceptCheckbox: TNewCheckBox;

procedure InitializeWizard;
begin
  // Create terms page after welcome
  TermsPage := CreateOutputMsgMemoPage(wpWelcome,
    'Terms of Service and Privacy Policy',
    'Please review and accept the terms',
    'By installing Tabeza POS Connect, you agree to our Terms of Service and Privacy Policy.',
    '');
  
  // Add terms text
  TermsPage.RichEditViewer.Lines.Add('TABEZA POS CONNECT');
  TermsPage.RichEditViewer.Lines.Add('Terms of Service & Privacy Policy');
  TermsPage.RichEditViewer.Lines.Add('');
  TermsPage.RichEditViewer.Lines.Add('Full terms available at: https://tabeza.co.ke/terms');
  TermsPage.RichEditViewer.Lines.Add('');
  TermsPage.RichEditViewer.Lines.Add('By installing this software, you agree to:');
  TermsPage.RichEditViewer.Lines.Add('1. Use the service in accordance with our Terms of Service');
  TermsPage.RichEditViewer.Lines.Add('2. Allow collection of usage data as described in our Privacy Policy');
  TermsPage.RichEditViewer.Lines.Add('3. Comply with all applicable laws and regulations');
  
  // Add acceptance checkbox
  AcceptCheckbox := TNewCheckBox.Create(TermsPage);
  AcceptCheckbox.Parent := TermsPage.Surface;
  AcceptCheckbox.Top := TermsPage.RichEditViewer.Top + TermsPage.RichEditViewer.Height + 16;
  AcceptCheckbox.Width := TermsPage.SurfaceWidth;
  AcceptCheckbox.Caption := 'I accept the Terms of Service and Privacy Policy';
  AcceptCheckbox.Checked := False;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  
  // Validate terms acceptance
  if CurPageID = TermsPage.ID then
  begin
    if not AcceptCheckbox.Checked then
    begin
      MsgBox('You must accept the Terms of Service and Privacy Policy to continue.', 
             mbError, MB_OK);
      Result := False;
    end;
  end;
end;
```

#### Acceptance Logging

**Log Format:**
```json
{
  "timestamp": "2026-02-19T10:30:00Z",
  "barId": "bar_abc123",
  "termsVersion": "v1.0",
  "installerVersion": "1.2.0",
  "accepted": true,
  "ipAddress": "192.168.1.100"
}
```

**Implementation:**
```pascal
procedure LogTermsAcceptance(BarID: String);
var
  LogFile: String;
  LogContent: String;
  Timestamp: String;
begin
  LogFile := ExpandConstant('{app}\logs\terms-acceptance.log');
  Timestamp := GetDateTimeString('yyyy-mm-dd hh:nn:ss', #0, #0);
  
  LogContent := Format('[%s] Bar ID: %s | Terms v1.0 | Installer v1.2.0 | Accepted', 
                       [Timestamp, BarID]);
  
  SaveStringToFile(LogFile, LogContent + #13#10, True);
end;
```

### 3. Branding Updates

#### Display Names

**User-Facing (with space):**
- Application Name: "Tabeza POS Connect"
- Service Display Name: "Tabeza POS Connect Service"
- Start Menu Folder: "Tabeza POS Connect"
- Uninstaller Name: "Tabeza POS Connect"

**Technical (no space):**
- Executable: `TabezaConnect-Setup-v1.2.0.exe`
- Service Name: `TabezaConnectService`
- Install Directory: `C:\Program Files\TabezaConnect`
- Registry Key: `HKLM\Software\TabezaConnect`

**Inno Setup Configuration:**
```pascal
[Setup]
AppName=Tabeza POS Connect
AppVersion=1.2.0
AppPublisher=Tabeza
AppPublisherURL=https://tabeza.co.ke
AppSupportURL=https://tabeza.co.ke/support
AppUpdatesURL=https://github.com/billoapp/TabezaConnect/releases

DefaultDirName={autopf}\TabezaConnect
DefaultGroupName=Tabeza POS Connect
UninstallDisplayName=Tabeza POS Connect

OutputBaseFilename=TabezaConnect-Setup-v1.2.0
```

### 4. Antivirus Compatibility

#### Strategy: Minimize False Positives

**Best Practices:**
1. **Use Standard Patterns**: Follow Windows installer conventions
2. **Avoid Rapid Operations**: Add small delays between file operations
3. **Clear Metadata**: Include version info, company name, description
4. **Retry Logic**: Handle temporary file locks

**Implementation:**
```pascal
[Code]
function InstallFileWithRetry(SourceFile, DestFile: String): Boolean;
var
  Retry: Integer;
  Success: Boolean;
begin
  Retry := 0;
  Success := False;
  
  while (Retry < 3) and (not Success) do
  begin
    try
      FileCopy(SourceFile, DestFile, False);
      Success := True;
    except
      Retry := Retry + 1;
      if Retry < 3 then
        Sleep(1000); // Wait 1 second before retry
    end;
  end;
  
  Result := Success;
end;
```

#### Version Information

**Add to executable metadata:**
```
FileVersion: 1.2.0.0
ProductVersion: 1.2.0
CompanyName: Tabeza
FileDescription: Tabeza POS Connect Installer
ProductName: Tabeza POS Connect
LegalCopyright: Copyright © 2026 Tabeza
```

### 5. Bar ID Configuration

#### Input Validation

**Custom Page:**
```pascal
var
  BarIDPage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  // Create Bar ID input page
  BarIDPage := CreateInputQueryPage(TermsPage.ID,
    'Venue Configuration',
    'Enter your Bar ID',
    'Please enter the Bar ID provided by Tabeza. You can find this in your staff dashboard.');
  
  BarIDPage.Add('Bar ID:', False);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  BarID: String;
begin
  Result := True;
  
  if CurPageID = BarIDPage.ID then
  begin
    BarID := Trim(BarIDPage.Values[0]);
    
    // Validate Bar ID format
    if Length(BarID) < 8 then
    begin
      MsgBox('Please enter a valid Bar ID. It should be at least 8 characters long.', 
             mbError, MB_OK);
      Result := False;
    end
    else if Pos(' ', BarID) > 0 then
    begin
      MsgBox('Bar ID should not contain spaces.', mbError, MB_OK);
      Result := False;
    end;
  end;
end;
```

#### Configuration File

**Save to JSON:**
```pascal
procedure SaveConfiguration(BarID: String);
var
  ConfigFile: String;
  ConfigContent: String;
begin
  ConfigFile := ExpandConstant('{app}\config.json');
  
  ConfigContent := '{' + #13#10 +
    '  "barId": "' + BarID + '",' + #13#10 +
    '  "version": "1.2.0",' + #13#10 +
    '  "installedAt": "' + GetDateTimeString('yyyy-mm-dd"T"hh:nn:ss"Z"', #0, #0) + '",' + #13#10 +
    '  "apiUrl": "https://api.tabeza.co.ke"' + #13#10 +
    '}';
  
  SaveStringToFile(ConfigFile, ConfigContent, False);
end;
```

### 6. Service Installation

#### Windows Service Setup

**Using NSSM (Non-Sucking Service Manager):**
```pascal
[Files]
Source: "nssm.exe"; DestDir: "{app}\bin"; Flags: ignoreversion

[Run]
; Install service
Filename: "{app}\bin\nssm.exe"; Parameters: "install TabezaConnectService ""{app}\bin\node.exe"" ""{app}\service\index.js"""; Flags: runhidden
; Set service display name
Filename: "{app}\bin\nssm.exe"; Parameters: "set TabezaConnectService DisplayName ""Tabeza POS Connect Service"""; Flags: runhidden
; Set service description
Filename: "{app}\bin\nssm.exe"; Parameters: "set TabezaConnectService Description ""Tabeza POS receipt capture and relay service"""; Flags: runhidden
; Set startup type to automatic
Filename: "{app}\bin\nssm.exe"; Parameters: "set TabezaConnectService Start SERVICE_AUTO_START"; Flags: runhidden
; Start service
Filename: "{app}\bin\nssm.exe"; Parameters: "start TabezaConnectService"; Flags: runhidden
```

**Service Configuration:**
```pascal
procedure ConfigureService;
var
  ResultCode: Integer;
begin
  // Set service to restart on failure
  Exec(ExpandConstant('{app}\bin\nssm.exe'), 
       'set TabezaConnectService AppExit Default Restart',
       '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  
  // Set restart delay to 10 seconds
  Exec(ExpandConstant('{app}\bin\nssm.exe'),
       'set TabezaConnectService AppRestartDelay 10000',
       '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;
```

### 7. Error Handling

#### User-Friendly Error Messages

**Common Errors:**
```pascal
const
  ERR_ADMIN_REQUIRED = 'Administrator privileges are required to install Tabeza POS Connect. Please right-click the installer and select "Run as administrator".';
  ERR_DISK_SPACE = 'Insufficient disk space. Please free up at least 100MB and try again.';
  ERR_ANTIVIRUS = 'Installation was blocked by antivirus software. Please temporarily disable your antivirus or add an exception for the installer.';
  ERR_SERVICE_START = 'The service was installed but failed to start. Please check Windows Event Viewer for details or contact support@tabeza.co.ke';

function HandleInstallError(ErrorCode: Integer): String;
begin
  case ErrorCode of
    5: Result := ERR_ADMIN_REQUIRED;
    112: Result := ERR_DISK_SPACE;
    else
      Result := Format('Installation failed with error code %d. Please contact support@tabeza.co.ke', [ErrorCode]);
  end;
end;
```

## Data Flow

### Installation Process

```
1. User Downloads Installer
   ↓
2. UAC Elevation Request
   ↓ (if declined)
   └→ Show ERR_ADMIN_REQUIRED
   
3. Welcome Screen
   ↓
4. Terms & Conditions Page
   ↓ (if not accepted)
   └→ Block Next button
   
5. Bar ID Input Page
   ↓ (validate format)
   └→ Show validation error if invalid
   
6. Installation Progress
   - Extract files to Program Files
   - Create config.json with Bar ID
   - Log terms acceptance
   - Install Windows service
   - Configure service settings
   ↓ (on error)
   └→ Show specific error message
   
7. Service Start
   ↓ (verify running)
   └→ Show ERR_SERVICE_START if failed
   
8. Completion Screen
   - Show success message
   - Provide next steps
   - Link to dashboard
```

## Testing Strategy

### Test Cases

#### 1. Admin Rights
- **TC1.1**: Install with admin rights → Success
- **TC1.2**: Install without admin rights → Clear error message
- **TC1.3**: Install on locked directory → Retry logic works

#### 2. Terms Acceptance
- **TC2.1**: Try to proceed without accepting → Blocked
- **TC2.2**: Accept terms → Installation proceeds
- **TC2.3**: Terms logged correctly → Verify log file

#### 3. Bar ID Validation
- **TC3.1**: Enter valid Bar ID → Accepted
- **TC3.2**: Enter short Bar ID → Validation error
- **TC3.3**: Enter Bar ID with spaces → Validation error
- **TC3.4**: Configuration saved correctly → Verify config.json

#### 4. Branding
- **TC4.1**: Check Programs list → Shows "Tabeza POS Connect"
- **TC4.2**: Check Start menu → Shows "Tabeza POS Connect"
- **TC4.3**: Check service name → Shows "Tabeza POS Connect Service"
- **TC4.4**: Check install directory → Uses "TabezaConnect"

#### 5. Service Installation
- **TC5.1**: Service installs successfully → Verify in Services
- **TC5.2**: Service starts automatically → Check status
- **TC5.3**: Service survives reboot → Restart and verify

#### 6. Antivirus Compatibility
- **TC6.1**: Install with Windows Defender → Success
- **TC6.2**: Install with Avast → Success (may show warning)
- **TC6.3**: Retry logic handles temporary locks → Success

## Correctness Properties

### Property 1: Admin Elevation Requirement
**Property**: Installation MUST fail gracefully if admin rights are not granted
```
∀ installation_attempt:
  IF NOT has_admin_rights(installation_attempt)
  THEN installation_fails_with_clear_message(installation_attempt)
```

**Validates**: Requirements 1.1

### Property 2: Terms Acceptance Requirement
**Property**: Installation CANNOT proceed without terms acceptance
```
∀ installation_attempt:
  IF NOT terms_accepted(installation_attempt)
  THEN cannot_proceed_past_terms_page(installation_attempt)
```

**Validates**: Requirements 2.1

### Property 3: Bar ID Validation
**Property**: Only valid Bar IDs are accepted
```
∀ bar_id:
  IF length(bar_id) < 8 OR contains_spaces(bar_id)
  THEN validation_fails(bar_id)
```

**Validates**: User Story 1

### Property 4: Service Installation Success
**Property**: Service MUST be installed and running after successful installation
```
∀ successful_installation:
  service_exists("TabezaConnectService") AND
  service_status("TabezaConnectService") = "Running"
```

**Validates**: User Story 1

### Property 5: Configuration Persistence
**Property**: Bar ID and terms acceptance MUST be persisted
```
∀ installation:
  IF installation_complete(installation)
  THEN config_file_exists(installation) AND
       terms_log_exists(installation) AND
       bar_id_matches(installation)
```

**Validates**: Requirements 2.2

## Security Considerations

### 1. Bar ID Storage
- Store in plain text config file (acceptable for MVP)
- File permissions: Read-only for non-admin users
- Future: Encrypt sensitive configuration

### 2. Terms Acceptance Logging
- Log locally for compliance
- Include timestamp and version
- Future: Send to backend API for centralized tracking

### 3. Service Security
- Run as Local System account
- Restrict file permissions to admin only
- Future: Run as dedicated service account

## Performance Considerations

### Installation Time
- Target: < 2 minutes total
- File extraction: ~30 seconds
- Service installation: ~15 seconds
- Service start: ~10 seconds
- User input time: Variable

### Resource Usage
- Disk space: ~50MB
- Memory during install: ~100MB
- Service memory: ~50MB running

## Deployment

### Build Process
1. Update Inno Setup script with changes
2. Compile installer with Inno Setup Compiler
3. Test on clean Windows 10/11 VMs
4. Upload to GitHub releases
5. Update download links in staff app

### Release Checklist
- [ ] Inno Setup script updated
- [ ] Terms text finalized
- [ ] Bar ID validation tested
- [ ] Service installation tested
- [ ] Branding verified
- [ ] Error messages reviewed
- [ ] Tested on Windows 10
- [ ] Tested on Windows 11
- [ ] Tested with Defender
- [ ] Tested with Avast
- [ ] GitHub release created
- [ ] Download links updated

## Future Enhancements

### Post-MVP Improvements
1. **Code Signing**: Obtain certificate to eliminate security warnings
2. **Auto-Updates**: Check for updates and prompt user
3. **Silent Installation**: Support `/SILENT` flag for IT deployments
4. **Unattended Mode**: Pre-configure Bar ID via command line
5. **Multi-language**: Support additional languages
6. **Telemetry**: Send installation success/failure metrics

## References

- Inno Setup Documentation: https://jrsoftware.org/ishelp/
- NSSM Documentation: https://nssm.cc/usage
- Windows Service Best Practices: https://docs.microsoft.com/en-us/windows/win32/services/
