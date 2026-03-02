; Tabeza POS Connect Installer Script
; Version 1.6.2 - BUGFIXES FOR UPGRADE HANDLING
; Built with Inno Setup 6.x
; Based on v1.6.0 with critical fixes
;
; NEW IN v1.6.2 (improvements over v1.6.0):
; - FIXED: Config preservation during upgrades (barId, driverId)
; - FIXED: Service cleanup before installation (stop + delete old service)
; - FIXED: Port configuration using folder port approach
; - Enhanced upgrade reliability

[Setup]
; Application Information
AppName=Tabeza POS Connect
AppVersion=1.6.2
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
OutputBaseFilename=TabezaConnect-Setup-v1.6.2
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

; License File
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
; Compiled Service Executable
Source: "TabezaConnect.exe"; DestDir: "{app}"; Flags: ignoreversion; Components: core

; PowerShell Scripts
Source: "src\installer\scripts\create-folders.ps1"; DestDir: "{app}\scripts"; Components: core
Source: "src\installer\scripts\detect-thermal-printer.ps1"; DestDir: "{app}\scripts"; Components: core
Source: "src\installer\scripts\configure-bridge.ps1"; DestDir: "{app}\scripts"; Components: core
Source: "src\installer\scripts\configure-pooling-printer.ps1"; DestDir: "{app}\scripts"; Components: core
Source: "src\installer\scripts\uninstall-pooling-printer.ps1"; DestDir: "{app}\scripts"; Components: core
Source: "src\installer\scripts\verify-bridge.ps1"; DestDir: "{app}\scripts"; Components: core
Source: "src\installer\scripts\register-service-pkg.ps1"; DestDir: "{app}\scripts"; Components: core
Source: "src\installer\scripts\register-printer-with-api.ps1"; DestDir: "{app}\scripts"; Components: core
Source: "src\installer\scripts\check-service-started.ps1"; DestDir: "{app}\scripts"; Components: core
Source: "src\installer\scripts\write-status.ps1"; DestDir: "{app}\scripts"; Components: core
Source: "src\installer\scripts\show-installation-summary.ps1"; DestDir: "{app}\scripts"; Components: core
Source: "src\installer\scripts\merge-preserved-config.ps1"; DestDir: "{app}\scripts"; Components: core

; Bridge Service
Source: "src\service\final-bridge.js"; DestDir: "{app}\service"; Components: core

; Configuration Template
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
Name: "{commonappdata}\Tabeza"; Permissions: users-modify
Name: "{commonappdata}\Tabeza\logs"; Permissions: users-modify
Name: "{commonappdata}\Tabeza\TabezaPrints"; Permissions: users-modify
Name: "{commonappdata}\Tabeza\temp"; Permissions: users-modify
Name: "{commonappdata}\Tabeza\queue"; Permissions: users-modify

[Code]
var
  BarIdPage: TInputQueryWizardPage;
  BarId: String;
  PreservedBarId: String;
  PreservedDriverId: String;
  HasExistingConfig: Boolean;

{ Log terms acceptance }
procedure LogTermsAcceptance;
var
  LogFile: String;
  LogContent: String;
  Timestamp: String;
