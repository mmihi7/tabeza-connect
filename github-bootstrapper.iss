[Setup]
AppName=Tabeza POS Connect
AppVersion=1.1.0
AppPublisher=Tabeza
DefaultDirName={autopf}\Tabeza POS Connect
OutputDir=dist-bootstrapper
OutputBaseFilename=TabezaConnect-Setup-1.1.0
Compression=lzma
WizardStyle=modern
PrivilegesRequired=admin

[Code]
function DownloadAndInstall;
begin
  MsgBox('Tabeza POS Connect 1.1.0 will be downloaded from:' + #13#10 + 'https://github.com/billoapp/TabezaConnect/releases/download/v1.1.0/TabezaConnect.exe', mbInformation, MB_OK);
end;
