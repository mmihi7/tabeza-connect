# Implementation Plan: TabezaConnect Customer Onboarding Experience

## Overview

This implementation plan covers the complete customer onboarding experience for TabezaConnect, from download through ongoing management. The system operates strictly in Basic mode with POS authority, capturing and mirroring POS receipts without creating financial orders.

Implementation will use JavaScript/Node.js to maintain consistency with the existing printer-service codebase. The plan is organized into 7 phases matching the design document, with clear dependencies and integration points.

## Tasks

- [x] 1. Set up project structure and core configuration
  - Create directory structure for TabezaConnect components
  - Set up package.json with required dependencies (electron, express, better-sqlite3, node-windows)
  - Create configuration schema with CORE TRUTH enforcement (venueMode: 'basic', authorityMode: 'pos')
  - Set up environment configuration for development and production
  - _Requirements: Design sections "Components and Interfaces", "Data Models"_

- [-] 2. Implement Configuration Manager module
  - [x] 2.1 Create ConfigurationManager class with load/save methods
    - Implement JSON file loading from %APPDATA%\Tabeza\config.json
    - Implement configuration validation with CORE TRUTH checks
    - Add encryption for sensitive data (API keys, driver credentials)
    - _Requirements: Design "Component 8: Configuration Manager", "Model 1: TabezaConnectConfig"_
  
  - [ ]* 2.2 Write unit tests for ConfigurationManager
    - Test config loading and saving
    - Test validation rules (barId format, venueMode='basic', authorityMode='pos')
    - Test encryption/decryption
    - Test backup and restore functionality
    - _Requirements: Design "Testing Strategy - Unit Testing Approach"_
  
  - [ ] 2.3 Implement template management methods
    - Add loadTemplate() and saveTemplate() methods
    - Implement template versioning
    - Add template validation (regex pattern compilation)
    - _Requirements: Design "Model 3: ParsingTemplate"_

- [x] 3. Implement Bar ID validation API integration
  - [x] 3.1 Create Bar ID validation service
    - Implement API call to Tabeza Cloud: POST /bars/:barId/validate
    - Verify venue exists and is configured for Basic mode
    - Return clear error messages for invalid Bar IDs
    - _Requirements: Design "Function 1: validateBarId()"_
  
  - [ ]* 3.2 Write unit tests for Bar ID validation
    - Test valid Bar ID acceptance
    - Test invalid Bar ID rejection
    - Test network error handling
    - Test timeout scenarios
    - _Requirements: Design "Testing Strategy"_

- [x] 4. Checkpoint - Verify configuration and validation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Inno Setup installer
  - [x] 5.1 Create installer script with Bar ID input screen
    - Extend existing TabezaConnect.iss with custom Bar ID input page
    - Add Bar ID validation during installation
    - Implement installation progress tracking
    - _Requirements: Design "Component 2: Inno Setup Installer"_
  
  - [x] 5.2 Add service installation to installer
    - Install Node.js service using node-windows
    - Configure service to run as Local System
    - Set up auto-start on Windows boot
    - Create desktop and start menu shortcuts
    - _Requirements: Design "Component 2: Inno Setup Installer"_
  
  - [ ]* 5.3 Test installer on clean Windows 10/11 systems
    - Test successful installation flow
    - Test Bar ID validation during install
    - Test service installation and startup
    - Test rollback on installation failure
    - _Requirements: Design "Testing Strategy - Integration Testing Approach"_

