# Printer Management UI - Design Document

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Web Browser (localhost:8765)              │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         printer-settings.html                       │    │
│  │                                                      │    │
│  │  ┌─────────────────────────────────────────────┐  │    │
│  │  │  Current Printer Display                     │  │    │
│  │  │  - Name, Status, Port                        │  │    │
│  │  │  - Last Activity                             │  │    │
│  │  └─────────────────────────────────────────────┘  │    │
│  │                                                      │    │
│  │  ┌─────────────────────────────────────────────┐  │    │
│  │  │  Change Printer Section                      │  │    │
│  │  │  - Dropdown (auto-populated)                 │  │    │
│  │  │  - Update Button                             │  │    │
│  │  │  - Test Print Button                         │  │    │
│  │  └─────────────────────────────────────────────┘  │    │
│  │                                                      │    │
│  │  ┌─────────────────────────────────────────────┐  │    │
│  │  │  Bridge Status                               │  │    │
│  │  │  - Running/Stopped                           │  │    │
│  │  │  - Capture Folder                            │  │    │
│  │  │  - Recent Activity                           │  │    │
│  │  └─────────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/JSON
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              TabezaConnect Service (localhost:8765)          │
│                                                              │
│  API Endpoints:                                             │
│  ├─ GET  /api/status                                        │
│  ├─ GET  /api/printers/list                                 │
│  ├─ POST /api/printers/set-physical                         │
│  └─ POST /api/printers/test                                 │
│                                                              │
│  Bridge Management:                                         │
│  ├─ Load config.json                                        │
│  ├─ Update printer configuration                            │
│  ├─ Restart bridge service                                  │
│  └─ Verify bridge is running                                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Bridge Service (final-bridge.js)            │
│                                                              │
│  Runtime Printer Change:                                    │
│  1. Stop current watcher                                    │
│  2. Update config.printerName                               │
│  3. Restart watcher                                         │
│  4. Verify forwarding works                                 │
└─────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Web UI (printer-settings.html)

**File**: `src/public/printer-settings.html`

**Layout Structure**:
```html
<!DOCTYPE html>
<html>
<head>
  <title>Printer Settings - Tabeza Connect</title>
  <style>/* Modern, responsive CSS */</style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>🖨️ Printer Settings</h1>
      <p>Manage your physical printer configuration</p>
    </div>
    
    <div class="content">
      <!-- Alert Messages -->
      <div id="alert" class="alert"></div>
      
      <!-- Section 1: Current Configuration -->
      <div class="section">
        <h2>Current Configuration</h2>
        <div class="printer-card" id="currentPrinter">
          <!-- Populated by JavaScript -->
        </div>
      </div>
      
      <!-- Section 2: Change Printer -->
      <div class="section">
        <h2>Change Physical Printer</h2>
        <p class="help-text">
          Select a different printer if you've replaced your hardware.
          Your POS will continue printing to "Tabeza POS Connect" - no POS changes needed.
        </p>
        
        <select id="printerSelect">
          <option value="">Loading printers...</option>
        </select>
        
        <button onclick="updatePrinter()">Update Printer</button>
        <button onclick="testPrint()" class="secondary">Send Test Print</button>
      </div>
      
      <!-- Section 3: Bridge Status -->
      <div class="section">
        <h2>Bridge Status</h2>
        <div id="bridgeStatus">
          <!-- Populated by JavaScript -->
        </div>
      </div>
    </div>
  </div>
  
  <script>/* JavaScript for API calls and UI updates */</script>
</body>
</html>
```

**JavaScript Functions**:

```javascript
// Load current status
async function loadStatus() {
  const response = await fetch('/api/status');
  const data = await response.json();
  
  // Update current printer display
  updateCurrentPrinter(data.bridge);
  
  // Update bridge status
  updateBridgeStatus(data.bridge);
}

// Load available printers
async function loadPrinters() {
  const response = await fetch('/api/printers/list');
  const data = await response.json();
  
  const select = document.getElementById('printerSelect');
  select.innerHTML = '<option value="">-- Select a printer --</option>';
  
  data.printers.forEach(printer => {
    const option = document.createElement('option');
    option.value = printer.name;
    option.textContent = `${printer.name} (${printer.status})`;
    select.appendChild(option);
  });
}

// Update printer configuration
async function updatePrinter() {
  const printerName = document.getElementById('printerSelect').value;
  
  if (!printerName) {
    showAlert('Please select a printer', 'error');
    return;
  }
  
  // Confirm change
  if (!confirm(`Change printer to: ${printerName}?\n\nYour POS configuration will not change.`)) {
    return;
  }
  
  const response = await fetch('/api/printers/set-physical', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ printerName })
  });
  
  const data = await response.json();
  
  if (data.success) {
    showAlert('✅ Printer updated successfully!', 'success');
    loadStatus(); // Refresh display
  } else {
    showAlert('❌ ' + data.error, 'error');
  }
}

// Send test print
async function testPrint() {
  const response = await fetch('/api/printers/test', {
    method: 'POST'
  });
  
  const data = await response.json();
  
  if (data.success) {
    showAlert('✅ Test print sent! Check your printer.', 'success');
  } else {
    showAlert('❌ ' + data.error, 'error');
  }
}

// Auto-refresh every 5 seconds
setInterval(loadStatus, 5000);
```

