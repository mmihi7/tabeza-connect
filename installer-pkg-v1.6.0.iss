; Tabeza POS Connect Installer Script
; Version 1.6.0 - SILENT BRIDGE + PRINTER MANAGEMENT UI
; Built with Inno Setup 6.x
; Based on v1.5.1 with new features
;
; NEW IN v1.6.0 (improvements over v1.5.1):
; - Silent bridge integration (automatic printer detection & configuration)
; - Printer management UI (self-service printer replacement at localhost:8765/printer-settings.html)
; - Unified config.json structure (bridge settings integrated)
; - Automatic spooler restart after port setup (fixes error state)
; - Real test print verification (end-to-end validation)
; - Unique temp files per job (fixes race condition)
; - Runtime printer changes without service restart
;
; PRESERVED FROM v1.5.1:
; - Built-in Inno Setup license page (simple checkbox, inline terms)
; - Clean Bar ID validation
; - Terms acceptance logging
; - All existing functionality

[Setup]
; Application Information
AppName=Tabeza POS Connect
AppVersion=1.6.0
AppPublisher=Tabeza
AppPublisherURL=https://tabeza.co.ke
AppSupportURL=https://tabeza.co.ke/support
AppUpdatesURL=https://tabeza.co.ke/downloads
AppCopyright=Copyright (C) 2026 Tabeza

; Installation Directories
DefaultDirName={autopf}\TabezaConnect
DefaultGroupName=Tabeza POS Connect
DisableProgramGroupPage=yes

; Output Configuration
OutputDir=dist
OutputBaseFilename=TabezaConnect-Setup-v1.6.0
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\icon.ico

; Compression
Compression=lzma2/max
SolidCompression=yes

; Privileges and Architecture
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog
ArchitecturesInstallIn64BitMode=x64
ArchitecturesAllowed=x64

; Directory Configuration
UsePreviousAppDir=yes
DirExistsWarning=auto
DisableDirPage=no

; Wizard Configuration
WizardStyle=modern
DisableWelcomePage=no

; License File - Use built-in license page for proper checkbox behavior
LicenseFile=src\installer\TERMS_AND_PRIVACY.txt

; Uninstall Configuration
UninstallDisplayName=Tabeza POS Connect
UninstallFilesDir={app}\uninstall

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Messages]
WelcomeLabel2=This will install Tabeza POS Connect on your computer.%n%nTabeza POS Connect captures receipt data from your POS system and syncs it with the Tabeza staff app.%n%nIMPORTANT: Your printer will be automatically detected and configured.

[CustomMessages]
BarIdPrompt=Enter your Bar ID from the Tabeza staff dashboard:
BarIdInvalid=Bar ID must be at least 6 characters and contain only letters, numbers, and hyphens.
BarIdEmpty=Bar ID is required to continue installation.

[Types]
Name: "full"; Description: "Full installation"
Name: "custom"; Description: "Custom installation"; Flags: iscustom

[Components]
Name: "core"; Description: "Core Service (Required)"; Types: full custom; Flags: fixed
Name: "docs"; Description: "Documentation"; Types: full custom

[Files]
; ============================================================================
; PKG VERSION: Compiled executable + scripts
; ============================================================================

; Compiled Service Executable
Source: "TabezaConnect.exe"; DestDir: "{app}"; Flags: ignoreversion; Components: core

; PowerShell Scripts (NEW SCRIPTS FOR BRIDGE)
Source: "src\installer\scripts\create-folders.ps1"; DestDir: "{app}\scripts"; Components: core
Source: "src\installer\scripts\detect-thermal-printer.ps1"; DestDir: "{app}\scripts"; Components: core
Source: "src\installer\scripts\configure-bridge.ps1"; DestDir: "{app}\scripts"; Components: core
Source: "src\installer\scripts\verify-bridge.ps1"; DestDir: "{app}\scripts"; Components: core
Source: "src\installer\scripts\register-service-pkg.ps1"; DestDir: "{app}\scripts"; Components: core
Source: "src\installer\scripts\register-printer-with-api.ps1"; DestDir: "{app}\scripts"; Components: core

; Bridge Service
Source: "src\service\final-bridge.js"; DestDir: "{app}\service"; Components: core

