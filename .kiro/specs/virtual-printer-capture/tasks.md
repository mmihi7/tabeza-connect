# Tasks: Virtual Printer Capture Architecture (clawPDF-Based)

> **Note:** This task list focuses on code development tasks only. Manual testing tasks have been removed to streamline implementation.

> **Progress:** 10 of 65 tasks completed (15%)

---

## Phase 1: ClawPDF Integration & Configuration

### 1.1 Installation Scripts
- [x] 1.1.1 Bundle clawPDF 0.9.3 MSI installer with Tabeza Connect installer
- [x] 1.1.2 Create PowerShell script for silent installation (`install-clawpdf.ps1`)
- [x] 1.1.3 Add installation step to Inno Setup script with rollback logic
- [x] 1.1.4 Add registry cleanup to uninstaller script

### 1.2 Printer Profile Configuration
- [x] 1.2.1 Create PowerShell script to configure clawPDF printer profile (`configure-clawpdf.ps1`)
- [x] 1.2.2 Create test script for printer profile validation (`test-clawpdf-printer.ps1`)

---

## Phase 2: Spool Folder Monitoring

### 2.1 Spool Watcher Implementation
- [x] 2.1.1 Create SpoolWatcher class in src/service/spool-watcher.js
- [x] 2.1.2 Implement file watching with chokidar for .ps files
- [x] 2.1.3 Implement file stabilization delay and locking check
- [x] 2.1.4 Add error handling and logging for file watcher events
- [x] 2.1.5 Write unit tests for SpoolWatcher class

### 2.2 Print Job Processing
- [x] 2.2.1 Implement handleSpoolFile method
- [x] 2.2.2 Read spool file content (raw PostScript data)
- [x] 2.2.3 Save as C:\TabezaPrints\order_{timestamp}.prn (overwrite)
- [x] 2.2.4 Archive spool file to processed\ folder with timestamp
- [x] 2.2.5 Queue job for forwarding to physical printer
- [-] 2.2.6 Delete spool file after successful processing
- [ ] 2.2.7 Write unit tests for print job processing

### 2.3 Service Integration
- [x] 2.3.1 Modify src/service/index.js to initialize SpoolWatcher
- [ ] 2.3.2 Connect SpoolWatcher to existing capture service
- [ ] 2.3.3 Add configuration flag for clawPDF vs pooling mode
- [ ] 2.3.4 Update file watcher to handle both order.prn and spool files
- [ ] 2.3.5 Update service startup and shutdown sequences
- [ ] 2.3.6 Write integration tests for end-to-end spool capture

---

## Phase 3: Physical Printer Forwarding

### 3.1 Printer Adapter Core
- [ ] 3.1.1 Create PhysicalPrinterAdapter class in src/service/printer-adapter.js
- [ ] 3.1.2 Implement printer configuration loading from config.json
- [ ] 3.1.3 Implement forwarding queue with exponential backoff retry
- [ ] 3.1.4 Implement printer selection logic (default, routing rules)
- [ ] 3.1.5 Add logging for all forwarding events
- [ ] 3.1.6 Write unit tests for printer adapter core

### 3.2 Printer Connection Types
- [ ] 3.2.1 Create USBPrinterConnection class in src/service/connections/usb-printer.js
- [ ] 3.2.2 Create NetworkPrinterConnection class in src/service/connections/network-printer.js
- [ ] 3.2.3 Create SerialPrinterConnection class in src/service/connections/serial-printer.js
- [ ] 3.2.4 Implement printer status detection for all connection types
- [ ] 3.2.5 Add error handling for disconnection, timeout, and network failures
- [ ] 3.2.6 Write unit tests for each connection type

### 3.3 Printer Auto-Detection
- [ ] 3.3.1 Implement detectPrinters method for USB, network, and serial
- [ ] 3.3.2 Implement printer identity query (ESC/POS)
- [ ] 3.3.3 Add caching for detected printers
- [ ] 3.3.4 Write unit tests for printer detection

---

## Phase 4: Management UI

### 4.1 Printer Configuration Page
- [ ] 4.1.1 Create printer configuration UI at /settings/printer
- [ ] 4.1.2 Implement printer list display with status indicators
- [ ] 4.1.3 Implement "Detect Printers" button functionality
- [ ] 4.1.4 Implement printer selection dropdown and "Test Print" button
- [ ] 4.1.5 Implement manual printer addition form
- [ ] 4.1.6 Add real-time status updates via polling

### 4.2 Template Warning System
- [ ] 4.2.1 Add template existence check on service startup
- [ ] 4.2.2 Log WARNING when no template.json exists
- [ ] 4.2.3 Create warning banner in Management UI when no template exists
- [ ] 4.2.4 Add "Generate Template Now" button to warning banner
- [ ] 4.2.5 Update System Tray Icon to show orange/warning color when no template
- [ ] 4.2.6 Add template status indicator to dashboard
- [ ] 4.2.7 Block access to "View Receipts" and "Upload Queue" when no template
- [ ] 4.2.8 Update receipt capture logic to save to failed folder when no template
- [ ] 4.2.9 Skip cloud upload when no template exists
- [ ] 4.2.10 Update installer to open Management UI to template wizard after installation

