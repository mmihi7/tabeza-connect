[Setup]
AppName=Tabeza POS Connect
AppVersion=1.1.1
AppPublisher=Tabeza
DefaultDirName={autopf}\Tabeza POS Connect
OutputDir=dist-bootstrapper
OutputBaseFilename=TabezaConnect-Setup-1.1.1
SetupIconFile=assets\icon.ico
Compression=lzma
WizardStyle=modern
PrivilegesRequired=admin
LicenseFile=LICENSE.txt

[Files]

[Code]
procedure InitializeWizard;
begin
  MsgBox('Tabeza POS Connect 1.1.1 will be downloaded from GitHub.' + #13#10 +
         'Repo: billoapp/TabezaConnect', mbInformation, MB_OK);
end;