- [x] 6. Implement Node.js background service
  - [x] 6.1 Create main service entry point
    - Set up Express server on port 8765
    - Implement service lifecycle (start, stop, restart)
    - Add heartbeat mechanism (POST /printer/heartbeat every 30 seconds)
    - _Requirements: Design "Component 3: Node.js Background Service"_

  
  - [x] 6.2 Implement Windows Printer Pooling capture
    - Integrate SimpleCapture module for printer pooling mode
    - Configure to monitor capture file at C:\TabezaPrints\order.prn
    - Set up Windows printer with two ports: primary (physical thermal/USB printer) + secondary (file port)
    - Implement 3-check stability algorithm (3 checks × 100ms delay) to ensure complete file writes
    - Copy stable files to temp folder (C:\TabezaPrints\captures\) with unique timestamps
    - Enqueue receipts with ESC/POS bytes in base64 format (cloud will parse)
    - Handle file stability, permissions errors, and queue full scenarios
    - _Requirements: Design "Component 3: Node.js Background Service", SimpleCapture implementation_

  
  - [x] 6.3 Integrate with existing receiptParser
    - Import receiptParser from packages/printer-service/lib/receiptParser.js
    - Call parseReceipt() with captured text and template
    - Handle parsing results and confidence levels
    - _Requirements: Design "Component 5: Receipt Parser Module"_
  
  - [ ]* 6.4 Write unit tests for service components
    - Test service startup and shutdown
    - Test heartbeat mechanism
    - Test spooler file detection
    - Test text extraction from spool files
    - _Requirements: Design "Testing Strategy - Unit Testing Approach"_

- [-] 7. Implement local queue manager with SQLite
  - [x] 7.1 Create SQLite database schema
    - Create receipts table with fields: id, barId, rawText, parsedData, status, retryCount, capturedAt
    - Create indexes for efficient querying (status, capturedAt)
    - Set up WAL mode for concurrent access
    - _Requirements: Design "Component 7: Local Queue Manager", "Model 2: CapturedReceipt"_
  
  - [ ] 7.2 Implement QueueManager class
    - Add add(), getPending(), markUploaded(), markFailed() methods
    - Implement queue statistics tracking
    - Add cleanup for old uploaded receipts (30 days)
    - _Requirements: Design "Component 7: Local Queue Manager"_
  
  - [ ]* 7.3 Write unit tests for QueueManager
    - Test receipt addition to queue
    - Test status transitions (pending → uploaded/failed)
    - Test retry count tracking
    - Test queue statistics
    - _Requirements: Design "Testing Strategy - Unit Testing Approach"_

- [ ] 8. Checkpoint - Verify core service functionality
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement upload worker with retry logic
  - [ ] 9.1 Create UploadWorker class
    - Implement queue processing loop (every 5 seconds)
    - Add exponential backoff for retries (5s, 10s, 20s)
    - Implement batch uploads for efficiency (when queue > 10)
    - _Requirements: Design "Function 5: uploadParsedReceipt()", "Upload Worker Algorithm"_
  
  - [ ] 9.2 Integrate with Tabeza Cloud API
    - Implement POST /api/printer/relay endpoint call
    - Send parsed receipt data with barId and driverId
    - Handle success and error responses
    - _Requirements: Design "Component 3: Node.js Background Service"_
  
  - [ ]* 9.3 Write unit tests for upload worker
    - Test successful upload flow
    - Test retry logic with exponential backoff
    - Test network error handling
    - Test queue processing
    - _Requirements: Design "Testing Strategy - Unit Testing Approach"_

- [ ] 10. Implement DeepSeek API integration for template generation
  - [ ] 10.1 Create TemplateGenerator class
    - Implement generate() method calling DeepSeek API
    - Parse AI response into ParsingTemplate structure
    - Validate generated regex patterns
    - _Requirements: Design "Function 3: generateParsingTemplate()", "Component 6: Template Generator"_
  
  - [ ] 10.2 Add template testing functionality
    - Implement test() method to validate template against sample receipts
    - Calculate confidence scores (high/medium/low)
    - Provide detailed test results with issues
    - _Requirements: Design "Function 4: testParsingTemplate()"_
  
  - [ ] 10.3 Implement fallback to default template
    - Handle API failures gracefully
    - Load default template from packages/printer-service/lib/receiptParser.js
    - Log API errors for debugging
    - _Requirements: Design "Error Scenario 6: DeepSeek API Failure"_
  
  - [ ]* 10.4 Write unit tests for template generation
    - Test successful template generation
    - Test regex pattern validation
    - Test fallback to default template
    - Test template testing functionality
    - _Requirements: Design "Testing Strategy - Unit Testing Approach"_