### 4.3 Virtual Printer Status Dashboard
- [ ] 4.3.1 Add virtual printer status section to main dashboard
- [ ] 4.3.2 Display printer driver status and job counters
- [ ] 4.3.3 Display jobs received/forwarded/failed and average forward time
- [ ] 4.3.4 Display forwarding queue depth
- [ ] 4.3.5 Add "View Failed Jobs" and "Retry Failed Jobs" buttons
- [ ] 4.3.6 Add real-time updates for capture statistics

### 4.4 API Endpoints
- [ ] 4.4.1 Create GET /api/printer/status endpoint
- [ ] 4.4.2 Create GET /api/printers endpoint
- [ ] 4.4.3 Create POST /api/printers/detect endpoint
- [ ] 4.4.4 Create POST /api/printers/test endpoint
- [ ] 4.4.5 Create POST /api/printers/configure endpoint
- [ ] 4.4.6 Create GET /api/queue/forward and POST /api/queue/retry endpoints
- [ ] 4.4.7 Document all API endpoints in OpenAPI/Swagger format

---

## Phase 5: Installer & Migration

### 5.1 Inno Setup Integration
- [ ] 5.1.1 Update installer-pkg.iss to include clawPDF MSI
- [ ] 5.1.2 Add virtual printer installation step to [Run] section
- [ ] 5.1.3 Add administrator privilege check
- [ ] 5.1.4 Update uninstaller to remove "Tabeza POS Printer" profile
- [ ] 5.1.5 Add spool folder creation to installer

### 5.2 Migration Logic
- [ ] 5.2.1 Implement detection of existing pooling printer
- [ ] 5.2.2 Backup config.json and template.json before migration
- [ ] 5.2.3 Preserve queue folder contents during migration
- [ ] 5.2.4 Remove pooling printer and install virtual printer
- [ ] 5.2.5 Add migration success/failure reporting
- [ ] 5.2.6 Write migration script documentation

---

## Phase 6: Testing

### 6.1 Unit Tests
- [ ] 6.1.1 Write unit tests for SpoolWatcher class
- [ ] 6.1.2 Write unit tests for print job processing
- [ ] 6.1.3 Write unit tests for PhysicalPrinterAdapter
- [ ] 6.1.4 Write unit tests for USB, network, and serial printer connections
- [ ] 6.1.5 Write unit tests for printer detection
- [ ] 6.1.6 Achieve 80%+ code coverage

### 6.2 Property-Based Tests
- [ ] 6.2.1 Write property tests for data integrity (capture and forward)
- [ ] 6.2.2 Write property tests for filename uniqueness and job ordering
- [ ] 6.2.3 Write property tests for queue persistence and exponential backoff
- [ ] 6.2.4 Write property tests for queue draining order and round-trip parsing

### 6.3 Integration Tests
- [ ] 6.3.1 Write end-to-end test: capture → forward → parse → upload
- [ ] 6.3.2 Write tests for error scenarios: printer offline, network down, disk full
- [ ] 6.3.3 Write tests for service restart with pending queue
- [ ] 6.3.4 Write tests for crash recovery and concurrent print jobs
- [ ] 6.3.5 Write test for migration from pooling to virtual printer

---

## Phase 7: Documentation

### 7.1 Technical Documentation
- [ ] 7.1.1 Update ARCHITECTURE.md with virtual printer integration details
- [ ] 7.1.2 Create VIRTUAL-PRINTER-INTEGRATION.md guide
- [ ] 7.1.3 Create PRINTER-ADAPTER.md guide
- [ ] 7.1.4 Update API documentation
- [ ] 7.1.5 Create troubleshooting guide
- [ ] 7.1.6 Create migration guide for existing installations
- [ ] 7.1.7 Update README.md with new architecture
- [ ] 7.1.8 Create release notes

### 7.2 User Documentation
- [ ] 7.2.1 Create printer setup guide
- [ ] 7.2.2 Create printer configuration guide
- [ ] 7.2.3 Create troubleshooting FAQ
- [ ] 7.2.4 Update installation guide
- [ ] 7.2.5 Create migration guide for venue owners
- [ ] 7.2.6 Create quick start guide

---

## Phase 8: Monitoring & Maintenance

### 8.1 Monitoring Implementation
- [ ] 8.1.1 Add virtual printer metrics to cloud dashboard
- [ ] 8.1.2 Add forwarding metrics to cloud dashboard
- [ ] 8.1.3 Set up alerts for printer failures
- [ ] 8.1.4 Set up alerts for forwarding failures
- [ ] 8.1.5 Set up alerts for high queue depth
- [ ] 8.1.6 Create monitoring dashboard for support team
- [ ] 8.1.7 Document monitoring procedures

### 8.2 Maintenance Procedures
- [ ] 8.2.1 Create driver update procedure documentation
- [ ] 8.2.2 Create driver rollback procedure documentation
- [ ] 8.2.3 Create log rotation script
- [ ] 8.2.4 Create disk cleanup script
- [ ] 8.2.5 Create printer reconfiguration procedure
- [ ] 8.2.6 Document common issues and solutions
- [ ] 8.2.7 Create escalation procedures

---

## Summary

**Total Phases:** 8  
**Total Tasks:** 65 (code development only)  
**Completed:** 10 tasks (15%)  
**Remaining:** 55 tasks  
**Focus:** Implementation tasks that can be executed without manual testing  
**Approach:** Each task is a concrete code deliverable
