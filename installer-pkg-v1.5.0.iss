; Tabeza POS Connect Installer Script
; Version 1.5.0 - SIMPLIFIED TERMS ACCEPTANCE
; Built with Inno Setup 6.x
;
; CHANGES IN v1.5.0:
; - Full terms embedded inline from TERMS_AND_PRIVACY.txt
; - Simple checkbox (no scroll-to-enable complexity)
; - NO external links - all terms are inline
; - Terms acceptance logging
; - Privacy policy is especially important

[Setup]
; Application Information
AppName=Tabeza POS Connect
AppVersion=1.5.0
AppPublisher=Tabeza
AppPublisherURL=https://tabeza.co.ke
AppSupportURL=https://tabeza.co.ke/support
AppUpdatesURL=https://tabeza.co.ke/downloads
AppCopyright=Copyright (C) 2026 Tabeza

; Installation Directories
DefaultDirName={autopf}\TabezaConnect
DefaultGroupName=Tabeza POS Connect
DisableProgramGroupPage=yes

; Output Configuration
OutputDir=dist
OutputBaseFilename=TabezaConnect-Setup-v1.5.0
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\icon.ico

; Compression
Compression=lzma2/max
SolidCompression=yes

; Privileges and Architecture
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog
ArchitecturesInstallIn64BitMode=x64
ArchitecturesAllowed=x64

; Directory Configuration
UsePreviousAppDir=yes
DirExistsWarning=auto
DisableDirPage=no

; Wizard Configuration
WizardStyle=modern
DisableWelcomePage=no

; Uninstall Configuration
UninstallDisplayName=Tabeza POS Connect
UninstallFilesDir={app}\uninstall

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Messages]
WelcomeLabel2=This will install Tabeza POS Connect on your computer.%n%nTabeza POS Connect captures receipt data from your POS system and syncs it with the Tabeza staff app.%n%nIMPORTANT: Tabeza works ALONGSIDE your existing printer. Your current printer setup will NOT change.

[CustomMessages]
BarIdPrompt=Enter your Bar ID from the Tabeza staff dashboard:
BarIdInvalid=Bar ID must be at least 6 characters and contain only letters, numbers, and hyphens.
BarIdEmpty=Bar ID is required to continue installation.

[Types]
Name: "full"; Description: "Full installation"
Name: "custom"; Description: "Custom installation"; Flags: iscustom

[Components]
Name: "core"; Description: "Core Service (Required)"; Types: full custom; Flags: fixed
Name: "printer"; Description: "Virtual Printer Configuration"; Types: full custom
Name: "docs"; Description: "Documentation"; Types: full custom

[Files]
; Compiled Service Executable
Source: "TabezaConnect.exe"; DestDir: "{app}"; Flags: ignoreversion; Components: core

; PowerShell Scripts
Source: "src\installer\scripts\*"; DestDir: "{app}\scripts"; Flags: recursesubdirs; Components: core

; Configuration Template
Source: "config.template.json"; DestDir: "{app}"; DestName: "config.json"; Flags: onlyifdoesntexist; Components: core

; Terms and Privacy (embedded in installer)
Source: "src\installer\TERMS_AND_PRIVACY.txt"; DestDir: "{app}\docs"; Flags: ignoreversion; Components: core

; Documentation
Source: "Plan\README.txt"; DestDir: "{app}\docs"; Components: docs
Source: "Plan\BEFORE-INSTALL.txt"; DestDir: "{app}\docs"; Components: docs
Source: "Plan\AFTER-INSTALL.txt"; DestDir: "{app}\docs"; Components: docs

; Icon
Source: "icon.ico"; DestDir: "{app}"; Components: core

; License
Source: "LICENSE.txt"; DestDir: "{app}"; Components: core

[Dirs]
; Create application data directories in ProgramData
Name: "{commonappdata}\Tabeza"; Permissions: users-modify
Name: "{commonappdata}\Tabeza\logs"; Permissions: users-modify
Name: "{commonappdata}\Tabeza\config"; Permissions: users-modify
Name: "{commonappdata}\Tabeza\TabezaPrints"; Permissions: users-modify
Name: "{commonappdata}\Tabeza\TabezaPrints\pending"; Permissions: users-modify
Name: "{commonappdata}\Tabeza\TabezaPrints\processed"; Permissions: users-modify
Name: "{commonappdata}\Tabeza\TabezaPrints\failed"; Permissions: users-modify

[Code]
var
  BarIdPage: TInputQueryWizardPage;
  BarId: String;
  TermsPage: TOutputMsgMemoWizardPage;
  AcceptCheckbox: TNewCheckBox;

{ Load terms from file }
procedure LoadTermsFromFile(Memo: TRichEditViewer);
var
  TermsFile: String;
  Lines: TArrayOfString;
  I: Integer;