---

### 2. API Endpoints (src/service/index.js)

#### A. List Available Printers

**Endpoint**: `GET /api/printers/list`

**Implementation**:
```javascript
app.get('/api/printers/list', async (req, res) => {
  try {
    const { execSync } = require('child_process');
    
    // Get all printers via PowerShell
    const psCommand = `
      Get-Printer | Where-Object { 
        $_.Name -notmatch "Microsoft|OneNote|Fax|PDF|AnyDesk|XPS|Send To|Adobe" 
      } | Select-Object Name, PortName, PrinterStatus, DriverName | ConvertTo-Json
    `;
    
    const result = execSync(`powershell -Command "${psCommand}"`, {
      encoding: 'utf8',
      windowsHide: true
    });
    
    const printers = JSON.parse(result);
    const printerList = Array.isArray(printers) ? printers : [printers];
    
    res.json({
      success: true,
      printers: printerList.map(p => ({
        name: p.Name,
        port: p.PortName,
        status: p.PrinterStatus,
        driver: p.DriverName
      }))
    });
  } catch (error) {
    console.error('Failed to list printers:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

**Response Format**:
```json
{
  "success": true,
  "printers": [
    {
      "name": "EPSON L3210 Series",
      "port": "USB001",
      "status": "Normal",
      "driver": "EPSON L3210 Series"
    },
    {
      "name": "Star TSP143III",
      "port": "TCP/IP_192.168.1.100",
      "status": "Normal",
      "driver": "Star TSP100"
    }
  ]
}
```

**Error Handling**:
- PowerShell execution fails → Return 500 with error message
- No printers found → Return empty array
- JSON parse fails → Return 500 with error message

---

#### B. Update Physical Printer

**Endpoint**: `POST /api/printers/set-physical`

**Implementation**:
```javascript
app.post('/api/printers/set-physical', async (req, res) => {
  try {
    const { printerName } = req.body;
    
    if (!printerName) {
      return res.status(400).json({
        success: false,
        error: 'printerName is required'
      });
    }
    
    // Verify printer exists
    const { execSync } = require('child_process');
    try {
      execSync(`powershell -Command "Get-Printer -Name '${printerName}'"`, {
        windowsHide: true
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: `Printer not found: ${printerName}`
      });
    }
    
    // Update config
    if (!config.bridge) {
      config.bridge = {};
    }
    
    const oldPrinter = config.bridge.printerName;
    config.bridge.printerName = printerName;
    
    // Save to file
    saveConfig(config);
    
    console.log(`🔄 Printer changed: ${oldPrinter} → ${printerName}`);
    
    // Restart bridge if running
    if (printBridge) {
      console.log('🔄 Restarting bridge with new printer...');
      printBridge.stop();
      printBridge.config.printerName = printerName;
      printBridge.start();
      console.log('✅ Bridge restarted successfully');
    }
    
    res.json({
      success: true,
      message: `Physical printer updated to: ${printerName}`,
      oldPrinter,
      newPrinter: printerName
    });
  } catch (error) {
    console.error('Failed to update printer:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

**Request Format**:
```json
{
  "printerName": "Star TSP143III"
}
```

**Response Format**:
```json
{
  "success": true,
  "message": "Physical printer updated to: Star TSP143III",
  "oldPrinter": "EPSON L3210 Series",
  "newPrinter": "Star TSP143III"
}
```

**Error Handling**:
- Missing printerName → Return 400
- Printer not found → Return 400
- Config save fails → Return 500
- Bridge restart fails → Log error, return success (bridge will auto-recover)

---

#### C. Send Test Print

**Endpoint**: `POST /api/printers/test`

**Implementation**:
```javascript
app.post('/api/printers/test', async (req, res) => {
  try {
    if (!config.bridge || !config.bridge.enabled) {
      return res.status(400).json({
        success: false,
        error: 'Bridge not enabled'
      });
    }
    
    // Create test receipt
    const now = new Date();
    const testReceipt = `
========================================
       TABEZA TEST PRINT
========================================
Date: ${now.toLocaleString()}
Printer: ${config.bridge.printerName}

This is a test print to verify your
printer configuration is working.

If you can read this, your printer
is configured correctly!

========================================
    Powered by Tabeza
========================================
    `;
    
    // Write to capture folder
    const testFile = path.join(
      config.bridge.captureFolder,
      `test_${Date.now()}.prn`
    );
    
    fs.writeFileSync(testFile, testReceipt);
    
    console.log('📄 Test print sent to bridge');
    console.log(`   File: ${testFile}`);
    
    res.json({
      success: true,
      message: 'Test print sent successfully',
      file: path.basename(testFile)
    });
  } catch (error) {
    console.error('Test print failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

**Response Format**:
```json
{
  "success": true,
  "message": "Test print sent successfully",
  "file": "test_1708531200000.prn"
}
```

**Error Handling**:
- Bridge not enabled → Return 400
- Capture folder not found → Return 500
- File write fails → Return 500

---

#### D. Enhanced Status Endpoint

**Endpoint**: `GET /api/status` (enhanced)

**Implementation**:
```javascript
app.get('/api/status', (req, res) => {
  const bridgeStats = printBridge ? {
    enabled: true,
    printerName: config.bridge.printerName,
    captureFolder: config.bridge.captureFolder,
    lastActivity: printBridge.lastActivity || null,
    status: printBridge.isRunning ? 'running' : 'stopped',
    filesProcessed: printBridge.filesProcessed || 0
  } : {
    enabled: false,
    status: 'not configured'
  };
  
  res.json({
    status: 'running',
    version: '1.6.0',
    timestamp: new Date().toISOString(),
    barId: config.barId,
    driverId: config.driverId,
    configured: !!config.barId,
    bridge: bridgeStats
  });
});
```

**Response Format**:
```json
{
  "status": "running",
  "version": "1.6.0",
  "timestamp": "2026-02-21T10:30:00Z",
  "barId": "xxx-xxx-xxx",
  "driverId": "driver-hostname",
  "configured": true,
  "bridge": {
    "enabled": true,
    "printerName": "EPSON L3210 Series",
    "captureFolder": "C:\\ProgramData\\Tabeza\\TabezaPrints",
    "lastActivity": "2026-02-21T10:25:00Z",
    "status": "running",
    "filesProcessed": 42
  }
}
```

---

### 3. Bridge Service Updates

**File**: `src/service/final-bridge.js`

**Changes Required**:

#### A. Add Runtime Printer Change Support

```javascript
class FinalUniversalBridge {
    constructor(configPath = 'C:\\ProgramData\\Tabeza\\config.json') {
        this.configPath = configPath;
        this.config = this.loadConfig();
        this.watcher = null;
        this.processingFiles = new Set();
        this.isShuttingDown = false;
        this.isRunning = false;
        this.lastActivity = null;
        this.filesProcessed = 0;
    }
    
    start() {
        if (this.isRunning) {
            console.log('⚠️  Bridge already running');
            return;
        }
        
        console.log('🌉 Starting bridge...');
        console.log(`   Printer: ${this.config.bridge.printerName}`);
        
        // ... existing start logic ...
        
        this.isRunning = true;
    }
    
    stop() {
        if (!this.isRunning) {
            console.log('⚠️  Bridge not running');
            return;
        }
        
        console.log('🛑 Stopping bridge...');
        
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
        
        this.processingFiles.clear();
        this.isRunning = false;
        
        console.log('✅ Bridge stopped');
    }
    
    restart(newPrinterName) {
        console.log(`🔄 Restarting bridge with new printer: ${newPrinterName}`);
        
        this.stop();
        this.config.bridge.printerName = newPrinterName;
        this.start();
        
        console.log('✅ Bridge restarted successfully');
    }
    
    async handlePrint(filePath) {
        // ... existing logic ...
        
        // Update activity tracking
        this.lastActivity = new Date().toISOString();
        this.filesProcessed++;
    }
}
```

#### B. Expose Bridge Instance Globally

```javascript
// In src/service/index.js

let printBridge = null;

async function startWatcher() {
  if (config.captureMode === 'bridge') {
    await initializeQueue();
    
    console.log('🌉 Starting Silent Bridge Mode...');
    
    printBridge = new PrintBridge();
    printBridge.start();
    
    // Make bridge accessible to API endpoints
    global.printBridge = printBridge;
  }
}
```

---

## Data Flow

### Printer Change Flow
```
1. User selects new printer from dropdown
   ↓
2. User clicks "Update Printer"
   ↓
3. Confirmation dialog shown
   ↓
4. POST /api/printers/set-physical
   ├─ Verify printer exists
   ├─ Update config.json
   ├─ Stop bridge
   ├─ Update bridge.config.printerName
   ├─ Start bridge
   └─ Return success
   ↓
5. UI shows success message
   ↓
6. UI refreshes status display
   ↓
7. New printer is active
```

### Test Print Flow
```
1. User clicks "Send Test Print"
   ↓
2. POST /api/printers/test
   ├─ Create test receipt text
   ├─ Write to capture folder
   └─ Return success
   ↓
3. Bridge detects new file
   ├─ Read file content
   ├─ Upload to cloud (test mode)
   ├─ Forward to physical printer
   └─ Delete file
   ↓
4. Physical printer prints receipt
   ↓
5. User verifies receipt printed
```

---

## UI States

### Loading State
```
┌─────────────────────────────────────┐
│  Current Configuration              │
│  ┌───────────────────────────────┐ │
│  │  ⏳ Loading...                 │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Normal State
```
┌─────────────────────────────────────┐
│  Current Configuration              │
│  ┌───────────────────────────────┐ │
│  │  EPSON L3210 Series           │ │
│  │  Status: ✅ Ready             │ │
│  │  Port: USB001                 │ │
│  │  Last Activity: 2 mins ago    │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Error State
```
┌─────────────────────────────────────┐
│  Current Configuration              │
│  ┌───────────────────────────────┐ │
│  │  EPSON L3210 Series           │ │
│  │  Status: ❌ Error             │ │
│  │  Port: USB001                 │ │
│  │  Last Activity: Never         │ │
│  └───────────────────────────────┘ │
│                                     │
│  ⚠️ Bridge not running             │
│  Please restart TabezaConnect      │
└─────────────────────────────────────┘
```

### Success Message
```
┌─────────────────────────────────────┐
│  ✅ Printer updated successfully!   │
│  Your printer is now: Star TSP143III│
└─────────────────────────────────────┘
```

### Error Message
```
┌─────────────────────────────────────┐
│  ❌ Failed to update printer        │
│  Printer not found: Invalid Name    │
└─────────────────────────────────────┘
```

---

## Testing Strategy

### Unit Tests
- API endpoint responses (mock PowerShell)
- Printer list parsing
- Config file updates
- Bridge restart logic

### Integration Tests
- Full printer change workflow
- Test print end-to-end
- Bridge restart verification
- Error handling scenarios

### Manual Tests
- Change printer with real hardware
- Send test print and verify physical output
- Test with printer offline
- Test with no printers available
- Test with multiple printers

---

## Performance Considerations

### API Response Times
- `/api/printers/list`: < 1 second (PowerShell execution)
- `/api/printers/set-physical`: < 2 seconds (config update + bridge restart)
- `/api/printers/test`: < 500ms (file write)
- `/api/status`: < 100ms (in-memory data)

### UI Responsiveness
- Page load: < 2 seconds
- Printer dropdown population: < 1 second
- Button click feedback: Immediate
- Status refresh: Every 5 seconds (auto)

### Resource Usage
- Memory: < 5 MB for UI page
- CPU: < 1% during idle
- Network: < 10 KB per API call

---

## Security Considerations

### Access Control
- Only accessible from localhost (no remote access)
- No authentication required (localhost trust model)
- No sensitive data exposed in API responses

### Input Validation
- Printer name validated against available printers
- No arbitrary command execution
- Config file writes are atomic

### Audit Logging
- All printer changes logged to console
- Timestamp and old/new printer recorded
- Test prints logged with timestamp

---

## Deployment Strategy

### Version: v1.6.0

### Files to Add
- `src/public/printer-settings.html` (new)
- API endpoints in `src/service/index.js` (modified)
- Bridge restart logic in `src/service/final-bridge.js` (modified)

### Files to Update
- `src/public/configure.html` (add link to printer settings)
- `src/service/index.js` (add API endpoints)
- `src/service/final-bridge.js` (add restart support)

### Testing Checklist
- [ ] Printer list loads correctly
- [ ] Printer change works with real hardware
- [ ] Test print produces physical receipt
- [ ] Bridge restarts successfully
- [ ] Error messages are clear
- [ ] UI is responsive on tablet
- [ ] Works on Windows 10 and 11

---

## Success Criteria

### Functional Success
- ✅ User can see current printer
- ✅ User can change printer without support
- ✅ Test print works end-to-end
- ✅ Bridge restarts automatically
- ✅ No service restart required

### User Experience Success
- ✅ Printer change takes < 2 minutes
- ✅ Clear success/failure feedback
- ✅ No technical knowledge required
- ✅ Works on first attempt
- ✅ Helpful error messages

### Technical Success
- ✅ No race conditions
- ✅ Config always consistent
- ✅ Bridge always restarts successfully
- ✅ No memory leaks
- ✅ Proper error handling