begin
  LogFile := ExpandConstant('{commonappdata}\Tabeza\logs\terms-acceptance.log');
  Timestamp := GetDateTimeString('yyyy-mm-dd hh:nn:ss', #0, #0);
  LogContent := Format('[%s] Bar ID: %s | Terms v1.0 | Installer v1.6.2 | Accepted via built-in license page', [Timestamp, BarId]);
  SaveStringToFile(LogFile, LogContent + #13#10, True);
end;

{ Simple config value parser }
function ExtractConfigValue(const Content: String; const Key: String): String;
var
  KeyPos, ValueStart, ValueEnd: Integer;
  Line: String;
begin
  Result := '';
  KeyPos := Pos('"' + Key + '"', Content);
  
  if KeyPos > 0 then
  begin
    ValueStart := Pos(':', Copy(Content, KeyPos, Length(Content))) + KeyPos;
    if ValueStart > KeyPos then
    begin
      Line := Trim(Copy(Content, ValueStart, Length(Content)));
      if (Length(Line) > 0) and (Line[1] = '"') then
      begin
        Line := Copy(Line, 2, Length(Line));
        ValueEnd := Pos('"', Line);
        if ValueEnd > 0 then
          Result := Copy(Line, 1, ValueEnd - 1);
      end;
    end;
  end;
end;

{ Load preserved config values }
procedure LoadPreservedConfig();
var
  ExistingConfigPath: String;
  ConfigContent: AnsiString;
begin
  HasExistingConfig := False;
  PreservedBarId := '';
  PreservedDriverId := '';
  
  ExistingConfigPath := ExpandConstant('{commonappdata}\Tabeza\config.json');
  
  if FileExists(ExistingConfigPath) then
  begin
    Log('Existing config.json found, preserving configuration...');
    
    try
      if LoadStringFromFile(ExistingConfigPath, ConfigContent) then
      begin
        PreservedBarId := ExtractConfigValue(String(ConfigContent), 'barId');
        PreservedDriverId := ExtractConfigValue(String(ConfigContent), 'driverId');
        
        if (PreservedBarId <> '') or (PreservedDriverId <> '') then
        begin
          HasExistingConfig := True;
          Log('Preserved barId: ' + PreservedBarId);
          Log('Preserved driverId: ' + PreservedDriverId);
        end;
      end;
    except
      Log('Warning: Could not parse config.json');
    end;
  end;
end;

{ Initialize setup }
function InitializeSetup(): Boolean;
begin
  LoadPreservedConfig();
  Result := True;
end;

{ Initialize wizard }
procedure InitializeWizard;
begin
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

{ Validate Bar ID input }
function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  
  if CurPageID = BarIdPage.ID then
  begin
    BarId := Trim(BarIdPage.Values[0]);
    
    if BarId = '' then
    begin
      MsgBox(ExpandConstant('{cm:BarIdEmpty}'), mbError, MB_OK);
      Result := False;
      Exit;
    end;
    
    if not ValidateBarId(BarId) then
    begin
      MsgBox(ExpandConstant('{cm:BarIdInvalid}'), mbError, MB_OK);
      Result := False;
      Exit;
    end;
  end;
end;

{ Pre-fill Bar ID if upgrading }
procedure CurPageChanged(CurPageID: Integer);
begin
  if (CurPageID = BarIdPage.ID) and (PreservedBarId <> '') then
  begin
    BarIdPage.Values[0] := PreservedBarId;
    Log('Pre-filled Bar ID: ' + PreservedBarId);
  end;
end;

{ Post-install actions }
procedure CurStepChanged(CurStep: TSetupStep);
var
  PoolingErrorMsg: String;
begin
  if CurStep = ssPostInstall then
  begin
    LogTermsAcceptance;
    
    { Check pooling printer configuration result }
    { Note: The pooling configuration runs in [Run] section with waituntilterminated }
    { Exit codes: 0=success, 2=already configured (idempotent), 3=no printer, 4=no admin, 1=other error }
    if IsAdminInstallMode then
    begin
      PoolingErrorMsg := CheckPoolingConfigurationLog();
      
      if PoolingErrorMsg <> '' then
      begin
        { Log the error but allow installation to continue }
        Log('Pooling printer configuration warning: ' + PoolingErrorMsg);
        
        { Display informational message to user }
        MsgBox('Printer Configuration Notice:' + #13#10 + #13#10 +
               PoolingErrorMsg + #13#10 + #13#10 +
               'The TabezaConnect service has been installed successfully, but automatic printer configuration was not completed.' + #13#10 + #13#10 +
               'You can configure the printer manually using the instructions in the documentation, or contact support for assistance.' + #13#10 + #13#10 +
               'Log file: C:\ProgramData\Tabeza\logs\configure-pooling.log',
               mbInformation, MB_OK);
      end
      else
      begin
        Log('Pooling printer configuration completed successfully');
      end;
    end;
  end;
end;

{ Get Bar ID for scripts }
function GetBarId(Param: String): String;
begin
  Result := BarId;
end;

{ Get API URL }
function GetApiUrl(Param: String): String;
begin
  Result := 'https://tabeza.co.ke';
end;

{ Get preserved Bar ID }
function GetPreservedBarId(Param: String): String;
begin
  Result := PreservedBarId;
end;

{ Get preserved Driver ID }
function GetPreservedDriverId(Param: String): String;
begin
  Result := PreservedDriverId;
end;

{ Check if we have preserved config }
function HasPreservedConfig(): Boolean;
begin
  Result := HasExistingConfig;
end;

{ Check if running in admin mode }
function IsAdminInstallMode(): Boolean;
begin
  Result := IsAdmin;
end;

{ Check pooling printer configuration log for errors }
function CheckPoolingConfigurationLog(): String;
var
  LogFile: String;
  LogContent: AnsiString;
  LogStr: String;
begin
  Result := '';
  LogFile := ExpandConstant('{commonappdata}\Tabeza\logs\configure-pooling.log');
  
  if FileExists(LogFile) then
  begin
    try
      if LoadStringFromFile(LogFile, LogContent) then
      begin
        LogStr := String(LogContent);
        
        { Check for critical errors }
        if Pos('[ERROR]', LogStr) > 0 then
        begin
          if Pos('No thermal printer detected', LogStr) > 0 then
            Result := 'No thermal printer detected. Please ensure your printer is connected and drivers are installed.'
          else if Pos('Administrator privileges required', LogStr) > 0 then
            Result := 'Administrator privileges required for printer configuration.'
          else if Pos('Print Spooler service is not running', LogStr) > 0 then
            Result := 'Windows Print Spooler service is not running. Please start the service and try again.'
          else
            Result := 'Printer configuration encountered an error. Check the log file for details.';
        end;
      end;
    except
      { Ignore log read errors }
    end;
  end;
end;

{ Prepare for installation - handle upgrades }
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
  RetryCount: Integer;
begin
  Result := '';
  NeedsRestart := False;
  
  { Check for existing service }
  if Exec('sc.exe', 'query TabezaConnect', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    if ResultCode = 0 then
    begin
      Log('Existing service detected, stopping...');
      
      if Exec('sc.exe', 'stop TabezaConnect', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
      begin
        RetryCount := 0;
        repeat
          Sleep(1000);
          Exec('sc.exe', 'query TabezaConnect', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
          RetryCount := RetryCount + 1;
        until (RetryCount >= 10);
        
        Log('Service stopped');
      end;
      
      Log('Removing old service registration...');
      if Exec('sc.exe', 'delete TabezaConnect', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
      begin
        Sleep(2000);
        Log('Old service removed');
      end;
    end;
  end;
  
  Result := '';
end;

[Run]
; Step 1: Create folders
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\create-folders.ps1"" -WatchFolder ""C:\TabezaPrints"""; \
  StatusMsg: "Creating folders..."; \
  Flags: runhidden waituntilterminated; \
  Components: core

; Step 2: Configure pooling printer (automatic printer detection and configuration)
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\configure-pooling-printer.ps1"" -CaptureFilePath ""C:\TabezaPrints\order.prn"""; \
  StatusMsg: "Configuring Tabeza POS Printer..."; \
  Flags: runhidden waituntilterminated; \
  Components: core; \
  Check: IsAdminInstallMode

; Step 3: Detect printer (fallback for legacy bridge mode)
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\detect-thermal-printer.ps1"" -OutputFile ""C:\ProgramData\Tabeza\detected-printer.json"""; \
  StatusMsg: "Detecting printer..."; \
  Flags: runhidden waituntilterminated; \
  Components: core

; Step 4: Configure bridge (legacy bridge mode)
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\configure-bridge.ps1"" -BarId ""{code:GetBarId}"" -ConfigFile ""C:\ProgramData\Tabeza\config.json"""; \
  StatusMsg: "Configuring printer..."; \
  Flags: runhidden waituntilterminated; \
  Components: core

; Step 4b: Merge preserved config (only if upgrading)
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\merge-preserved-config.ps1"" -PreservedBarId ""{code:GetPreservedBarId}"" -PreservedDriverId ""{code:GetPreservedDriverId}"" -ConfigFile ""C:\ProgramData\Tabeza\config.json"""; \
  StatusMsg: "Restoring configuration..."; \
  Flags: runhidden waituntilterminated; \
  Components: core; \
  Check: HasPreservedConfig

; Step 5: Register service
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\register-service-pkg.ps1"" -InstallPath ""{app}"" -BarId ""{code:GetBarId}"""; \
  StatusMsg: "Registering service..."; \
  Flags: runhidden waituntilterminated; \
  Components: core

; Step 6: Start service
Filename: "sc.exe"; \
  Parameters: "start TabezaConnect"; \
  StatusMsg: "Starting service..."; \
  Flags: runhidden waituntilterminated; \
  Components: core

; Step 6b: Check service started
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\check-service-started.ps1"""; \
  StatusMsg: "Verifying service..."; \
  Flags: runhidden waituntilterminated; \
  Components: core

; Step 7: Register printer with API
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\register-printer-with-api.ps1"" -BarId ""{code:GetBarId}"" -ConfigFile ""C:\ProgramData\Tabeza\config.json"""; \
  StatusMsg: "Registering printer..."; \
  Flags: runhidden waituntilterminated; \
  Components: core

; Step 8: Verify installation
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\verify-bridge.ps1"" -InstallPath ""{app}"""; \
  StatusMsg: "Verifying installation..."; \
  Flags: runhidden waituntilterminated; \
  Components: core

; Step 9: Show summary
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\show-installation-summary.ps1"""; \
  StatusMsg: "Generating summary..."; \
  Flags: waituntilterminated; \
  Components: core

; Step 10: Post-install instructions (optional)
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

; Remove Tabeza POS Printer and capture port (preserves capture file data)
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\uninstall-pooling-printer.ps1"" -PreserveCaptureData -Silent"; \
  Flags: runhidden; \
  RunOnceId: "RemovePoolingPrinter"

; Remove legacy bridge printer (for backwards compatibility)
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -Command ""Remove-Printer -Name 'Tabeza POS Connect' -ErrorAction SilentlyContinue"""; \
  Flags: runhidden; \
  RunOnceId: "RemoveLegacyPrinter"

[UninstallDelete]
Name: "{commonappdata}\Tabeza\logs"; Type: filesandordirs
Name: "{commonappdata}\Tabeza\TabezaPrints"; Type: filesandordirs
Name: "{commonappdata}\Tabeza\temp"; Type: filesandordirs
Name: "{commonappdata}\Tabeza\queue"; Type: filesandordirs
Name: "{commonappdata}\Tabeza\detected-printer.json"; Type: files

[Registry]
Root: HKLM; Subkey: "Software\Tabeza\Connect"; ValueType: string; ValueName: "InstallPath"; ValueData: "{app}"; Flags: uninsdeletekey
Root: HKLM; Subkey: "Software\Tabeza\Connect"; ValueType: string; ValueName: "Version"; ValueData: "1.6.2"; Flags: uninsdeletekey
Root: HKLM; Subkey: "Software\Tabeza\Connect"; ValueType: string; ValueName: "BarId"; ValueData: "{code:GetBarId}"; Flags: uninsdeletekey
Root: HKLM; Subkey: "Software\Tabeza\Connect"; ValueType: string; ValueName: "TermsAccepted"; ValueData: "v1.0"; Flags: uninsdeletekey
Root: HKLM; Subkey: "Software\Tabeza\Connect"; ValueType: string; ValueName: "CaptureMode"; ValueData: "bridge"; Flags: uninsdeletekey
