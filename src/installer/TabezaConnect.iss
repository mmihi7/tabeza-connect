; ===========================================================================
; TabezaConnect - Inno Setup Installer Script
; Version: 1.7.0
; ===========================================================================

#ifndef AppVersion
  #define AppVersion "1.7.0"
#endif

#define AppName     "TabezaConnect"
#define AppPublisher "Tabeza"
#define AppURL      "https://tabeza.co.ke"
#define ServiceName "TabezaConnect"
#define WatchFolder "C:\TabezaPrints"
#define BackendAPI  "https://tabeza.co.ke/api"  ; Your Vercel backend

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

ArchitecturesAllowed=x86 x64
ArchitecturesInstallIn64BitMode=x64

DefaultDirName={pf}\TabezaConnect
DisableDirPage=yes
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes

PrivilegesRequired=admin

OutputDir=..\..\dist
OutputBaseFilename=TabezaConnect-Setup-v{#AppVersion}
SetupIconFile=..\..\assets\icon-green.ico
UninstallDisplayIcon={app}\TabezaConnect.exe

Compression=lzma2/ultra64
SolidCompression=yes
LZMAUseSeparateProcess=yes
WizardStyle=modern
SetupLogging=yes
LicenseFile=..\..\LICENSE.txt

; ===========================================================================
[Languages]
; ===========================================================================
Name: "english"; MessagesFile: "compiler:Default.isl"

; ===========================================================================
[Messages]
; ===========================================================================
WelcomeLabel2=This will install TabezaConnect on your computer.%n%nTabezaConnect captures receipt data from your POS system and syncs it with the Tabeza staff app.%n%nIMPORTANT: Tabeza works ALONGSIDE your existing printer. Your current printer setup will NOT change.%n%nAfter installation, right-click the TabezaConnect tray icon to configure your Bar ID and settings.

; ===========================================================================
[Code]
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
    LogToFile('Start Time: ' + GetDateTimeString('yyyy-mm-dd hh:nn:ss', '-', ':'));

    // Step 1: Windows Defender exclusions (non-fatal)
    LogToFile('Step 1: Adding Windows Defender exclusions...');
    Exec('powershell.exe',
      '-NoProfile -NonInteractive -ExecutionPolicy Bypass -Command ' +
      '"Add-MpPreference -ExclusionPath ''' + InstallPath + ''' -ErrorAction SilentlyContinue;' +
      ' Add-MpPreference -ExclusionPath ''C:\TabezaPrints'' -ErrorAction SilentlyContinue;' +
      ' Add-MpPreference -ExclusionPath ''C:\ProgramData\Tabeza'' -ErrorAction SilentlyContinue"',
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

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
    end;

    // Step 3: Install Redmon
    LogToFile('Step 3: Installing Redmon port monitor...');
    if Exec('powershell.exe',
      '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ScriptPath + 'install-redmon.ps1" -InstallDir "' + InstallPath + '"',
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0) then
    begin
      LogToFile('  Redmon installed successfully');
    end
    else
    begin
      ErrorMsg := 'Warning: Could not install Redmon (code ' + IntToStr(ResultCode) + ')';
      LogToFile('  ' + ErrorMsg);
    end;

    // Step 4: Configure virtual printer (Redmon approach)
    LogToFile('Step 4: Configuring printer...');
    
    // First, detect physical printers
    LogToFile('  Detecting physical printers...');
    if Exec('powershell.exe',
      '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ScriptPath + 'detect-thermal-printer.ps1"' +
      ' -OutputFile "' + InstallPath + '\printer-detection.json"',
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0) then
    begin
      LogToFile('  Printers detected');
      
      // Configure virtual printer with Redmon
      if Exec('powershell.exe',
        '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ScriptPath + 'configure-redmon-printer.ps1"',
        '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode <= 1) then
      begin
        LogToFile('  Virtual printer configured');
      end
      else
      begin
        LogToFile('  Could not configure virtual printer (code: ' + IntToStr(ResultCode) + ')');
      end;
    end
    else
    begin
      LogToFile('  Could not detect printers (code: ' + IntToStr(ResultCode) + ')');
    end;

    // Step 5: Register Windows service
    LogToFile('Step 5: Registering Windows service...');
    
    // Stop any existing service
    Exec('powershell.exe',
      '-NoProfile -NonInteractive -ExecutionPolicy Bypass -Command ' +
      '"Stop-Service -Name ''''{#ServiceName}'''' -Force -ErrorAction SilentlyContinue; ' +
      'sc.exe delete {#ServiceName}"',
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    
    Sleep(2000);
    
    // Register new service
    if Exec('powershell.exe',
      '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ScriptPath + 'register-service.ps1"' +
      ' -InstallDir "' + InstallPath + '"',
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0) then
    begin
      LogToFile('  Service registered successfully');
      
      // Start the service
      Exec('powershell.exe',
        '-NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Start-Service -Name ''''{#ServiceName}''''"',
        '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      
      // Note: The checkbox for launching the app will be handled by the [Run] section
      // based on the user's selection in the final setup page
    end
    else
    begin
      LogToFile('  Could not register service (code: ' + IntToStr(ResultCode) + ')');
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
    // Stop and remove service
    Exec('powershell.exe', 
      '-NoProfile -NonInteractive -Command "Stop-Service -Name ''''{#ServiceName}'''' -Force -ErrorAction SilentlyContinue"', 
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    
    Sleep(3000);
    Exec('sc.exe', 'delete {#ServiceName}', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
end;

[Files]
Source: "..\..\dist\win-unpacked\*";                     DestDir: "{app}"; Flags: ignoreversion recursesubdirs
Source: "..\..\src\service\dist\tabeza-printer-service.exe"; DestDir: "{app}"; DestName: "tabeza-service.exe"; Flags: ignoreversion
Source: "..\..\config-production.json";           DestDir: "{app}"; DestName: "config.json"; Flags: ignoreversion
Source: "..\..\LICENSE.txt";                        DestDir: "{app}"; Flags: ignoreversion
Source: "scripts\*.ps1";      DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "redmon19\*";         DestDir: "{app}\redmon19"; Flags: ignoreversion recursesubdirs

[Dirs]
Name: "{#WatchFolder}";   Permissions: users-full
Name: "{app}\logs";       Permissions: users-full
Name: "{app}\scripts";    Permissions: users-full
Name: "{app}\redmon19";   Permissions: users-full

[Icons]
Name: "{group}\{#AppName}";           Filename: "{app}\TabezaConnect.exe"; WorkingDir: "{app}"
Name: "{group}\Uninstall {#AppName}"; Filename: "{uninstallexe}"
Name: "{commondesktop}\{#AppName}";   Filename: "{app}\TabezaConnect.exe"; WorkingDir: "{app}"
Name: "{group}\View Installation Log"; Filename: "{app}\install.log"

[Run]
Filename: "{app}\TabezaConnect.exe"; Description: "Launch TabezaConnect"; Flags: nowait postinstall skipifsilent