begin
  TermsFile := ExpandConstant('{tmp}\TERMS_AND_PRIVACY.txt');
  
  { Try to load from extracted file }
  if FileExists(TermsFile) and LoadStringsFromFile(TermsFile, Lines) then
  begin
    for I := 0 to GetArrayLength(Lines) - 1 do
      Memo.Lines.Add(Lines[I]);
  end
  else
  begin
    { Fallback: Add essential terms if file not found }
    Memo.Lines.Add('TABEZA POS CONNECT - TERMS OF SERVICE AND PRIVACY POLICY');
    Memo.Lines.Add('');
    Memo.Lines.Add('Last Updated: February 20, 2026');
    Memo.Lines.Add('Version 1.0');
    Memo.Lines.Add('');
    Memo.Lines.Add('BY INSTALLING TABEZA POS CONNECT, YOU AGREE TO THESE TERMS.');
    Memo.Lines.Add('');
    Memo.Lines.Add('================================================================================');
    Memo.Lines.Add('1. SERVICE DESCRIPTION');
    Memo.Lines.Add('================================================================================');
    Memo.Lines.Add('');
    Memo.Lines.Add('Tabeza POS Connect is a Windows background service that:');
    Memo.Lines.Add('- Monitors your Windows print spooler for receipt data');
    Memo.Lines.Add('- Captures receipt information AFTER printing completes');
    Memo.Lines.Add('- Sends receipt data to Tabeza cloud services for digital receipt delivery');
    Memo.Lines.Add('- Does NOT interfere with or delay your normal printing operations');
    Memo.Lines.Add('');
    Memo.Lines.Add('IMPORTANT: Your printer and POS system operate independently.');
    Memo.Lines.Add('');
    Memo.Lines.Add('================================================================================');
    Memo.Lines.Add('2. DATA COLLECTION AND PRIVACY');
    Memo.Lines.Add('================================================================================');
    Memo.Lines.Add('');
    Memo.Lines.Add('WHAT WE COLLECT:');
    Memo.Lines.Add('- Receipt data: items, quantities, prices, totals, taxes');
    Memo.Lines.Add('- Venue identifier (Bar ID)');
    Memo.Lines.Add('- Timestamp of each transaction');
    Memo.Lines.Add('- Device identifier (anonymous)');
    Memo.Lines.Add('- Print job metadata');
    Memo.Lines.Add('');
    Memo.Lines.Add('WHAT WE DO NOT COLLECT:');
    Memo.Lines.Add('- Customer names or personal information from receipts');
    Memo.Lines.Add('- Credit card numbers or payment card data');
    Memo.Lines.Add('- Employee personal information');
    Memo.Lines.Add('- Any data unrelated to receipts');
    Memo.Lines.Add('');
    Memo.Lines.Add('HOW WE USE YOUR DATA:');
    Memo.Lines.Add('- Provide digital receipts to your customers via the Tabeza app');
    Memo.Lines.Add('- Enable customers to link receipts to their tabs');
    Memo.Lines.Add('- Generate analytics and reports for your venue');
    Memo.Lines.Add('- Improve receipt parsing accuracy');
    Memo.Lines.Add('');
    Memo.Lines.Add('DATA STORAGE AND SECURITY:');
    Memo.Lines.Add('- Receipt data is encrypted during transmission (HTTPS/TLS)');
    Memo.Lines.Add('- Data is stored securely on Supabase cloud infrastructure');
    Memo.Lines.Add('- Access is restricted to authorized Tabeza systems and your venue staff');
    Memo.Lines.Add('- We implement industry-standard security practices');
    Memo.Lines.Add('');
    Memo.Lines.Add('DATA RETENTION:');
    Memo.Lines.Add('- Raw receipt data: Retained for 90 days');
    Memo.Lines.Add('- Parsed receipt data: Retained for 1 year or as required by law');
    Memo.Lines.Add('- You may request deletion of your venue data at any time');
    Memo.Lines.Add('');
    Memo.Lines.Add('DATA SHARING:');
    Memo.Lines.Add('We do NOT sell your data. We may share data only:');
    Memo.Lines.Add('- With your explicit consent');
    Memo.Lines.Add('- With service providers who assist in operating Tabeza (under strict NDAs)');
    Memo.Lines.Add('- When required by law or legal process');
    Memo.Lines.Add('- To protect Tabeza rights or prevent fraud');
    Memo.Lines.Add('');
    Memo.Lines.Add('================================================================================');
    Memo.Lines.Add('3. YOUR RESPONSIBILITIES');
    Memo.Lines.Add('================================================================================');
    Memo.Lines.Add('');
    Memo.Lines.Add('You agree to:');
    Memo.Lines.Add('- Provide accurate venue information during setup');
    Memo.Lines.Add('- Maintain the security of your Bar ID and credentials');
    Memo.Lines.Add('- Comply with all applicable laws regarding receipt data');
    Memo.Lines.Add('- Notify customers that digital receipts are available via Tabeza');
    Memo.Lines.Add('- Ensure you have the right to transmit receipt data from your POS system');
    Memo.Lines.Add('');
    Memo.Lines.Add('You must NOT:');
    Memo.Lines.Add('- Attempt to reverse engineer or modify the software');
    Memo.Lines.Add('- Use the service for any illegal purpose');
    Memo.Lines.Add('- Transmit malicious code or interfere with the service');
    Memo.Lines.Add('- Share your Bar ID with unauthorized parties');
    Memo.Lines.Add('');
    Memo.Lines.Add('================================================================================');
    Memo.Lines.Add('4. LIMITATION OF LIABILITY');
    Memo.Lines.Add('================================================================================');
    Memo.Lines.Add('');
    Memo.Lines.Add('TO THE MAXIMUM EXTENT PERMITTED BY LAW:');
    Memo.Lines.Add('- Tabeza POS Connect is provided "AS IS" without warranties of any kind');
    Memo.Lines.Add('- We are not liable for any indirect, incidental, or consequential damages');
    Memo.Lines.Add('- Our total liability shall not exceed the amount you paid for the service');
    Memo.Lines.Add('  in the 12 months preceding the claim');
    Memo.Lines.Add('- We are not responsible for data loss, business interruption, or lost profits');
    Memo.Lines.Add('');
    Memo.Lines.Add('================================================================================');
    Memo.Lines.Add('5. CONTACT INFORMATION');
    Memo.Lines.Add('================================================================================');
    Memo.Lines.Add('');
    Memo.Lines.Add('For questions about these terms or privacy practices:');
    Memo.Lines.Add('Email: support@tabeza.co.ke');
    Memo.Lines.Add('Website: https://tabeza.co.ke');
    Memo.Lines.Add('');
    Memo.Lines.Add('For data protection inquiries:');
    Memo.Lines.Add('Email: privacy@tabeza.co.ke');
    Memo.Lines.Add('');
    Memo.Lines.Add('© 2026 Tabeza. All rights reserved.');
  end;
