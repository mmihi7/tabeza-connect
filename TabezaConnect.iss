; ===========================================================================
; TabezaConnect - Inno Setup Installer Script
; Version: 1.7.0
; Build: "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" TabezaConnect.iss /DAppVersion=1.7.0
; ===========================================================================

#ifndef AppVersion
  #define AppVersion "1.7.0"
#endif

#define AppName     "TabezaConnect"
#define AppPublisher "Tabeza"
#define AppURL      "https://tabeza.co.ke"
#define ServiceName "TabezaConnect"
#define WatchFolder "C:\TabezaPrints"

; ===========================================================================
[Setup]
; ===========================================================================
AppId={{6D3E8A2F-4B1C-4F9D-A8E5-2C7B3D6F1A04}}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}/support
AppUpdatesURL={#AppURL}/updates
VersionInfoVersion={#AppVersion}
VersionInfoCompany={#AppPublisher}
VersionInfoDescription={#AppName} Setup

ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

DefaultDirName={commonpf64}\TabezaConnect
DisableDirPage=yes
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes

PrivilegesRequired=admin

OutputDir=dist-inno
OutputBaseFilename=TabezaConnect-Setup-v{#AppVersion}
SetupIconFile=assets\icon-green.ico
UninstallDisplayIcon={app}\TabezaConnect.exe

Compression=lzma2/ultra64
SolidCompression=yes
LZMAUseSeparateProcess=yes
WizardStyle=modern

; Enable logging for debugging
SetupLogging=yes

; ===========================================================================
[Languages]
; ===========================================================================
Name: "english"; MessagesFile: "compiler:Default.isl"

; ===========================================================================
[Code]
; ===========================================================================
var
  BarIDPage: TInputQueryWizardPage;
  BarIDValue: String;

procedure InitializeWizard;
begin
  BarIDPage := CreateInputQueryPage(wpWelcome,
    'Venue Configuration',
    'Enter your Tabeza Bar ID',
    'Your Bar ID can be found in the Tabeza dashboard under Settings > Venue.' + #13#10 +
    'This ID is required for the service to connect to your Tabeza account.');
  BarIDPage.Add('Bar ID (Required):', False);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = BarIDPage.ID then
  begin
    if Trim(BarIDPage.Values[0]) = '' then
    begin
      MsgBox('Bar ID is required. Please enter your venue Bar ID.', mbError, MB_OK);
      Result := False;
      Exit;
    end;
    
    // Validate Bar ID format (alphanumeric, no special chars)
    if Pos(' ', Trim(BarIDPage.Values[0])) > 0 then
    begin
      MsgBox('Bar ID should not contain spaces. Please remove any spaces.', mbError, MB_OK);
      Result := False;
      Exit;
    end;
    
    BarIDValue := Trim(BarIDPage.Values[0]);
  end;
end;

procedure LogToFile(Message: string);
var
  LogFile: string;
begin
  LogFile := ExpandConstant('{app}\install.log');
  SaveStringToFile(LogFile, Message + #13#10, True);
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  InstallPath: String;
  ScriptPath: String;
  ErrorMsg: String;
begin
  if CurStep = ssPostInstall then
  begin
    InstallPath := ExpandConstant('{app}');
    ScriptPath  := InstallPath + '\scripts\';
    
    LogToFile('=== TabezaConnect Installation Log ===');
    LogToFile('Installation Path: ' + InstallPath);
    LogToFile('Bar ID: ' + BarIDValue);
    LogToFile('Start Time: ' + GetDateTimeString('yyyy-mm-dd hh:nn:ss', '-', ':'));

    // Step 1: Windows Defender exclusions (non-fatal)
    LogToFile('Step 1: Adding Windows Defender exclusions...');
    if Exec('powershell.exe',
      '-NoProfile -NonInteractive -ExecutionPolicy Bypass -Command ' +
      '"Add-MpPreference -ExclusionPath ''' + InstallPath + ''' -ErrorAction SilentlyContinue;' +
      ' Add-MpPreference -ExclusionPath ''C:\TabezaPrints'' -ErrorAction SilentlyContinue;' +
      ' Add-MpPreference -ExclusionPath ''C:\ProgramData\Tabeza'' -ErrorAction SilentlyContinue"',
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    begin
      LogToFile('  Defender exclusions added (code: ' + IntToStr(ResultCode) + ')');
    end
    else
    begin
      LogToFile('  Warning: Could not add Defender exclusions');
    end;

    // Step 2: Create folders
    LogToFile('Step 2: Creating folders...');
    if Exec('powershell.exe',
      '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ScriptPath + 'create-folders.ps1"',
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0) then
    begin
      LogToFile('  Folders created successfully');
    end
    else
    begin
      ErrorMsg := 'Warning: Could not create folders (code ' + IntToStr(ResultCode) + ')';
      LogToFile('  ' + ErrorMsg);
      MsgBox(ErrorMsg + '. Some folders may need to be created manually.',
             mbInformation, MB_OK);
    end;

    // Step 3: Write config.json
    LogToFile('Step 3: Writing config.json...');
    if Exec('powershell.exe',
      '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ScriptPath + 'write-config.ps1"' +
      ' -BarID "' + BarIDValue + '" -InstallDir "' + InstallPath + '"',
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0) then
    begin
      LogToFile('  config.json written successfully');
    end
    else
    begin
      ErrorMsg := 'Warning: Could not write config.json (code ' + IntToStr(ResultCode) + ')';
      LogToFile('  ' + ErrorMsg);
      MsgBox(ErrorMsg + '. You may need to configure manually.',
             mbInformation, MB_OK);
    end;

    // Step 4: Register Windows service
    LogToFile('Step 4: Registering Windows service...');
    
    // First, stop any existing service
    Exec('powershell.exe',
      '-NoProfile -NonInteractive -ExecutionPolicy Bypass -Command ' +
      '"Stop-Service -Name ''''{#ServiceName}'''' -Force -ErrorAction SilentlyContinue; ' +
      'sc.exe delete {#ServiceName}"',
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    
    Sleep(2000); // Wait for service to be removed
    
    // Register new service
    if Exec('powershell.exe',
      '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ScriptPath + 'register-service.ps1"' +
      ' -InstallDir "' + InstallPath + '" -BarID "' + BarIDValue + '"',
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0) then
    begin
      LogToFile('  Service registered successfully');
      
      // Start the service
      if Exec('powershell.exe',
        '-NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Start-Service -Name ''''{#ServiceName}''''"',
        '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
      begin
        LogToFile('  Service started successfully');
      end
      else
      begin
        LogToFile('  Warning: Service registered but could not start automatically');
      end;
    end
    else
    begin
      ErrorMsg := 'Warning: Could not register service (code ' + IntToStr(ResultCode) + ')';
      LogToFile('  ' + ErrorMsg);
      MsgBox(ErrorMsg + '. Service may need to be registered manually.' + #13#10 +
             'Run as Administrator: ' + InstallPath + '\scripts\register-service.ps1',
             mbInformation, MB_OK);
    end;
    
    LogToFile('Installation completed at: ' + GetDateTimeString('yyyy-mm-dd hh:nn:ss', '-', ':'));
    LogToFile('=======================================');
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  ResultCode: Integer;
begin
  if CurUninstallStep = usUninstall then
  begin
    // Stop service first
    Exec('powershell.exe', 
      '-NoProfile -NonInteractive -Command "Stop-Service -Name ''''{#ServiceName}'''' -Force -ErrorAction SilentlyContinue"', 
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    
    Sleep(3000); // Wait for service to stop
    
    // Delete service
    Exec('sc.exe', 'delete {#ServiceName}', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    
    // Remove firewall rules if any
    Exec('netsh', 'advfirewall firewall delete rule name="TabezaConnect Service"', 
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
  
  if CurUninstallStep = usPostUninstall then
  begin
    // Clean up any remaining files
    DelTree(ExpandConstant('{app}'), True, True, True);
  end;
end;

[Files]
Source: "dist-app\TabezaConnect.exe";       DestDir: "{app}"; Flags: ignoreversion
Source: "dist-app\tabeza-service.exe";      DestDir: "{app}"; Flags: ignoreversion
Source: "config-production.json";           DestDir: "{app}"; DestName: "config.json"; Flags: ignoreversion
Source: "TabezaConnect-Launcher.bat";       DestDir: "{app}"; Flags: ignoreversion
Source: "assets\icon-green.ico";            DestDir: "{app}"; Flags: ignoreversion
Source: "src\installer\scripts\create-folders.ps1";   DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "src\installer\scripts\write-config.ps1";     DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "src\installer\scripts\register-service.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion

; Include PowerShell execution policy helper
Source: "src\installer\scripts\set-executionpolicy.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion

[Dirs]
Name: "{#WatchFolder}";   Permissions: everyone-full
Name: "{app}\logs";       Permissions: everyone-modify
Name: "{app}\scripts";    Permissions: everyone-read

[Icons]
Name: "{group}\{#AppName}";           Filename: "{app}\TabezaConnect.exe"; WorkingDir: "{app}"
Name: "{group}\Uninstall {#AppName}"; Filename: "{uninstallexe}"
Name: "{commondesktop}\{#AppName}";   Filename: "{app}\TabezaConnect.exe"; WorkingDir: "{app}"
Name: "{group}\View Installation Log"; Filename: "{app}\install.log"; Flags: runminimized

[Registry]
Root: HKLM; Subkey: "SOFTWARE\Tabeza\TabezaConnect"; ValueType: string; ValueName: "InstallPath"; ValueData: "{app}";          Flags: createvalueifdoesntexist uninsdeletekey
Root: HKLM; Subkey: "SOFTWARE\Tabeza\TabezaConnect"; ValueType: string; ValueName: "Version";     ValueData: "{#AppVersion}";  Flags: createvalueifdoesntexist
Root: HKLM; Subkey: "SOFTWARE\Tabeza\TabezaConnect"; ValueType: string; ValueName: "WatchFolder"; ValueData: "{#WatchFolder}"; Flags: createvalueifdoesntexist
Root: HKLM; Subkey: "SOFTWARE\Tabeza\TabezaConnect"; ValueType: string; ValueName: "BarID";       ValueData: "{code:GetBarID}"; Flags: createvalueifdoesntexist uninsdeletevalue

[Run]
; Run launcher after install (optional)
Filename: "{app}\TabezaConnect-Launcher.bat"; Description: "Launch TabezaConnect"; Flags: postinstall nowait skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}\scripts"
Type: filesandordirs; Name: "{app}\logs"
Type: files; Name: "{app}\install.log"
Type: files; Name: "{app}\*.log"

[Code]
function GetBarID(Param: String): String;
begin
  Result := BarIDValue;
end;