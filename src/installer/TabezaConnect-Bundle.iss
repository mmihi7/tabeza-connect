; TabezaConnect Installer - Packages nodejs-bundle into EXE
; Simple, standalone installer

#ifndef AppVersion
  #define AppVersion "1.7.14"
#endif

#define AppName "TabezaConnect"
#define AppPublisher "Tabeza"
#define AppURL "https://tabeza.co.ke"

[Setup]
AppId={{6D3E8A2F-4B1C-4F9D-A8E5-2C7B3D6F1A04}}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
VersionInfoVersion={#AppVersion}

ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

DefaultDirName={commonpf64}\TabezaConnect
DisableDirPage=yes
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes

PrivilegesRequired=admin

OutputDir=..\..\dist
OutputBaseFilename=TabezaConnect-Setup-v{#AppVersion}
SetupIconFile=..\..\assets\icon-green.ico

Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
; Package the entire nodejs-bundle directory
Source: "nodejs-bundle\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Dirs]
Name: "C:\TabezaPrints"; Permissions: users-modify
Name: "C:\TabezaPrints\spool"; Permissions: users-modify
Name: "C:\TabezaPrints\processed"; Permissions: users-modify
Name: "C:\TabezaPrints\failed"; Permissions: users-modify
Name: "C:\ProgramData\Tabeza"; Permissions: users-modify
Name: "C:\ProgramData\Tabeza\logs"; Permissions: users-modify

[Icons]
Name: "{group}\{#AppName} Dashboard"; Filename: "http://localhost:8765"
Name: "{group}\View Logs"; Filename: "{app}\logs"
Name: "{group}\Uninstall {#AppName}"; Filename: "{uninstallexe}"

[Run]
; Run the install.bat script after installation
Filename: "{app}\install.bat"; Description: "Complete installation setup"; Flags: postinstall runascurrentuser waituntilterminated
