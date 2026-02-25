; TabezaConnect Installer - Tray Application Edition
; Inno Setup 6.0+  https://jrsoftware.org/isinfo.php
;
; ARCHITECTURE:
;   TabezaConnect runs as a system-tray Electron app, NOT a Windows service.
;   Auto-start at login via HKCU Run registry key with --minimized flag.
;   Configuration stored in HKLM\SOFTWARE\Tabeza\TabezaConnect.
;
; UPGRADE HANDLING:
;   If an old TabezaConnect Windows service exists it is stopped and deleted
;   before files are copied.

#define MyAppName      "Tabeza Connect"
#define MyAppVersion   "2.0.0"
#define MyAppPublisher "Tabeza"
#define MyAppURL       "https://tabeza.co.ke"
#define MyAppExeName   "TabezaConnect.exe"
#define ServiceName    "TabezaConnect"
#define RunKeyName     "TabezaConnect"

[Setup]
AppId={{A7B3C4D5-E6F7-8901-2345-67890ABCDEF1}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}

DefaultDirName={autopf}\Tabeza
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes

; Admin required to write HKLM registry keys and ProgramData folders
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog

OutputDir=installer-output
OutputBaseFilename=TabezaConnectSetup
Compression=lzma
SolidCompression=yes

WizardStyle=modern
SetupIconFile=assets\icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}

VersionInfoVersion={#MyAppVersion}
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName} Installer

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

; ── Files ─────────────────────────────────────────────────────────────────────
[Files]
; Electron bundle (produced by electron-builder or pkg)
Source: "dist\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion

; App icon (used in Start Menu shortcuts)
Source: "assets\icon.ico"; DestDir: "{app}"; Flags: ignoreversion

[Dirs]
Name: "{commonappdata}\Tabeza";                Permissions: everyone-full
Name: "{commonappdata}\Tabeza\queue";          Permissions: everyone-full
Name: "{commonappdata}\Tabeza\logs";           Permissions: everyone-full
Name: "{commonappdata}\Tabeza\TabezaPrints";   Permissions: everyone-full

