# TABEZA Printer Agent - Installation Guide

**Complete setup guide for Windows Service + Virtual Printer**

## 🎯 **What You're Installing**

TABEZA Printer Agent is infrastructure software that:
- **Runs as a Windows Service** (invisible, always-on)
- **Creates a virtual printer** that captures receipt data
- **Processes receipts with AI** and syncs to the cloud
- **Works offline-first** with automatic retry

## 📋 **Prerequisites**

### **System Requirements**
- Windows 10/11 or Windows Server 2016+
- Node.js 18+ installed
- Administrator privileges
- Internet connection (for cloud sync)

### **Pre-Installation Checklist**
- [ ] Close all POS applications
- [ ] Ensure Print Spooler service is running
- [ ] Have your TABEZA API credentials ready
- [ ] Backup existing printer configurations (optional)

## 🚀 **Installation Steps**

### **Step 1: Build the Service**

```bash
# Navigate to the printer agent directory
cd packages/printer-agent

# Install dependencies
pnpm install

# Build the service
pnpm build
```

**Expected Output:**
```
✅ TypeScript compilation successful
✅ Service files generated in dist/
✅ Ready for installation
```

### **Step 2: Install Windows Service**

**Run PowerShell as Administrator:**

```powershell
# Install the Windows Service
pnpm run install-service
```

**Expected Output:**
```
🚀 Installing TABEZA Printer Agent as Windows Service...
✅ Created required directories
✅ Service script found
Installing service...
✅ TABEZA Printer Agent service installed successfully
✅ TABEZA Printer Agent service started successfully

Next steps:
1. Install the virtual printer by running: install-printer.ps1
2. Check service status in Windows Services (services.msc)
3. View logs in: C:\ProgramData\TABEZA\Logs
```

### **Step 3: Install Virtual Printer**

**In the same Administrator PowerShell:**

```powershell
# Install the virtual printer
.\scripts\install-printer.ps1
```

**Expected Output:**
```
🚀 Installing TABEZA Virtual Printer...
📁 Creating capture directory: C:\ProgramData\TABEZA\PrintCapture
✅ Capture directory created
🔒 Setting directory permissions...
✅ Directory permissions set
🔍 Checking for Generic/Text Only driver...
✅ Driver already available
🖨️  Installing TABEZA Virtual Printer...
✅ Printer installed successfully
⚙️  Configuring printer properties...
✅ Printer configured
🧪 Testing printer installation...
✅ Printer test successful

🎉 TABEZA Virtual Printer installed successfully!

📋 Installation Summary:
  Printer Name: TABEZA Virtual Printer
  Driver: Generic / Text Only
  Port: FILE:
  Capture Directory: C:\ProgramData\TABEZA\PrintCapture
```

### **Step 4: Configure Environment Variables**

Create or update environment variables for your system:

```powershell
# Set environment variables (replace with your actual values)
[Environment]::SetEnvironmentVariable("TABEZA_API_KEY", "your-api-key", "Machine")
[Environment]::SetEnvironmentVariable("TABEZA_MERCHANT_ID", "your-merchant-id", "Machine")
[Environment]::SetEnvironmentVariable("TABEZA_SECRET_KEY", "your-secret-key", "Machine")
[Environment]::SetEnvironmentVariable("TABEZA_API_ENDPOINT", "https://api.tabeza.com", "Machine")
```

**Restart the service to pick up new environment variables:**

```powershell
Restart-Service "TabezaPrinterAgent"
```

### **Step 5: Verify Installation**

**Run the installation test:**

```powershell
.\scripts\test-installation.ps1
```

**Expected Output:**
```
🧪 Testing TABEZA Printer Agent Installation...

Testing: Windows Service Installation... ✅ PASS
Testing: Windows Service Status... ✅ PASS
Testing: Virtual Printer Installation... ✅ PASS
Testing: Printer Driver... ✅ PASS
Testing: Capture Directory... ✅ PASS
Testing: Directory Permissions... ✅ PASS
Testing: Log Directory... ✅ PASS
Testing: Service Logs... ✅ PASS
Testing: Local Database... ✅ PASS
Testing: Print Capture... ✅ PASS

📊 Test Results Summary
=======================
Tests Passed: 10 / 10

🎉 All tests passed! TABEZA Printer Agent is properly installed.
```

## ✅ **Verification Steps**

### **1. Check Service Status**
```powershell
Get-Service "TabezaPrinterAgent"
```
**Expected:** Status = Running

### **2. Check Printer Installation**
```powershell
Get-Printer -Name "TABEZA Virtual Printer"
```
**Expected:** Printer listed with Generic/Text Only driver

