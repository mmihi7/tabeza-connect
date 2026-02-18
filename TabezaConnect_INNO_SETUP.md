# 🏗️ **Creating Inno Setup Installer for TabezaConnect**

## 🎯 **Why Inno Setup?**

### **Current Issues:**
- ❌ ZIP file distribution (unprofessional)
- ❌ Manual extraction required
- ❌ Multiple installation steps
- ❌ No Windows installer integration

### **Inno Setup Benefits:**
- ✅ **Single EXE file** - professional distribution
- ✅ **Windows Installer integration** - UAC, shortcuts, uninstall
- ✅ **Professional wizard** - license agreement, install path
- ✅ **Registry integration** - Windows services, auto-start
- ✅ **Desktop shortcuts** - Start menu, quick launch
- ✅ **Silent install** - `/SILENT` for deployment
- ✅ **Update detection** - automatic version checking

---

## 🛠️ **Step 1: Install Inno Setup**

### **Download Inno Setup:**
1. Go to: https://jrsoftware.org/isdl.php
2. Download: **Inno Setup 6.2** (QuickStart recommended)
3. Install with default options

### **Alternative: Chocolatey**
```bash
# Install via Chocolatey (easier for developers)
choco install innosetup
```

---

## 📝 **Step 2: Create Installer Script**

### **Create `installer.iss`:**
```ini
; TabezaConnect Installer Script
; Generated for Inno Setup Compiler

[Setup]
AppId={{A1B2C3D-4E5F-9B6F-1234567890}
AppName=TabezaConnect
AppVersion=1.1.0
AppPublisher=Tabeza
AppURL=https://github.com/billoapp/TabezaConnect
AppComments=Windows installer for POS integration
AppCopyright=Copyright (C) 2024 Tabeza

[Languages]
Name: "english"
MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create desktop shortcut"
Name: "quicklaunch"; Description: "Quick launch icon"

[Files]
Source: "src\installer\nodejs-bundle\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "src\installer\install.bat"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\TabezaConnect"; Filename: "TabezaConnect.exe"; Tasks: desktopicon
Name: "{group}\TabezaConnect"; Filename: "TabezaConnect.exe"; Tasks: quicklaunch

[Run]
Filename: "install.bat"; WorkingDir: "{app}"; StatusMsg: "Installing TabezaConnect service..."

[Registry]
Root: HKLM; Subkey: "SOFTWARE\TabezaConnect"; ValueType: string; ValueName: "InstallPath"; ValueData: "{app}"
Root: HKLM; Subkey: "SOFTWARE\TabezaConnect"; ValueType: string; ValueName: "Version"; ValueData: "1.1.0"

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

[UninstallRun]
Filename: "{cmd}"; Parameters: "/C """"{app}\uninstall.bat"""; RunOnceId: "uninstall_service"
```

---

## 🏗️ **Step 3: Update Build Process**

### **Create `build-inno.bat`:**
```batch
@echo off
echo ========================================
echo Building TabezaConnect Installer
echo ========================================
echo.

echo Step 1: Building Node.js bundle...
call build-pkg.bat

if errorlevel 1 (
    echo ❌ Node.js build failed!
    pause
    exit /b 1
)

echo.
echo Step 2: Building installer...
echo.

REM Check if Inno Setup is available
where iscc >nul 2>nul
if errorlevel 1 (
    echo ❌ Inno Setup not found!
    echo Please install Inno Setup from: https://jrsoftware.org/isdl.php
    echo.
    pause
    exit /b 1
)

REM Compile installer
iscc installer.iss

if errorlevel 1 (
    echo ❌ Installer build failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo Build Complete!
echo ========================================
echo.
echo Output: Output\TabezaConnect-Setup.exe
echo.

echo Next Steps:
echo 1. Test installer on clean VM
echo 2. Upload to GitHub releases
echo 3. Update download links
echo.
pause
```

---

## 📦 **Step 4: Update package.json**

### **Add build script:**
```json
{
  "name": "tabeza-connect",
  "version": "1.1.0",
  "description": "Tabeza Connect - Windows installer for POS integration",
  "scripts": {
    "download:nodejs": "node src/installer/download-nodejs.js",
    "build:installer": "node src/installer/build-installer.js",
    "build:inno": "build-inno.bat",
    "build": "npm run download:nodejs && npm run build:installer && npm run build:inno",
    "test": "echo \"No tests yet\" && exit 0"
  },
  "devDependencies": {
    "adm-zip": "^0.5.10"
  }
}
```

---

## 🚀 **Step 5: Create Uninstaller**

### **Create `uninstall.bat`:**
```batch
@echo off
echo Stopping TabezaConnect service...
net stop tabezaconnect 2>nul

echo Removing TabezaConnect service...
sc delete tabezaconnect 2>nul

echo Removing startup entry...
reg delete "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "TabezaConnect" /f 2>nul

echo Removing application files...
rmdir /s /q "%~dp0" 2>nul

echo TabezaConnect uninstalled successfully.
pause
```

---

## 🎯 **Professional Installation Flow**

### **User Experience:**
1. **Download**: `TabezaConnect-Setup.exe` (single file)
2. **Double-click**: Professional Windows installer launches
3. **UAC Prompt**: Windows security confirmation
4. **Install Wizard**: 
   - Welcome screen with Tabeza branding
   - License agreement
   - Install path selection (default: `C:\Program Files\TabezaConnect`)
   - Desktop shortcut option
   - Start menu shortcut option
5. **Installation**: Files copied, registry entries created
6. **Service Setup**: Windows service installed and started
7. **Completion**: Success message with launch options

### **Professional Features:**
- ✅ **Desktop Shortcut**: Double-click to start service
- ✅ **Start Menu**: Programs → TabezaConnect
- ✅ **Service Integration**: Windows service management
- ✅ **Auto-Start**: Launch with Windows
- ✅ **Update Support**: Automatic version checking
- ✅ **Uninstall**: Clean removal via Windows Apps

---

## 🔄 **Build Command**

### **New Build Process:**
```bash
# Build professional installer
npm run build:inno

# Output: Output\TabezaConnect-Setup.exe (single file)
# Ready for GitHub release!
```

---

## 📋 **Migration Path**

### **From ZIP to EXE:**
1. ✅ **Keep same build process** for Node.js bundle
2. ✅ **Add Inno Setup compilation**
3. ✅ **Update version to 1.1.0**
4. ✅ **Create uninstaller**
5. ✅ **Test installer thoroughly**

### **Benefits:**
- 🎯 **Professional distribution** - single EXE file
- 🏗️ **Windows integration** - proper installer behavior
- 📱 **User-friendly** - double-click installation
- 🔄 **Update support** - automatic version checking
- 🗑️ **Clean uninstall** - proper Windows removal

---

## 🎉 **Result**

**Users will get a professional `TabezaConnect-Setup.exe` that:**
- Installs like traditional Windows software
- Creates proper shortcuts and registry entries
- Manages Windows service correctly
- Supports silent installation for deployment
- Provides professional uninstallation

**No more ZIP files - just one professional EXE!** 🚀