; ── Start-menu shortcuts ───────────────────────────────────────────────────────
[Icons]
; Open the status window (runs the app if not running, shows it if already running)
Name: "{group}\{#MyAppName}";                   Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Configure {#MyAppName}";         Filename: "{app}\{#MyAppExeName}"; Parameters: "--show-config"
Name: "{group}\View Logs";                      Filename: "{commonappdata}\Tabeza\logs"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"

; ── Registry ───────────────────────────────────────────────────────────────────
[Registry]
; ── Auto-start at Windows login (minimized to tray) ──────────────────────────
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; \
  ValueType: string; ValueName: "{#RunKeyName}"; \
  ValueData: """{app}\{#MyAppExeName}"" --minimized"; \
  Flags: uninsdeletevalue

; ── Tabeza configuration namespace (bar ID written in [Code] below) ───────────
Root: HKLM; Subkey: "SOFTWARE\Tabeza\TabezaConnect"; \
  Flags: uninsdeletekeyifempty

; ── [Code] section ────────────────────────────────────────────────────────────
[Code]
var
  ConfigPage: TInputQueryWizardPage;
  InstallSucceeded: Boolean;

{-------------------------------------------------------------------------------
  Helpers
-------------------------------------------------------------------------------}
function ServiceExists(SvcName: string): Boolean;
var
  RC: Integer;
begin
  Result := Exec(ExpandConstant('{sys}\sc.exe'),
    'query "' + SvcName + '"',
    '', SW_HIDE, ewWaitUntilTerminated, RC) and (RC = 0);
end;

procedure StopAndDeleteService(SvcName: string);
var
  RC: Integer;
begin
  Log('Stopping service: ' + SvcName);
  Exec(ExpandConstant('{sys}\sc.exe'),
    'stop "' + SvcName + '"', '', SW_HIDE, ewWaitUntilTerminated, RC);
  Sleep(2500);

  Log('Deleting service: ' + SvcName);
  Exec(ExpandConstant('{sys}\sc.exe'),
    'delete "' + SvcName + '"', '', SW_HIDE, ewWaitUntilTerminated, RC);
  Sleep(1000);
end;

{-------------------------------------------------------------------------------
  Kill any running TabezaConnect tray process so we can overwrite the EXE
-------------------------------------------------------------------------------}
procedure KillRunningApp;
var
  RC: Integer;
begin
  Log('Killing any running TabezaConnect process...');
  Exec('taskkill.exe', '/F /IM "{#MyAppExeName}"',
    '', SW_HIDE, ewWaitUntilTerminated, RC);
  Sleep(1000);
end;

{-------------------------------------------------------------------------------
  Write Bar ID + configuration into HKLM registry
  (this is what src/service/index.js reads via loadConfig)
-------------------------------------------------------------------------------}
procedure WriteRegistryConfig(BarID: string);
begin
  Log('Writing BarID to registry: ' + BarID);
  RegWriteStringValue(HKLM,
    'SOFTWARE\Tabeza\TabezaConnect', 'BarID', BarID);
  RegWriteStringValue(HKLM,
    'SOFTWARE\Tabeza\TabezaConnect', 'APIUrl',
    'https://bkaigyrrzsqbfscyznzw.supabase.co');
  RegWriteStringValue(HKLM,
    'SOFTWARE\Tabeza\TabezaConnect', 'CaptureMode', 'spooler');
  RegWriteStringValue(HKLM,
    'SOFTWARE\Tabeza\TabezaConnect', 'WatchFolder',
    'C:\ProgramData\Tabeza\TabezaPrints');
end;

{-------------------------------------------------------------------------------
  Wizard initialisation – create config input page
-------------------------------------------------------------------------------}
procedure InitializeWizard;
begin
  InstallSucceeded := False;

  ConfigPage := CreateInputQueryPage(wpWelcome,
    'Tabeza Configuration',
    'Connect this device to your Tabeza account',
    'Enter your Bar ID from the Tabeza dashboard (Settings → Devices).' + #13#10 +
    'You can leave this blank and configure later via the tray icon.');

  ConfigPage.Add('Bar ID (from Tabeza dashboard):', False);
  ConfigPage.Values[0] := '';
end;

{-------------------------------------------------------------------------------
  Validation
-------------------------------------------------------------------------------}
function NextButtonClick(CurPageID: Integer): Boolean;
var
  BarID: string;
begin
  Result := True;

  if CurPageID = ConfigPage.ID then
  begin
    BarID := Trim(ConfigPage.Values[0]);
    // Bar ID is optional – user can configure later
    if (BarID <> '') and (Length(BarID) < 3) then
    begin
      MsgBox('Bar ID looks too short. Please double-check it from the Tabeza dashboard.',
        mbError, MB_OK);
      Result := False;
    end;
  end;
end;

{-------------------------------------------------------------------------------
  Post-install steps
-------------------------------------------------------------------------------}
procedure CurStepChanged(CurStep: TSetupStep);
var
  BarID:   string;
  ExePath: string;
begin
  if CurStep = ssInstall then
  begin
    // ── Before copying files: remove old Windows service if present ──────────
    if ServiceExists('{#ServiceName}') then
    begin
      Log('Legacy Windows service found - removing before install...');
      StopAndDeleteService('{#ServiceName}');
    end;

    // Kill any running instance so the EXE can be overwritten
    KillRunningApp;
  end;

  if CurStep = ssPostInstall then
  begin
    Log('Post-install steps starting...');

    BarID   := Trim(ConfigPage.Values[0]);
    ExePath := ExpandConstant('{app}\{#MyAppExeName}');

    // Write Bar ID to registry (skip if blank - user will configure via tray)
    if BarID <> '' then
      WriteRegistryConfig(BarID)
    else
      Log('Bar ID left blank - skipping registry config write');

    // The HKCU Run key was already written by the [Registry] section.
    // Launch the app now so the user sees it immediately (minimized to tray).
    Log('Launching TabezaConnect tray application...');
    Exec(ExePath, '--minimized', '', SW_SHOW, ewNoWait, 0);

    InstallSucceeded := True;
    Log('Post-install complete');
  end;
end;

{-------------------------------------------------------------------------------
  Finish page message
-------------------------------------------------------------------------------}
procedure CurPageChanged(CurPageID: Integer);
var
  BarID: string;
  Msg:   string;
begin
  if (CurPageID = wpFinished) and InstallSucceeded then
  begin
    BarID := Trim(ConfigPage.Values[0]);

    Msg := 'Tabeza Connect has been installed successfully!' + #13#10 + #13#10;

    if BarID <> '' then
      Msg := Msg + 'Bar ID: ' + BarID + #13#10 + #13#10 +
             'The tray icon is now visible in your taskbar notification area.' + #13#10 +
             'Tabeza Connect will start automatically when Windows starts.'
    else
      Msg := Msg +
             'The tray icon is now visible in your taskbar notification area.' + #13#10 + #13#10 +
             'Right-click the tray icon → Open Configuration to enter your Bar ID.';

    MsgBox(Msg, mbInformation, MB_OK);
  end;
end;

{-------------------------------------------------------------------------------
  Uninstall – remove auto-start key, registry config, stop any running instance
-------------------------------------------------------------------------------}
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  RC: Integer;
begin
  if CurUninstallStep = usUninstall then
  begin
    Log('Uninstall: stopping TabezaConnect...');

    // Kill tray app
    Exec('taskkill.exe', '/F /IM "{#MyAppExeName}"',
      '', SW_HIDE, ewWaitUntilTerminated, RC);
    Sleep(1000);

    // Remove HKCU Run key (belt-and-suspenders; [Registry] Flags already handle this)
    RegDeleteValue(HKCU,
      'Software\Microsoft\Windows\CurrentVersion\Run',
      '{#RunKeyName}');

    // Remove HKLM config keys
    RegDeleteKeyIncludingSubkeys(HKLM, 'SOFTWARE\Tabeza\TabezaConnect');

    // Also stop & delete legacy service if somehow still present
    if ServiceExists('{#ServiceName}') then
      StopAndDeleteService('{#ServiceName}');

    Log('Uninstall cleanup complete');
  end;
end;

; ── Post-install run options ───────────────────────────────────────────────────
[Run]
Filename: "{app}\{#MyAppExeName}"; \
  Description: "Start TabezaConnect now"; \
  Flags: postinstall nowait skipifsilent; \
  Parameters: "--minimized"

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
