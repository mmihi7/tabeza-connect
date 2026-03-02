# Implementation Plan: Auto-Configure Tabeza Pooling Printer

## Overview

This implementation plan breaks down the automatic printer pooling configuration feature into discrete, actionable tasks. The feature will create a PowerShell-based configuration script that automatically detects thermal printers, creates the "Tabeza POS Printer" with dual-port configuration, and integrates with the Inno Setup installer.

The implementation follows a bottom-up approach: build core utilities first, then detection logic, then configuration logic, then validation, and finally installer integration. Each task includes specific requirements references and property test annotations where applicable.

## Tasks

- [x] 1. Set up PowerShell script structure and logging infrastructure
  - Create `src/installer/scripts/configure-pooling-printer.ps1` with parameter definitions
  - Implement `Write-Log` function with file and console output to `C:\ProgramData\Tabeza\logs\configure-pooling.log`
  - Implement log rotation (10MB max size)
  - Add timestamp formatting (ISO 8601)
  - Support log levels: INFO, WARN, ERROR
  - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 2. Implement privilege and service validation functions
  - [x] 2.1 Create `Test-AdminPrivileges` function
    - Use `[Security.Principal.WindowsPrincipal]` to check admin status
    - Return boolean result
    - _Requirements: 11.2_
  
  - [x] 2.2 Create `Test-PrintSpoolerRunning` function
    - Query Print Spooler service status using `Get-Service`
    - Attempt to start service if stopped
    - Return boolean result with error details
    - _Requirements: 8.5_
  
  - [x] 2.3 Add privilege validation at script entry point
    - Exit with code 4 if not admin
    - Display error message requesting elevation
    - _Requirements: 11.3_

- [x] 3. Implement thermal printer detection module
  - [x] 3.1 Create `Get-ThermalPrinters` function
    - Query all printers using `Get-Printer`
    - Exclude patterns: Microsoft Print to PDF, Fax, OneNote, XPS, Adobe PDF, Tabeza POS Printer
    - Score printers by thermal keywords: Receipt, Thermal, POS, TM-, RP-, Epson, Star, Citizen, Bixolon, Sam4s
    - Return highest scoring printer
    - Log all detected printers with scores
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [ ]* 3.2 Write property test for thermal printer detection exclusion
    - **Property 1: Thermal Printer Detection Exclusion**
    - **Validates: Requirements 1.1, 1.2**
    - Generate random printer sets including excluded patterns
    - Verify excluded printers are never returned
    - Run 100 iterations
  
  - [ ]* 3.3 Write property test for thermal printer prioritization
    - **Property 2: Thermal Printer Prioritization**
    - **Validates: Requirements 1.3**
    - Generate random sets of thermal printers with varying keyword matches
    - Verify highest scoring printer is always selected
    - Run 100 iterations
  
  - [x] 3.4 Create `Get-PrinterPortName` function
    - Query printer port using `Get-Printer` PortName property
    - Handle multiple ports (comma-separated)
    - Return primary physical port
    - _Requirements: 1.4_
  
  - [x] 3.5 Create `Get-PrinterDriverName` function
    - Query printer driver using `Get-Printer` DriverName property
    - Verify driver exists using `Get-PrinterDriver`
    - Return driver name or throw error if missing
    - _Requirements: 2.2_
  
  - [x] 3.6 Handle no thermal printer detected scenario
    - Exit with code 3
    - Display error message with troubleshooting steps
    - List all detected printers in error message
    - _Requirements: 1.5_

- [x] 4. Implement capture directory and port configuration module
  - [x] 4.1 Create `New-CaptureDirectory` function
    - Check if directory exists
    - Create directory if missing using `New-Item`
    - Grant Print Spooler service write permissions using `icacls`
    - Verify permissions were applied
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 4.2 Create `New-LocalCapturePort` function
    - Check if port exists using `Get-PrinterPort`
    - Verify existing port points to correct file path
    - Remove and recreate if path is incorrect
    - Create new port using `Add-PrinterPort` with file path
    - Enable bidirectional support
    - _Requirements: 2.4, 3.4, 3.5, 3.6_
  
  - [ ]* 4.3 Write property test for local port file path
    - **Property 6: Local Port File Path**
    - **Validates: Requirements 2.4, 3.4**
    - Generate random capture file paths
    - Create ports and verify PrinterHostAddress matches
    - Run 100 iterations
  
  - [ ]* 4.4 Write property test for port configuration idempotency
    - **Property 11: Port Configuration Idempotency**
    - **Validates: Requirements 3.5**
    - Create port, verify, recreate with same path
    - Create port, verify, recreate with different path
    - Verify correct behavior in both cases
    - Run 100 iterations

