; ===========================================================================
; TabezaConnect - Inno Setup Installer Script
; Satisfies: TR-1, US-1, US-2, US-4
; ===========================================================================
; Build with:
;   iscc.exe src\installer\TabezaConnect.iss /DAppVersion=1.0.0
; ===========================================================================

#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif

#define AppName        "TabezaConnect"
#define AppPublisher   "Tabeza"
#define AppURL         "https://tabeza.com"
#define AppExeName     "tabeza-service.exe"
#define ServiceName    "TabezaConnect"
#define WatchFolder    "C:\TabezaPrints"
#define InstallDir     "{commonpf}\Tabeza"

[Setup]
; -- Identity --
AppId={{6D3E8A2F-4B1C-4F9D-A8E5-2C7B3D6F1A04}}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}/support
AppUpdatesURL={#AppURL}/updates
VersionInfoVersion={#AppVersion}
VersionInfoCompany={#AppPublisher}
VersionInfoDescription={#AppName} Setup

; -- Installation target --
DefaultDirName={#InstallDir}
DisableDirPage=yes
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes

; -- Elevation & privileges --
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=commandline

; -- Output --
OutputDir=..\..\dist
OutputBaseFilename=TabezaConnect-Setup-v{#AppVersion}
SetupIconFile=..\..\assets\icon.ico
UninstallDisplayIcon={app}\icon.ico

; -- Compression --
Compression=lzma2/ultra64
SolidCompression=yes
LZMAUseSeparateProcess=yes

; -- UI --
WizardStyle=modern
WizardResizable=no
ShowLanguageDialog=no
DisableWelcomePage=no

; -- Compatibility --
ArchitecturesAllowed=x64 x86
ArchitecturesInstallIn64BitMode=x64

; -- Uninstall --
UninstallDisplayName={#AppName}
CreateUninstallRegKey=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

; ===========================================================================
; Custom wizard page variables
; ===========================================================================
[Code]
var
  BarIDPage: TInputQueryWizardPage;
  BarIDValue: string;

// ---------------------------------------------------------------------------
// Create the custom Bar ID page (US-2: collect Bar ID during installation)
// ---------------------------------------------------------------------------
procedure InitializeWizard;
begin
  BarIDPage := CreateInputQueryPage(
    wpWelcome,
    'Venue Configuration',
    'Enter your Tabeza Bar ID',
    'Please enter the Bar ID provided by Tabeza support. ' +
    'This links this installation to your venue account.'
  );
  BarIDPage.Add('Bar ID:', False);
  // Pre-fill if registry key exists (re-install scenario)
  BarIDPage.Values[0] := GetPreviousData('BarID', '');
end;

// ---------------------------------------------------------------------------
// Persist Bar ID for re-install / repair scenarios
// ---------------------------------------------------------------------------
procedure RegisterPreviousData(PreviousDataKey: Integer);
begin
  SetPreviousData(PreviousDataKey, 'BarID', BarIDPage.Values[0]);
end;

// ---------------------------------------------------------------------------
// Validate Bar ID before allowing Next (US-2: must not be empty)
// ---------------------------------------------------------------------------
function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = BarIDPage.ID then
  begin
    if Trim(BarIDPage.Values[0]) = '' then
    begin
      MsgBox(
        'Please enter your Bar ID before continuing.',
        mbError, MB_OK
      );
      Result := False;
      Exit;
    end;
    BarIDValue := Trim(BarIDPage.Values[0]);
  end;
end;

// ---------------------------------------------------------------------------
// Stop and remove service before uninstall / upgrade
// ---------------------------------------------------------------------------
procedure StopAndRemoveService;
var
  ResultCode: Integer;
begin
  Exec('sc.exe', 'stop ' + '{#ServiceName}', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec('sc.exe', 'delete ' + '{#ServiceName}', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then
    StopAndRemoveService;
end;

function InitializeSetup: Boolean;
begin
  // Stop existing service on upgrade/repair before files are replaced
  StopAndRemoveService;
  Result := True;
end;

// ---------------------------------------------------------------------------
// Return Bar ID to be used as a parameter in [Run] section via {code:GetBarID}
// ---------------------------------------------------------------------------
function GetBarID(Param: string): string;
begin
  Result := BarIDValue;
end;

// ---------------------------------------------------------------------------
// Check if this is a 64-bit OS for Node path selection
// ---------------------------------------------------------------------------
function Is64BitOS: Boolean;
begin
  Result := Is64BitInstallMode;
end;

// ===========================================================================
// FILES
// ===========================================================================
[Files]
; Node.js runtime bundle (TR-1: bundled runtime) - x64 only
Source: "nodejs-bundle\*"; DestDir: "{app}\runtime"; Flags: recursesubdirs createallsubdirs

; Application files
Source: "..\..\TabezaService.exe"; DestDir: "{app}"; Flags: ignoreversion

; PowerShell scripts (TR-4)
Source: "scripts\configure-printer.ps1"; DestDir: "{app}\scripts"
Source: "scripts\register-service.ps1";  DestDir: "{app}\scripts"
Source: "scripts\uninstall-service.ps1"; DestDir: "{app}\scripts"

; Icon for uninstaller entry
Source: "..\..\assets\icon.ico"; DestDir: "{app}"

; ===========================================================================
; DIRECTORIES
; ===========================================================================
[Dirs]
; Watch folder with permissive ACL so service and printer driver can write (TR-1)
Name: "{#WatchFolder}";            Permissions: everyone-full
Name: "{app}\logs";                Permissions: everyone-modify
Name: "{app}\config";              Permissions: everyone-modify

; ===========================================================================
; REGISTRY
; ===========================================================================
[Registry]
; Store Bar ID for the service to read (TR-1)
Root: HKLM; Subkey: "SOFTWARE\Tabeza\TabezaConnect"; \
  ValueType: string; ValueName: "BarID"; ValueData: "{code:GetBarID}"; Flags: createvalueifdoesntexist

Root: HKLM; Subkey: "SOFTWARE\Tabeza\TabezaConnect"; \
  ValueType: string; ValueName: "WatchFolder"; ValueData: "{#WatchFolder}"; Flags: createvalueifdoesntexist

Root: HKLM; Subkey: "SOFTWARE\Tabeza\TabezaConnect"; \
  ValueType: string; ValueName: "InstallDir"; ValueData: "{app}"

Root: HKLM; Subkey: "SOFTWARE\Tabeza\TabezaConnect"; \
  ValueType: string; ValueName: "Version"; ValueData: "{#AppVersion}"

; ===========================================================================
; RUN SECTION — post-install steps (US-2, TR-4)
; ===========================================================================
[Run]
; Step 1: Configure virtual printer
Filename: "powershell.exe"; \
  Parameters: "-NonInteractive -ExecutionPolicy Bypass -File ""{app}\scripts\configure-printer.ps1"" -WatchFolder ""{#WatchFolder}"" -Silent"; \
  StatusMsg: "Configuring virtual printer..."; \
  Flags: runhidden waituntilterminated; \
  Check: not WizardSilent

Filename: "powershell.exe"; \
  Parameters: "-NonInteractive -ExecutionPolicy Bypass -File ""{app}\scripts\configure-printer.ps1"" -WatchFolder ""{#WatchFolder}"" -Silent"; \
  StatusMsg: "Configuring virtual printer..."; \
  Flags: runhidden waituntilterminated; \
  Check: WizardSilent

; Step 2: Register & start Windows service
Filename: "powershell.exe"; \
  Parameters: "-NonInteractive -ExecutionPolicy Bypass -File ""{app}\scripts\register-service.ps1"" -InstallDir ""{app}"" -BarID ""{code:GetBarID}"" -WatchFolder ""{#WatchFolder}"" -ServiceName ""{#ServiceName}"" -Silent"; \
  StatusMsg: "Registering and starting TabezaConnect service..."; \
  Flags: runhidden waituntilterminated

; Step 3: Verify service started
Filename: "sc.exe"; \
  Parameters: "query {#ServiceName}"; \
  Flags: runhidden waituntilterminated

; ===========================================================================
; UNINSTALL RUN SECTION (US-4)
; ===========================================================================
[UninstallRun]
; Stop and remove service
Filename: "powershell.exe"; \
  Parameters: "-NonInteractive -ExecutionPolicy Bypass -File ""{app}\scripts\uninstall-service.ps1"" -ServiceName ""{#ServiceName}"" -Silent"; \
  Flags: runhidden waituntilterminated; \
  RunOnceId: "StopService"

; Remove virtual printer
Filename: "powershell.exe"; \
  Parameters: "-NonInteractive -ExecutionPolicy Bypass -Command ""Remove-Printer -Name 'Tabeza Virtual Printer' -ErrorAction SilentlyContinue"""; \
  Flags: runhidden waituntilterminated; \
  RunOnceId: "RemovePrinter"

; ===========================================================================
; ICONS (Start menu)
; ===========================================================================
[Icons]
Name: "{group}\Uninstall {#AppName}"; Filename: "{uninstallexe}"
