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

; clawPDF installer and scripts
Source: "src\installer\clawPDF-0.9.3.msi"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "src\installer\scripts\install-clawpdf.ps1"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "src\installer\scripts\rollback-clawpdf.ps1"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "src\installer\scripts\configure-clawpdf.ps1"; DestDir: "{tmp}"; Flags: deleteafterinstall

[Dirs]
; Create necessary directories
Name: "{commonappdata}\Tabeza"; Permissions: everyone-full
Name: "{commonappdata}\Tabeza\queue"; Permissions: everyone-full
Name: "{commonappdata}\Tabeza\logs"; Permissions: everyone-full
Name: "{commonappdata}\Tabeza\TabezaPrints"; Permissions: everyone-full
Name: "{commonappdata}\Tabeza\TabezaPrints\spool"; Permissions: everyone-full
Name: "{commonappdata}\Tabeza\TabezaPrints\processed"; Permissions: everyone-full
Name: "{commonappdata}\Tabeza\TabezaPrints\failed"; Permissions: everyone-full

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
  ClawPDFInstalled: Boolean;

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
  ClawPDFInstalled := False;

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

{*******************************************************************************
  ClawPDF Management
*******************************************************************************}
function InstallClawPDF(): Boolean;
var
  ResultCode: Integer;
  InstallerPath: string;
  ScriptPath: string;
  LogPath: string;
