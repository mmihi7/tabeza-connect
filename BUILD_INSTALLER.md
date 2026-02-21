# Building the Tabeza Connect Installer

This guide explains how to build a complete Windows installer for Tabeza Connect.

## Prerequisites

### 1. Install Inno Setup
Download and install Inno Setup 6.0 or later:
- **Download**: https://jrsoftware.org/isdl.php
- Choose "Inno Setup 6.x.x with Encryption"
- Install with default options

### 2. Prepare Your Files

Create a build directory structure:

```
TabezaConnect-Installer/
├── TabezaConnect.iss          (the installer script)
├── build/
│   └── TabezaConnect.exe      (your compiled service)
├── config-template.json       (empty template)
├── README.txt                 (user documentation)
├── tabeza-icon.ico            (optional: app icon)
└── installer-output/          (created automatically)
```

### 3. Create Required Files

#### config-template.json
```json
{
  "barId": "",
  "deviceId": "",
  "apiEndpoint": "",
  "queuePath": "C:\\ProgramData\\Tabeza\\queue",
  "logPath": "C:\\ProgramData\\Tabeza\\logs",
  "uploadRetryDelay": 5000,
  "spoolPath": "C:\\Windows\\System32\\spool\\PRINTERS"
}
```

#### README.txt
```
Tabeza Connect - POS Receipt Capture Service
=============================================

This service captures POS receipts from the Windows print spooler
and uploads them to your Tabeza account.

Installation:
1. The installer will ask for your Bar ID (from Tabeza dashboard)
2. Enter a unique Device ID for this computer
3. The service installs and starts automatically

Testing:
- Print to "Tabeza Capture Printer" to test receipt capture
- Check logs at: C:\ProgramData\Tabeza\logs\
- View config at: C:\ProgramData\Tabeza\config.json

Support: https://tabeza.co.ke/support
```

## Building the Installer

### Method 1: Using Inno Setup GUI (Easiest)

1. Open Inno Setup Compiler
2. File → Open → Select `TabezaConnect.iss`
3. Build → Compile
4. Output: `installer-output/TabezaConnectSetup.exe`

### Method 2: Command Line (For CI/CD)

```batch
"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" TabezaConnect.iss
```

### Method 3: Using npm script

Add to your `package.json`:

```json
{
  "scripts": {
    "build:service": "pkg index.js -t node18-win-x64 -o build/TabezaConnect.exe",
    "build:installer": "iscc TabezaConnect.iss",
    "build:all": "npm run build:service && npm run build:installer"
  }
}
```

Then run:
```bash
npm run build:all
```

## What the Installer Does

When a user runs `TabezaConnectSetup.exe`:

1. **Welcome Screen** - Shows app info
2. **Configuration Screen** - Asks for:
   - Bar ID (from Tabeza dashboard)
   - Device ID (auto-filled with computer name)
   - API Endpoint (pre-filled with production URL)
3. **Installation** - Automatically:
   - Installs TabezaConnect.exe to `C:\Program Files\Tabeza\`
   - Creates data directories in `C:\ProgramData\Tabeza\`
   - Installs "Tabeza Capture Printer" (virtual printer)
   - Installs Windows Service
   - Creates config file with user's settings
   - Starts the service
4. **Finish Screen** - Shows success message with next steps

## Error Handling

The installer includes automatic rollback:
- If service installation fails → removes printer
- If printer installation fails → cleans up files
- If any step fails → shows error and cleans up

## Testing the Installer

### Test on a Clean VM
1. Create Windows 10/11 VM (VirtualBox, VMware, Hyper-V)
2. Copy `TabezaConnectSetup.exe` to VM
3. Run as Administrator
4. Verify:
   - Service appears in services.msc
   - Printer appears in Printers & Scanners
   - Config file created at `C:\ProgramData\Tabeza\config.json`
   - Service is running (should see "Running" status)

### Test Receipt Capture
1. Open Notepad
2. File → Print → Select "Tabeza Capture Printer"
3. Print
4. Check logs: `C:\ProgramData\Tabeza\logs\`
5. Verify receipt was captured and uploaded

## Uninstallation

The installer creates an uninstaller at:
```
C:\Program Files\Tabeza\unins000.exe
```

Or via Windows Settings:
- Settings → Apps → Tabeza Connect → Uninstall

Uninstaller will:
- Stop and remove the Windows Service
- Remove the virtual printer
- Remove program files
- Keep config and queue data (in case of reinstall)

## Troubleshooting

### "Failed to install virtual printer"
**Cause**: Insufficient permissions or corrupted print spooler

**Solution**: 
1. Run installer as Administrator
2. Restart Print Spooler service:
   ```batch
   net stop spooler
   net start spooler
   ```

### "Failed to install Windows service"
**Cause**: Service name conflict or permissions

**Solution**:
1. Check if service already exists:
   ```batch
   sc query TabezaConnect
   ```
2. If exists, remove manually:
   ```batch
   sc stop TabezaConnect
   sc delete TabezaConnect
   ```
3. Run installer again

### "Service installed but failed to start"
**Cause**: Missing dependencies or config error

**Solution**:
1. Check logs: `C:\ProgramData\Tabeza\logs\`
2. Check config: `C:\ProgramData\Tabeza\config.json`
3. Start manually:
   ```batch
   sc start TabezaConnect
   ```

## Advanced: Signing the Installer

For production, sign the installer with a code signing certificate:

```batch
signtool sign /f "certificate.pfx" /p "password" /t http://timestamp.digicert.com TabezaConnectSetup.exe
```

This removes Windows SmartScreen warnings.

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build Installer

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build service
        run: npm run build:service
      
      - name: Install Inno Setup
        run: choco install innosetup -y
      
      - name: Build installer
        run: iscc TabezaConnect.iss
      
      - name: Upload installer
        uses: actions/upload-artifact@v3
        with:
          name: TabezaConnectSetup
          path: installer-output/TabezaConnectSetup.exe
```

## Distribution

Upload the final `TabezaConnectSetup.exe` to:
- Your website: https://tabeza.co.ke/downloads/
- GitHub Releases
- Direct download link for customers

**File size**: Typically 10-30MB depending on whether you bundle Node.js runtime

## Next Steps

1. Build the installer locally first
2. Test on a clean Windows VM
3. Test with your actual POS system
4. Get feedback from one test venue
5. Sign the installer (production)
6. Distribute to customers

---

**Questions?** Check the Inno Setup documentation: https://jrsoftware.org/ishelp/
