; Tabeza POS Connect Installer Script
; Version 1.5.2 - FIXED: Built-in License Page
; Built with Inno Setup 6.x
;
; CHANGES IN v1.5.2:
; - FIXED: Uses Inno Setup built-in license page
; - FIXED: Checkbox always visible and functional
; - Removed custom terms page code
; - Full terms loaded from TERMS_AND_PRIVACY.txt
; - Scroll-to-enable behavior (built-in)
; - Terms acceptance logging

[Setup]
; Application Information
AppName=Tabeza POS Connect
AppVersion=1.5.2
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
OutputBaseFilename=TabezaConnect-Setup-v1.5.2
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
WelcomeLabel2=This will install Tabeza POS Connect on your computer.%n%nTabeza POS Connect captures receipt data from your POS system and syncs it with Tabeza staff app.%n%nIMPORTANT: Tabeza works ALONGSIDE your existing printer. Your current printer setup will NOT change.

[CustomMessages]
BarIdPrompt=Enter your Bar ID from Tabeza staff dashboard:
BarIdInvalid=Bar ID must be at least 6 characters and contain only letters, numbers, and hyphens.
BarIdEmpty=Bar ID is required to continue installation.

[Types]
Name: "full"; Description: "Full installation"
Name: "custom"; Description: "Custom installation"; Flags: iscustom

[Components]
Name: "core"; Description: "Core Service (Required)"; Types: full custom; Flags: fixed
Name: "printer"; Description: "Virtual Printer Configuration"; Types: full custom
Name: "docs"; Description: "Documentation"; Types: full custom

[Files]
; Compiled Service Executable
Source: "TabezaConnect.exe"; DestDir: "{app}"; Flags: ignoreversion; Components: core

; PowerShell Scripts
Source: "src\installer\scripts\*"; DestDir: "{app}\scripts"; Flags: recursesubdirs; Components: core

; Configuration Template
Source: "config.template.json"; DestDir: "{app}"; DestName: "config.json"; Flags: onlyifdoesntexist; Components: core

; Terms and Privacy (embedded in installer)
Source: "src\installer\TERMS_AND_PRIVACY.txt"; DestDir: "{app}\docs"; Flags: ignoreversion; Components: core

; Documentation
Source: "Plan\README.txt"; DestDir: "{app}\docs"; Components: docs
Source: "Plan\BEFORE-INSTALL.txt"; DestDir: "{app}\docs"; Components: docs
Source: "Plan\AFTER-INSTALL.txt"; DestDir: "{app}\docs"; Components: docs

; Icon
Source: "icon.ico"; DestDir: "{app}"; Components: core

; License
Source: "LICENSE.txt"; DestDir: "{app}"; Components: core

[Dirs]
; Create application data directories in ProgramData
Name: "{commonappdata}\Tabeza"; Permissions: users-modify
Name: "{commonappdata}\Tabeza\logs"; Permissions: users-modify
Name: "{commonappdata}\Tabeza\config"; Permissions: users-modify
Name: "{commonappdata}\Tabeza\TabezaPrints"; Permissions: users-modify
Name: "{commonappdata}\Tabeza\TabezaPrints\pending"; Permissions: users-modify
Name: "{commonappdata}\Tabeza\TabezaPrints\processed"; Permissions: users-modify
Name: "{commonappdata}\Tabeza\TabezaPrints\failed"; Permissions: users-modify

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
  LogContent := Format('[%s] Bar ID: %s | Terms v1.0 | Installer v1.5.2 | Accepted via built-in license page', [Timestamp, BarId]);
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
  
  { Check minimum length }
  if Length(Value) < 6 then
    Exit;
  
  { Check characters (alphanumeric + hyphens only) }
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
; Step 1: Create watch folders
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\create-folders.ps1"" -WatchFolder ""C:\ProgramData\Tabeza\TabezaPrints"""; \
  StatusMsg: "Creating watch folders..."; \
  Flags: runhidden waituntilterminated; \
  Components: core

; Step 2: Configure printer (if selected)
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\configure-printer.ps1"""; \
  StatusMsg: "Configuring Tabeza POS Connect printer..."; \
  Flags: runhidden waituntilterminated; \
  Components: printer

; Step 3: Register Windows service
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\register-service-pkg.ps1"" -InstallPath ""{app}"" -BarId ""{code:GetBarId}"" -ApiUrl ""{code:GetApiUrl}"""; \
  StatusMsg: "Registering Tabeza POS Connect service..."; \
  Flags: runhidden waituntilterminated; \
  Components: core

; Step 4: Start the service
Filename: "sc.exe"; \
  Parameters: "start TabezaConnect"; \
  StatusMsg: "Starting Tabeza POS Connect service..."; \
  Flags: runhidden waituntilterminated; \
  Components: core

; Step 5: Verify installation
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\verify-installation.ps1"" -InstallPath ""{app}"""; \
  StatusMsg: "Verifying installation..."; \
  Flags: runhidden waituntilterminated; \
  Components: core

; Step 6: Show post-install instructions (optional)
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
; Clean up log files
Name: "{commonappdata}\Tabeza\logs"; Type: filesandordirs
Name: "{commonappdata}\Tabeza\TabezaPrints\processed"; Type: filesandordirs
Name: "{commonappdata}\Tabeza\TabezaPrints\failed"; Type: filesandordirs

[Registry]
; Store installation path for updates
Root: HKLM; Subkey: "Software\Tabeza\Connect"; ValueType: string; ValueName: "InstallPath"; ValueData: "{app}"; Flags: uninsdeletekey
Root: HKLM; Subkey: "Software\Tabeza\Connect"; ValueType: string; ValueName: "Version"; ValueData: "1.5.2"; Flags: uninsdeletekey
Root: HKLM; Subkey: "Software\Tabeza\Connect"; ValueType: string; ValueName: "BarId"; ValueData: "{code:GetBarId}"; Flags: uninsdeletekey
Root: HKLM; Subkey: "Software\Tabeza\Connect"; ValueType: string; ValueName: "TermsAccepted"; ValueData: "v1.0"; Flags: uninsdeletekey
