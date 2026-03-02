# Implementation Tasks

## Overview

This task list breaks down the implementation of Management UI and missing features for Tabeza Connect v1.7.0 into actionable tasks. Tasks are organized by component and include both implementation and testing work.

## Task Execution Order

Tasks should be executed in the following order to ensure dependencies are met:
1. Core infrastructure (Registry Reader, ESC/POS Stripper, Template Parser)
2. Queue system and Upload Worker
3. HTTP Server and API endpoints
4. Management UI pages
5. System Tray integration
6. Heartbeat Service
7. Installer integration
8. Property-based tests

## Tasks

### Phase 1: Core Infrastructure

- [x] 1. Implement Registry Reader
  - [x] 1.1 Create `src/service/config/registry-reader.js` module
  - [x] 1.2 Implement `readRegistryKey()` using PowerShell Get-ItemProperty
  - [x] 1.3 Implement `readConfigFile()` for config.json parsing
  - [x] 1.4 Implement `loadConfig()` with priority cascade (env → registry → config → defaults)
  - [x] 1.5 Add error handling for registry read failures
  - [x] 1.6 Add error handling for malformed config.json
  - [x] 1.7 Write unit tests for registry reading
  - [x] 1.8 Write unit tests for config file reading
  - [x] 1.9 Write unit tests for priority cascade
  - [x] 1.10 Write property test for Property 1 (Configuration Priority Cascade)
  - [x] 1.11 Write property test for Property 2 (Configuration Fallback Resilience)

- [x] 2. Implement ESC/POS Stripper
  - [x] 2.1 Create `src/service/parser/escpos-stripper.js` module
  - [x] 2.2 Implement `isPrintable()` for ASCII 0x20-0x7E check
  - [x] 2.3 Implement `isNewline()` for 0x0A and 0x0D check
  - [x] 2.4 Implement `strip()` to process buffer byte-by-byte
  - [x] 2.5 Add ESC sequence detection and removal (0x1B + command bytes)
  - [x] 2.6 Add GS sequence detection and removal (0x1D + command bytes)
  - [x] 2.7 Add performance optimization for < 5ms target
  - [x] 2.8 Write unit tests for printable ASCII preservation
  - [x] 2.9 Write unit tests for newline preservation
  - [x] 2.10 Write unit tests for ESC/GS sequence removal
  - [x] 2.11 Write unit tests for empty input handling
  - [x] 2.12 Write property test for Property 3 (ESC/POS Character Preservation)
  - [x] 2.13 Write property test for Property 4 (ESC/POS Control Code Removal)

- [x] 2.14 Implement File Watcher with Chokidar
  - [x] 2.14.1 Configure chokidar to watch order.prn file
  - [x] 2.14.2 Add 1.5-second delay after change detection (wait for POS to finish writing)
  - [x] 2.14.3 Implement debouncing to avoid multiple triggers for same print job
  - [x] 2.14.4 Add error handling for file read failures
  - [x] 2.14.5 Write unit tests for file watcher initialization
  - [x] 2.14.6 Write unit tests for debouncing logic

- [x] 2.15 Implement Post-Processing File Handling
  - [x] 2.15.1 Truncate order.prn to 0 bytes after successful read (file must stay on disk)
  - [x] 2.15.2 Create processed\ folder for successful captures
  - [x] 2.15.3 Archive timestamped copy to processed\YYYYMMDD-HHMMSS.prn on success
  - [x] 2.15.4 Create failed\ folder for failed captures
  - [x] 2.15.5 Archive timestamped copy to failed\YYYYMMDD-HHMMSS.prn on parse error
  - [x] 2.15.6 Add error handling for archive failures (log warning, continue)
  - [x] 2.15.7 Write unit tests for order.prn truncation
  - [x] 2.15.8 Write unit tests for timestamped archiving

- [x] 3. Implement Template Parser
  - [x] 3.1 Create `src/service/parser/template-parser.js` module
  - [x] 3.2 Implement `loadTemplate()` to read template.json from disk
  - [x] 3.3 Implement `parse()` to apply regex patterns to receipt text
  - [x] 3.4 Add item_line pattern extraction (name, qty, price)
  - [x] 3.5 Add total_line pattern extraction
  - [x] 3.6 Add receipt_number pattern extraction
  - [x] 3.7 Implement `calculateConfidence()` based on match success rate
  - [x] 3.8 Implement `validate()` to check total matches sum of items
  - [x] 3.9 Add handling for missing template.json (return parsed: false)
  - [x] 3.10 Add handling for malformed template JSON
  - [x] 3.11 Add performance optimization for < 5ms target
  - [x] 3.12 Write unit tests for parsing with valid template
  - [x] 3.13 Write unit tests for missing template handling
  - [x] 3.14 Write unit tests for confidence calculation
  - [x] 3.15 Write unit tests for total validation
  - [x] 3.16 Write property test for Property 5 (Template Pattern Application)
  - [x] 3.17 Write property test for Property 6 (Confidence Score Calculation)
  - [x] 3.18 Write property test for Property 7 (Receipt Total Validation)
  - [x] 3.19 Write property test for Property 8 (Extracted Item Validation)