- [ ] 11. Implement Electron system tray application
  - [ ] 11.1 Create Electron main process
    - Set up Electron app with system tray icon
    - Implement tray icon states (green/yellow/red/gray)
    - Add context menu with actions
    - _Requirements: Design "Component 4: Electron System Tray Application"_
  
  - [ ] 11.2 Implement tray menu actions
    - Add "Test Receipt Capture" action
    - Add "View Captured Receipts" action
    - Add "Open Configuration" action
    - Add "Restart Service" action
    - Add "View Logs" action
    - _Requirements: Design "Component 4: Electron System Tray Application"_
  
  - [ ] 11.3 Create notification system
    - Implement showNotification() for events (receipt captured, upload success/failure)
    - Add notification preferences to configuration
    - _Requirements: Design "Component 4: Electron System Tray Application"_
  
  - [ ] 11.4 Implement status monitoring
    - Poll service status endpoint (GET /status) every 10 seconds
    - Update tray icon based on service status
    - Display queue statistics in menu
    - _Requirements: Design "Model 4: ServiceStatus"_
  
  - [ ]* 11.5 Write integration tests for tray application
    - Test tray icon creation and visibility
    - Test menu actions
    - Test notification display
    - Test status updates
    - _Requirements: Design "Testing Strategy - Integration Testing Approach"_

- [ ] 12. Checkpoint - Verify UI and service integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Implement receipt testing workflow
  - [ ] 13.1 Create test receipt capture UI
    - Build Electron window with instructions for printing test receipt
    - Show real-time capture status
    - Display captured receipt text
    - _Requirements: Design "Phase 4: Receipt Testing Workflow"_
  
  - [ ] 13.2 Add test receipt endpoint to service
    - Implement POST /test-capture endpoint
    - Trigger manual capture test
    - Return captured receipt data
    - _Requirements: Design "Component 3: Node.js Background Service - API Endpoints"_
  
  - [ ]* 13.3 Write integration tests for receipt testing
    - Test receipt capture from POS print
    - Test UI display of captured receipt
    - Test error handling for capture failures
    - _Requirements: Design "Testing Strategy - Integration Testing Approach"_

- [ ] 14. Implement template generation UI workflow
  - [ ] 14.1 Create template generation wizard
    - Build multi-step wizard: upload sample → generate → preview → test → approve
    - Show template generation progress
    - Display generated regex patterns
    - _Requirements: Design "Phase 5: Template Generation"_
  
  - [ ] 14.2 Add template preview and editing
    - Display template fields with regex patterns
    - Allow manual editing of patterns
    - Validate patterns on edit
    - _Requirements: Design "Component 6: Template Generator"_
  
  - [ ] 14.3 Implement template testing UI
    - Upload multiple test receipts
    - Show parsing results for each receipt
    - Display confidence scores and issues
    - _Requirements: Design "Phase 6: Parser Approval"_
  
  - [ ] 14.4 Add template approval flow
    - Implement approve button with confirmation
    - Save approved template to configuration
    - Restart service with new template
    - _Requirements: Design "Phase 6: Parser Approval"_
  
  - [ ]* 14.5 Write integration tests for template workflow
    - Test complete template generation flow
    - Test template editing and validation
    - Test template testing with sample receipts
    - Test template approval and service restart
    - _Requirements: Design "Testing Strategy - Integration Testing Approach"_

