; Tabeza Connect Installer Script (PKG Version)
; Version 1.7.0
; Built with Inno Setup 6.x
;
; FIXES in this version:
; - Step 2 (printer): Removed IsAdminInstallMode check so printer always installs
; - Step 4 (service): Fixed TABEZA_WATCH_FOLDER env var to use ProgramData path
; - Step 6 (docs): Changed from unchecked to checked, docs component no longer required
; - Added Step 7: Launch TabezaConnect.exe after install so tray appears immediately

[Setup]
AppName=TabezaConnect
AppVersion=1.7.0
AppPublisher=Tabeza
AppPublisherURL=https://tabeza.co.ke
AppSupportURL=https://tabeza.co.ke/support
AppUpdatesURL=https://tabeza.co.ke/downloads
AppCopyright=Copyright (C) 2026 Tabeza

DefaultDirName={autopf}\TabezaConnect
DefaultGroupName=TabezaConnect
DisableProgramGroupPage=yes

OutputDir=dist
OutputBaseFilename=TabezaConnect-Setup-v1.7.0
SetupIconFile=icon-green.ico
UninstallDisplayIcon={app}\icon-green.ico

Compression=lzma2/max
SolidCompression=yes

PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog
ArchitecturesInstallIn64BitMode=x64
ArchitecturesAllowed=x64

UsePreviousAppDir=yes
DirExistsWarning=auto
DisableDirPage=no

WizardStyle=modern
DisableWelcomePage=no
LicenseFile=LICENSE.txt

UninstallDisplayName=TabezaConnect
UninstallFilesDir={app}\uninstall

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Messages]
WelcomeLabel2=This will install TabezaConnect on your computer.%n%nTabezaConnect captures receipt data from your POS system and syncs it with the Tabeza staff app.%n%nIMPORTANT: Tabeza works ALONGSIDE your existing printer. Your current printer setup will NOT change.

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
; Compiled Service Executable (single file, ~40-50 MB)
Source: "TabezaConnect.exe"; DestDir: "{app}"; Flags: ignoreversion; Components: core

; PowerShell Scripts
Source: "src\installer\scripts\*"; DestDir: "{app}\scripts"; Flags: recursesubdirs; Components: core

; Configuration Template
Source: "config.template.json"; DestDir: "{app}"; DestName: "config.json"; Flags: onlyifdoesntexist; Components: core

; Documentation
Source: "Plan\README.txt"; DestDir: "{app}\docs"; Components: docs
Source: "Plan\BEFORE-INSTALL.txt"; DestDir: "{app}\docs"; Components: docs
Source: "Plan\AFTER-INSTALL.txt"; DestDir: "{app}\docs"; Components: docs

; Icon
Source: "icon-green.ico"; DestDir: "{app}"; Components: core

; License
Source: "LICENSE.txt"; DestDir: "{app}"; Components: core

[Dirs]
Name: "{commonappdata}\Tabeza"; Permissions: users-modify
Name: "{commonappdata}\Tabeza\logs"; Permissions: users-modify
Name: "{commonappdata}\Tabeza\config"; Permissions: users-modify
Name: "{commonappdata}\Tabeza\TabezaPrints"; Permissions: users-modify
Name: "{commonappdata}\Tabeza\TabezaPrints\pending"; Permissions: users-modify
Name: "{commonappdata}\Tabeza\TabezaPrints\processed"; Permissions: users-modify
Name: "{commonappdata}\Tabeza\TabezaPrints\failed"; Permissions: users-modify

[Icons]
; Start menu shortcut
Name: "{group}\TabezaConnect"; Filename: "{app}\TabezaConnect.exe"; IconFilename: "{app}\icon-green.ico"
Name: "{group}\Uninstall TabezaConnect"; Filename: "{uninstallexe}"

[Registry]
; Store installation path for updates and service
Root: HKLM; Subkey: "Software\Tabeza\Connect"; ValueType: string; ValueName: "InstallPath"; ValueData: "{app}"; Flags: uninsdeletekey
Root: HKLM; Subkey: "Software\Tabeza\Connect"; ValueType: string; ValueName: "Version"; ValueData: "1.7.0"; Flags: uninsdeletekey
Root: HKLM; Subkey: "Software\Tabeza\Connect"; ValueType: string; ValueName: "BarId"; ValueData: "{code:GetBarId}"; Flags: uninsdeletekey

; Auto-start TabezaConnect.exe at Windows login (for system tray)
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; \
  ValueType: string; ValueName: "TabezaConnect"; \
  ValueData: """{app}\TabezaConnect.exe"""; \
  Flags: uninsdeletevalue

[Code]
var
  BarIdPage: TInputQueryWizardPage;
  BarId: String;

function GetSafeTempDir(): String;
var
  TempDir: String;
begin
  TempDir := ExpandConstant('{tmp}');
  if DirExists(TempDir) and IsAdminInstallMode then
    Result := TempDir
  else
    Result := ExpandConstant('{usertmp}');
end;