### Phase 2: Queue System and Upload Worker

- [x] 4. Implement Queue System
  - [x] 4.1 Create `src/service/queue/queue-manager.js` module
  - [x] 4.2 Implement `enqueue()` to write JSON file with UUID to pending\
  - [x] 4.3 Implement `dequeue()` to read oldest pending file by enqueuedAt
  - [x] 4.4 Implement `markUploaded()` to move file from pending\ to uploaded\
  - [x] 4.5 Implement `markFailed()` to update uploadAttempts and lastUploadError
  - [x] 4.6 Implement `scanPending()` to resume uploads on service restart
  - [x] 4.7 Implement `getStats()` to return pending/uploaded/failed counts
  - [x] 4.8 Add atomic file write (write to temp, rename)
  - [x] 4.9 Add error handling for disk full scenarios
  - [x] 4.10 Add error handling for corrupted queue files
  - [x] 4.11 Write unit tests for enqueue operation
  - [x] 4.12 Write unit tests for dequeue operation
  - [x] 4.13 Write unit tests for markUploaded operation
  - [x] 4.14 Write unit tests for markFailed operation
  - [x] 4.15 Write unit tests for scanPending on restart
  - [x] 4.16 Write property test for Property 9 (Queue File Creation)
  - [x] 4.17 Write property test for Property 13 (Queue Exactly-Once Semantics)

- [x] 5. Implement Upload Worker
  - [x] 5.1 Create `src/service/queue/upload-worker.js` module
  - [x] 5.2 Implement `start()` to begin 2-second polling loop
  - [x] 5.3 Implement `stop()` to gracefully stop worker
  - [x] 5.4 Implement `processNext()` to handle next pending receipt
  - [x] 5.5 Implement `uploadReceipt()` to POST to /api/receipts/ingest
  - [x] 5.6 Implement `getBackoffDelay()` for exponential backoff (5s, 10s, 20s, 40s)
  - [x] 5.7 Add retry logic with max 4 attempts
  - [x] 5.8 Add handling for HTTP 2xx success (move to uploaded\)
  - [x] 5.9 Add handling for HTTP 4xx errors (move to failed\, no retry)
  - [x] 5.10 Add handling for HTTP 5xx errors (retry with backoff)
  - [x] 5.11 Add handling for network timeouts (retry with backoff)
  - [x] 5.12 Add axios configuration with 30s timeout
  - [x] 5.13 Write unit tests for successful upload flow
  - [x] 5.14 Write unit tests for failed upload with retry
  - [x] 5.15 Write unit tests for exponential backoff delays
  - [x] 5.16 Write unit tests for max attempts handling
  - [x] 5.17 Write property test for Property 10 (Upload Success State Transition)
  - [x] 5.18 Write property test for Property 11 (Upload Retry with Exponential Backoff)
  - [x] 5.19 Write property test for Property 12 (Queue Restart Resilience)

### Phase 3: HTTP Server and API Endpoints

- [x] 6. Implement HTTP Server
  - [x] 6.1 Create `src/server/index.js` module
  - [x] 6.2 Implement Express server initialization
  - [x] 6.3 Add CORS middleware for localhost origins
  - [x] 6.4 Add body-parser middleware for JSON
  - [x] 6.5 Implement `registerStatic()` to serve public\ files
  - [x] 6.6 Implement `registerRoutes()` to mount API endpoints
  - [x] 6.7 Implement `start()` to bind to port 8765
  - [x] 6.8 Implement `stop()` to gracefully shutdown server
  - [x] 6.9 Add error handling for port already in use
  - [x] 6.10 Add error middleware for unhandled exceptions
  - [x] 6.11 Add fault isolation (capture service continues if server fails)
  - [x] 6.12 Write unit tests for server startup
  - [x] 6.13 Write unit tests for static file serving
  - [x] 6.14 Write unit tests for CORS headers
  - [x] 6.15 Write property test for Property 16 (HTTP Server Fault Isolation)

