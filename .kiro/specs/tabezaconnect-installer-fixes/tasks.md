# Implementation Plan: TabezaConnect v1.6.1 Installer Bugfixes

## Overview

This plan fixes five critical bugs in the TabezaConnect v1.6.1 installer by:
1. Removing port creation code from configure-bridge.ps1
2. Adding write-status.ps1 calls to all scripts
3. Ensuring driverId is added to config.json
4. Adding Inno Setup progress page for real-time status
5. Implementing upgrade handling to preserve configuration

All changes are minimal bugfixes to existing scripts and installer configuration.

## Tasks

- [x] 1. Fix configure-bridge.ps1 port configuration
  - Remove port creation code (lines 60-67: "Creating NULL port" section)
  - Replace with: Set printer to use NULL: port directly (Set-Printer -Name $printerInfo.printerName -PortName "NULL:")
  - NULL: is a built-in Windows port, no creation needed
  - Ensure printer name is written to config.json as forwarding target
  - Verify write-status.ps1 call exists at end
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ]* 1.1 Write unit test for configure-bridge.ps1
  - Test that script doesn't create new port
  - Test that printer name appears in config.json
  - Test that status entry is written
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Add missing write-status.ps1 calls to scripts
  - [x] 2.1 Add write-status.ps1 call to create-folders.ps1
    - Add call at end of script with step 1 details
    - _Requirements: 2.1_
  
  - [x] 2.2 Add write-status.ps1 call to detect-thermal-printer.ps1
    - Add call at end of script with step 2 details
    - _Requirements: 2.2_
  
  - [x] 2.3 Add write-status.ps1 call to check-service-started.ps1
    - Add call at end of script with step 5 details
    - Include service status in details
    - _Requirements: 2.5_
  
  - [x] 2.4 Add write-status.ps1 call to verify-bridge.ps1
    - Add call at end of script with step 7 details
    - _Requirements: 2.7_

- [ ]* 2.5 Write property test for complete installation status
  - **Property 1: Complete Installation Status Tracking**
  - **Validates: Requirements 2.8**
  - Test that complete installation has exactly 7 status entries
  - Run full installation and verify installation-status.json

- [x] 3. Test printer forwarding chain on development machine
  - Manually test: Notepad → Print to detected printer → Verify file in C:\TabezaPrints
  - Verify: File contains print job data
  - Test: Out-Printer forwarding to physical printer works
  - Document: Any issues with printer detection or forwarding
  - This validates the core bridge functionality before building installer
  - _Requirements: 1.2, 1.3_

- [x] 3. Fix driverId not being added to config.json
  - Review register-printer-with-api.ps1 config update logic
  - Ensure config is read before adding driverId
  - Ensure all existing fields are preserved
  - Verify UTF-8 encoding is used
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ]* 3.1 Write property test for config field preservation
  - **Property 2: Config Field Preservation on Update**
  - **Validates: Requirements 3.3, 7.2**
  - Test that updating config preserves all existing fields
  - Generate random configs and verify preservation

- [x] 4. Checkpoint - Verify all scripts write status correctly
  - Run each script individually and check installation-status.json
  - Verify all 7 steps write status entries
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Add Inno Setup progress page
  - [x] 5.1 Create Pascal code for progress page
    - Add InitializeWizard procedure to create progress page
    - Create 7 status labels for each installation step
    - Add UpdateStepStatus procedure to update labels
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [x] 5.2 Add status polling logic
    - Add CurStepChanged procedure to poll installation-status.json
    - Parse JSON and update status labels every 500ms
    - Show progress page during ssPostInstall step
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [x] 5.3 Add summary page
    - Display final status of all steps
    - Show success/failure indicators
    - Allow user to proceed to completion
    - _Requirements: 4.4, 4.5_

- [x] 6. Implement upgrade handling
  - [x] 6.1 Add PrepareToInstall function
    - Check for existing TabezaConnect service
    - Stop service if running
    - _Requirements: 7.1_
  
  - [x] 6.2 Add config preservation logic
    - Check for existing config.json
    - Read and store barId and driverId
    - Merge preserved values with new config after installation
    - _Requirements: 7.2_
  
  - [x] 6.3 Add port reuse logic
    - Check for existing printer port
    - Reuse port instead of creating duplicate
    - _Requirements: 7.3_
  
  - [x] 6.4 Add service cleanup logic
    - Remove old service registration before creating new one
    - Restart service with preserved configuration
    - _Requirements: 7.4, 7.5_

- [ ]* 6.5 Write unit tests for upgrade handling
  - Test service stop on upgrade
  - Test config preservation
  - Test port reuse
  - Test service restart
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 7. Update installer-pkg-v1.6.1.iss
  - Add [Code] section with progress page Pascal code
  - Verify all [Run] entries use runhidden flag
  - Ensure progress page script does NOT use runhidden
  - Add upgrade handling code
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 8. Final checkpoint - End-to-end testing
  - Test clean installation on fresh Windows machine
  - Test upgrade from v1.6.0
  - Verify all 7 steps complete and write status
  - Verify progress page displays correctly
  - Verify no PowerShell windows flash
  - Verify config.json has driverId
  - Verify service starts and runs
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Focus on minimal changes to fix specific bugs
- Preserve all existing functionality
