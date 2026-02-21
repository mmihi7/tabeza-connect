; Tabeza Connect Installer
; Complete installer with virtual printer, service installation, and configuration
; Requires Inno Setup 6.0 or later: https://jrsoftware.org/isinfo.php

#define MyAppName "Tabeza Connect"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Tabeza"
#define MyAppURL "https://tabeza.co.ke"
#define MyAppExeName "TabezaConnect.exe"
#define ServiceName "TabezaConnect"
#define PrinterName "Tabeza Capture Printer"

[Setup]
; App identification
AppId={{A7B3C4D5-E6F7-8901-2345-67890ABCDEF1}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}

; Installation directories
DefaultDirName={autopf}\Tabeza
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes

; Privileges - MUST run as admin
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog

; Output
OutputDir=installer-output
OutputBaseFilename=TabezaConnectSetup
Compression=lzma
SolidCompression=yes

; UI
WizardStyle=modern
SetupIconFile=tabeza-icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}

; Version info
VersionInfoVersion={#MyAppVersion}
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName} Installer

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
; Main executable (your built TabezaConnect.exe goes here)
Source: "build\TabezaConnect.exe"; DestDir: "{app}"; Flags: ignoreversion

; Node.js runtime (if you're bundling it)
; Source: "node\*"; DestDir: "{app}\node"; Flags: ignoreversion recursesubdirs createallsubdirs

; Configuration template
Source: "config-template.json"; DestDir: "{commonappdata}\Tabeza"; Flags: onlyifdoesntexist

; README and documentation
Source: "README.txt"; DestDir: "{app}"; Flags: isreadme

[Dirs]
; Create necessary directories
Name: "{commonappdata}\Tabeza"; Permissions: everyone-full
Name: "{commonappdata}\Tabeza\queue"; Permissions: everyone-full
Name: "{commonappdata}\Tabeza\logs"; Permissions: everyone-full

[Icons]
; Start menu shortcuts
Name: "{group}\Configure {#MyAppName}"; Filename: "notepad.exe"; Parameters: "{commonappdata}\Tabeza\config.json"
Name: "{group}\View Logs"; Filename: "{commonappdata}\Tabeza\logs"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"

[Code]
var
  ConfigPage: TInputQueryWizardPage;
  BarIDEdit: TEdit;
  DeviceIDEdit: TEdit;
  APIEndpointEdit: TEdit;
  InstallSucceeded: Boolean;
  ServiceInstalled: Boolean;
  PrinterInstalled: Boolean;

// Forward declarations
procedure RollbackInstallation; forward;

{*******************************************************************************
  Initialization - Create configuration wizard pages
*******************************************************************************}
procedure InitializeWizard;
begin
  InstallSucceeded := False;
  ServiceInstalled := False;
  PrinterInstalled := False;

  // Create configuration page
  ConfigPage := CreateInputQueryPage(wpWelcome,
    'Tabeza Configuration',
    'Connect this device to your Tabeza bar',
    'Please enter your configuration details from the Tabeza dashboard.');

  // Bar ID field
  ConfigPage.Add('Bar ID (from Tabeza dashboard):', False);
  ConfigPage.Values[0] := '';
  
  // Device ID field
  ConfigPage.Add('Device ID (e.g., POS-Station-1):', False);
  ConfigPage.Values[1] := 'POS-' + GetComputerNameString;
  
  // API Endpoint field
  ConfigPage.Add('API Endpoint:', False);
  ConfigPage.Values[2] := 'https://api.tabeza.co.ke';
end;

{*******************************************************************************
  Validation - Check configuration inputs
*******************************************************************************}
function NextButtonClick(CurPageID: Integer): Boolean;
var
  BarID: string;
  DeviceID: string;
  APIEndpoint: string;
begin
  Result := True;

  if CurPageID = ConfigPage.ID then
  begin
    BarID := Trim(ConfigPage.Values[0]);
    DeviceID := Trim(ConfigPage.Values[1]);
    APIEndpoint := Trim(ConfigPage.Values[2]);

    // Validate Bar ID
    if BarID = '' then
    begin
      MsgBox('Bar ID is required. Please enter your Bar ID from the Tabeza dashboard.', mbError, MB_OK);
      Result := False;
      Exit;
    end;

    // Validate Device ID
    if DeviceID = '' then
    begin
      MsgBox('Device ID is required. Please enter a unique name for this device.', mbError, MB_OK);
      Result := False;
      Exit;
    end;

    // Validate API Endpoint
    if APIEndpoint = '' then
    begin
      MsgBox('API Endpoint is required.', mbError, MB_OK);
      Result := False;
      Exit;
    end;

    if (Pos('http://', APIEndpoint) <> 1) and (Pos('https://', APIEndpoint) <> 1) then
    begin
      MsgBox('API Endpoint must start with http:// or https://', mbError, MB_OK);
      Result := False;
      Exit;
    end;
  end;
end;

{*******************************************************************************
  Service Management
*******************************************************************************}
function ServiceExists(ServiceName: string): Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec('sc', 'query "' + ServiceName + '"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;

function StopService(ServiceName: string): Boolean;
var
  ResultCode: Integer;
begin
  Log('Stopping service: ' + ServiceName);
  Result := Exec('sc', 'stop "' + ServiceName + '"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  if Result then
    Sleep(2000); // Wait for service to stop
  Log('Stop service result: ' + IntToStr(ResultCode));
end;

function DeleteService(ServiceName: string): Boolean;
var
  ResultCode: Integer;
begin
  Log('Deleting service: ' + ServiceName);
  Result := Exec('sc', 'delete "' + ServiceName + '"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  if Result then
    Sleep(1000); // Wait for deletion
  Log('Delete service result: ' + IntToStr(ResultCode));
end;

function InstallService(ServiceName: string; ExePath: string): Boolean;
var
  ResultCode: Integer;
  Params: string;
begin
  Log('Installing service: ' + ServiceName);
  Params := 'create "' + ServiceName + '" ' +
            'binPath= "' + ExePath + '" ' +
            'start= auto ' +
            'DisplayName= "Tabeza Connect Service"';
  
  Result := Exec('sc', Params, '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Log('Install service result: ' + IntToStr(ResultCode));
  
  if Result and (ResultCode = 0) then
  begin
    // Set service description
    Exec('sc', 'description "' + ServiceName + '" "Captures POS receipts for Tabeza"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    ServiceInstalled := True;
  end;
end;

function StartService(ServiceName: string): Boolean;
var
  ResultCode: Integer;
begin
  Log('Starting service: ' + ServiceName);
  Result := Exec('sc', 'start "' + ServiceName + '"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Log('Start service result: ' + IntToStr(ResultCode));
end;

{*******************************************************************************
  Printer Management
*******************************************************************************}
function PrinterExists(PrinterName: string): Boolean;
var
  ResultCode: Integer;
  Output: AnsiString;
begin
  // Use PowerShell to check if printer exists
  Result := Exec('powershell.exe', 
    '-NoProfile -Command "Get-Printer -Name ''' + PrinterName + ''' -ErrorAction SilentlyContinue | Out-Null; exit $LASTEXITCODE"',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Result := Result and (ResultCode = 0);
  Log('Printer exists check: ' + PrinterName + ' = ' + BoolToStr(Result));
end;

function InstallVirtualPrinter(PrinterName: string): Boolean;
var
  ResultCode: Integer;
  Params: string;
begin
  Log('Installing virtual printer: ' + PrinterName);
  
  // Use printui.dll to install printer with Generic/Text Only driver
  Params := 'printui.dll,PrintUIEntry ' +
            '/if ' +                                          // Install using INF
            '/b "' + PrinterName + '" ' +                    // Printer name
            '/f "%windir%\inf\ntprint.inf" ' +              // INF file (built into Windows)
            '/r "NULL:" ' +                                  // Port (NULL = nothing prints)
            '/m "Generic / Text Only"';                      // Driver name
  
  Result := Exec('rundll32', Params, '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Log('Install printer result: ' + IntToStr(ResultCode));
  
  if Result and (ResultCode = 0) then
  begin
    PrinterInstalled := True;
    Sleep(2000); // Wait for printer to be ready
  end;
end;

function DeletePrinter(PrinterName: string): Boolean;
var
  ResultCode: Integer;
begin
  Log('Deleting printer: ' + PrinterName);
  
  Result := Exec('rundll32',
    'printui.dll,PrintUIEntry /dl /n "' + PrinterName + '"',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  
  Log('Delete printer result: ' + IntToStr(ResultCode));
  
  if Result then
    Sleep(1000);
end;

{*******************************************************************************
  Configuration File Creation
*******************************************************************************}
function CreateConfigFile(BarID, DeviceID, APIEndpoint: string): Boolean;
var
  ConfigFile: string;
  ConfigContent: TStringList;
begin
  Result := False;
  ConfigFile := ExpandConstant('{commonappdata}\Tabeza\config.json');
  
  Log('Creating config file: ' + ConfigFile);
  
  ConfigContent := TStringList.Create;
  try
    ConfigContent.Add('{');
    ConfigContent.Add('  "barId": "' + BarID + '",');
    ConfigContent.Add('  "deviceId": "' + DeviceID + '",');
    ConfigContent.Add('  "apiEndpoint": "' + APIEndpoint + '",');
    ConfigContent.Add('  "queuePath": "C:\\ProgramData\\Tabeza\\queue",');
    ConfigContent.Add('  "logPath": "C:\\ProgramData\\Tabeza\\logs",');
    ConfigContent.Add('  "uploadRetryDelay": 5000,');
    ConfigContent.Add('  "spoolPath": "C:\\Windows\\System32\\spool\\PRINTERS"');
    ConfigContent.Add('}');
    
    try
      ConfigContent.SaveToFile(ConfigFile);
      Result := True;
      Log('Config file created successfully');
    except
      Log('ERROR: Failed to create config file');
      MsgBox('Failed to create configuration file at: ' + ConfigFile, mbError, MB_OK);
    end;
  finally
    ConfigContent.Free;
  end;
end;

{*******************************************************************************
  Rollback - Cleanup on installation failure
*******************************************************************************}
procedure RollbackInstallation;
begin
  Log('Rolling back installation...');
  
  // Stop and remove service if it was installed
  if ServiceInstalled then
  begin
    if ServiceExists('{#ServiceName}') then
    begin
      StopService('{#ServiceName}');
      DeleteService('{#ServiceName}');
    end;
  end;
  
  // Remove printer if it was installed
  if PrinterInstalled then
  begin
    if PrinterExists('{#PrinterName}') then
    begin
      DeletePrinter('{#PrinterName}');
    end;
  end;
  
  Log('Rollback complete');
end;

{*******************************************************************************
  Post-Installation Steps
*******************************************************************************}
procedure CurStepChanged(CurStep: TSetupStep);
var
  BarID: string;
  DeviceID: string;
  APIEndpoint: string;
  ExePath: string;
  ConfigCreated: Boolean;
  ServiceStarted: Boolean;
begin
  if CurStep = ssPostInstall then
  begin
    Log('Starting post-installation steps...');
    
    try
      // Get configuration values
      BarID := Trim(ConfigPage.Values[0]);
      DeviceID := Trim(ConfigPage.Values[1]);
      APIEndpoint := Trim(ConfigPage.Values[2]);
      ExePath := ExpandConstant('{app}\{#MyAppExeName}');
      
      // Step 1: Create configuration file
      Log('Step 1: Creating configuration file');
      ConfigCreated := CreateConfigFile(BarID, DeviceID, APIEndpoint);
      if not ConfigCreated then
      begin
        MsgBox('Failed to create configuration file. Installation cannot continue.', mbCriticalError, MB_OK);
        RollbackInstallation;
        Exit;
      end;
      
      // Step 2: Install virtual printer
      Log('Step 2: Installing virtual printer');
      if not PrinterExists('{#PrinterName}') then
      begin
        if not InstallVirtualPrinter('{#PrinterName}') then
        begin
          MsgBox('Failed to install virtual printer. This is required for receipt capture.' + #13#10 + 
                 'Please run the installer again as Administrator.', mbCriticalError, MB_OK);
          RollbackInstallation;
          Exit;
        end;
      end
      else
      begin
        Log('Printer already exists, skipping installation');
        PrinterInstalled := True; // Mark as installed for rollback purposes
      end;
      
      // Step 3: Stop existing service if running
      Log('Step 3: Checking for existing service');
      if ServiceExists('{#ServiceName}') then
      begin
        Log('Existing service found, stopping and removing');
        StopService('{#ServiceName}');
        DeleteService('{#ServiceName}');
        Sleep(2000); // Wait for full cleanup
      end;
      
      // Step 4: Install Windows service
      Log('Step 4: Installing Windows service');
      if not InstallService('{#ServiceName}', ExePath) then
      begin
        MsgBox('Failed to install Windows service. Please check the installation log.', mbCriticalError, MB_OK);
        RollbackInstallation;
        Exit;
      end;
      
      // Step 5: Start the service
      Log('Step 5: Starting service');
      ServiceStarted := StartService('{#ServiceName}');
      if not ServiceStarted then
      begin
        // Service installation succeeded but start failed - not critical
        MsgBox('Service installed but failed to start automatically.' + #13#10 +
               'You may need to start it manually from Services (services.msc).', mbInformation, MB_OK);
      end;
      
      // Success!
      InstallSucceeded := True;
      Log('Installation completed successfully');
      
    except
      Log('EXCEPTION during post-installation');
      MsgBox('An error occurred during installation. Rolling back changes...', mbCriticalError, MB_OK);
      RollbackInstallation;
    end;
  end;
end;

{*******************************************************************************
  Uninstallation
*******************************************************************************}
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then
  begin
    Log('Starting uninstallation...');
    
    // Stop and remove service
    if ServiceExists('{#ServiceName}') then
    begin
      StopService('{#ServiceName}');
      DeleteService('{#ServiceName}');
    end;
    
    // Remove virtual printer
    if PrinterExists('{#PrinterName}') then
    begin
      DeletePrinter('{#PrinterName}');
    end;
    
    // Note: We don't delete config files or queue data
    // in case user wants to reinstall and keep their configuration
    Log('Uninstallation complete');
  end;
end;

{*******************************************************************************
  Final Page - Show success message and next steps
*******************************************************************************}
procedure CurPageChanged(CurPageID: Integer);
var
  StatusText: string;
begin
  if CurPageID = wpFinished then
  begin
    if InstallSucceeded then
    begin
      StatusText := 'Tabeza Connect has been installed successfully!' + #13#10 + #13#10 +
                    'Configuration:' + #13#10 +
                    '  • Bar ID: ' + ConfigPage.Values[0] + #13#10 +
                    '  • Device ID: ' + ConfigPage.Values[1] + #13#10 + #13#10 +
                    'The service is now running and monitoring for receipts.' + #13#10 + #13#10 +
                    'Next steps:' + #13#10 +
                    '  1. Print a test receipt to "' + '{#PrinterName}' + '"' + #13#10 +
                    '  2. Check your Tabeza dashboard for captured receipts' + #13#10 +
                    '  3. Configure your actual POS to use this capture method';
      
      MsgBox(StatusText, mbInformation, MB_OK);
    end;
  end;
end;

[UninstallDelete]
; Clean up generated files on uninstall (keep config and queue for safety)
Type: filesandordirs; Name: "{app}"

[Run]
; Optional: Open configuration after install
Filename: "{commonappdata}\Tabeza\config.json"; Description: "View configuration file"; Flags: postinstall shellexec skipifsilent nowait

; Optional: Open logs directory
Filename: "{commonappdata}\Tabeza\logs"; Description: "Open logs directory"; Flags: postinstall shellexec skipifsilent nowait unchecked