- [x] 7. Implement API Endpoints
  - [x] 7.1 Create `src/server/routes/status.js` for GET /api/status
  - [x] 7.2 Implement status endpoint returning service status, job count, last activity, Bar ID, template status
  - [x] 7.3 Create `src/server/routes/config.js` for GET/POST /api/config
  - [x] 7.4 Implement GET /api/config to return current configuration
  - [x] 7.5 Implement POST /api/config to update configuration
  - [x] 7.6 Add validation for Bar ID (non-empty) and API URL (valid HTTPS)
  - [x] 7.7 Create `src/server/routes/logs.js` for GET /api/logs
  - [x] 7.8 Implement logs endpoint to return last 100 lines of service.log
  - [x] 7.9 Create `src/server/routes/test-print.js` for POST /api/test-print
  - [x] 7.10 Implement test-print endpoint to trigger test capture
  - [x] 7.11 Create `src/server/routes/template.js` for template endpoints
  - [x] 7.12 Implement GET /api/template/status to return template existence and version
  - [x] 7.13 Implement POST /api/template/generate to initiate template generation
  - [x] 7.14 Implement GET /api/receipts/recent to return recent captured receipts
  - [x] 7.15 Write unit tests for all API endpoints
  - [x] 7.16 Write unit tests for error responses
  - [x] 7.17 Write property test for Property 17 (Configuration Validation)

### Phase 4: Management UI Pages

- [x] 8. Implement Dashboard Page
  - [x] 8.1 Create `src/server/public/index.html` with dashboard layout
  - [x] 8.2 Create `src/server/public/css/styles.css` with shared styles
  - [x] 8.3 Create `src/server/public/js/dashboard.js` with dashboard logic
  - [x] 8.4 Add service status indicator (green/grey circle)
  - [x] 8.5 Add total jobs processed counter
  - [x] 8.6 Add last activity timestamp display
  - [x] 8.7 Add configured Bar ID display
  - [x] 8.8 Add template status display (exists/missing, version)
  - [x] 8.9 Add API URL display
  - [x] 8.10 Add watch folder path display
  - [x] 8.11 Add navigation links to other pages
  - [x] 8.12 Implement auto-refresh every 5 seconds via polling /api/status
  - [x] 8.13 Add responsive design for desktop browsers
  - [x] 8.14 Write manual tests for dashboard display

- [x] 9. Implement Template Generator Page
  - [x] 9.1 Create `src/server/public/template.html` with modal layout
  - [x] 9.2 Create `src/server/public/js/template.js` with generator logic
  - [x] 9.3 Add modal overlay that appears when template.json missing
  - [x] 9.4 Add 3-step workflow with progress indicator (1/3, 2/3, 3/3)
  - [x] 9.5 Add Step 1 UI: "Print your first test receipt from your POS"
  - [x] 9.6 Add Step 2 UI: "Print a DIFFERENT receipt (different items/prices)"
  - [x] 9.7 Add Step 3 UI: "Print one more DIFFERENT receipt"
  - [x] 9.8 Implement polling /api/receipts/recent every 2 seconds
  - [x] 9.9 Add checkmark display when receipt captured (✓ Receipt N received)
  - [x] 9.10 Add automatic step advancement when receipt detected
  - [x] 9.11 Add loading spinner during template generation
  - [x] 9.12 Implement POST to /api/template/generate with 3 receipts
  - [x] 9.13 Add success message display when template created
  - [x] 9.14 Add error message display with retry button
  - [x] 9.15 Add modal close functionality
  - [x] 9.16 Write manual tests for template generator workflow
  - [x] 9.17 Write property test for Property 18 (Template Generator Order Independence)

- [ ]* 10. Implement Configuration Page (OPTIONAL - Configuration handled automatically)
  - [ ]* 10.1 Create `src/server/public/config.html` with form layout
  - [ ]* 10.2 Create `src/server/public/js/config.js` with configuration logic
  - [ ]* 10.3 Add text input for Bar ID
  - [ ]* 10.4 Add text input for API URL
  - [ ]* 10.5 Add text input for Watch Folder
  - [ ]* 10.6 Add Save button
  - [ ]* 10.7 Implement loading current config from GET /api/config on page load
  - [ ]* 10.8 Implement form submission to POST /api/config
  - [ ]* 10.9 Add client-side validation (Bar ID non-empty, API URL valid HTTPS)
  - [ ]* 10.10 Add success message display
  - [ ]* 10.11 Add error message display
  - [ ]* 10.12 Write manual tests for configuration updates

