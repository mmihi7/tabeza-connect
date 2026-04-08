# Implementation Tasks: Redmon-Based Receipt Capture

## Overview

This task list implements the Redmon-based receipt capture system that replaces the failed printer pooling and clawPDF approaches. The implementation follows a phased approach to ensure each component is tested before integration.

## Task Breakdown

### Phase 1: Cleanup and Preparation

- [x] 1. Remove Failed Implementation Code
  - [x] 1.1 Delete clawPDF integration code
  - [x] 1.2 Delete printer pooling code
  - [x] 1.3 Remove obsolete configuration files
  - [x] 1.4 Update documentation to remove references

- [x] 2. Setup Redmon Integration Infrastructure
  - [x] 2.1 Download Redmon installer (v1.9+)
  - [x] 2.2 Create Redmon installation script
  - [x] 2.3 Add Redmon to installer assets
  - [x] 2.4 Create printer configuration PowerShell script

### Phase 2: Core Capture Components

- [x] 3. Implement ESC/POS Textifier Module
  - [x] 3.1 Create textifier module with Windows-1252 decoding
  - [x] 3.2 Implement ESC/POS control code stripping
  - [x] 3.3 Implement whitespace normalization
  - [x] 3.4 Add unit tests for textifier
  - [x] 3.5 Add property-based tests for textifier

- [x] 4. Implement Template-Based Parser Module
  - [x] 4.1 Create parser module with template loading
  - [x] 4.2 Implement regex pattern matching
  - [x] 4.3 Implement confidence score calculation
  - [x] 4.4 Add structured JSON output generation
  - [x] 4.5 Add unit tests for parser
  - [x] 4.6 Add property-based tests for parser

- [x] 5. Implement Capture Script
  - [x] 5.1 Create capture script entry point
  - [x] 5.2 Implement stdin reading
  - [x] 5.3 Implement raw file saving
  - [x] 5.4 Integrate textifier module
  - [x] 5.5 Integrate parser module
  - [x] 5.6 Add error handling and logging
  - [x] 5.7 Package as standalone executable with pkg

### Phase 3: Upload and Forwarding

- [x] 6. Implement Upload Worker
  - [x] 6.1 Create upload worker with queue polling
  - [x] 6.2 Implement exponential backoff retry logic
  - [x] 6.3 Implement queue file management (pending/uploaded)
  - [x] 6.4 Add cloud API integration (/api/receipts/ingest)
  - [x] 6.5 Add queue persistence across restarts
  - [x] 6.6 Add unit tests for upload worker
  - [x] 6.7 Add integration tests for upload flow

- [x] 7. Implement Physical Printer Forwarder
  - [x] 7.1 Create printer forwarder module
  - [x] 7.2 Implement USB printer communication (serialport)
  - [x] 7.3 Implement network printer communication (raw TCP)
  - [x] 7.4 Implement retry logic with exponential backoff
  - [x] 7.5 Add failed print job handling
  - [x] 7.6 Add unit tests for printer forwarder
  - [x] 7.7 Add integration tests for printer forwarding

- [x] 8. Implement Template Cache Manager
  - [x] 8.1 Create template cache manager module
  - [x] 8.2 Implement template download from cloud API
  - [x] 8.3 Implement template validation
  - [x] 8.4 Implement template caching logic
  - [x] 8.5 Add daily update check scheduler
  - [x] 8.6 Add offline fallback to cached template
  - [x] 8.7 Add unit tests for template cache manager

### Phase 4: Installation and Configuration

- [x] 9. Update Installer for Redmon
  - [x] 9.1 Add Redmon silent installation step
  - [x] 9.2 Create printer with Generic/Text Only driver
  - [x] 9.3 Configure Redmon port to pipe to capture script
  - [x] 9.4 Set capture script path and arguments
  - [x] 9.5 Test printer creation on Windows 10
  - [x] 9.6 Test printer creation on Windows 11

- [ ]* 10. Implement Configuration Migration (OPTIONAL - Not needed for launch)
  - [ ]* 10.1 Detect existing installations (pooling/clawPDF)
  - [ ]* 10.2 Backup existing config.json and template.json
  - [ ]* 10.3 Remove old printer configurations
  - [ ]* 10.4 Migrate Bar ID to new configuration
  - [ ]* 10.5 Preserve captured receipts in processed/
  - [ ]* 10.6 Implement rollback on migration failure
  - [ ]* 10.7 Add migration tests