- [ ] 15. Implement ongoing management features
  - [ ] 15.1 Create receipt history viewer
    - Build UI to display captured receipts (today, week, month)
    - Show receipt details (raw text, parsed data, status)
    - Add filtering and search functionality
    - _Requirements: Design "Phase 7: Ongoing Management"_
  
  - [ ] 15.2 Implement configuration editor
    - Build UI for editing configuration settings
    - Add validation for configuration changes
    - Implement save and restart flow
    - _Requirements: Design "Component 8: Configuration Manager"_
  
  - [ ] 15.3 Create log viewer
    - Display service logs (service.log, upload.log, errors.log)
    - Add log filtering by level and timestamp
    - Implement log export functionality
    - _Requirements: Design "Component 7: Local Queue Manager - Queue Structure"_
  
  - [ ]* 15.4 Write integration tests for management features
    - Test receipt history display
    - Test configuration editing
    - Test log viewing and filtering
    - _Requirements: Design "Testing Strategy - Integration Testing Approach"_

- [ ] 16. Checkpoint - Verify complete UI functionality
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Implement error handling and recovery
  - [ ] 17.1 Add error handling for all error scenarios
    - Implement handlers for all 10 error scenarios from design
    - Add clear error messages and recovery instructions
    - Implement automatic recovery where possible
    - _Requirements: Design "Error Handling" section (all 10 scenarios)_
  
  - [ ] 17.2 Create diagnostic tools
    - Build check-spooler-permissions.bat script
    - Create kill-port-8765.bat for port conflicts
    - Add configuration validation tool
    - _Requirements: Design "Error Scenario 2, 3"_
  
  - [ ]* 17.3 Write tests for error scenarios
    - Test invalid Bar ID handling
    - Test service installation failure recovery
    - Test network connectivity loss
    - Test disk space exhaustion
    - _Requirements: Design "Testing Strategy - Integration Testing Approach"_

- [ ] 18. Implement security measures
  - [ ] 18.1 Add data encryption
    - Encrypt sensitive configuration data (API keys)
    - Use HTTPS for all API communications
    - Implement certificate validation
    - _Requirements: Design "Security Considerations - Data Protection"_
  
  - [ ] 18.2 Implement access controls
    - Set NTFS permissions on configuration files
    - Restrict queue directory access to service account
    - Run service as Local System with minimum privileges
    - _Requirements: Design "Security Considerations - Access Control"_
  
  - [ ]* 18.3 Write security tests
    - Test configuration encryption
    - Test HTTPS certificate validation
    - Test file permission restrictions
    - _Requirements: Design "Security Considerations"_

- [ ] 19. Implement performance optimizations
  - [ ] 19.1 Optimize receipt capture
    - Use chokidar file watcher instead of polling
    - Implement debouncing for file stability
    - Use streaming for large files
    - _Requirements: Design "Performance Considerations - Receipt Capture Performance"_
  
  - [ ] 19.2 Optimize parsing and upload
    - Compile regex patterns once at startup
    - Implement batch uploads for queue > 10
    - Add compression for receipt data
    - _Requirements: Design "Performance Considerations - Parsing Performance, Upload Performance"_
  
  - [ ] 19.3 Implement memory management
    - Add queue size limits (max 1000 pending)
    - Clean up uploaded receipts after 30 days
    - Use streaming for large files
    - _Requirements: Design "Performance Considerations - Memory Management"_
  
  - [ ]* 19.4 Write performance tests
    - Test receipt capture latency (< 2 seconds)
    - Test parsing time (< 100ms per receipt)
    - Test upload time (< 1 second per receipt)
    - Test memory usage (< 150MB peak)
    - _Requirements: Design "Performance Considerations" - all target metrics_

- [ ] 20. Checkpoint - Verify performance and security
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 21. Create Wix download page
  - [ ] 21.1 Design download page layout
    - Create hero section with Tabeza branding
    - Add prominent download button with version and file size
    - Display system requirements checklist
    - _Requirements: Design "Component 1: Wix Download Page"_
  
  - [ ] 21.2 Add installation instructions
    - Create step-by-step installation guide
    - Add FAQ section
    - Include troubleshooting tips
    - _Requirements: Design "Component 1: Wix Download Page"_
  
  - [ ] 21.3 Implement download tracking
    - Add analytics for download button clicks
    - Track download completion rates
    - _Requirements: Design "Component 1: Wix Download Page - Responsibilities"_