; Configuration Template (UNIFIED STRUCTURE)
Source: "config.template.json"; DestDir: "{app}"; DestName: "config.json"; Flags: onlyifdoesntexist; Components: core

; Terms and Privacy
Source: "src\installer\TERMS_AND_PRIVACY.txt"; DestDir: "{app}\docs"; Flags: ignoreversion; Components: core

; Documentation
Source: "Plan\README.txt"; DestDir: "{app}\docs"; Components: docs
Source: "Plan\BEFORE-INSTALL.txt"; DestDir: "{app}\docs"; Components: docs
Source: "Plan\AFTER-INSTALL.txt"; DestDir: "{app}\docs"; Components: docs

; Icon and License
Source: "icon.ico"; DestDir: "{app}"; Components: core
Source: "LICENSE.txt"; DestDir: "{app}"; Components: core

[Dirs]
; Create application data directories
Name: "{commonappdata}\Tabeza"; Permissions: users-modify
Name: "{commonappdata}\Tabeza\logs"; Permissions: users-modify
Name: "{commonappdata}\Tabeza\TabezaPrints"; Permissions: users-modify
Name: "{commonappdata}\Tabeza\temp"; Permissions: users-modify
Name: "{commonappdata}\Tabeza\queue"; Permissions: users-modify

[Code]
var
  BarIdPage: TInputQueryWizardPage;
  BarId: String;

{ Log terms acceptance (built-in license page automatically handles acceptance) }
procedure LogTermsAcceptance;
var
  LogFile: String;
  LogContent: String;
  Timestamp: String;