- [ ]* 11. Implement Log Viewer Page (OPTIONAL - Can view logs via file system)
  - [ ]* 11.1 Create `src/server/public/logs.html` with log display layout
  - [ ]* 11.2 Create `src/server/public/js/logs.js` with log viewer logic
  - [ ]* 11.3 Add monospace text display area
  - [ ]* 11.4 Implement loading logs from GET /api/logs
  - [ ]* 11.5 Add color-coding for log levels (INFO=blue, WARN=yellow, ERROR=red)
  - [ ]* 11.6 Implement auto-refresh every 5 seconds
  - [ ]* 11.7 Add manual refresh button
  - [ ]* 11.8 Implement auto-scroll to bottom on new logs
  - [ ]* 11.9 Add "No logs available" message when file missing
  - [ ]* 11.10 Write manual tests for log viewer

### Phase 5: System Tray Integration

- [x] 12. Implement System Tray
  - [x] 12.1 Create `src/tray/index.js` module (separate process)
  - [x] 12.2 Add electron dependency for tray icon
  - [x] 12.3 Implement `start()` to initialize and show tray icon
  - [x] 12.4 Implement `stop()` to remove tray icon and exit
  - [x] 12.5 Implement `updateIcon()` to switch between green/grey icons
  - [x] 12.6 Implement `pollStatus()` to check /api/status every 10 seconds
  - [x] 12.7 Add context menu with "Open Dashboard" option
  - [x] 12.8 Add context menu with "Send Test Print" option
  - [x] 12.9 Add context menu with "View Logs" option
  - [x] 12.10 Add context menu with "Quit" option
  - [x] 12.11 Implement "Open Dashboard" to open http://localhost:8765 in browser
  - [x] 12.12 Implement "Send Test Print" to POST to /api/test-print
  - [x] 12.13 Implement "View Logs" to open http://localhost:8765/logs in browser
  - [x] 12.14 Implement "Quit" to exit tray process (service continues)
  - [x] 12.15 Add error handling for connection failures
  - [x] 12.16 Create icon assets (icon-green.ico, icon-grey.ico)
  - [x] 12.17 Write manual tests for system tray functionality

### Phase 6: Heartbeat Service

- [x] 13. Implement Heartbeat Service
  - [x] 13.1 Create `src/service/heartbeat/heartbeat-service.js` module
  - [x] 13.2 Implement `generateDriverId()` to format "driver-{HOSTNAME}"
  - [x] 13.3 Implement `start()` to begin 30-second heartbeat loop
  - [x] 13.4 Implement `stop()` to gracefully stop heartbeat
  - [x] 13.5 Implement `sendHeartbeat()` to POST to /api/printer/heartbeat
  - [x] 13.6 Add payload with barId, driverId, version, status: 'online'
  - [x] 13.7 Read version from package.json
  - [x] 13.8 Add error handling for network failures (log warning, retry on next interval)
  - [x] 13.9 Add axios configuration with 10s timeout
  - [x] 13.10 Write unit tests for driver ID generation
  - [x] 13.11 Write unit tests for heartbeat payload structure
  - [x] 13.12 Write unit tests for error handling
  - [x] 13.13 Write property test for Property 14 (Heartbeat Payload Structure)
  - [x] 13.14 Write property test for Property 15 (Driver ID Format)

### Phase 7: Service Integration

- [ ] 14. Integrate Components into Main Service
  - [ ] 14.1 Update `src/service/index.js` to import all components
  - [ ] 14.2 Add Registry Reader initialization at startup
  - [ ] 14.3 Add configuration logging at startup
  - [ ] 14.4 Add driver ID generation and logging
  - [ ] 14.5 Add folder creation (queue\pending\, queue\uploaded\, TabezaPrints\processed\, TabezaPrints\failed\)
  - [ ] 14.6 Initialize chokidar file watcher on order.prn with 1.5s delay
  - [ ] 14.7 Integrate ESC/POS Stripper into file watcher callback
  - [ ] 14.8 Integrate Template Parser after stripping
  - [ ] 14.9 Integrate Queue System enqueue after parsing
  - [ ] 14.10 Add order.prn truncation after successful processing
  - [ ] 14.11 Add timestamped archiving to processed\ or failed\ folders
  - [ ] 14.12 Start Upload Worker after queue initialization
  - [ ] 14.13 Start Heartbeat Service after configuration loaded
  - [ ] 14.14 Start HTTP Server (with fault isolation)
  - [ ] 14.15 Add graceful shutdown handling for all components
  - [ ] 14.16 Write integration tests for end-to-end receipt flow
  - [ ] 14.17 Write integration tests for service restart resilience
  - [ ] 14.18 Write integration tests for order.prn truncation and archiving

