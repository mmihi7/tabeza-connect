# Pivot: EXE Installer Instead of ZIP

## Current Problem
The ZIP + batch file approach has several issues:
1. Customers must extract ZIP manually
2. Must find and right-click install.bat
3. Must select "Run as administrator"
4. ZIP creation keeps crashing due to large directory size
5. Not a professional installation experience

## Better Solution: EXE Installer

### Customer Experience
**Current (ZIP):**
1. Download ZIP (35-40 MB)
2. Extract to folder
3. Navigate to folder
4. Find install.bat
5. Right-click > Run as administrator
6. Follow prompts

**Proposed (EXE):**
1. Download TabezaConnect-Setup.exe (35-40 MB)
2. Double-click
3. Follow prompts (auto-elevates to admin)
4. Done

### Recommended Tool: Inno Setup

**Why Inno Setup:**
- Free and open-source
- Industry standard (used by VS Code, Git for Windows, etc.)
- Automatic UAC elevation
- Professional-looking installer UI
- Small overhead (~1-2 MB)
- Easy to script
- Supports custom pages for Bar ID input
- Can register Windows services
- Can configure printers
- Handles uninstall automatically

**Download:** https://jrsoftware.org/isinfo.php

### Implementation Plan

#### 1. Install Inno Setup
- Download and install Inno Setup 6.x
- Add to PATH for command-line builds

#### 2. Create Inno Setup Script
File: `TabezaConnect/installer.iss`

```iss
[Setup]
AppName=Tabeza Connect
AppVersion=1.0.0
AppPublisher=Tabeza
AppPublisherURL=https://tabeza.co.ke
DefaultDirName={pf}\Tabeza
DefaultGroupName=Tabeza Connect
OutputDir=dist
OutputBaseFilename=TabezaConnect-Setup-v1.0.0
Compression=lzma2/max
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64
UninstallDisplayIcon={app}\icon.ico

[Files]
Source: "src\installer\nodejs-bundle\nodejs\*"; DestDir: "{app}\nodejs"; Flags: recursesubdirs
Source: "src\installer\nodejs-bundle\service\*"; DestDir: "{app}\nodejs\service"; Flags: recursesubdirs
Source: "src\installer\nodejs-bundle\scripts\*"; DestDir: "{app}\scripts"; Flags: recursesubdirs

[Code]
var
  BarIdPage: TInputQueryWizardPage;
  BarId: String;

procedure InitializeWizard;
begin
  BarIdPage := CreateInputQueryPage(wpWelcome,
    'Configuration', 'Enter your venue details',
    'Please enter your Bar ID from the Tabeza staff dashboard:');
  BarIdPage.Add('Bar ID:', False);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = BarIdPage.ID then
  begin
    BarId := BarIdPage.Values[0];
    if BarId = '' then
    begin
      MsgBox('Bar ID is required', mbError, MB_OK);
      Result := False;
    end;
  end;
end;

[Run]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\scripts\create-folders.ps1"""; StatusMsg: "Creating watch folders..."; Flags: runhidden
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\scripts\configure-printer.ps1"""; StatusMsg: "Configuring printer..."; Flags: runhidden
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\scripts\register-service.ps1"" -InstallPath ""{app}"" -BarId ""{code:GetBarId}"" -ApiUrl ""https://staff.tabeza.co.ke"""; StatusMsg: "Registering Windows service..."; Flags: runhidden

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -Command ""Stop-Service -Name 'TabezaConnect' -Force; sc.exe delete TabezaConnect"""; Flags: runhidden

[Code]
function GetBarId(Param: String): String;
begin
  Result := BarId;
end;
```

#### 3. Update Build Script
File: `TabezaConnect/src/installer/build-installer.js`

Replace ZIP creation step with:

```javascript
// Step 6: Create EXE installer with Inno Setup
console.log('Step 6: Creating EXE installer...\n');

try {
  // Check if Inno Setup is installed
  execSync('iscc /? >nul 2>&1', { stdio: 'ignore' });
  
  console.log('Building installer with Inno Setup...');
  execSync('iscc installer.iss', {
    cwd: ROOT_DIR,
    stdio: 'inherit'
  });
  
  const exePath = path.join(OUTPUT_DIR, 'TabezaConnect-Setup-v1.0.0.exe');
  if (fs.existsSync(exePath)) {
    const stats = fs.statSync(exePath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    
    console.log('\n✅ EXE installer created successfully');
    console.log(`   Size: ${sizeMB} MB`);
    console.log(`   Path: ${exePath}\n`);
  }
} catch (error) {
  console.error('❌ Inno Setup not found or build failed');
  console.error('Please install Inno Setup from: https://jrsoftware.org/isinfo.php');
  process.exit(1);
}
```

#### 4. Benefits

**For Customers:**
- Professional installation experience
- Automatic admin elevation
- Progress bar and status messages
- Proper uninstaller in Windows Settings
- Desktop/Start Menu shortcuts (optional)
- No manual file extraction

**For You:**
- No ZIP creation crashes
- Smaller file size (better compression)
- Automatic service registration
- Proper Windows integration
- Easy to update and version
- Can be code-signed for trust

#### 5. Next Steps

1. Install Inno Setup on your development machine
2. Create `installer.iss` script
3. Update build script to use Inno Setup instead of ZIP
4. Test the EXE installer
5. (Optional) Get code signing certificate for production

### Alternative: electron-builder

Since you're already using Electron, you could also use electron-builder:

```json
// package.json
{
  "build": {
    "appId": "com.tabeza.connect",
    "productName": "Tabeza Connect",
    "win": {
      "target": "nsis",
      "icon": "icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    }
  }
}
```

Then run: `npm run build` (with electron-builder configured)

## Recommendation

**Use Inno Setup** because:
1. More control over installation process
2. Can prompt for Bar ID during install
3. Can run PowerShell scripts for printer setup
4. Smaller file size
5. Industry standard for Windows installers

The EXE approach solves all current problems and provides a much better customer experience.