begin
  Log('Installing clawPDF...');
  Result := False;
  
  InstallerPath := ExpandConstant('{tmp}\clawPDF-0.9.3.msi');
  ScriptPath := ExpandConstant('{tmp}\install-clawpdf.ps1');
  LogPath := ExpandConstant('{tmp}\clawpdf-install.log');
  
  // Execute PowerShell script to install clawPDF
  if Exec('powershell.exe',
    '-NoProfile -ExecutionPolicy Bypass -File "' + ScriptPath + '" ' +
    '-InstallerPath "' + InstallerPath + '" ' +
    '-LogPath "' + LogPath + '"',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    Log('ClawPDF installation script exit code: ' + IntToStr(ResultCode));
    
    if ResultCode = 0 then
    begin
      Log('ClawPDF installed successfully');
      ClawPDFInstalled := True;
      Result := True;
    end
    else
    begin
      Log('ERROR: ClawPDF installation failed with exit code: ' + IntToStr(ResultCode));
      MsgBox('Failed to install clawPDF (exit code: ' + IntToStr(ResultCode) + ').' + #13#10 +
             'Please check the log file at: ' + LogPath, mbError, MB_OK);
    end;
  end
  else
  begin
    Log('ERROR: Failed to execute clawPDF installation script');
    MsgBox('Failed to execute clawPDF installation script.', mbError, MB_OK);
  end;
end;

function ConfigureClawPDF(): Boolean;
var
  ResultCode: Integer;
  ScriptPath: string;
  SpoolPath: string;
begin
  Log('Configuring clawPDF printer profile...');
  Result := False;
  
  ScriptPath := ExpandConstant('{tmp}\configure-clawpdf.ps1');
  SpoolPath := ExpandConstant('{commonappdata}\Tabeza\TabezaPrints\spool');
  
  // Execute PowerShell script to configure clawPDF
  if Exec('powershell.exe',
    '-NoProfile -ExecutionPolicy Bypass -File "' + ScriptPath + '" ' +
    '-SpoolPath "' + SpoolPath + '"',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    Log('ClawPDF configuration script exit code: ' + IntToStr(ResultCode));
    
    if ResultCode = 0 then
    begin
      Log('ClawPDF configured successfully');
      Result := True;
    end
    else
    begin
      Log('ERROR: ClawPDF configuration failed with exit code: ' + IntToStr(ResultCode));
      MsgBox('Failed to configure clawPDF printer profile (exit code: ' + IntToStr(ResultCode) + ').', mbError, MB_OK);
    end;
  end
  else
  begin
    Log('ERROR: Failed to execute clawPDF configuration script');
    MsgBox('Failed to execute clawPDF configuration script.', mbError, MB_OK);
  end;
end;

function RollbackClawPDF(): Boolean;
var
  ResultCode: Integer;
  ScriptPath: string;
  LogPath: string;
begin
  Log('Rolling back clawPDF installation...');
  Result := False;
  
  ScriptPath := ExpandConstant('{tmp}\rollback-clawpdf.ps1');
  LogPath := ExpandConstant('{tmp}\clawpdf-rollback.log');
  
  // Execute PowerShell script to rollback clawPDF
  if Exec('powershell.exe',
    '-NoProfile -ExecutionPolicy Bypass -File "' + ScriptPath + '" ' +
    '-LogPath "' + LogPath + '"',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    Log('ClawPDF rollback script exit code: ' + IntToStr(ResultCode));
    
    if ResultCode = 0 then
    begin
      Log('ClawPDF rolled back successfully');
      Result := True;
    end
    else
    begin
      Log('WARNING: ClawPDF rollback failed with exit code: ' + IntToStr(ResultCode));
      // Don't show error to user during rollback - just log it
    end;
  end
  else
  begin
    Log('WARNING: Failed to execute clawPDF rollback script');
  end;
end;

{*******************************************************************************
  Printer Management (continued)
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
  
  // Rollback clawPDF if it was installed
  if ClawPDFInstalled then
  begin
    RollbackClawPDF();
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
      
      // Step 2: Install clawPDF
      Log('Step 2: Installing clawPDF');
      if not InstallClawPDF() then
      begin
        MsgBox('Failed to install clawPDF. This is required for receipt capture.' + #13#10 + 
               'Please run the installer again as Administrator.', mbCriticalError, MB_OK);
        RollbackInstallation;
        Exit;
      end;
      
      // Step 3: Configure clawPDF printer profile
      Log('Step 3: Configuring clawPDF printer profile');
      if not ConfigureClawPDF() then
      begin
        MsgBox('Failed to configure clawPDF printer profile. Installation cannot continue.', mbCriticalError, MB_OK);
        RollbackInstallation;
        Exit;
      end;
      
      // Step 4: Install virtual printer (legacy - may be removed in future)
      Log('Step 4: Installing virtual printer (legacy)');
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
      
      // Step 5: Stop existing service if running
      Log('Step 5: Checking for existing service');
      if ServiceExists('{#ServiceName}') then
      begin
        Log('Existing service found, stopping and removing');
        StopService('{#ServiceName}');
        DeleteService('{#ServiceName}');
        Sleep(2000); // Wait for full cleanup
      end;
      
      // Step 6: Install Windows service
      Log('Step 6: Installing Windows service');
      if not InstallService('{#ServiceName}', ExePath) then
      begin
        MsgBox('Failed to install Windows service. Please check the installation log.', mbCriticalError, MB_OK);
        RollbackInstallation;
        Exit;
      end;
      
      // Step 7: Start the service
      Log('Step 7: Starting service');
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
  Registry Cleanup Functions
*******************************************************************************}
function DeleteRegistryKey(RootKey: Integer; SubKeyPath: string): Boolean;
var
  ResultCode: Integer;
  RootKeyName: string;
begin
  Result := False;
  
  // Convert root key constant to string for logging
  case RootKey of
    HKEY_LOCAL_MACHINE: RootKeyName := 'HKLM';
    HKEY_CURRENT_USER: RootKeyName := 'HKCU';
    else RootKeyName := 'UNKNOWN';
  end;
  
  Log('Attempting to delete registry key: ' + RootKeyName + '\' + SubKeyPath);
  
  // Check if key exists before attempting deletion
  if RegKeyExists(RootKey, SubKeyPath) then
  begin
    if RegDeleteKeyIncludingSubkeys(RootKey, SubKeyPath) then
    begin
      Log('Successfully deleted registry key: ' + RootKeyName + '\' + SubKeyPath);
      Result := True;
    end
    else
    begin
      Log('WARNING: Failed to delete registry key: ' + RootKeyName + '\' + SubKeyPath);
    end;
  end
  else
  begin
    Log('Registry key does not exist (already removed): ' + RootKeyName + '\' + SubKeyPath);
    Result := True; // Not an error if key doesn't exist
  end;
end;

function CleanupTabezaRegistry(): Boolean;
begin
  Log('Cleaning up Tabeza Connect registry entries...');
  Result := True;
  
  // Remove Tabeza Connect configuration registry key
  if not DeleteRegistryKey(HKEY_LOCAL_MACHINE, 'SOFTWARE\Tabeza\TabezaConnect') then
    Result := False;
  
  // Remove parent Tabeza key if it's empty (no other subkeys)
  if RegKeyExists(HKEY_LOCAL_MACHINE, 'SOFTWARE\Tabeza') then
  begin
    // Only delete if no subkeys remain
    if not RegKeyExists(HKEY_LOCAL_MACHINE, 'SOFTWARE\Tabeza\TabezaConnect') then
    begin
      Log('Attempting to remove parent Tabeza registry key if empty...');
      DeleteRegistryKey(HKEY_LOCAL_MACHINE, 'SOFTWARE\Tabeza');
    end;
  end;
  
  Log('Tabeza Connect registry cleanup complete');
end;

function CleanupClawPDFRegistry(): Boolean;
var
  UserChoice: Integer;
begin
  Log('Checking for clawPDF registry entries...');
  Result := True;
  
  // Check if clawPDF registry keys exist
  if RegKeyExists(HKEY_CURRENT_USER, 'Software\clawSoft\clawPDF') or
     RegKeyExists(HKEY_LOCAL_MACHINE, 'SOFTWARE\clawSoft\clawPDF') then
  begin
    // Ask user if they want to remove clawPDF completely
    UserChoice := MsgBox(
      'Do you want to remove clawPDF printer software completely?' + #13#10 + #13#10 +
      'Choose "Yes" to remove clawPDF and all its settings.' + #13#10 +
      'Choose "No" to keep clawPDF installed (you may be using it for other purposes).' + #13#10 + #13#10 +
      'Note: The "Tabeza POS Printer" profile will be removed regardless of your choice.',
      mbConfirmation, MB_YESNO);
    
    if UserChoice = IDYES then
    begin
      Log('User chose to remove clawPDF completely');
      
      // Remove clawPDF user settings (HKCU)
      if not DeleteRegistryKey(HKEY_CURRENT_USER, 'Software\clawSoft\clawPDF') then
        Result := False;
      
      // Remove clawPDF machine settings (HKLM)
      if not DeleteRegistryKey(HKEY_LOCAL_MACHINE, 'SOFTWARE\clawSoft\clawPDF') then
        Result := False;
      
      // Remove parent clawSoft keys if empty
      if RegKeyExists(HKEY_CURRENT_USER, 'Software\clawSoft') then
      begin
        if not RegKeyExists(HKEY_CURRENT_USER, 'Software\clawSoft\clawPDF') then
          DeleteRegistryKey(HKEY_CURRENT_USER, 'Software\clawSoft');
      end;
      
      if RegKeyExists(HKEY_LOCAL_MACHINE, 'SOFTWARE\clawSoft') then
      begin
        if not RegKeyExists(HKEY_LOCAL_MACHINE, 'SOFTWARE\clawSoft\clawPDF') then
          DeleteRegistryKey(HKEY_LOCAL_MACHINE, 'SOFTWARE\clawSoft');
      end;
      
      Log('clawPDF registry cleanup complete');
    end
    else
    begin
      Log('User chose to keep clawPDF installed');
    end;
  end
  else
  begin
    Log('No clawPDF registry entries found');
  end;
end;

{*******************************************************************************
  Uninstallation
*******************************************************************************}
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  DataChoice: Integer;
begin
  if CurUninstallStep = usUninstall then
  begin
    Log('Starting uninstallation...');
    Log('Tabeza Connect version: {#MyAppVersion}');
    Log('Computer name: ' + GetComputerNameString);
    
    // Step 1: Stop and remove service
    Log('Step 1: Stopping and removing Windows service');
    if ServiceExists('{#ServiceName}') then
    begin
      StopService('{#ServiceName}');
      DeleteService('{#ServiceName}');
      Log('Service removed successfully');
    end
    else
    begin
      Log('Service not found (already removed or never installed)');
    end;
    
    // Step 2: Remove virtual printer
    Log('Step 2: Removing virtual printer');
    if PrinterExists('{#PrinterName}') then
    begin
      DeletePrinter('{#PrinterName}');
      Log('Printer removed successfully');
    end
    else
    begin
      Log('Printer not found (already removed or never installed)');
    end;
    
    // Step 3: Clean up Tabeza Connect registry entries
    Log('Step 3: Cleaning up Tabeza Connect registry entries');
    CleanupTabezaRegistry();
    
    // Step 4: Clean up clawPDF registry entries (with user prompt)
    Log('Step 4: Cleaning up clawPDF registry entries');
    CleanupClawPDFRegistry();
    
    // Step 5: Ask about data deletion
    Log('Step 5: Checking for user data');
    if DirExists(ExpandConstant('{commonappdata}\Tabeza')) then
    begin
      DataChoice := MsgBox(
        'Do you want to delete all captured receipt data and configuration?' + #13#10 + #13#10 +
        'This includes:' + #13#10 +
        '  • Configuration files (config.json, template.json)' + #13#10 +
        '  • Captured receipts and queue data' + #13#10 +
        '  • Log files' + #13#10 + #13#10 +
        'Choose "Yes" to delete all data (cannot be undone).' + #13#10 +
        'Choose "No" to keep your data for future reinstallation.',
        mbConfirmation, MB_YESNO);
      
      if DataChoice = IDYES then
      begin
        Log('User chose to delete all data');
        Log('Deleting data directory: ' + ExpandConstant('{commonappdata}\Tabeza'));
        
        // Delete the entire Tabeza data directory
        if DelTree(ExpandConstant('{commonappdata}\Tabeza'), True, True, True) then
        begin
          Log('Successfully deleted all user data');
        end
        else
        begin
          Log('WARNING: Failed to delete some user data files');
          MsgBox('Some data files could not be deleted. You may need to manually remove: ' + #13#10 +
                 ExpandConstant('{commonappdata}\Tabeza'), mbInformation, MB_OK);
        end;
      end
      else
      begin
        Log('User chose to keep data for future reinstallation');
        MsgBox('Your configuration and receipt data have been preserved at:' + #13#10 +
               ExpandConstant('{commonappdata}\Tabeza') + #13#10 + #13#10 +
               'This data will be used if you reinstall Tabeza Connect.',
               mbInformation, MB_OK);
      end;
    end
    else
    begin
      Log('No user data directory found');
    end;
    
    Log('Uninstallation complete');
    Log('Registry cleanup: Complete');
    Log('Service removal: Complete');
    Log('Printer removal: Complete');
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
; Clean up application files on uninstall
; Note: User data deletion is handled programmatically in CurUninstallStepChanged
; based on user choice during uninstallation
Type: filesandordirs; Name: "{app}"

[Run]
; Optional: Open configuration after install
Filename: "{commonappdata}\Tabeza\config.json"; Description: "View configuration file"; Flags: postinstall shellexec skipifsilent nowait

; Optional: Open logs directory
Filename: "{commonappdata}\Tabeza\logs"; Description: "Open logs directory"; Flags: postinstall shellexec skipifsilent nowait unchecked
