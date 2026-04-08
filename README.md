# Tabeza Connect - Electron + Electron Builder

## 🎯 Overview

This is the **Electron-based** version of Tabeza Connect that includes:

- ✅ **Automatic Folder Creation** - `C:\TabezaPrints\` created automatically on install/update/startup
- ✅ **clawPDF Virtual Printer Integration** - Reliable print job capture using open-source virtual printer
- ✅ **System Tray Integration** for easy access
- ✅ **Background Service** for receipt capture and forwarding
- ✅ **HTTP API** for Management UI
- ✅ **Professional NSIS Installer**

## 📄 Third-Party Software

### clawPDF

Tabeza Connect uses **clawPDF 0.9.3** as its virtual printer foundation:

- **License**: GNU Affero General Public License v3.0 (AGPL-3.0)
- **Source**: https://github.com/clawsoftware/clawPDF
- **Purpose**: Virtual printer for capturing print jobs from POS systems
- **Bundled**: clawPDF MSI installer is included with Tabeza Connect installer
- **Installation**: Automatically installed during Tabeza Connect setup

**AGPL-3.0 Compliance Notice**: clawPDF is licensed under AGPL-3.0. The source code for clawPDF is available at the repository link above. Tabeza Connect uses clawPDF as a separate component without modification. If you distribute Tabeza Connect, you must comply with AGPL-3.0 requirements for clawPDF.

---

## 📁 Directory Structure

```
C:\TabezaPrints\                    ← ALL DATA HERE (root level, easy access)
├── order.prn                       ← Capture file (TabezaCapturePort writes here)
├── processed\                      ← Archived receipts
├── failed\                         ← Failed receipts
├── logs\                           ← Service logs
│   ├── service.log
│   ├── electron.log
│   └── printer-setup.log
├── queue\                          ← Upload queue
│   ├── pending\
│   └── uploaded\
├── templates\                      ← Parsing templates
│   └── template.json
└── config.json                     ← Configuration
```

---

## 🔧 Folder Creation - When It Happens

The `C:\TabezaPrints\` folder structure is automatically created/verified:

| Scenario | Action |
|----------|--------|
| **Fresh Install** | NSIS installer runs `CreateFolders` action |
| **Reinstall** | NSIS installer runs `CreateFolders` (won't overwrite existing data) |
| **Update** | NSIS installer runs `CreateFolders` (ensures new folders exist) |
| **App Startup** | Electron calls `initializeTabezaPrintsFolder()` |
| **Service Startup** | Background service calls `initializeTabezaPrintsFolder()` |
| **Manual Repair** | Tray menu → "Repair Folder Structure" or API call |

### Manual Folder Creation

```powershell
# Create/verify folder structure manually
powershell -File "C:\Program Files\TabezaConnect\installer\printer-pooling-setup.ps1" -Action CreateFolders

# Output shows what was created vs existing
```

### API Endpoints for Folder Management

```bash
# Check folder status
GET http://127.0.0.1:8765/api/folders

# Repair folders
POST http://127.0.0.1:8765/api/folders/repair
```

---

## 🖨️ clawPDF Virtual Printer Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           POS SOFTWARE                                       │
│                    (prints to "Tabeza Agent")                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Tabeza Agent                                     │
│                    (clawPDF Virtual Printer)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                        ┌──────────────────────────┐
                        │   clawPDF Engine         │
                        │   - Intercepts print job │
                        │   - Saves to spool/      │
                        └──────────────────────────┘
                                    │
                                    ▼
                        ┌──────────────────────────┐
                        │   C:\TabezaPrints\       │
                        │   spool\{jobId}.ps       │
                        └──────────────────────────┘
                                    │
                                    ▼
                        ┌──────────────────────────┐
                        │   Tabeza Connect         │
                        │   (Background Service)   │
                        │   - Spool Watcher        │
                        │   - Capture to order.prn │
                        │   - Forward to Printer   │
                        │   - Receipt Parser       │
                        │   - Cloud Upload         │
                        └──────────────────────────┘
                          │                    │
                          ▼                    ▼
        ┌──────────────────────┐    ┌──────────────────────────┐
        │   PHYSICAL PRINTER   │    │   Cloud API              │
        │   (Paper Receipt)    │    │   (Digital Receipt)      │
        └──────────────────────┘    └──────────────────────────┘
```