### **3. View Service Logs**
```powershell
Get-Content "$env:ProgramData\TABEZA\Logs\tabeza-agent.log" -Tail 20
```
**Expected:** Recent log entries showing service startup and component initialization

### **4. Test Print Capture**
1. Print any document to "TABEZA Virtual Printer"
2. When prompted, save to: `C:\ProgramData\TABEZA\PrintCapture\`
3. Check logs for processing activity

## 🔧 **Configuration**

### **Service Configuration**
Location: `C:\ProgramData\TABEZA\config.json`

```json
{
  "serviceName": "TabezaPrinterAgent",
  "displayName": "TABEZA Printer Agent",
  "apiEndpoint": "https://api.tabeza.com",
  "syncInterval": 30000,
  "printCaptureDirectory": "C:\\ProgramData\\TABEZA\\PrintCapture",
  "monitorAllPrinters": true,
  "encryptLocalData": true,
  "healthCheckInterval": 60000
}
```

### **Environment Variables**
- `TABEZA_API_KEY`: Your API authentication key
- `TABEZA_MERCHANT_ID`: Your merchant identifier
- `TABEZA_SECRET_KEY`: Secret key for data encryption
- `TABEZA_API_ENDPOINT`: API endpoint URL (default: https://api.tabeza.com)
- `LOG_LEVEL`: Logging level (info, debug, warn, error)

## 📊 **Monitoring**

### **Service Status**
```powershell
# Check service status
Get-Service "TabezaPrinterAgent"

# View service details
Get-WmiObject -Class Win32_Service -Filter "Name='TabezaPrinterAgent'"
```

### **Log Files**
- **Main Log**: `C:\ProgramData\TABEZA\Logs\tabeza-agent.log`
- **Error Log**: `C:\ProgramData\TABEZA\Logs\tabeza-agent-error.log`
- **Exceptions**: `C:\ProgramData\TABEZA\Logs\tabeza-agent-exceptions.log`

### **Database**
- **Location**: `C:\ProgramData\TABEZA\Data\tabeza-agent.db`
- **Type**: SQLite with WAL mode
- **Size**: Monitor for growth (normal: <100MB)

## 🚨 **Troubleshooting**

### **Service Won't Start**

**Check Windows Event Log:**
```powershell
Get-EventLog -LogName Application -Source "TabezaPrinterAgent" -Newest 10
```

**Common Solutions:**
1. Verify Node.js is installed and in PATH
2. Check file permissions on service directory
3. Ensure no antivirus blocking
4. Restart as Administrator

### **Printer Not Capturing**

**Check Capture Directory:**
```powershell
ls "C:\ProgramData\TABEZA\PrintCapture"
```

**Common Solutions:**
1. Verify directory exists and has write permissions
2. Check Print Spooler service is running
3. Test printing to other printers first
4. Restart TABEZA service

### **Sync Issues**

**Test Connectivity:**
```powershell
Test-NetConnection api.tabeza.com -Port 443
```

**Common Solutions:**
1. Check internet connection
2. Verify API credentials
3. Check firewall settings
4. Review sync logs for errors

### **High Resource Usage**

**Check Service Performance:**
```powershell
Get-Process -Name "node" | Where-Object {$_.ProcessName -eq "node"}
```

**Common Solutions:**
1. Check for large print jobs in queue
2. Monitor database size
3. Adjust sync interval
4. Clear old log files

## 🗑️ **Uninstallation**

### **Remove Service**
```powershell
# Run as Administrator
pnpm run uninstall-service
```

### **Remove Virtual Printer**
```powershell
# Run as Administrator
.\scripts\uninstall-printer.ps1

# To also remove data
.\scripts\uninstall-printer.ps1 -RemoveData
```

### **Clean Up Data (Optional)**
```powershell
# Remove all TABEZA data
Remove-Item -Path "$env:ProgramData\TABEZA" -Recurse -Force
```

## 📞 **Support**

### **Getting Help**
1. **Check Logs First**: Always review service logs for error details
2. **Run Test Script**: Use `test-installation.ps1` to identify issues
3. **Check Documentation**: Review README.md and PRINTER-DRIVER-STRATEGY.md
4. **System Information**: Collect Windows version, Node.js version, error logs

### **Diagnostic Information**
When reporting issues, include:
- Windows version and edition
- Node.js version (`node --version`)
- Service logs (last 50 lines)
- Test script results
- Error messages from Windows Event Log

## 🎯 **Success Criteria**

Your installation is successful when:
- ✅ Service shows as "Running" in Windows Services
- ✅ "TABEZA Virtual Printer" appears in printer list
- ✅ Test script passes all 10 tests
- ✅ Service logs show successful startup
- ✅ Print jobs are captured and processed
- ✅ Data syncs to TABEZA dashboard

**You're now ready to capture receipt data with TABEZA!** 🎉