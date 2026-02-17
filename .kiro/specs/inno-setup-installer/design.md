# Inno Setup Installer Integration - Design

## Architecture Overview

The Inno Setup installer will replace the current ZIP-based distribution with a professional Windows installer that handles all installation and configuration steps automatically.

```
┌─────────────────────────────────────────────────────────────┐
│                    Build Process                             │
├─────────────────────────────────────────────────────────────┤
│  1. Download Node.js runtime                                 │
│  2. Build service files                                      │
│  3. Create nodejs-bundle/                                    │
│  4. Compile Inno Setup script → .exe                        │
│  5. Validate .exe artifact                                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Installation Flow                           │
├─────────────────────────────────────────────────────────────┤
│  1. Welcome screen                                           │
│  2. License agreement                                        │
│  3. Custom page: Collect Bar ID                             │
│  4. Installation directory (default: C:\Program Files\Tabeza)│
│  5. Install files                                            │
│  6. Create watch folder                                      │
│  7. Configure printer (PowerShell)                          │
│  8. Register service (PowerShell)                           │
│  9. Start service                                            │
│  10. Completion screen                                       │
└─────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Inno Setup Script (installer.iss)

**Location:** `TabezaConnect/installer.iss`

**Key Sections:**

#### [Setup]
```pascal
[Setup]
AppName=Tabeza Connect
AppVersion={#GetFileVersion("package.json")}
AppPublisher=Tabeza
AppPublisherURL=https://tabeza.co.ke
DefaultDirName={autopf}\Tabeza
DefaultGroupName=Tabeza Connect
OutputDir=dist
OutputBaseFilename=TabezaConnect-Setup-v{#AppVersion}
Compression=lzma2/max
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64
WizardStyle=modern
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\icon.ico
```

#### [Files]
```pascal
[Files]
; Node.js runtime
Source: "src\installer\nodejs-bundle\nodejs\*"; DestDir: "{app}\nodejs"; Flags: ignoreversion recursesubdirs

; Service files
Source: "src\installer\nodejs-bundle\service\*"; DestDir: "{app}\nodejs\service"; Flags: ignoreversion recursesubdirs

; PowerShell scripts
Source: "src\installer\nodejs-bundle\scripts\*"; DestDir: "{app}\scripts"; Flags: ignoreversion recursesubdirs

; Configuration files
Source: "config.template.json"; DestDir: "{app}"; DestName: "config.json"; Flags: onlyifdoesntexist

; Documentation
Source: "README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "LICENSE"; DestDir: "{app}"; Flags: ignoreversion

; Icon
Source: "icon.ico"; DestDir: "{app}"; Flags: ignoreversion
```

#### [Code] - Custom Pages
```pascal
[Code]
var
  BarIdPage: TInputQueryWizardPage;
  BarIdValue: String;

procedure InitializeWizard;
begin
  { Create custom page for Bar ID }
  BarIdPage := CreateInputQueryPage(wpLicense,
    'Configuration', 'Enter your Tabeza Bar ID',
    'Please enter the Bar ID provided by Tabeza. You can find this in your Tabeza staff dashboard.');
  BarIdPage.Add('Bar ID:', False);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  
  if CurPageID = BarIdPage.ID then
  begin
    BarIdValue := Trim(BarIdPage.Values[0]);
    
    { Validate Bar ID format (UUID) }
    if Length(BarIdValue) <> 36 then
    begin
      MsgBox('Please enter a valid Bar ID (36 characters).', mbError, MB_OK);
      Result := False;
    end;
  end;
end;
```

#### [Run] - Post-Installation
```pascal
[Run]
; Create watch folder
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\scripts\create-folders.ps1"""; StatusMsg: "Creating watch folder..."; Flags: runhidden waituntilterminated

; Configure printer
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\scripts\configure-printer.ps1"" -SkipIfExists"; StatusMsg: "Configuring virtual printer..."; Flags: runhidden waituntilterminated

; Register and start service
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\scripts\register-service.ps1"" -InstallPath ""{app}"" -BarId ""{code:GetBarId}"" -ApiUrl ""https://staff.tabeza.co.ke"""; StatusMsg: "Registering Windows service..."; Flags: runhidden waituntilterminated

; Open status page
Filename: "http://localhost:8765/api/status"; Description: "Open Tabeza Connect status page"; Flags: shellexec postinstall skipifsilent nowait
```

#### [UninstallRun]
```pascal
[UninstallRun]
; Stop and remove service
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\scripts\register-service.ps1"" -Uninstall"; Flags: runhidden waituntilterminated

; Remove printer
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -Command ""Remove-Printer -Name 'Tabeza Receipt Printer' -ErrorAction SilentlyContinue"""; Flags: runhidden waituntilterminated
```

### 2. Build Script Updates

**File:** `TabezaConnect/src/installer/build-installer.js`

Add Inno Setup compilation step:

```javascript
// Step 7: Compile Inno Setup installer
console.log('Step 7: Compiling Inno Setup installer...\n');

const isccPath = process.env.ISCC_PATH || 'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe';

if (fs.existsSync(isccPath)) {
  try {
    execSync(`"${isccPath}" installer.iss`, {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });
    
    const exePath = path.join(OUTPUT_DIR, `TabezaConnect-Setup-v${VERSION}.exe`);
    if (fs.existsSync(exePath)) {
      const stats = fs.statSync(exePath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`\n✅ Installer created: ${sizeMB} MB`);
    }
  } catch (error) {
    console.error('\n⚠️  Inno Setup compilation failed');
    console.error('Falling back to ZIP distribution');
  }
} else {
  console.log('\n⚠️  Inno Setup not found at:', isccPath);
  console.log('Skipping .exe creation (ZIP will be created instead)');
}
```

### 3. GitHub Actions Workflow Updates

**File:** `TabezaConnect/.github/workflows/release.yml`

Add Inno Setup installation and compilation:

```yaml
- name: Install Inno Setup
  run: |
    choco install innosetup -y
    echo "ISCC_PATH=C:\Program Files (x86)\Inno Setup 6\ISCC.exe" >> $GITHUB_ENV

- name: Build installer
  run: npm run build:installer
  
- name: Validate .exe artifact
  run: |
    $exePath = "dist/TabezaConnect-Setup-v${{ steps.extract_version.outputs.version }}.exe"
    if (Test-Path $exePath) {
      Write-Host "✅ Installer found: $exePath"
      $size = (Get-Item $exePath).Length / 1MB
      Write-Host "Size: $([math]::Round($size, 2)) MB"
    } else {
      Write-Error "Installer not found"
      exit 1
    }
```

### 4. PowerShell Script Enhancements

**Updates needed for Inno Setup compatibility:**

#### configure-printer.ps1
- Add `-SkipIfExists` parameter (already implemented)
- Ensure silent operation (no interactive prompts when called from installer)
- Return proper exit codes

#### register-service.ps1
- Accept `-InstallPath`, `-BarId`, `-ApiUrl` parameters (already implemented)
- Support silent operation
- Return proper exit codes

#### create-folders.ps1 (already exists)
- No changes needed

## Data Flow

### Installation Data Flow
```
User Input (Bar ID)
    ↓
Inno Setup Wizard
    ↓
[Files] Section → Copy files to C:\Program Files\Tabeza
    ↓
[Run] Section → Execute PowerShell scripts
    ↓
    ├→ create-folders.ps1 → C:\TabezaPrints
    ├→ configure-printer.ps1 → Virtual printer
    └→ register-service.ps1 → Windows service
    ↓
Service starts automatically
    ↓
Installation complete
```

### Build Data Flow
```
package.json (version)
    ↓
build-installer.js
    ↓
    ├→ Download Node.js
    ├→ Copy service files
    ├→ Install dependencies
    └→ Create nodejs-bundle/
    ↓
Inno Setup Compiler (ISCC.exe)
    ↓
    ├→ Read installer.iss
    ├→ Bundle nodejs-bundle/
    ├→ Embed scripts
    └→ Compile to .exe
    ↓
dist/TabezaConnect-Setup-v{version}.exe
```

## Error Handling

### Installation Errors
- **Node.js not found:** Display error message with troubleshooting steps
- **Service registration fails:** Log to Event Viewer, show error dialog
- **Printer configuration fails:** Continue installation, show warning
- **Insufficient permissions:** Installer requires admin (enforced by Inno Setup)

### Build Errors
- **Inno Setup not found:** Fall back to ZIP creation, log warning
- **Compilation fails:** Exit with error code, display error message
- **Missing files:** Validate nodejs-bundle/ before compilation

## Security Considerations

1. **Code Signing:** Installer should be code-signed (future enhancement)
2. **Admin Elevation:** Required for service registration and printer configuration
3. **File Permissions:** Service files readable by LocalSystem account
4. **Watch Folder:** Everyone has full control (required for POS integration)

## Performance Considerations

- **Installer Size:** ~50-60 MB (Node.js runtime + service files)
- **Installation Time:** 2-3 minutes on average hardware
- **Compression:** LZMA2/max for smallest file size
- **Solid Compression:** Enabled for better compression ratio

## Testing Strategy

1. **Local Testing:** Build and test installer on development machine
2. **Clean VM Testing:** Test on fresh Windows 10/11 VM
3. **Upgrade Testing:** Test upgrading from previous version
4. **Uninstall Testing:** Verify clean uninstallation
5. **Silent Install Testing:** Test `/SILENT` and `/VERYSILENT` flags

## Rollout Plan

1. **Phase 1:** Create and test Inno Setup script locally
2. **Phase 2:** Integrate into build process
3. **Phase 3:** Add GitHub Actions support
4. **Phase 4:** Create test release
5. **Phase 5:** Production release

## Backward Compatibility

- ZIP distribution can coexist with .exe installer
- Both can be included in GitHub releases
- Users can choose their preferred installation method
- Eventually deprecate ZIP in favor of .exe