begin
  LogFile := ExpandConstant('{commonappdata}\Tabeza\logs\terms-acceptance.log');
  Timestamp := GetDateTimeString('yyyy-mm-dd hh:nn:ss', #0, #0);
  LogContent := Format('[%s] Bar ID: %s | Terms v1.0 | Installer v1.6.0 | Accepted via built-in license page', [Timestamp, BarId]);
  SaveStringToFile(LogFile, LogContent + #13#10, True);
end;

{ Initialize wizard }
procedure InitializeWizard;
begin
  { Create Bar ID input page after license page }
  BarIdPage := CreateInputQueryPage(wpLicense,
    'Configuration', 'Enter your venue details',
    'Please enter your Bar ID from the Tabeza staff dashboard.' + #13#10 + #13#10 +
    'To find your Bar ID:' + #13#10 +
    '1. Log in to https://tabeza.co.ke' + #13#10 +
    '2. Go to Settings > Venue Details' + #13#10 +
    '3. Copy your Bar ID');
  
  BarIdPage.Add('Bar ID:', False);
  BarIdPage.Values[0] := '';
end;

{ Validate Bar ID }
function ValidateBarId(const Value: String): Boolean;
var
  I: Integer;
  C: Char;
begin
  Result := False;
  
  if Length(Value) < 6 then
    Exit;
  
  for I := 1 to Length(Value) do
  begin
    C := Value[I];
    if not (((C >= 'a') and (C <= 'z')) or
            ((C >= 'A') and (C <= 'Z')) or
            ((C >= '0') and (C <= '9')) or
            (C = '-')) then
      Exit;
  end;
  
  Result := True;
end;

{ Validate Bar ID only (license acceptance handled by built-in page) }
function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  
  { Validate Bar ID }
  if CurPageID = BarIdPage.ID then
  begin
    BarId := Trim(BarIdPage.Values[0]);
    
    { Check if empty }
    if BarId = '' then
    begin
      MsgBox(ExpandConstant('{cm:BarIdEmpty}'), mbError, MB_OK);
      Result := False;
      Exit;
    end;
    
    { Validate format }
    if not ValidateBarId(BarId) then
    begin
      MsgBox(ExpandConstant('{cm:BarIdInvalid}'), mbError, MB_OK);
      Result := False;
      Exit;
    end;
  end;
end;

{ Post-install actions }
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    { Log terms acceptance }
    LogTermsAcceptance;
  end;
end;

{ Get Bar ID for use in scripts }
function GetBarId(Param: String): String;
begin
  Result := BarId;
end;

{ Get API URL }
function GetApiUrl(Param: String): String;
begin
  Result := 'https://tabeza.co.ke';
end;

[Run]
; Step 1: Create folders
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\create-folders.ps1"" -WatchFolder ""C:\ProgramData\Tabeza\TabezaPrints"""; \
  StatusMsg: "Creating folders..."; \
  Flags: runhidden waituntilterminated; \
  Components: core

; Step 2: Detect printer (SILENT)
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\detect-thermal-printer.ps1"" -OutputFile ""C:\ProgramData\Tabeza\detected-printer.json"""; \
  StatusMsg: "Detecting your printer..."; \
  Flags: runhidden waituntilterminated; \
  Components: core

; Step 3: Configure bridge (SILENT - includes spooler restart)
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\configure-bridge.ps1"" -BarId ""{code:GetBarId}"" -ConfigFile ""C:\ProgramData\Tabeza\config.json"""; \
  StatusMsg: "Setting up your printer..."; \
  Flags: runhidden waituntilterminated; \
  Components: core

; Step 4: Register service
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\register-service-pkg.ps1"" -InstallPath ""{app}"" -BarId ""{code:GetBarId}"""; \
  StatusMsg: "Registering service..."; \
  Flags: runhidden waituntilterminated; \
  Components: core

; Step 5: Start service
Filename: "sc.exe"; \
  Parameters: "start TabezaConnect"; \
  StatusMsg: "Starting service..."; \
  Flags: runhidden waituntilterminated; \
  Components: core

; Step 6: Register printer with Tabeza API
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\register-printer-with-api.ps1"" -BarId ""{code:GetBarId}"" -ConfigFile ""C:\ProgramData\Tabeza\config.json"""; \
  StatusMsg: "Registering printer with Tabeza..."; \
  Flags: runhidden waituntilterminated; \
  Components: core

; Step 7: Verify with REAL test print (NOT runhidden - user needs to see prompt)
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\verify-bridge.ps1"" -InstallPath ""{app}"""; \
  StatusMsg: "Verifying installation..."; \
  Flags: waituntilterminated; \
  Components: core

; Step 8: Show post-install instructions (optional)
Filename: "{win}\notepad.exe"; \
  Parameters: """{app}\docs\AFTER-INSTALL.txt"""; \
  Description: "View post-installation instructions"; \
  Flags: postinstall shellexec skipifsilent nowait unchecked; \
  Components: docs; \
  Check: FileExists(ExpandConstant('{app}\docs\AFTER-INSTALL.txt'))

[UninstallRun]
; Stop the service
Filename: "sc.exe"; \
  Parameters: "stop TabezaConnect"; \
  Flags: runhidden; \
  RunOnceId: "StopService"

; Delete the service
Filename: "sc.exe"; \
  Parameters: "delete TabezaConnect"; \
  Flags: runhidden; \
  RunOnceId: "DeleteService"

; Remove printer (optional)
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -Command ""Remove-Printer -Name 'Tabeza POS Connect' -ErrorAction SilentlyContinue"""; \
  Flags: runhidden; \
  RunOnceId: "RemovePrinter"

[UninstallDelete]
; Clean up files
Name: "{commonappdata}\Tabeza\logs"; Type: filesandordirs
Name: "{commonappdata}\Tabeza\TabezaPrints"; Type: filesandordirs
Name: "{commonappdata}\Tabeza\temp"; Type: filesandordirs
Name: "{commonappdata}\Tabeza\queue"; Type: filesandordirs
Name: "{commonappdata}\Tabeza\detected-printer.json"; Type: files

[Registry]
; Store installation info (consistent with v1.5.1)
Root: HKLM; Subkey: "Software\Tabeza\Connect"; ValueType: string; ValueName: "InstallPath"; ValueData: "{app}"; Flags: uninsdeletekey
Root: HKLM; Subkey: "Software\Tabeza\Connect"; ValueType: string; ValueName: "Version"; ValueData: "1.6.0"; Flags: uninsdeletekey
Root: HKLM; Subkey: "Software\Tabeza\Connect"; ValueType: string; ValueName: "BarId"; ValueData: "{code:GetBarId}"; Flags: uninsdeletekey
Root: HKLM; Subkey: "Software\Tabeza\Connect"; ValueType: string; ValueName: "TermsAccepted"; ValueData: "v1.0"; Flags: uninsdeletekey
Root: HKLM; Subkey: "Software\Tabeza\Connect"; ValueType: string; ValueName: "CaptureMode"; ValueData: "bridge"; Flags: uninsdeletekey