---

## 🚀 Build Instructions

### Prerequisites

```bash
# Install Node.js 18+
# Install dependencies
npm install

# Rebuild native modules for Electron
npm run rebuild
```

### ⚠️ Required Manual Download

**Before building the installer**, you must download the clawPDF MSI installer:

1. **Download** `clawPDF-0.9.3-setup.msi` from:
   ```
   https://github.com/clawsoftware/clawPDF/releases/download/v0.9.3/clawPDF-0.9.3-setup.msi
   ```

2. **Place** the file in:
   ```
   src/installer/resources/clawpdf/clawPDF-0.9.3-setup.msi
   ```

3. **Verify** the bundle:
   ```powershell
   .\src\installer\scripts\verify-clawpdf-bundle.ps1
   ```

**See [ClawPDF Bundling Guide](docs/installer/CLAWPDF-BUNDLING-GUIDE.md) for detailed instructions.**

### Development

```bash
# Run in development mode
npm start
```

### Build Installer

```bash
# Build Windows installer (NSIS)
npm run build:installer

# Build portable executable
npm run build:portable

# Build all formats
npm run build:all
```

### Output

After building, you'll find in `dist/`:
- `Tabeza Connect Setup 1.7.0.exe` - NSIS installer (~80MB)
- `Tabeza Connect-Portable-1.7.0.exe` - Portable version

---

## 🔧 Printer Pooling Setup

### How It Works

1. **During Installation**: NSIS installer prompts to configure printer pooling
2. **PowerShell Script**: Creates `TabezaCapturePort` → `C:\TabezaPrints\order.prn`
3. **Setup Wizard**: GUI for selecting which printer to pool
4. **System Tray**: Re-run setup anytime from tray menu

### PowerShell Script Actions

```powershell
# List available printers
.\printer-pooling-setup.ps1 -Action ListPrinters

# Create/verify folder structure (runs automatically on install)
.\printer-pooling-setup.ps1 -Action CreateFolders

# Configure printer pooling
.\printer-pooling-setup.ps1 -Action Install -PhysicalPrinterName "Your Printer Name"

# Check configuration status
.\printer-pooling-setup.ps1 -Action Check

# Remove printer configuration (keeps TabezaPrints folder)
.\printer-pooling-setup.ps1 -Action Uninstall
```

---

## 📦 Installer Features

### What the Installer Does