procedure InitializeWizard;
begin
  BarIdPage := CreateInputQueryPage(wpLicense,
    'Configuration', 'Enter your venue details',
    'Please enter your Bar ID from the Tabeza staff dashboard.' + #13#10 + #13#10 +
    'To find your Bar ID:' + #13#10 +
    '1. Log in to "https://tabeza.co.ke"' + #13#10 +
    '2. Go to Settings > Venue Details' + #13#10 +
    '3. Copy your Bar ID');

  BarIdPage.Add('Bar ID:', False);
  BarIdPage.Values[0] := '';
end;

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

function GetBarId(Param: String): String;
begin
  Result := BarId;
end;

function GetApiUrl(Param: String): String;
begin
  Result := 'https://tabeza.co.ke';
end;

function HandlePrinterConfigError(ErrorCode: Integer): String;
begin
  case ErrorCode of
    0: Result := 'Printer configured successfully.';
    1: Result := 'Printer configuration failed. Check C:\ProgramData\Tabeza\logs\configure-pooling.log';
    2: Result := 'Printer already configured (no changes needed).';
    3: Result := 'No thermal printer detected. Install a thermal printer first.';
    4: Result := 'Administrator privileges required.';
    5: Result := 'Print Spooler service is not running.';
  else
    Result := 'Unknown error code: ' + IntToStr(ErrorCode);
  end;
end;

[Run]
; ============================================================================
; Step 1: Create watch folders
; ============================================================================
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\create-folders.ps1"" -WatchFolder ""C:\ProgramData\Tabeza\TabezaPrints"""; \
  StatusMsg: "Creating watch folders..."; \
  Flags: runhidden waituntilterminated; \
  Components: core

; ============================================================================
; Step 2: Configure automatic printer pooling
; FIX: Removed "Check: IsAdminInstallMode" - that caused this step to be
; silently skipped on normal (non-/ALLUSERS) installs. Since PrivilegesRequired=admin,
; the installer always runs as admin — the Check was redundant and harmful.
; ============================================================================
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\configure-pooling-printer.ps1"" -CaptureFilePath ""C:\ProgramData\Tabeza\TabezaPrints\order.prn"""; \
  StatusMsg: "Configuring Tabeza Agent (automatic pooling)..."; \
  Flags: runhidden waituntilterminated; \
  Components: printer

; ============================================================================
; Step 3: Register Windows service
; FIX: register-service-pkg.ps1 hardcodes TABEZA_WATCH_FOLDER=C:\TabezaPrints
; but the actual folder is C:\ProgramData\Tabeza\TabezaPrints.
; We pass it explicitly here so the service env var is correct.
; ============================================================================
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\register-service-pkg.ps1"" -InstallPath ""{app}"" -BarId ""{code:GetBarId}"" -ApiUrl ""{code:GetApiUrl}"" -WatchFolder ""C:\ProgramData\Tabeza\TabezaPrints"""; \
  StatusMsg: "Registering TabezaConnect service..."; \
  Flags: runhidden waituntilterminated; \
  Components: core

; ============================================================================
; Step 4: Start the service
; ============================================================================
Filename: "sc.exe"; \
  Parameters: "start TabezaConnect"; \
  StatusMsg: "Starting TabezaConnect service..."; \
  Flags: runhidden waituntilterminated; \
  Components: core

; ============================================================================
; Step 5: Verify installation
; ============================================================================
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\verify-installation.ps1"" -InstallPath ""{app}"""; \
  StatusMsg: "Verifying installation..."; \
  Flags: runhidden waituntilterminated; \
  Components: core

; ============================================================================
; Step 6: Launch TabezaConnect.exe so the system tray appears immediately
; (It's also set to auto-start via registry Run key above)
; FIX: This was missing entirely - the service runs headless, the .exe itself
; must be launched separately for the system tray to appear.
; ============================================================================
Filename: "{app}\TabezaConnect.exe"; \
  StatusMsg: "Starting Tabeza system tray..."; \
  Description: "Start TabezaConnect now"; \
  Flags: postinstall nowait skipifsilent; \
  Components: core

; ============================================================================
; Step 7: Show post-install instructions
; FIX: Was "unchecked" (opt-in) and required docs component.
; Now "checked" by default so users always see it.
; ============================================================================
Filename: "{win}\notepad.exe"; \
  Parameters: """{app}\docs\AFTER-INSTALL.txt"""; \
  Description: "View post-installation instructions (recommended)"; \
  Flags: postinstall shellexec skipifsilent nowait; \
  Check: FileExists(ExpandConstant('{app}\docs\AFTER-INSTALL.txt'))

[UninstallRun]
; Stop and kill the tray process first
Filename: "taskkill.exe"; \
  Parameters: "/F /IM TabezaConnect.exe"; \
  Flags: runhidden; \
  RunOnceId: "KillTray"

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

; Remove Tabeza Agent
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\uninstall-pooling-printer.ps1"""; \
  Flags: runhidden; \
  RunOnceId: "RemovePoolingPrinter"

[UninstallDelete]
Name: "{commonappdata}\Tabeza\logs"; Type: filesandordirs
Name: "{commonappdata}\Tabeza\TabezaPrints\processed"; Type: filesandordirs
Name: "{commonappdata}\Tabeza\TabezaPrints\failed"; Type: filesandordirs
