; ===========================================================================
; TabezaConnect - Modern Installer Script (No BarID in installer)
; Version: 1.7.0
; ===========================================================================
; This installer uses the modern approach where BarID is set through the tray interface
; instead of during installation. This simplifies the installation process.

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
SetupIconFile=..\..\assets\icon-green.ico
UninstallDisplayIcon={app}\TabezaConnect.exe

Compression=lzma2/ultra64
SolidCompression=yes
LZMAUseSeparateProcess=yes
WizardStyle=modern
SetupLogging=yes

; ===========================================================================
[Languages]
; ===========================================================================
Name: "english"; MessagesFile: "compiler:Default.isl"

; ===========================================================================
[Messages]
; ===========================================================================
WelcomeLabel2=This will install TabezaConnect on your computer.%n%nTabezaConnect captures receipt data from your POS system and syncs it with the Tabeza staff app.%n%nIMPORTANT: Tabeza works ALONGSIDE your existing printer. Your current printer setup will NOT change.%n%nAfter installation, right-click the TabezaConnect tray icon to configure your Bar ID and settings.

; ===========================================================================
[Files]
; ===========================================================================
Source: "..\..\dist\win-unpacked\TabezaConnect.exe";       DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\src\service\dist\tabeza-printer-service.exe"; DestDir: "{app}"; DestName: "tabeza-service.exe"; Flags: ignoreversion
Source: "..\..\config-production.json";           DestDir: "{app}"; DestName: "config.json"; Flags: ignoreversion
Source: "..\..\assets\icon-green.ico";            DestDir: "{app}"; Flags: ignoreversion
Source: "scripts\*.ps1";      DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "redmon19\*";         DestDir: "{app}\redmon19"; Flags: ignoreversion recursesubdirs

; ===========================================================================
[Dirs]
; ===========================================================================
Name: "{#WatchFolder}";   Permissions: users-full
Name: "{app}\logs";       Permissions: users-full
Name: "{app}\scripts";    Permissions: users-full
Name: "{app}\redmon19";   Permissions: users-full

; ===========================================================================
[Icons]
; ===========================================================================
Name: "{group}\{#AppName}";           Filename: "{app}\TabezaConnect.exe"; WorkingDir: "{app}"
Name: "{group}\Uninstall {#AppName}"; Filename: "{uninstallexe}"
Name: "{commondesktop}\{#AppName}";   Filename: "{app}\TabezaConnect.exe"; WorkingDir: "{app}"

; ===========================================================================
[Registry]
; ===========================================================================
; Auto-start TabezaConnect.exe at Windows login (for system tray)
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; \
  ValueType: string; ValueName: "TabezaConnect"; \
  ValueData: """{app}\TabezaConnect.exe"""; \
  Flags: uninsdeletevalue

; ===========================================================================
[Code]
; ===========================================================================
procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  InstallPath: String;
  RedmonPath: String;
begin
  if CurStep = ssPostInstall then
  begin
    InstallPath := ExpandConstant('{app}');
    RedmonPath := InstallPath + '\redmon19';
    
    // Step 1: Install Redmon port monitor
    Exec(ExpandConstant('{cmd}'), '/c ""' + RedmonPath + '\setup.exe" -s"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    
    // Step 2: Configure Redmon port
    Exec(ExpandConstant('{cmd}'), '/c reg add "HKLM\SYSTEM\CurrentControlSet\Control\Print\Monitors\Redirected Port\Ports\TabezaCapturePort" /v Command /t REG_SZ /d "C:\TabezaPrints\capture.exe" /f', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    
    // Step 3: Set output printer
    Exec(ExpandConstant('{cmd}'), '/c reg add "HKLM\SYSTEM\CurrentControlSet\Control\Print\Monitors\Redirected Port\Ports\TabezaCapturePort" /v Output /t REG_SZ /d "EPSON L3210 Series" /f', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
end;

; ===========================================================================
[Run]
; ===========================================================================
Filename: "{app}\TabezaConnect.exe"; Description: "Launch TabezaConnect (tray icon will appear)"; Flags: postinstall nowait skipifsilent