- [x] 11. Implement Physical Printer Configuration UI
  - [x] 11.1 Add printer configuration page to Management UI
  - [x] 11.2 List available printers (USB, network, serial)
  - [x] 11.3 Add manual network printer IP entry
  - [x] 11.4 Implement test print functionality
  - [x] 11.5 Save printer configuration to config.json
  - [x] 11.6 Add configuration reload on file change

### Phase 5: Management UI Integration

- [x] 12. Implement Template Generation Wizard
  - [x] 12.1 Create template generation wizard UI
  - [x] 12.2 Add 3-step receipt capture flow
  - [x] 12.3 Implement real-time receipt detection
  - [x] 12.4 Add cloud API integration (/api/receipts/generate-template)
  - [x] 12.5 Save generated template to template.json
  - [x] 12.6 Display success message with sample parsed receipt
  - [x] 12.7 Add error handling and retry logic

- [x] 13. Update Management UI Dashboard
  - [x] 13.1 Add Redmon status indicator
  - [x] 13.2 Display queue status (pending/uploaded counts)
  - [x] 13.3 Add offline mode indicator
  - [x] 13.4 Display last capture timestamp
  - [x] 13.5 Add template version and last update info
  - [x] 13.6 Display printer status (online/offline)

- [ ] 14. Implement Log Viewer Enhancements
  - [ ] 14.1 Add component filter (capture, textify, parse, upload, forward)
  - [ ] 14.2 Add event type filter
  - [ ] 14.3 Display last 1000 log entries
  - [ ] 14.4 Add real-time log streaming
  - [ ] 14.5 Add log export functionality

### Phase 6: Testing and Validation

- [ ] 15. Implement Property-Based Tests
  - [ ] 15.1 Property 1: Complete Data Capture
  - [ ] 15.2 Property 2: Processing Pipeline Completeness
  - [ ] 15.3 Property 3: Filename Format Consistency
  - [ ] 15.4 Property 4: ESC/POS Textification Correctness
  - [ ] 15.5 Property 5: Template-Based Parsing
  - [ ] 15.6 Property 6: Template Caching and Validation
  - [ ] 15.7 Property 7: Upload Queue Persistence
  - [ ] 15.8 Property 8: Exponential Backoff Retry
  - [ ] 15.9 Property 9: Physical Printer Forwarding
  - [ ] 15.10 Property 10: Offline Operation Continuity
  - [ ] 15.11 Property 11: Configuration Migration Preservation
  - [ ] 15.12 Property 12: Comprehensive Operation Logging

- [ ] 16. Implement Integration Tests
  - [ ] 16.1 End-to-end print job flow test
  - [ ] 16.2 Offline operation and sync test
  - [ ] 16.3 Configuration reload test
  - [ ] 16.4 Error recovery scenarios test
  - [ ] 16.5 Migration from pooling test
  - [ ] 16.6 Migration from clawPDF test

- [ ] 17. Implement Performance Tests
  - [ ] 17.1 Capture latency benchmark (< 50ms)
  - [ ] 17.2 Textify latency benchmark (< 10ms)
  - [ ] 17.3 Parse latency benchmark (< 50ms)
  - [ ] 17.4 Forward latency benchmark (< 200ms)
  - [ ] 17.5 End-to-end latency benchmark (< 100ms)
  - [ ] 17.6 Throughput test (≥ 10 receipts/second)
  - [ ] 17.7 Memory usage test (< 200MB)
  - [ ] 17.8 CPU usage test (< 5%)
  - [ ] 17.9 Burst test (100 receipts in 10 seconds)
  - [ ] 17.10 Sustained test (10 receipts/second for 1 hour)
  - [ ] 17.11 Queue stress test (1000 pending receipts)
  - [ ] 17.12 Long-running test (7 days continuous operation)

### Phase 7: Security and Reliability

- [ ] 18. Implement Security Features
  - [ ] 18.1 Encrypt Bar ID with Windows DPAPI
  - [ ] 18.2 Implement HTTPS-only cloud API communication
  - [ ] 18.3 Restrict Management UI to localhost only
  - [ ] 18.4 Implement input validation for configuration
  - [ ] 18.5 Implement stdin data size validation
  - [ ] 18.6 Redact sensitive data in logs
  - [ ] 18.7 Set file permissions on capture folders
  - [ ] 18.8 Add security tests

