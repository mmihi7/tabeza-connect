; TabezaConnect Bootstrapper Installer
; Downloads and installs the actual application from cloud

#define MyAppName "Tabeza POS Connect"
#define MyAppVersion "1.1.0"
#define MyAppPublisher "Tabeza"
#define MyAppURL "https://tabeza.co.ke"
#define MyAppExeName "TabezaConnect.exe"
#define CloudDownloadURL "https://releases.tabeza.co.ke/TabezaConnect-1.1.0.exe"

[Setup]
AppId={{COMPILE-TIME-GENERATED-GUID}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
LicenseFile=LICENSE.txt
OutputDir=dist-bootstrapper
OutputBaseFilename=TabezaConnect-Setup
SetupIconFile=assets\icon.ico
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin

; Download progress page
[Messages]
BeveledLabel=TabezaConnect POS Bridge

[CustomMessages]
DownloadCaption=Choose Installation Version
DownloadLabel=Select Tabeza POS Connect version to install:
DownloadSubLabel=Choose from available versions below.
VersionLabel=Available Versions:
CustomURLLabel=Or enter custom download URL:

[Code]
{ Function to download file from URL }
function DownloadFile(URL, Filename: string): Boolean;
var
  WinHttpReq: Variant;
  Stream: Variant;
  BytesRead: Integer;
  TotalBytes: Integer;
  Buffer: string;
begin
  Result := False;
  try
    WinHttpReq := CreateOleObject('WinHttp.WinHttpRequest.5.1');
    WinHttpReq.Open('GET', URL, False);
    WinHttpReq.Send;
    
    if WinHttpReq.Status = 200 then
    begin
      Stream := CreateOleObject('ADODB.Stream');
      Stream.Type := 1; { adTypeBinary }
      Stream.Open;
      Stream.Write(WinHttpReq.ResponseBody);
      Stream.SaveToFile(Filename, 2); { adSaveCreateOverWrite }
      Stream.Close;
      
      Result := True;
    end;
  except
    Result := False;
  end;
end;

{ Version selection page }
function CreateVersionPage: TWizardPage;
var
  Page: TWizardPage;
  VersionCombo: TComboBox;
  CustomEdit: TEdit;
  CustomLabel: TNewStaticText;
begin
  Page := CreateCustomPage(wpWelcome, CustomMessage('DownloadCaption'), CustomMessage('DownloadLabel'));
  
  { Version label }
  CustomLabel := TNewStaticText.Create(Page);
  CustomLabel.Caption := CustomMessage('VersionLabel');
  CustomLabel.Top := ScaleY(30);
  CustomLabel.Left := ScaleX(20);
  
  { Version dropdown }
  VersionCombo := TComboBox.Create(Page);
  VersionCombo.Top := ScaleY(60);
  VersionCombo.Left := ScaleX(20);
  VersionCombo.Width := Page.SurfaceWidth - ScaleX(40);
  VersionCombo.Style := csDropDownList;
  
  { Add available versions }
  VersionCombo.Items.Add('1.1.0 (Latest)');
  VersionCombo.Items.Add('1.0.9');
  VersionCombo.Items.Add('1.0.8');
  VersionCombo.Items.Add('1.0.7');
  VersionCombo.ItemIndex := 0; { Select latest by default }
  
  { Custom URL edit }
  CustomEdit := TEdit.Create(Page);
  CustomEdit.Top := ScaleY(120);
  CustomEdit.Left := ScaleX(20);
  CustomEdit.Width := Page.SurfaceWidth - ScaleX(40);
  CustomEdit.Text := '';
  
  { Custom URL label }
  CustomLabel := TNewStaticText.Create(Page);
  CustomLabel.Caption := CustomMessage('CustomURLLabel');
  CustomLabel.Top := ScaleY(100);
  CustomLabel.Left := ScaleX(20);
  
  Result := Page;
end;
function CreateDownloadPage: TWizardPage;
var
  Page: TWizardPage;
  ProgressBar: TNewProgressBar;
  StatusLabel: TNewStaticText;
begin
  Page := CreateCustomPage(wpReady, CustomMessage('DownloadCaption'), CustomMessage('DownloadLabel'));
  
  StatusLabel := TNewStaticText.Create(Page);
  StatusLabel.Top := ScaleY(20);
  StatusLabel.Left := ScaleX(0);
  StatusLabel.Width := Page.SurfaceWidth;
  StatusLabel.Caption := CustomMessage('DownloadSubLabel');
  StatusLabel.Parent := Page.Surface;
  
  ProgressBar := TNewProgressBar.Create(Page);
  ProgressBar.Top := ScaleY(60);
  ProgressBar.Left := ScaleX(0);
  ProgressBar.Width := Page.SurfaceWidth;
  ProgressBar.Height := ScaleY(25);
  ProgressBar.Position := 0;
  ProgressBar.Parent := Page.Surface;
  
  Result := Page;
end;

// Download and install the actual application
procedure DownloadAndInstall;
var
  DownloadPath: string;
  InstallPath: string;
  ResultCode: Integer;
begin
  DownloadPath := ExpandConstant('{tmp}\{#MyAppExeName}');
  InstallPath := ExpandConstant('{app}\{#MyAppExeName}');
  
  // Download the actual installer
  if not DownloadFile('{#CloudDownloadURL}', DownloadPath) then
  begin
    MsgBox('Failed to download Tabeza POS Connect. Please check your internet connection and try again.', mbError, MB_OK);
    Abort;
  end;
  
  // Run the downloaded installer silently
  if not Exec(DownloadPath, '/S /D=' + ExpandConstant('{app}'), '', SW_SHOW, ewWaitUntilTerminated, ResultCode) then
  begin
    MsgBox('Failed to install Tabeza POS Connect. Error code: ' + IntToStr(ResultCode), mbError, MB_OK);
    Abort;
  end;
  
  // Clean up downloaded file
  DeleteFile(DownloadPath);
end;

// Initialize setup
function InitializeSetup(): Boolean;
var
  DownloadPage: TWizardPage;
begin
  // Create custom download page
  DownloadPage := CreateDownloadPage;
  
  Result := True;
end;

// Next page handler
function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  
  if CurPageID = wpReady then
  begin
    // Start download and installation
    DownloadAndInstall;
  end;
end;

// Installation complete
procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = wpFinished then
  begin
    // Create desktop shortcut
    CreateShellLink(
      ExpandConstant('{userdesktop}\Tabeza POS Connect.lnk'),
      ExpandConstant('{app}\{#MyAppExeName}'),
      '',
      ExpandConstant('{app}'),
      '', '', 0, SW_SHOWNORMAL, 
      ExpandConstant('{app}\{#MyAppExeName}'), 0, '');
      
    // Create start menu shortcut
    CreateShellLink(
      ExpandConstant('{userprograms}\Tabeza POS Connect\Tabeza POS Connect.lnk'),
      ExpandConstant('{app}\{#MyAppExeName}'),
      '',
      ExpandConstant('{app}'),
      '', '', 0, SW_SHOWNORMAL, 
      ExpandConstant('{app}\{#MyAppExeName}'), 0, '');
  end;
end;
