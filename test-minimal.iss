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
var
  DownloadURL, DownloadPath, ResultCode: Integer;
begin
  { GitHub Releases URL }
  DownloadURL := 'https://github.com/billoapp/TabezaConnect/releases/download/v1.1.0/TabezaConnect.exe';
  DownloadPath := ExpandConstant('{tmp}\TabezaConnect-1.1.0.exe');
  
  { Show download dialog }
  if MsgBox('Download Tabeza POS Connect 1.1.0 from GitHub?', mbConfirmation, MB_YESNO) = IDYES then
  begin
    { Download the main app }
    if MsgBox('Downloading from: ' + DownloadURL + #13#10 + 'This will download the full TabezaConnect application.', mbInformation, MB_OK) = IDOK then
    begin
      { TODO: Add actual download code here }
      MsgBox('Ready to download from GitHub Releases!', mbInformation, MB_OK);
    end;
  end;
end;
