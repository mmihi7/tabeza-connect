; Tabeza POS Connect Professional Bootstrapper
; Downloads and installs TabezaConnect with professional UI

#define MyAppName "Tabeza POS Connect"
#define MyAppVersion "1.1.1"
#define MyAppPublisher "Tabeza"
#define MyAppURL "https://tabeza.co.ke"
#define MyAppExeName "TabezaConnect.exe"
#define CloudDownloadURL "https://github.com/billoapp/TabezaConnect/releases/download/v1.1.1/TabezaConnect.exe"

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
OutputBaseFilename=TabezaConnect-Setup-{#MyAppVersion}
SetupIconFile=assets\icon.ico
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
WizardImageStretch=no
ShowLanguageDialog=yes

[Messages]
WelcomeLabel1=Welcome to the {#MyAppName} Setup Wizard
WelcomeLabel2=This will install {#MyAppName} on your computer.%n%n%nClick Next to continue.
FinishedLabel={#MyAppName} has been installed on your computer.%n%n%nClick Finish to close Setup.
BeveledLabel=Tabeza POS Connect

[CustomMessages]
DownloadCaption=Downloading {#MyAppName}
DownloadLabel=Please wait while we download the latest version of {#MyAppName}...
DownloadSubLabel=This may take a few moments depending on your connection speed.
InstallingLabel=Installing {#MyAppName}...
ConfiguringLabel=Configuring {#MyAppName}...
CompleteLabel=Installation complete!

[Code]
var
  DownloadPage: TWizardPage;
  ProgressBar: TNewProgressBar;
  StatusLabel: TNewStaticText;
  CancelButton: TNewButton;

{ Function to create download progress page }
function CreateDownloadPage: TWizardPage;
begin
  DownloadPage := CreateCustomPage(wpWelcome, CustomMessage('DownloadCaption'), CustomMessage('DownloadLabel'), CustomMessage('DownloadSubLabel'));
  
  { Create progress bar }
  ProgressBar := TNewProgressBar.Create(DownloadPage.Surface);
  ProgressBar.SetBounds(ScaleX(20), ScaleY(60), ScaleX(200), ScaleY(25));
  
  { Create status label }
  StatusLabel := TNewStaticText.Create(DownloadPage.Surface);
  StatusLabel.SetBounds(ScaleX(20), ScaleY(30), ScaleX(300), ScaleY(20));
  StatusLabel.Caption := CustomMessage('DownloadLabel');
  
  { Create cancel button }
  CancelButton := TNewButton.Create(DownloadPage.Surface);
  CancelButton.Caption := 'Cancel';
  CancelButton.SetBounds(ScaleX(240), ScaleY(100), ScaleX(75), ScaleY(25));
  CancelButton.OnClick := @CancelButtonClick;
  
  Result := DownloadPage;
end;

{ Function to download file with progress }
function DownloadFileWithProgress(URL, Filename: string): Boolean;
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
      TotalBytes := Length(WinHttpReq.ResponseBody);
      Stream := CreateOleObject('ADODB.Stream');
      Stream.Type := 1; { adTypeBinary }
      Stream.Open;
      
      BytesRead := 0;
      while BytesRead < TotalBytes do
      begin
        { Update progress }
        ProgressBar.Position := Round(BytesRead * 100 / TotalBytes);
        StatusLabel.Caption := 'Downloading... ' + IntToStr(BytesRead) + ' / ' + IntToStr(TotalBytes) + ' bytes';
        
        { Read chunk }
        Buffer := Copy(WinHttpReq.ResponseBody, BytesRead + 1, 10000);
        Stream.Write(Buffer);
        BytesRead := BytesRead + Length(Buffer);
        
        { Allow UI to update }
        Application.ProcessMessages;
      end;
      
      Stream.SaveToFile(Filename, 2); { adSaveCreateOverWrite }
      Stream.Close;
      
      Result := True;
    end;
  except
    Result := False;
  end;
end;

{ Function to install downloaded application }
function InstallDownloadedApp(Filename: string): Boolean;
var
  ResultCode: Integer;
  InstallPath: string;
begin
  InstallPath := ExpandConstant('{app}\{#MyAppExeName}');
  
  { Update UI }
  StatusLabel.Caption := CustomMessage('InstallingLabel');
  ProgressBar.Position := 0;
  
  { Copy downloaded file to app directory }
  if FileCopy(Filename, InstallPath, False) then
  begin
    { Create desktop shortcut }
    CreateShellLink(
      ExpandConstant('{userdesktop}\{#MyAppName}.lnk'),
      InstallPath,
      '',
      ExpandConstant('{app}'),
      '', '', 0, SW_SHOWNORMAL, 
      InstallPath, 0, '');
    
    { Create start menu shortcut }
    CreateShellLink(
      ExpandConstant('{userprograms}\{#MyAppName}\{#MyAppName}.lnk'),
      InstallPath,
      '',
      ExpandConstant('{app}'),
      '', '', 0, SW_SHOWNORMAL, 
      InstallPath, 0, '');
    
    { Create auto-start registry entry }
    RegWriteStringValue(HKCU, 'Software\Microsoft\Windows\CurrentVersion\Run', '{#MyAppName}', InstallPath);
    
    Result := True;
  end
  else
  begin
    Result := False;
  end;
end;

{ Cancel button handler }
procedure CancelButtonClick(Sender: TObject);
begin
  { Show confirmation }
  if MsgBox('Are you sure you want to cancel the installation?', mbConfirmation, MB_YESNO) = IDYES then
  begin
    WizardForm.Close;
  end;
end;

{ Initialize wizard }
function InitializeWizard: Boolean;
begin
  Result := True;
end;

{ Next page handler }
function NextButtonClick(CurPageID: Integer): Boolean;
var
  DownloadPath: string;
  InstallSuccess: Boolean;
begin
  Result := True;
  
  if CurPageID = wpReady then
  begin
    { Start download }
    DownloadPath := ExpandConstant('{tmp}\{#MyAppExeName}');
    
    if DownloadFileWithProgress('{#CloudDownloadURL}', DownloadPath) then
    begin
      { Install the application }
      InstallSuccess := InstallDownloadedApp(DownloadPath);
      
      if InstallSuccess then
      begin
        { Show completion message }
        StatusLabel.Caption := CustomMessage('CompleteLabel');
        ProgressBar.Position := 100;
        
        { Clean up temp file }
        DeleteFile(DownloadPath);
        
        { Proceed to finish }
        Result := True;
      end
      else
      begin
        MsgBox('Failed to install {#MyAppName}. Please try again.', mbError, MB_OK);
        Result := False;
      end;
    end
    else
    begin
      MsgBox('Failed to download {#MyAppName}. Please check your internet connection and try again.', mbError, MB_OK);
      Result := False;
    end;
  end
  else if CurPageID = CreateDownloadPage.ID then
  begin
    { Start download when user clicks Next }
    PostMessage(WizardForm.Handle, WM_Next, 0, 0);
  end;
end;

{ Should skip page logic }
function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
end;

{ Page change handler }
function CurPageChanged(CurPageID, CurNewPageID: Integer);
begin
  { Update progress bar when entering download page }
  if CurNewPageID = CreateDownloadPage.ID then
  begin
    ProgressBar.Position := 0;
    StatusLabel.Caption := CustomMessage('DownloadLabel');
  end;
end;
