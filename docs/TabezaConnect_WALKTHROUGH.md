# 🚀 **New TabezaConnect Architecture & POS Basic Onboarding**

## 📋 **How New TabezaConnect Works**

### **🔄 Two Capture Modes**

#### **1. LEGACY MODE (captureMode='folder')**
- **What**: Monitors folder for print jobs (`C:\ProgramData\Tabeza\TabezaPrints`)
- **How**: POS → TabezaConnect → Printer (blocking intermediary)
- **Use**: "Print to File" or any printer that outputs to a folder
- **Flow**: POS prints → TabezaConnect intercepts → forwards to cloud → physical printer

#### **2. NEW MODE (captureMode='spooler')** ⭐
- **What**: Monitors Windows print spooler (`C:\Windows\System32\spool\PRINTERS`)
- **How**: POS → Printer (instant) + TabezaConnect watches spooler (passive)
- **Revolution**: Printer never knows Tabeza exists. POS never knows Tabeza exists.
- **Flow**: POS prints directly → physical printer prints instantly + TabezaConnect captures from spooler

---

## 🔧 **Technical Architecture**

### **Components**
1. **Printer Service**: Node.js service (port 8765)
2. **Virtual Printer**: Generic/Text Only printer with FILE: port
3. **Installer**: Automated setup with bundled Node.js runtime
4. **Spool Monitor**: Passive Windows spooler watcher

### **Key Features**
- ✅ **Zero POS Modification**: Works with any POS that can print
- ✅ **Dual-Printer Architecture**: Physical printer continues working independently
- ✅ **Automatic Receipt Capture**: Monitors virtual printer output
- ✅ **Offline-First**: Queues receipts when internet is unavailable
- ✅ **Self-Healing**: Automatically recovers from common failures
- ✅ **2-Minute Installation**: Customer-friendly setup wizard

---

## 📦 **GitHub & Distribution**

### **Same EXE File?**
**YES** - The same `TabezaConnect-Setup.exe` is used, but with enhanced capabilities:

#### **What's New:**
- 🆕 **Spooler monitoring** (passive capture)
- 🆕 **Background upload worker** (async processing)
- 🆕 **Local queue system** (offline-first)
- 🆕 **Auto-failover** (self-healing)
- 🆕 **Configuration wizard** (POS Basic mode detection)

### **Build Process**
```bash
# Clone repository (same as before)
git clone https://github.com/billoapp/TabezaConnect.git
cd TabezaConnect

# Install dependencies (same as before)
npm install
cd src/service && npm install && cd ../..

# Build installer (same as before)
npm run build

# Output: dist/TabezaConnect-Setup-v1.0.0.zip
```

---

## 🎯 **POS Basic Mode Onboarding Flow**

