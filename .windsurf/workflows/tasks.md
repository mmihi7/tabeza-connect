---
auto_execution_mode: 2
---
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

### Phase 1: Core Infrastructure (Completed)

### Phase 2: Queue System and Upload Worker (Completed)

### Phase 3: HTTP Server and API Endpoints (Completed)

### Phase 4: Management UI Pages (Completed)

### Phase 5: System Tray Integration (Completed)

### Phase 6: Heartbeat Service (Completed)

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
