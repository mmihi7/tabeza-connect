# TABEZA Printer Agent

**Windows Service + Minimal Tray UI Architecture**

## 🎯 Core Principle

> **TABEZA is infrastructure, not an app.**
> 
> Like antivirus, backup agents, and fiscal printers - it runs invisibly in the background, survives reboots, and cannot be "closed" accidentally.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    WINDOWS SERVICE LAYER                       │
│                         (MANDATORY)                            │
│                                                                 │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────┐ │
│  │   Print Spooler │───▶│  Print Capture   │───▶│   Receipt   │ │
│  │   Monitoring    │    │     Engine       │    │   Parser    │ │
│  └─────────────────┘    └──────────────────┘    └─────────────┘ │
│                                 │                       │       │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────┐ │
│  │   Local Store   │◀───│   Session        │◀───│ Compliance  │ │
│  │   (SQLite)      │    │   Manager        │    │ Hints       │ │
│  └─────────────────┘    └──────────────────┘    └─────────────┘ │
│                                 │                               │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────┐ │
│  │   Health        │    │   Sync Engine    │───▶│   Cloud     │ │
│  │   Monitor       │    │   (Offline-Safe) │    │   API       │ │
│  └─────────────────┘    └──────────────────┘    └─────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      TRAY UI LAYER                             │
│                        (OPTIONAL)                              │
│                                                                 │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────┐ │
│  │   Status Icon   │    │   Quick Actions  │    │   Logs      │ │
│  │   🟢 Online     │    │   • View Logs    │    │   Viewer    │ │
│  │   🔴 Offline    │    │   • Test Print   │    │             │ │
│  └─────────────────┘    └──────────────────┘    └─────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 📋 Service Lifecycle Design

### 1. **Service Installation**
```
tabeza-printer-agent-setup.msi
├── Installs Windows Service
├── Creates virtual printer driver
├── Sets up local SQLite database
├── Configures auto-start
└── Adds system tray launcher
```

### 2. **Service Startup Sequence**
```typescript
// Service startup order (critical)
1. Initialize SQLite database
2. Load configuration
3. Start print spooler monitoring
4. Initialize virtual printer engine
5. Start sync engine (offline-safe)
6. Register health checks
7. Signal "Ready" to Windows
8. Optional: Launch tray UI
```

### 3. **Service Runtime Behavior**
```typescript
// Continuous operation
while (service.isRunning) {
  // Monitor print spooler for new jobs
  await printMonitor.checkForNewJobs();
  
  // Process captured receipts
  await receiptProcessor.processQueue();
  
  // Sync with cloud (when online)
  await syncEngine.syncPendingData();
  
  // Health check
  await healthMonitor.reportStatus();
  
  // Sleep 1 second
  await sleep(1000);
}
```

### 4. **Service Shutdown Sequence**
```typescript
// Graceful shutdown
1. Stop accepting new print jobs
2. Finish processing current queue
3. Flush pending sync data
4. Close database connections
5. Clean up resources
6. Signal Windows service stopped
```

## 🔧 Technical Implementation Strategy

### **Phase 1: Headless Service (MVP)**

**Core Service Components:**
```
packages/printer-agent/
├── src/
│   ├── service/
│   │   ├── windows-service.ts      # Service entry point
│   │   ├── service-controller.ts   # Start/stop/restart
│   │   └── service-installer.ts    # Installation logic
│   │
│   ├── core/
│   │   ├── print-monitor.ts        # Windows spooler integration
│   │   ├── receipt-processor.ts    # Uses virtual-printer engine
│   │   ├── session-manager.ts      # Receipt session handling
│   │   ├── local-store.ts          # SQLite operations
│   │   ├── sync-engine.ts          # Cloud synchronization
│   │   └── health-monitor.ts       # Service health checks
│   │
│   ├── config/
│   │   ├── service-config.ts       # Service configuration
│   │   └── printer-config.ts       # Printer mappings
│   │
│   └── utils/
│       ├── windows-api.ts          # Windows API bindings
│       ├── logging.ts              # Service logging
│       └── crypto.ts               # Local encryption
│
├── installer/
│   ├── service-installer.wxs       # WiX installer definition
│   ├── post-install.ps1           # Post-installation script
│   └── pre-uninstall.ps1          # Cleanup script
│
├── driver/
│   ├── tabeza-printer.inf         # Virtual printer driver
│   └── install-driver.ps1         # Driver installation
│
└── package.json
```

