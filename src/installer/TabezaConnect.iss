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
SetupLogging=yes

; ===========================================================================
[Languages]
; ===========================================================================
Name: "english"; MessagesFile: "compiler:Default.isl"

; ===========================================================================
[Code]
var
  BarIDPage: TInputQueryWizardPage;
  BarIDValue: String;
  ApiKeyPage: TInputQueryWizardPage;
  ApiKeyValue: String;

procedure InitializeWizard;
begin
  // Bar ID Page
  BarIDPage := CreateInputQueryPage(wpWelcome,
    'Venue Configuration',
    'Enter your Tabeza Bar ID',
    'Your Bar ID can be found in the Tabeza dashboard under Settings > Venue.' + #13#10 +
    'This ID is required for the service to connect to your Tabeza account.');
  BarIDPage.Add('Bar ID (Required):', False);
  
  // API Key Page (optional - for offline installs)
  ApiKeyPage := CreateInputQueryPage(BarIDPage.ID,
    'API Configuration',
    'Enter your DeepSeek API Key (Optional)',
    'If you have an internet connection, we can fetch this automatically.' + #13#10 +
    'Leave blank to fetch from Tabeza cloud (recommended).' + #13#10 +
    'Only enter manually if you are offline or have a custom key.');
  ApiKeyPage.Add('DeepSeek API Key (Optional):', False);
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
    
    // Validate Bar ID format (alphanumeric, no spaces)
    if Pos(' ', Trim(BarIDPage.Values[0])) > 0 then
    begin
      MsgBox('Bar ID should not contain spaces. Please remove any spaces.', mbError, MB_OK);
      Result := False;
      Exit;
    end;
    
    BarIDValue := Trim(BarIDPage.Values[0]);
  end
  else if CurPageID = ApiKeyPage.ID then
  begin
    ApiKeyValue := Trim(ApiKeyPage.Values[0]);
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
  FetchApiKeyCmd: String;
  TempFile: String;
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

    // Step 2.5: Fetch API key if not provided manually
    LogToFile('Step 2.5: Configuring API key...');
    if ApiKeyValue = '' then
    begin
      LogToFile('  Fetching API key from Tabeza cloud...');
      TempFile := InstallPath + '\temp_apikey.txt';
      
      // Download API key from your backend
      FetchApiKeyCmd := 
        '-NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "' +
        '$wc = New-Object System.Net.WebClient; ' +
        'try { ' +
        '  $url = ''{#BackendAPI}/get-key?barId=' + BarIDValue + '&version={#AppVersion}''; ' +
        '  $response = $wc.DownloadString($url); ' +
        '  $key = ($response | ConvertFrom-Json).apiKey; ' +
        '  $key | Out-File -FilePath ''' + TempFile + ''' -Encoding UTF8; ' +
        '  exit 0; ' +
        '} catch { ' +
        '  Write-Error $_.Exception.Message; ' +
        '  exit 1; ' +
        '}"';
      
      if Exec('powershell.exe', FetchApiKeyCmd, '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0) then
      begin
        // Read the fetched key
        if FileExists(TempFile) then
        begin
          LoadStringFromFile(TempFile, ApiKeyValue);
          ApiKeyValue := Trim(ApiKeyValue);
          DeleteFile(TempFile);
          LogToFile('  ✅ API key fetched successfully');
        end
        else
        begin
          LogToFile('  ⚠️ Could not read fetched API key');
        end;
      end
      else
      begin
        LogToFile('  ⚠️ Could not fetch API key from cloud (code: ' + IntToStr(ResultCode) + ')');
        LogToFile('  ⚠️ Template generation will be limited');
      end;
    end
    else
    begin
      LogToFile('  Using manually provided API key');
    end;

    // Step 3: Write config.json (now with fetched API key)
    LogToFile('Step 3: Writing config.json...');
    if Exec('powershell.exe',
      '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ScriptPath + 'write-config.ps1"' +
      ' -BarID "' + BarIDValue + '" -InstallDir "' + InstallPath + '"' +
      ' -ApiKey "' + ApiKeyValue + '"',
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0) then
    begin
      LogToFile('  ✅ config.json written successfully');
    end
    else
    begin
      ErrorMsg := 'Warning: Could not write config.json (code ' + IntToStr(ResultCode) + ')';
      LogToFile('  ' + ErrorMsg);
    end;

    // Step 4: Configure virtual printer and print pool
    LogToFile('Step 4: Configuring printer...');
    
    // First, detect physical printers
    LogToFile('  Detecting physical printers...');
    if Exec('powershell.exe',
      '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ScriptPath + 'detect-thermal-printer.ps1"' +
      ' -OutputFile "' + InstallPath + '\printer-detection.json"',
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0) then
    begin
      LogToFile('  ✅ Printers detected');
      
      // Configure virtual printer
      if Exec('powershell.exe',
        '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ScriptPath + 'configure-printer.ps1"' +
        ' -WatchFolder "C:\TabezaPrints"',
        '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode <= 1) then
      begin
        LogToFile('  ✅ Virtual printer configured');
        
        // Configure print pool
        if Exec('powershell.exe',
          '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ScriptPath + 'configure-print-pool.ps1"' +
          ' -ConfigFile "' + InstallPath + '\printer-detection.json"',
          '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0) then
        begin
          LogToFile('  ✅ Print pool configured successfully');
        end
        else
        begin
          LogToFile('  ⚠️ Could not configure print pool (code: ' + IntToStr(ResultCode) + ')');
        end;
      end
      else
      begin
        LogToFile('  ⚠️ Could not configure virtual printer (code: ' + IntToStr(ResultCode) + ')');
      end;
    end
    else
    begin
      LogToFile('  ⚠️ Could not detect printers (code: ' + IntToStr(ResultCode) + ')');
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
      ' -InstallDir "' + InstallPath + '" -BarID "' + BarIDValue + '"',
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0) then
    begin
      LogToFile('  ✅ Service registered successfully');
      
      // Start the service
      Exec('powershell.exe',
        '-NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Start-Service -Name ''''{#ServiceName}''''"',
        '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    end
    else
    begin
      LogToFile('  ⚠️ Could not register service (code: ' + IntToStr(ResultCode) + ')');
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
Source: "dist-app\TabezaConnect.exe";       DestDir: "{app}"; Flags: ignoreversion
Source: "dist-app\tabeza-service.exe";      DestDir: "{app}"; Flags: ignoreversion
Source: "config-production.json";           DestDir: "{app}"; DestName: "config.json"; Flags: ignoreversion
Source: "TabezaConnect-Launcher.bat";       DestDir: "{app}"; Flags: ignoreversion
Source: "assets\icon-green.ico";            DestDir: "{app}"; Flags: ignoreversion
Source: "src\installer\scripts\*.ps1";      DestDir: "{app}\scripts"; Flags: ignoreversion

[Dirs]
Name: "{#WatchFolder}";   Permissions: users-modify
Name: "{app}\logs";       Permissions: users-modify
Name: "{app}\scripts";    Permissions: users-read

[Icons]
Name: "{group}\{#AppName}";           Filename: "{app}\TabezaConnect.exe"; WorkingDir: "{app}"
Name: "{group}\Uninstall {#AppName}"; Filename: "{uninstallexe}"
Name: "{commondesktop}\{#AppName}";   Filename: "{app}\TabezaConnect.exe"; WorkingDir: "{app}"
Name: "{group}\View Installation Log"; Filename: "{app}\install.log"

[Run]
Filename: "{app}\TabezaConnect-Launcher.bat"; Description: "Launch TabezaConnect"; Flags: postinstall nowait skipifsilent