- [ ] 5. Implement printer creation and configuration module
  - [x] 5.1 Create `New-TabezaPOSPrinter` function
    - Verify driver exists before creation
    - Verify capture port exists (must be created first by New-LocalCapturePort)
    - Create printer with thermal printer port as primary port using `Add-Printer`
    - Configure printer pooling using WMI (NOT Add-PrinterPort - that's for TCP/IP only):
      - Get printer via WMI: `Get-WmiObject -Class Win32_Printer`
      - Disable "Print Directly to Printer": `$printerWMI.DoCompleteFirst = $false`
      - Enable bidirectional support: `$printerWMI.EnableBIDI = $true`
      - Set port list (thermal first, capture second): `$printerWMI.PortName = "$PhysicalPort,$CapturePort"`
      - Apply changes: `$printerWMI.Put()`
    - Set printer as not shared using `Set-Printer`
    - Verify final configuration (must have exactly 2 ports)
    - Log each configuration step with port details
    - CRITICAL: Thermal printer port MUST be first in the pool for seamless printing
    - _Requirements: 2.1, 2.2, 2.3, 2.6_
  
  - [ ]* 5.2 Write property test for driver inheritance
    - **Property 4: Driver Inheritance**
    - **Validates: Requirements 2.2**
    - Generate random printer/driver combinations
    - Create Tabeza POS Printer and verify driver matches
    - Run 100 iterations
  
  - [ ]* 5.3 Write property test for dual-port configuration
    - **Property 5: Dual-Port Configuration**
    - **Validates: Requirements 2.3, 6.1**
    - Create printer with two ports
    - Verify exactly two ports are configured
    - Verify one is physical, one is capture
    - Run 100 iterations
  
  - [ ]* 5.4 Write property test for printer sharing disabled
    - **Property 8: Printer Sharing Disabled**
    - **Validates: Requirements 2.6**
    - Create printer and verify Shared property is false
    - Run 100 iterations
  
  - [x] 5.5 Handle printer creation errors
    - Catch driver not found errors
    - Catch port not accessible errors
    - Catch printer name conflicts
    - Display specific error messages for each case
    - _Requirements: 8.2_

- [x] 6. Implement default printer preservation logic
  - [x] 6.1 Create `Get-DefaultPrinter` function
    - Query default printer using WMI or registry
    - Return printer name or null if none set
    - _Requirements: 4.1_
  
  - [x] 6.2 Create `Restore-DefaultPrinter` function
    - Set default printer using `(New-Object -ComObject WScript.Network).SetDefaultPrinter()`
    - Handle errors gracefully (log as warning, not fatal)
    - _Requirements: 4.2_
  
  - [ ]* 6.3 Write property test for default printer round-trip
    - **Property 12: Default Printer Round-Trip**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 7.5**
    - Record default printer before configuration
    - Run configuration
    - Verify default printer is unchanged
    - Test with various default printer scenarios
    - Run 100 iterations

- [x] 7. Implement configuration validation module
  - [x] 7.1 Create `Test-PoolingConfiguration` function
    - Verify printer exists using `Get-Printer`
    - Verify both ports are configured
    - Verify physical port is accessible
    - Verify capture file is writable by Print Spooler
    - Attempt test write to capture file
    - Return hashtable with validation results and errors
    - _Requirements: 6.1, 6.2, 6.3, 6.5_
  
  - [ ]* 7.2 Write property test for local port writability
    - **Property 14: Local Port Writability**
    - **Validates: Requirements 6.3**
    - Create port and capture file
    - Verify Print Spooler can write test data
    - Run 100 iterations
  
  - [ ]* 7.3 Write property test for capture file update on print
    - **Property 13: Capture File Update on Print**
    - **Validates: Requirements 5.3**
    - Send test print job to Tabeza POS Printer
    - Verify capture file size or timestamp changed
    - Run 100 iterations
  
  - [x] 7.4 Create `Test-CaptureFileUpdate` function
    - Send test print job using `Out-Printer`
    - Monitor capture file for changes
    - Return success/failure with details
    - Mark as non-fatal if printer is offline
    - _Requirements: 6.4_
  
  - [ ]* 7.5 Write property test for validation error messages
    - **Property 15: Validation Error Messages**
    - **Validates: Requirements 6.5**
    - Simulate various validation failures
    - Verify specific error messages are generated
    - Run 100 iterations

- [x] 8. Implement idempotency and self-healing logic
  - [x] 8.1 Create `Test-TabezaPrinterExists` function
    - Check if Tabeza POS Printer already exists
    - Return boolean result
    - _Requirements: 2.5, 7.1_
  
  - [x] 8.2 Create `Test-TabezaPrinterConfiguration` function
    - Verify existing printer has correct driver
    - Verify existing printer has correct ports
    - Verify existing printer is not shared
    - Return configuration status (valid/invalid)
    - _Requirements: 7.2_
  
  - [ ]* 8.3 Write property test for configuration idempotency
    - **Property 7: Configuration Idempotency**
    - **Validates: Requirements 2.5, 7.1, 7.3**
    - Run configuration twice
    - Verify no duplicates created
    - Verify second run exits successfully
    - Run 100 iterations
  
  - [ ]* 8.4 Write property test for configuration self-healing
    - **Property 16: Configuration Self-Healing**
    - **Validates: Requirements 7.2**
    - Create printer with incorrect configuration
    - Run configuration script
    - Verify configuration is corrected
    - Run 100 iterations
  
  - [ ]* 8.5 Write property test for capture data preservation
    - **Property 17: Capture Data Preservation**
    - **Validates: Requirements 7.4**
    - Create capture file with test data
    - Run reconfiguration
    - Verify file contents are preserved
    - Run 100 iterations

- [x] 9. Implement rollback and error recovery module
  - [x] 9.1 Create `Remove-TabezaPOSPrinter` function
    - Remove Tabeza POS Printer using `Remove-Printer`
    - Remove TabezaCapturePort using `Remove-PrinterPort`
    - Log rollback actions
    - Handle errors gracefully (already removed is success)
    - _Requirements: 8.4_
  
  - [ ]* 9.2 Write property test for configuration rollback
    - **Property 18: Configuration Rollback**
    - **Validates: Requirements 8.4**
    - Simulate failure after partial configuration
    - Verify all created resources are removed
    - Verify system returns to original state
    - Run 100 iterations
  
  - [x] 9.3 Implement rollback on validation failure
    - Call `Remove-TabezaPOSPrinter` if validation fails
    - Restore original default printer
    - Exit with code 1
    - _Requirements: 8.4_
  
  - [x] 9.4 Handle directory creation failures
    - Catch permission errors
    - Catch disk space errors
    - Display specific error message with path and issue
    - Exit with code 1
    - _Requirements: 8.3_

- [x] 10. Implement main orchestration logic
  - [x] 10.1 Create main script flow
    - Parse command-line parameters
    - Validate admin privileges
    - Verify Print Spooler is running
    - Detect thermal printer
    - Record default printer
    - Check if Tabeza POS Printer exists
    - Create or validate configuration
    - Restore default printer
    - Validate final configuration
    - Log success and exit with code 0
    - _Requirements: All_
  
  - [ ]* 10.2 Write property test for comprehensive error logging
    - **Property 19: Comprehensive Error Logging**
    - **Validates: Requirements 6.6, 8.5, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6**
    - Run various configuration scenarios
    - Verify all operations are logged with timestamps
    - Verify appropriate log levels are used
    - Run 100 iterations
  
  - [ ]* 10.3 Write property test for admin privilege precondition
    - **Property 21: Admin Privilege Precondition**
    - **Validates: Requirements 11.2**
    - Simulate non-admin execution
    - Verify exit code 4 is returned
    - Verify no printer operations are attempted
    - Run 100 iterations

- [ ] 11. Checkpoint - Ensure all unit tests pass
  - Run all unit tests in `src/installer/scripts/__tests__/configure-pooling-printer.tests.ps1`
  - Verify all property tests pass
  - Fix any failing tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Integrate with Inno Setup installer
  - [x] 12.1 Update Inno Setup script to call PowerShell configuration
    - Add `[Run]` section entry for `configure-pooling-printer.ps1`
    - Pass `-CaptureFilePath "C:\TabezaPrints\order.prn"` parameter
    - Set `Flags: runhidden waituntilterminated`
    - Add `Check: IsAdminInstallMode` condition
    - _Requirements: 11.1_
  
  - [x] 12.2 Add error handling in Inno Setup
    - Check PowerShell exit code in `CurStepChanged` procedure
    - Display error message if exit code is not 0 or 2
    - Allow installation to continue (printer config is optional)
    - Log error to installer log
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [x] 12.3 Add uninstaller support
    - Create `uninstall-pooling-printer.ps1` script
    - Remove Tabeza POS Printer
    - Remove TabezaCapturePort
    - Preserve capture file data
    - Add `[UninstallRun]` section entry in Inno Setup
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 13. Create property test generators and test infrastructure
  - [ ] 13.1 Create `New-RandomPrinterName` generator
    - Generate realistic thermal printer names
    - Include various brands and models
    - _Testing infrastructure_
  
  - [ ] 13.2 Create `New-RandomPortName` generator
    - Generate USB, LPT, COM, IP port names
    - Follow Windows port naming conventions
    - _Testing infrastructure_
  
  - [ ] 13.3 Create `New-RandomCapturePath` generator
    - Generate valid Windows file paths
    - Include various drives and folder names
    - _Testing infrastructure_
  
  - [ ] 13.4 Create mock helpers for Windows printer APIs
    - Mock `Get-Printer`, `Add-Printer`, `Remove-Printer`
    - Mock `Get-PrinterPort`, `Add-PrinterPort`, `Remove-PrinterPort`
    - Mock `Get-PrinterDriver`
    - Allow property tests to run without actual printer hardware
    - _Testing infrastructure_

- [ ] 14. Write unit tests for edge cases and error scenarios
  - [ ] 14.1 Test no thermal printers detected
    - Mock `Get-Printer` to return only PDF/Fax printers
    - Verify exit code 3
    - Verify error message includes troubleshooting steps
    - _Requirements: 1.5_
  
  - [ ] 14.2 Test physical printer offline scenario
    - Configure Tabeza POS Printer
    - Disconnect physical printer (mock)
    - Verify capture file still updates
    - _Requirements: 5.5_
  
  - [ ] 14.3 Test insufficient permissions error
    - Mock admin check to return false
    - Verify exit code 4
    - Verify error message requests elevation
    - _Requirements: 8.1, 11.3_
  
  - [ ] 14.4 Test missing driver error
    - Mock `Get-PrinterDriver` to return null
    - Verify exit code 1
    - Verify error message includes driver installation instructions
    - _Requirements: 8.2_
  
  - [ ] 14.5 Test directory creation failure
    - Mock directory creation to fail with permission error
    - Verify exit code 1
    - Verify error message includes specific path and issue
    - _Requirements: 8.3_

- [x] 15. Create integration test script
  - [x] 15.1 Create `test-pooling-configuration.ps1` integration test
    - Set up clean test environment
    - Install test thermal printer driver
    - Run configuration script
    - Verify Tabeza POS Printer is created
    - Verify default printer is preserved
    - Send test print job
    - Verify capture file is updated
    - Clean up test environment
    - _Integration testing_
  
  - [x] 15.2 Test upgrade scenario
    - Simulate existing v1.6.x installation
    - Run v1.7.0 configuration
    - Verify idempotent behavior
    - _Integration testing_
  
  - [x] 15.3 Test multiple printers scenario
    - Install 3 different thermal printer drivers
    - Run configuration
    - Verify correct printer is selected
    - _Integration testing_

- [ ] 16. Create documentation and user guides
  - [ ] 16.1 Update POOLING-MODE-SETUP.md
    - Document automatic configuration process
    - Add troubleshooting section
    - Include manual configuration fallback instructions
    - _Documentation_
  
  - [ ] 16.2 Create configuration log analysis guide
    - Document log file location
    - Explain log entry format
    - Provide common error patterns and solutions
    - _Documentation_
  
  - [ ] 16.3 Update installer README
    - Document new automatic printer configuration feature
    - Explain exit codes
    - Provide manual configuration instructions
    - _Documentation_

- [ ] 17. Final checkpoint - End-to-end validation
  - Test on Windows 10 (21H2)
  - Test on Windows 11 (22H2)
  - Test with EPSON TM-T20 printer
  - Test with Star TSP100 printer
  - Test with generic thermal printer
  - Verify all property tests pass
  - Verify all unit tests pass
  - Verify integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties across all valid configurations
- Unit tests validate specific examples and edge cases
- Checkpoints ensure incremental validation at key milestones
- The implementation follows a bottom-up approach: utilities → detection → configuration → validation → integration
- All PowerShell scripts should follow Windows PowerShell best practices (approved verbs, proper error handling, pipeline support)
- Mock Windows printer APIs in tests to avoid requiring actual printer hardware
- Integration tests should run in isolated test environments (VMs) to avoid affecting production systems