### **Service Configuration Model**
```typescript
interface ServiceConfig {
  // Service identity
  serviceName: 'TabezaPrinterAgent';
  displayName: 'TABEZA Printer Agent';
  description: 'Captures and processes receipt data from POS systems';
  
  // Runtime behavior
  startType: 'automatic';
  restartOnFailure: true;
  maxRestartAttempts: 3;
  
  // Local storage
  dataDirectory: '%ProgramData%\\TABEZA\\PrinterAgent';
  logDirectory: '%ProgramData%\\TABEZA\\Logs';
  
  // Cloud sync
  apiEndpoint: 'https://api.tabeza.com';
  syncInterval: 30000; // 30 seconds
  offlineRetentionDays: 30;
  
  // Print monitoring
  monitorAllPrinters: true;
  excludedPrinters: ['Microsoft Print to PDF', 'Fax'];
  
  // Security
  encryptLocalData: true;
  requireTLS: true;
}
```

## 🚀 **Implementation Roadmap**

### **Week 1: Service Foundation**
- [ ] Create Windows Service wrapper (Node.js + node-windows)
- [ ] Implement print spooler monitoring
- [ ] Set up SQLite local storage
- [ ] Basic receipt capture pipeline

### **Week 2: Core Processing**
- [ ] Integrate virtual-printer engine
- [ ] Implement session management
- [ ] Add compliance hints processing
- [ ] Local data encryption

### **Week 3: Cloud Integration**
- [ ] Build sync engine with offline support
- [ ] Implement retry logic and error handling
- [ ] Add health monitoring and diagnostics
- [ ] Service logging and debugging

### **Week 4: Installation & Deployment**
- [ ] Create MSI installer with WiX
- [ ] Virtual printer driver integration
- [ ] Auto-start configuration
- [ ] Basic system tray status icon

## 🎯 **Success Criteria (Phase 1)**

**Installation Experience:**
- ✅ Single MSI installer
- ✅ No user interaction required
- ✅ Works on Windows 10/11
- ✅ Survives Windows updates

**Runtime Behavior:**
- ✅ Starts automatically with Windows
- ✅ Runs even when no user logged in
- ✅ Cannot be accidentally closed
- ✅ Captures receipts from any printer

**Reliability:**
- ✅ Handles network outages gracefully
- ✅ Recovers from service crashes
- ✅ Maintains data integrity
- ✅ Minimal resource usage (<50MB RAM)

**Merchant Experience:**
- ✅ "It just works" - no configuration needed
- ✅ System tray shows online/offline status
- ✅ Receipts appear in TABEZA dashboard
- ✅ No interference with existing printing

## 🔧 **Technology Stack Decision**

**Recommended: Node.js + node-windows**
```typescript
// Why Node.js for the service:
✅ Reuses existing virtual-printer packages
✅ Fast development and testing
✅ Good Windows API bindings available
✅ Easy SQLite integration
✅ Familiar to the team

// Alternative: .NET Core
❓ More "native" Windows feel
❓ Better Windows integration
❌ Requires rewriting existing logic
❌ Longer development time
```

**Service Wrapper:**
```bash
npm install node-windows
# Creates actual Windows Service from Node.js app
```

**Print Monitoring:**
```bash
npm install node-printer
# Windows print spooler integration
```

**Local Database:**
```bash
npm install better-sqlite3
# Fast, reliable SQLite for local storage
```

## 📊 **Monitoring & Diagnostics**

**Service Health Indicators:**
- 🟢 **Healthy**: Capturing receipts, syncing to cloud
- 🟡 **Degraded**: Capturing receipts, offline (will sync later)
- 🔴 **Failed**: Service stopped or critical error

**Key Metrics:**
- Receipts captured per hour
- Sync success rate
- Local storage usage
- Service uptime
- Error frequency

**Diagnostic Endpoints:**
```
http://localhost:8765/health     # Service health check
http://localhost:8765/stats      # Processing statistics
http://localhost:8765/logs       # Recent log entries
http://localhost:8765/config     # Current configuration
```

This architecture ensures TABEZA behaves like professional infrastructure - invisible, reliable, and always working.

**Next Steps:**
- Should I proceed with **2️⃣ Virtual printer driver strategy**?
- Or would you prefer **4️⃣ Phase-1 build checklist** to start implementation?