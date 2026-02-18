; Tabeza Connect Installer Script
; Version 1.0.0
; Built with Inno Setup 6.x

[Setup]
; Application Information
AppName=Tabeza Connect
AppVersion=1.0.0
AppPublisher=Tabeza
AppPublisherURL=https://tabeza.co.ke
AppSupportURL=https://tabeza.co.ke/support
AppUpdatesURL=https://tabeza.co.ke/downloads
AppCopyright=Copyright (C) 2026 Tabeza

; Installation Directories
DefaultDirName={autopf}\Tabeza
DefaultGroupName=Tabeza Connect
DisableProgramGroupPage=yes

; Output Configuration
OutputDir=C:\Temp\TabezaConnect-Build
OutputBaseFilename=TabezaConnect-Setup-v1.0.0
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\icon.ico

; Compression
Compression=lzma2/max
SolidCompression=yes

; Privileges and Architecture
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64
ArchitecturesAllowed=x64

; Wizard Configuration
WizardStyle=modern
DisableWelcomePage=no
LicenseFile=src\installer\LICENSE.txt

; Uninstall Configuration
UninstallDisplayName=Tabeza Connect
UninstallFilesDir={app}\uninstall

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Messages]
WelcomeLabel2=This will install Tabeza Connect on your computer.%n%nTabeza Connect captures receipt data from your POS system and syncs it with the Tabeza staff app.%n%nIMPORTANT: Tabeza works ALONGSIDE your existing printer. Your current printer setup will NOT change.

[CustomMessages]
BarIdPrompt=Enter your Bar ID from the Tabeza staff dashboard:
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
; Node.js Runtime
Source: "src\installer\nodejs-bundle\nodejs\*"; DestDir: "{app}\nodejs"; Flags: recursesubdirs; Components: core

; Service Files
Source: "src\installer\nodejs-bundle\service\*"; DestDir: "{app}\service"; Flags: recursesubdirs; Components: core

; PowerShell Scripts
Source: "src\installer\scripts\*"; DestDir: "{app}\scripts"; Flags: recursesubdirs; Components: core

; Configuration Template
Source: "config.template.json"; DestDir: "{app}"; DestName: "config.json"; Flags: onlyifdoesntexist; Components: core

; Documentation
Source: "README.md"; DestDir: "{app}\docs"; Components: docs
Source: "BUILD-AND-DEPLOY.md"; DestDir: "{app}\docs"; Components: docs

; Icon
Source: "icon.ico"; DestDir: "{app}"; Components: core

; License
Source: "src\installer\LICENSE.txt"; DestDir: "{app}"; Components: core

[Dirs]
; Create application data directories
Name: "{userappdata}\Tabeza"; Permissions: users-modify
Name: "{userappdata}\Tabeza\logs"; Permissions: users-modify
Name: "{userappdata}\Tabeza\config"; Permissions: users-modify
Name: "{userappdata}\TabezaPrints"; Permissions: users-modify
Name: "{userappdata}\TabezaPrints\pending"; Permissions: users-modify
Name: "{userappdata}\TabezaPrints\processed"; Permissions: users-modify
Name: "{userappdata}\TabezaPrints\failed"; Permissions: users-modify

[Code]
var
  BarIdPage: TInputQueryWizardPage;
  BarId: String;

{ Custom page for Bar ID input }
procedure InitializeWizard;
begin
  { Create Bar ID input page }
  BarIdPage := CreateInputQueryPage(wpSelectComponents,
    'Configuration', 'Enter your venue details',
    'Please enter your Bar ID from the Tabeza staff dashboard.' + #13#10 + #13#10 +
    'To find your Bar ID:' + #13#10 +
    '1. Log in to "https://tabeza.co.ke"' + #13#10 +
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

{ Validate Bar ID page }
function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  
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

{ Get Bar ID for use in scripts }
function GetBarId(Param: String): String;
begin
  Result := BarId;
end;

{ Get API URL }
function GetApiUrl(Param: String): String;
begin
  Result := 'https://staff.tabeza.co.ke';
end;

[Run]
; Step 1: Create watch folders
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\create-folders.ps1"""; \
  StatusMsg: "Creating watch folders..."; \
  Flags: runhidden waituntilterminated; \
  Components: core

; Step 2: Configure printer (if selected)
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\configure-printer.ps1"""; \
  StatusMsg: "Configuring Tabeza Receipt Printer..."; \
  Flags: runhidden waituntilterminated; \
  Components: printer

; Step 3: Register Windows service
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\register-service.ps1"" -InstallPath ""{app}"" -BarId ""{code:GetBarId}"" -ApiUrl ""{code:GetApiUrl}"""; \
  StatusMsg: "Registering Tabeza Connect service..."; \
  Flags: runhidden waituntilterminated; \
  Components: core

; Step 4: Start the service
Filename: "sc.exe"; \
  Parameters: "start TabezaConnect"; \
  StatusMsg: "Starting Tabeza Connect service..."; \
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

; Remove printer (optional - ask user)
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -Command ""Remove-Printer -Name 'Tabeza Receipt Printer' -ErrorAction SilentlyContinue"""; \
  Flags: runhidden; \
  RunOnceId: "RemovePrinter"

[UninstallDelete]
; Clean up log files (ask user)
Type: filesandordirs; Name: "{userappdata}\Tabeza\logs"
Type: filesandordirs; Name: "{userappdata}\TabezaPrints\processed"
Type: filesandordirs; Name: "{userappdata}\TabezaPrints\failed"

[Registry]
; Store installation path for updates
Root: HKLM; Subkey: "Software\Tabeza\Connect"; ValueType: string; ValueName: "InstallPath"; ValueData: "{app}"; Flags: uninsdeletekey
Root: HKLM; Subkey: "Software\Tabeza\Connect"; ValueType: string; ValueName: "Version"; ValueData: "1.1.0"; Flags: uninsdeletekey
Root: HKLM; Subkey: "Software\Tabeza\Connect"; ValueType: string; ValueName: "BarId"; ValueData: "{code:GetBarId}"; Flags: uninsdeletekey