- [ ] 19. Implement Logging and Diagnostics
  - [ ] 19.1 Add structured logging with winston
  - [ ] 19.2 Log all capture operations with metrics
  - [ ] 19.3 Log textification results
  - [ ] 19.4 Log parsing results with confidence
  - [ ] 19.5 Log upload attempts with HTTP status
  - [ ] 19.6 Log forwarding attempts with printer status
  - [ ] 19.7 Implement log rotation (daily, 30 days retention)
  - [ ] 19.8 Limit log file size to 10MB

- [ ] 20. Implement Error Handling
  - [ ] 20.1 Handle stdin read failures
  - [ ] 20.2 Handle disk space low scenarios
  - [ ] 20.3 Handle file write failures
  - [ ] 20.4 Handle print job size exceeding 1MB
  - [ ] 20.5 Handle template missing scenarios
  - [ ] 20.6 Handle low confidence parses
  - [ ] 20.7 Handle network timeouts
  - [ ] 20.8 Handle printer offline scenarios
  - [ ] 20.9 Add error recovery tests

### Phase 8: Documentation and Deployment

- [ ] 21. Update Documentation
  - [ ] 21.1 Update ARCHITECTURE.md with Redmon approach
  - [ ] 21.2 Create troubleshooting guide
  - [ ] 21.3 Create installation guide
  - [ ] 21.4 Create configuration guide
  - [ ] 21.5 Update API documentation
  - [ ] 21.6 Create developer setup guide

- [ ] 22. Implement Uninstaller
  - [ ] 22.1 Stop Tabeza Connect service
  - [ ] 22.2 Remove "Tabeza Agent"
  - [ ] 22.3 Optionally uninstall Redmon
  - [ ] 22.4 Prompt to keep or delete captured data
  - [ ] 22.5 Remove registry entries
  - [ ] 22.6 Remove system tray icon from startup
  - [ ] 22.7 Create final backup before deletion

- [ ] 23. Prepare for Deployment
  - [ ] 23.1 Build installer package
  - [ ] 23.2 Test installer on clean Windows 10 machine
  - [ ] 23.3 Test installer on clean Windows 11 machine
  - [ ] 23.4 Test upgrade from pooling version
  - [ ] 23.5 Test upgrade from clawPDF version
  - [ ] 23.6 Create release notes
  - [ ] 23.7 Prepare rollback plan

### Phase 9: Cloud API Integration

- [ ] 24. Implement Cloud API Endpoints
  - [ ] 24.1 Create /api/receipts/ingest endpoint
  - [ ] 24.2 Create /api/receipts/template/{barId} endpoint
  - [ ] 24.3 Create /api/receipts/generate-template endpoint
  - [ ] 24.4 Add request validation
  - [ ] 24.5 Add response formatting
  - [ ] 24.6 Add error handling
  - [ ] 24.7 Add API tests
  - [ ] 24.8 Update API documentation

## Task Dependencies

### Critical Path
1 → 2 → 3 → 4 → 5 → 6 → 7 → 9 → 16 → 23

### Parallel Tracks
- Track A (Core): 3, 4, 5
- Track B (Workers): 6, 7, 8
- Track C (UI): 11, 12, 13, 14
- Track D (Testing): 15, 16, 17
- Track E (Security): 18, 19, 20
- Track F (Cloud): 24

## Success Criteria

The implementation is complete when:

1. ✅ All failed code (pooling, clawPDF) removed
2. ✅ Redmon installed and configured automatically
3. ✅ Capture script processes print jobs end-to-end
4. ✅ Textifier strips ESC/POS codes correctly
5. ✅ Parser extracts structured data with confidence scores
6. ✅ Upload worker syncs receipts to cloud
7. ✅ Printer forwarder sends jobs to physical printer
8. ✅ Template cache manager handles offline operation
9. ✅ Management UI displays status and allows configuration
10. ✅ All property-based tests pass (100 iterations each)
11. ✅ All integration tests pass
12. ✅ Performance benchmarks met
13. ✅ Security features implemented and tested
14. ✅ Documentation complete
15. ✅ Installer tested on Windows 10 and 11
16. ✅ Migration from old systems tested

## Notes

- Each task should be completed and tested before moving to the next
- Property-based tests must run with minimum 100 iterations
- All tests must be tagged with feature name and property number
- Performance benchmarks must be met before deployment
- Security features are non-negotiable and must be implemented
- Documentation must be updated as implementation progresses