1. **Installs Application**
   - Copies files to `C:\Program Files\TabezaConnect\`
   - Creates desktop and start menu shortcuts

2. **Creates TabezaPrints Folder Structure**
   ```
   C:\TabezaPrints\
   ├── order.prn           (capture file)
   ├── processed\
   ├── failed\
   ├── logs\
   ├── queue\pending\
   ├── queue\uploaded\
   ├── templates\
   └── config.json         (default config)
   ```

3. **Prompts for Printer Setup**
   - Shows printer selection dialog
   - Creates `TabezaCapturePort` pointing to `C:\TabezaPrints\order.prn`
   - Creates `Tabeza Agent` (pooled printer)

### Reinstall/Update Behavior

- ✅ Folder structure always verified (missing items recreated)
- ✅ Existing data preserved (never overwritten)
- ✅ Printer config checked (prompts if not configured)

### Uninstaller Features

1. Prompts to remove printer configuration
2. Prompts to remove `C:\TabezaPrints\` data
3. Cleans up shortcuts and registry entries

---

## 🖥️ System Tray Menu

Right-click the tray icon to access:

- **Service Status** - Shows running/stopped
- **Folder Status** - Shows if folders OK or missing
- **Open Management UI** - Opens http://127.0.0.1:8765/
- **Open Template Generator** - Opens template page
- **Configure Printer Pooling...** - Re-run setup wizard
- **Repair Folder Structure** - Manually recreate missing folders
- **View Logs** - Opens `C:\TabezaPrints\logs\`
- **Open Capture Folder** - Opens `C:\TabezaPrints\`
- **Restart Service** - Restart background service
- **Quit** - Exit application

---

## 📡 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Service status and statistics |
| `/api/config` | GET | Current configuration |
| `/api/folders` | GET | Check folder structure status |
| `/api/folders/repair` | POST | Repair missing folders |
| `/api/templates` | GET/POST | Get or save parsing template |
| `/api/template/generate` | POST | Generate template from receipts |
| `/api/queue` | GET | Queue statistics |
| `/template.html` | GET | Template generator UI |

---

## 🔄 Migration from PKG

| Feature | PKG Version | Electron Version |
|---------|-------------|------------------|
| Executable Size | ~45MB | ~80MB |
| System Tray | ❌ None | ✅ Full support |
| Printer Setup | ❌ Manual | ✅ Automated |
| Installer | ❌ Manual copy | ✅ NSIS |
| Data Location | Deep path | `C:\TabezaPrints\` |
| Folder Creation | ❌ Manual | ✅ Automatic |
| Folder Repair | ❌ Manual | ✅ Tray menu + API |

---

## 🛠️ Customization

### Change Application Icon

Replace `resources/icon-green.ico` with your icon (256x256 recommended).

### Change API URL

Edit `C:\TabezaPrints\config.json`:
```json
{
  "barId": "your-bar-id",
  "apiUrl": "https://your-api.com",
  "watchFolder": "C:\\TabezaPrints",
  "httpPort": 8765
}
```

### Change HTTP Port

In config.json, set `"httpPort": 9000` or any available port.

---

## ⚠️ Known Issues

1. **Administrator Required**: Printer setup needs admin rights
2. **Windows Only**: This version is Windows-specific
3. **First Run**: May need to run setup wizard manually if auto-setup fails

---

## 📝 Development Notes

### Testing Folder Creation

```powershell
# Test the folder creation
cd "C:\Program Files\TabezaConnect\installer"
powershell -ExecutionPolicy Bypass -File printer-pooling-setup.ps1 -Action CreateFolders
```

### Testing API

```powershell
# Check folder status via API
Invoke-WebRequest -Uri 'http://127.0.0.1:8765/api/folders' | ConvertFrom-Json

# Repair folders via API
Invoke-WebRequest -Uri 'http://127.0.0.1:8765/api/folders/repair' -Method POST
```

### Debugging Electron

```bash
# Run with DevTools
npm start
# Press Ctrl+Shift+I in any window
```

### Checking Logs

```
C:\TabezaPrints\logs\
├── service.log       # Background service logs
├── electron.log      # Electron main process logs
└── printer-setup.log # Printer setup logs
```

---

## 🚀 Quick Start for Production

1. Build the installer:
   ```bash
   npm run build:installer
   ```

2. Distribute `dist/Tabeza Connect Setup 1.7.0.exe`

3. Customer runs installer:
   - Accepts UAC prompt
   - `C:\TabezaPrints\` created automatically
   - Selects their receipt printer
   - Installer creates:
     - `C:\TabezaPrints\order.prn` (capture file)
     - `TabezaCapturePort` → capture file
     - `Tabeza Agent` (pooled)
   - Application starts automatically

4. Customer configures POS:
   - Selects "Tabeza Agent" in POS software
   - Receipts print on paper AND are captured to `C:\TabezaPrints\order.prn`
   - Tabeza Connect processes automatically

---

## 📞 Support

For issues or questions:
- Check logs in `C:\TabezaPrints\logs\`
- Run `printer-pooling-setup.ps1 -Action Check` to verify setup
- Use tray menu → "Repair Folder Structure" to fix missing folders
- Open Management UI at http://127.0.0.1:8765/api/status
- Verify capture file exists: `C:\TabezaPrints\order.prn`