- [ ] 22. Create user documentation
  - [ ] 22.1 Write installation guide
    - Document system requirements
    - Provide step-by-step installation instructions
    - Include screenshots for each step
    - _Requirements: Design "Component 2: Inno Setup Installer"_
  
  - [ ] 22.2 Write user manual
    - Document all features and workflows
    - Provide troubleshooting guide
    - Include FAQ section
    - _Requirements: Design "Phase 7: Ongoing Management"_
  
  - [ ] 22.3 Create video tutorials
    - Record installation walkthrough
    - Record receipt testing workflow
    - Record template generation process
    - _Requirements: Design "Overview" - user experience focus_

- [ ] 23. Implement end-to-end integration tests
  - [ ]* 23.1 Write complete onboarding flow test
    - Test installer execution with Bar ID validation
    - Test service installation and startup
    - Test receipt capture from POS
    - Test template generation and approval
    - Test receipt upload to cloud
    - _Requirements: Design "Testing Strategy - Integration Testing Approach - Test Scenario 1"_
  
  - [ ]* 23.2 Write offline-to-online flow test
    - Test service operation without network
    - Test receipt queuing locally
    - Test automatic upload on reconnection
    - _Requirements: Design "Testing Strategy - Integration Testing Approach - Test Scenario 2"_
  
  - [ ]* 23.3 Write template generation flow test
    - Test sample receipt upload
    - Test DeepSeek API integration
    - Test template validation and testing
    - Test template approval and application
    - _Requirements: Design "Testing Strategy - Integration Testing Approach - Test Scenario 3"_

- [ ] 24. Final checkpoint - Complete system verification
  - Run all unit tests and verify 80%+ coverage
  - Run all integration tests
  - Run end-to-end tests on clean Windows systems
  - Verify CORE TRUTH enforcement (venueMode='basic', authorityMode='pos')
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 25. Prepare for deployment
  - [ ] 25.1 Build production installer
    - Compile Node.js service to executable using pkg
    - Package Electron app with electron-builder
    - Create Inno Setup installer with all components
    - _Requirements: Design "Dependencies - Build Tools"_
  
  - [ ] 25.2 Sign installer with code signing certificate
    - Obtain code signing certificate
    - Sign TabezaConnect-Setup.exe
    - Verify signature
    - _Requirements: Design "Security Considerations - Code Security"_
  
  - [ ] 25.3 Upload installer to hosting
    - Upload to Wix downloads server
    - Update download page with new version
    - Test download link
    - _Requirements: Design "Component 1: Wix Download Page"_
  
  - [ ] 25.4 Create release notes
    - Document new features
    - List bug fixes
    - Include upgrade instructions
    - _Requirements: Design "Component 1: Wix Download Page - UI Elements"_

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- All tasks reference specific design sections for traceability
- Checkpoints ensure incremental validation at key milestones
- Implementation uses JavaScript/Node.js for consistency with existing printer-service
- CORE TRUTH enforcement: venueMode='basic', authorityMode='pos' (POS is digital authority)
- TabezaConnect ONLY mirrors POS receipts, NEVER creates financial orders
- Integration points with existing code:
  - packages/printer-service/lib/receiptParser.js (receipt parsing)
  - apps/staff/app/api/printer/relay/route.ts (receipt upload endpoint)
  - Existing Inno Setup script at TabezaConnect.iss
- All file paths use Windows conventions (backslashes, %APPDATA%, C:\ProgramData)
- Service runs on port 8765 (ensure no conflicts)
- SQLite database uses WAL mode for concurrent access
- Heartbeat interval: 30 seconds to Tabeza Cloud
- Queue processing interval: 5 seconds
- Maximum retry attempts: 3 with exponential backoff