end;

{ Log terms acceptance }
procedure LogTermsAcceptance;
var
  LogFile: String;
  LogContent: String;
  Timestamp: String;
begin
  LogFile := ExpandConstant('{commonappdata}\Tabeza\logs\terms-acceptance.log');
  Timestamp := GetDateTimeString('yyyy-mm-dd hh:nn:ss', #0, #0);
  LogContent := Format('[%s] Bar ID: %s | Terms v1.0 | Installer v1.5.0 | Accepted', [Timestamp, BarId]);
  SaveStringToFile(LogFile, LogContent + #13#10, True);
end;

{ Initialize wizard }
procedure InitializeWizard;
begin
  { Create terms page after welcome }
  TermsPage := CreateOutputMsgMemoPage(wpWelcome,
    'Terms of Service and Privacy Policy',
    'Please read and accept the terms to continue',
    'By installing Tabeza POS Connect, you agree to our Terms of Service and Privacy Policy.',
    '');
  
  { Load full terms from file }
  LoadTermsFromFile(TermsPage.RichEditViewer);
  
  { Add acceptance checkbox }
  AcceptCheckbox := TNewCheckBox.Create(TermsPage);
  AcceptCheckbox.Parent := TermsPage.Surface;
  AcceptCheckbox.Top := TermsPage.RichEditViewer.Top + TermsPage.RichEditViewer.Height + 16;
  AcceptCheckbox.Width := TermsPage.SurfaceWidth;
  AcceptCheckbox.Caption := 'I accept the Terms of Service and Privacy Policy';
  AcceptCheckbox.Checked := False;
  
  { Create Bar ID input page }
  BarIdPage := CreateInputQueryPage(TermsPage.ID,
    'Configuration', 'Enter your venue details',
    'Please enter your Bar ID from the Tabeza staff dashboard.' + #13#10 + #13#10 +
    'To find your Bar ID:' + #13#10 +
    '1. Log in to https://tabeza.co.ke' + #13#10 +
    '2. Go to Settings > Venue Details' + #13#10 +
    '3. Copy your Bar ID');
  
  BarIdPage.Add('Bar ID:', False);
  BarIdPage.Values[0] := '';
end;

{ Validate Bar ID }
function ValidateBarId(const Value: String): Boolean;
var
  I: Integer;
  C: Char;
begin
  Result := False;
  
  { Check minimum length }
  if Length(Value) < 6 then
    Exit;
  
  { Check characters (alphanumeric + hyphens only) }
  for I := 1 to Length(Value) do
  begin
    C := Value[I];
    if not (((C >= 'a') and (C <= 'z')) or
            ((C >= 'A') and (C <= 'Z')) or
            ((C >= '0') and (C <= '9')) or
            (C = '-')) then
      Exit;
  end;
  
  Result := True;
end;

{ Validate terms acceptance and Bar ID }
function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  
  { Validate terms acceptance }
  if CurPageID = TermsPage.ID then
  begin
    if not AcceptCheckbox.Checked then
    begin
      MsgBox('You must accept the Terms of Service and Privacy Policy to continue.', 
             mbError, MB_OK);
      Result := False;
    end;
  end;
  
  { Validate Bar ID }
  if CurPageID = BarIdPage.ID then
  begin
    BarId := Trim(BarIdPage.Values[0]);
    
    { Check if empty }
    if BarId = '' then
    begin
      MsgBox(ExpandConstant('{cm:BarIdEmpty}'), mbError, MB_OK);
      Result := False;
      Exit;
    end;
    
    { Validate format }
    if not ValidateBarId(BarId) then
    begin
      MsgBox(ExpandConstant('{cm:BarIdInvalid}'), mbError, MB_OK);
      Result := False;
      Exit;
    end;
  end;
end;

{ Post-install actions }
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    { Log terms acceptance }
    LogTermsAcceptance;
  end;
end;

{ Get Bar ID for use in scripts }
function GetBarId(Param: String): String;
begin
  Result := BarId;
end;

{ Get API URL }
function GetApiUrl(Param: String): String;
begin
  Result := 'https://tabeza.co.ke';
end;

[Run]
; Step 1: Create watch folders
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\create-folders.ps1"" -WatchFolder ""C:\ProgramData\Tabeza\TabezaPrints"""; \
  StatusMsg: "Creating watch folders..."; \
  Flags: runhidden waituntilterminated; \
  Components: core

; Step 2: Configure printer (if selected)
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\configure-printer.ps1"""; \
  StatusMsg: "Configuring Tabeza POS Connect printer..."; \
  Flags: runhidden waituntilterminated; \
  Components: printer

; Step 3: Register Windows service
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\register-service-pkg.ps1"" -InstallPath ""{app}"" -BarId ""{code:GetBarId}"" -ApiUrl ""{code:GetApiUrl}"""; \
  StatusMsg: "Registering Tabeza POS Connect service..."; \
  Flags: runhidden waituntilterminated; \
  Components: core

; Step 4: Start the service
Filename: "sc.exe"; \
  Parameters: "start TabezaConnect"; \
  StatusMsg: "Starting Tabeza POS Connect service..."; \
  Flags: runhidden waituntilterminated; \
  Components: core

; Step 5: Verify installation
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\verify-installation.ps1"" -InstallPath ""{app}"""; \
  StatusMsg: "Verifying installation..."; \
  Flags: runhidden waituntilterminated; \
  Components: core

; Step 6: Show post-install instructions (optional)
Filename: "{win}\notepad.exe"; \
  Parameters: """{app}\docs\AFTER-INSTALL.txt"""; \
  Description: "View post-installation instructions"; \
  Flags: postinstall shellexec skipifsilent nowait unchecked; \
  Components: docs; \
  Check: FileExists(ExpandConstant('{app}\docs\AFTER-INSTALL.txt'))

[UninstallRun]
; Stop the service
Filename: "sc.exe"; \
  Parameters: "stop TabezaConnect"; \
  Flags: runhidden; \
  RunOnceId: "StopService"

; Delete the service
Filename: "sc.exe"; \
  Parameters: "delete TabezaConnect"; \
  Flags: runhidden; \
  RunOnceId: "DeleteService"

; Remove printer (optional)
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -Command ""Remove-Printer -Name 'Tabeza POS Connect' -ErrorAction SilentlyContinue"""; \
  Flags: runhidden; \
  RunOnceId: "RemovePrinter"

[UninstallDelete]
; Clean up log files
Name: "{commonappdata}\Tabeza\logs"; Type: filesandordirs
Name: "{commonappdata}\Tabeza\TabezaPrints\processed"; Type: filesandordirs
Name: "{commonappdata}\Tabeza\TabezaPrints\failed"; Type: filesandordirs

[Registry]
; Store installation path for updates
Root: HKLM; Subkey: "Software\Tabeza\Connect"; ValueType: string; ValueName: "InstallPath"; ValueData: "{app}"; Flags: uninsdeletekey
Root: HKLM; Subkey: "Software\Tabeza\Connect"; ValueType: string; ValueName: "Version"; ValueData: "1.5.0"; Flags: uninsdeletekey
Root: HKLM; Subkey: "Software\Tabeza\Connect"; ValueType: string; ValueName: "BarId"; ValueData: "{code:GetBarId}"; Flags: uninsdeletekey
Root: HKLM; Subkey: "Software\Tabeza\Connect"; ValueType: string; ValueName: "TermsAccepted"; ValueData: "v1.0"; Flags: uninsdeletekey