### **Step 1: Installation**
1. Download `TabezaConnect-Setup-v1.0.0.zip` from [Releases](https://github.com/billoapp/TabezaConnect/releases)
2. Extract to temporary location
3. Right-click `install.bat` → "Run as administrator"
4. **Installation wizard detects POS Basic mode automatically**

### **Step 2: POS Configuration**
#### **For NEW Spooler Mode (Recommended)**
1. **Add "Tabeza Receipt Printer"** in Windows:
   - Start → Settings → Devices & Printers
   - Add printer → "Generic / Text Only" 
   - Port: `FILE:` 
   - Path: `C:\ProgramData\Tabeza\TabezaPrints`
2. **Configure POS to use "Tabeza Receipt Printer"**
3. **Test**: Print from POS → should appear in Tabeza instantly

#### **For Legacy Folder Mode (Fallback)**
1. POS already configured to print to folder
2. TabezaConnect monitors existing folder
3. Works with "Print to File" drivers

### **Step 3: Service Configuration**
The installer automatically configures `config.json`:

```json
{
  "barId": "438c80c1-fe11-4ac5-8a48-2fc45104ba31",
  "apiUrl": "https://tabeza.co.ke",
  "vercelBypassToken": "",
  "driverId": "driver-MIHI-PC",
  "watchFolder": "C:\\ProgramData\\Tabeza\\TabezaPrints",
  "captureMode": "pooling"  // NEW: "spooler" vs old "folder"
}
```

### **Step 4: Verification**
1. **Service Status**: TabezaConnect tray icon shows green (online)
2. **Print Test**: POS prints → receipt appears in staff dashboard
3. **Heartbeat**: Service sends status to cloud every 30 seconds
4. **Receipt Capture**: Templates can be generated in POS Setup tab

---

## 🔄 **Flow Comparison**

### **Old Flow (Legacy)**
```
POS Print → TabezaConnect Intercepts → Cloud Upload → Physical Printer
⬆️  Latency: 2-5 seconds (blocking)
⬆️  Dependency: TabezaConnect must be running
```

### **New Flow (Spooler)**
```
POS Print → Physical Printer (Instant) + TabezaConnect Captures from Spooler
⬇️  Latency: 0 seconds (non-blocking)
⬇️  Independence: POS works even if TabezaConnect is down
```

---

## 🎛️ **Service Management**

### **Background Services**
- **TabezaConnect Service**: Main receipt capture service
- **Upload Worker**: Processes local queue every 5 seconds
- **Heartbeat Service**: Status ping every 30 seconds
- **Spool Monitor**: Passive spooler watching

### **API Endpoints**
- `GET /status` - Service health check
- `GET /driver-status` - Driver connection status
- `POST /restart` - Restart service
- `POST /relay` - Receive print jobs (legacy mode)

---

## 🚨 **Troubleshooting**

### **Common Issues & Solutions**

#### **Spooler Mode Issues**
- **Problem**: No receipts captured
- **Solution**: Check Windows spooler permissions
- **Command**: `net stop spooler && net start spooler`

#### **Configuration Issues**
- **Problem**: Wrong bar ID
- **Solution**: Edit `C:\ProgramData\Tabeza\config.json`
- **Auto-fix**: Service detects and suggests corrections

#### **Network Issues**
- **Problem**: Receipts not uploading
- **Solution**: Local queue + retry mechanism
- **Status**: Tray icon shows yellow (queued)

---

## 📊 **Monitoring & Logs**

### **Service Status**
```bash
# Check service status
curl http://localhost:8765/status

# Check driver connection
curl http://localhost:8765/driver-status
```

### **Log Locations**
- **Service Logs**: `C:\ProgramData\Tabeza\logs\service.log`
- **Print Jobs**: `C:\ProgramData\Tabeza\logs\print-jobs.log`
- **Error Logs**: `C:\ProgramData\Tabeza\logs\errors.log`

---

## 🎯 **POS Basic Mode Benefits**

### **For Venue Owners**
- ✅ **Zero POS Training**: Staff uses existing POS
- ✅ **Instant Printing**: No latency, physical printer works normally
- ✅ **Digital Backup**: All receipts captured in cloud
- ✅ **Template Generation**: AI-powered receipt parsing
- ✅ **Customer Tabs**: Receipts assigned to digital tabs

### **For Customers**
- ✅ **Physical Receipts**: Get printed receipts instantly
- ✅ **Digital Access**: View receipts on their phones
- ✅ **Tab Payment**: Pay for assigned receipts digitally

---

## 🔄 **Migration Path**

### **From Old to New**
1. **Install new version** over existing installation
2. **Configuration preserved**: Same bar ID, settings
3. **Mode switch**: Change from `"folder"` to `"spooler"`
4. **Verify**: Test print job in both modes

### **Rollback Support**
- **Always Possible**: Switch back to legacy folder mode
- **Configuration**: Edit `captureMode` in `config.json`
- **Service**: Restart TabezaConnect service

---

## 🎉 **Summary**

The **new TabezaConnect** maintains the same simple installation process but adds:

1. **Passive Spooler Monitoring** - Zero latency capture
2. **Background Upload Worker** - Async processing
3. **Local Queue System** - Offline-first operation
4. **Self-Healing** - Automatic error recovery
5. **POS Basic Detection** - Automatic mode configuration

**Result**: Your existing POS workflow remains unchanged while gaining powerful digital receipt capture capabilities! 🚀