### Phase 8: Installer Integration

- [ ] 15. Update Installer
  - [ ] 15.1 Update `installer-pkg.iss` to add 5-second wait after service registration
  - [ ] 15.2 Add [Run] section to open http://localhost:8765 in browser
  - [ ] 15.3 Add registry key creation for system tray auto-start
  - [ ] 15.4 Update registry keys to include BarID, APIUrl, WatchFolder
  - [ ] 15.5 Add TabezaTray.exe to installer files
  - [ ] 15.6 Test installer opens Management UI automatically
  - [ ] 15.7 Test Management UI detects missing template and shows modal
  - [ ] 15.8 Test system tray launches on next login

### Phase 9: Build and Packaging

- [ ] 16. Build Executables
  - [ ] 16.1 Add fast-check, axios, express, cors dependencies to package.json
  - [ ] 16.2 Add electron dependency for tray process
  - [ ] 16.3 Update build-pkg.bat to compile TabezaConnect.exe
  - [ ] 16.4 Add build step for TabezaTray.exe
  - [ ] 16.5 Configure pkg to include src/server/public/ in virtual filesystem
  - [ ] 16.6 Configure pkg to include assets/ in virtual filesystem
  - [ ] 16.7 Test compiled executables run correctly
  - [ ] 16.8 Test Management UI loads from virtual filesystem

### Phase 10: Testing and Validation

- [ ] 17. Manual Testing
  - [ ] 17.1 Test complete installation flow
  - [ ] 17.2 Test template generator 3-step workflow
  - [ ] 17.3 Test receipt capture and parsing
  - [ ] 17.4 Test queue resilience (disconnect network, reconnect)
  - [ ] 17.5 Test service restart with pending receipts
  - [ ] 17.6 Test configuration updates via Management UI
  - [ ] 17.7 Test log viewer displays logs correctly
  - [ ] 17.8 Test system tray icon and menu
  - [ ] 17.9 Test heartbeat service sends status to cloud
  - [ ] 17.10 Test error scenarios (missing template, disk full, network timeout)

- [ ] 18. Property-Based Test Execution
  - [ ] 18.1 Run all property tests with 100+ iterations
  - [ ] 18.2 Verify Property 1: Configuration Priority Cascade
  - [ ] 18.3 Verify Property 2: Configuration Fallback Resilience
  - [ ] 18.4 Verify Property 3: ESC/POS Character Preservation
  - [ ] 18.5 Verify Property 4: ESC/POS Control Code Removal
  - [ ] 18.6 Verify Property 5: Template Pattern Application
  - [ ] 18.7 Verify Property 6: Confidence Score Calculation
  - [ ] 18.8 Verify Property 7: Receipt Total Validation
  - [ ] 18.9 Verify Property 8: Extracted Item Validation
  - [ ] 18.10 Verify Property 9: Queue File Creation
  - [ ] 18.11 Verify Property 10: Upload Success State Transition
  - [ ] 18.12 Verify Property 11: Upload Retry with Exponential Backoff
  - [ ] 18.13 Verify Property 12: Queue Restart Resilience
  - [ ] 18.14 Verify Property 13: Queue Exactly-Once Semantics
  - [ ] 18.15 Verify Property 14: Heartbeat Payload Structure
  - [ ] 18.16 Verify Property 15: Driver ID Format
  - [ ] 18.17 Verify Property 16: HTTP Server Fault Isolation
  - [ ] 18.18 Verify Property 17: Configuration Validation
  - [ ] 18.19 Verify Property 18: Template Generator Order Independence

## Notes

- All property tests must run with minimum 100 iterations
- Each property test must include tag: `Feature: management-ui-and-missing-features, Property {number}: {property_text}`
- HTTP Server failure must not stop Capture Service (fault isolation)
- Queue system must survive service restarts (offline resilience)
- Template parsing must complete in < 5ms for typical receipts
- ESC/POS stripping must complete in < 5ms for typical receipts
- Management UI must be accessible at http://localhost:8765
- System tray must auto-start on user login via registry Run key

### Critical File Handling Requirements

- **order.prn must stay on disk**: After reading, truncate to 0 bytes but never delete the file
- **1.5-second delay**: Wait after file change detection to ensure POS has finished writing
- **Timestamped archives**: Copy to processed\YYYYMMDD-HHMMSS.prn on success, failed\YYYYMMDD-HHMMSS.prn on error
- **Debouncing**: Prevent multiple triggers for the same print job
- **Atomic operations**: Use write-to-temp-then-rename for queue files to prevent corruption
