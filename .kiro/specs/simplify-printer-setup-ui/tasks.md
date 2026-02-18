# Implementation Plan: Simplify Printer Setup UI

## Overview

This plan implements a simplified printer setup experience by removing redundant UI elements and making printer registration fully automatic via heartbeat. The implementation focuses on consolidating printer UI into a single section, removing manual configuration buttons, and providing clear status indicators with automatic detection.

## Tasks

- [ ] 1. Create simplified PrinterStatus component
  - [x] 1.1 Create new PrinterStatus.tsx component with automatic detection
    - Implement status calculation logic (online/connecting/offline based on heartbeat)
    - Add Supabase realtime subscription for printer_drivers table
    - Add polling fallback (15 second interval)
    - Implement contextual UI based on status (online shows details, offline shows troubleshooting)
    - Add reconnect button for offline state
    - Add test print button for online state
    - _Requirements: 1.3, 2.1, 2.2, 2.3, 2.4, 3.1, 3.3, 5.1_
  
  - [ ]* 1.2 Write property test for status indicator correctness
    - **Property 1: Status Indicator Correctness**
    - **Validates: Requirements 2.2**
  
  - [ ]* 1.3 Write property test for offline troubleshooting display
    - **Property 2: Offline Troubleshooting Display**
    - **Validates: Requirements 3.1**
  
  - [ ]* 1.4 Write unit tests for PrinterStatus component
    - Test status icon rendering for each state
    - Test driver details visibility
    - Test troubleshooting content display
    - Test button visibility based on status
    - _Requirements: 2.2, 2.3, 2.4, 3.1, 5.1_

- [ ] 2. Update Settings page to use simplified printer UI
  - [x] 2.1 Remove "Printer Setup" tab from Settings navigation
    - Remove tab button from tab list
    - Remove tab content section
    - _Requirements: 1.4, 2.1_
  
  - [x] 2.2 Add printer status section to Venue Configuration tab
    - Add PrinterStatus component within Venue Configuration
    - Show only when printer_required === true
    - Position after configuration summary, before mode change controls
    - _Requirements: 2.1_
  
  - [x] 2.3 Remove all "Auto-Configure Printer Service" buttons
    - Remove from Printer Setup tab (being deleted)
    - Remove from Venue Configuration tab
    - Remove handleAutoConfigurePrinter function
    - Remove configuringPrinter state
    - _Requirements: 1.4_
  
  - [ ]* 2.4 Write unit tests for Settings page printer section
    - Test printer section only shows when printer_required is true
    - Test printer section hidden for Venue+Tabeza mode
    - Test "Auto-Configure" button is removed
    - _Requirements: 1.4, 2.1_

- [ ] 3. Implement reconnect functionality
  - [x] 3.1 Create reconnect API endpoint
    - Create /api/printer/reconnect route
    - Validate barId parameter
    - Check current driver status
    - Return status and guidance message
    - _Requirements: 5.1, 5.2_
  
  - [x] 3.2 Add reconnect handler to PrinterStatus component
    - Call reconnect API on button click
    - Show loading state during request
    - Display success/error feedback
    - Update status after reconnect
    - _Requirements: 5.2, 5.3, 5.4_
  
  - [ ]* 3.3 Write property test for reconnect action trigger
    - **Property 3: Reconnect Action Trigger**
    - **Validates: Requirements 5.2, 5.4**
  
  - [ ]* 3.4 Write property test for immediate feedback display
    - **Property 4: Immediate Feedback Display**
    - **Validates: Requirements 5.3**

- [ ] 4. Update home page printer status display
  - [x] 4.1 Replace PrinterStatusIndicator with PrinterStatus in home page
    - Update import statement
    - Pass required props (barId, venueMode, authorityMode)
    - Use compact mode for header display
    - _Requirements: 2.1, 2.2_
  
  - [ ]* 4.2 Write unit tests for home page printer display
    - Test printer status shows in compact mode
    - Test printer status only shows for Basic and Venue+POS modes
    - _Requirements: 2.1, 2.2_

- [ ] 5. Clean up legacy printer setup code
  - [x] 5.1 Remove old PrinterStatusIndicator component
    - Delete apps/staff/components/PrinterStatusIndicator.tsx
    - Update all imports to use new PrinterStatus component
    - _Requirements: 2.1_
  
  - [x] 5.2 Remove printer setup page
    - Delete apps/staff/app/setup/printer/page.tsx (if exists)
    - Remove any routes to printer setup page
    - _Requirements: 1.4, 2.1_
  
  - [x] 5.3 Update onboarding flows to remove manual printer configuration
    - Remove printer configuration step from BasicSetup component
    - Update to show "printer will connect automatically" message
    - Remove DriverInstallationGuidance manual configuration UI
    - _Requirements: 1.4_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6.1 Apply printer_drivers table migration
  - Run database/create-printer-drivers-table.sql in Supabase
  - Verify table exists with correct schema
  - Verify indexes and RLS policies are created
  - Test heartbeat by checking table populates within 30 seconds
  - _Requirements: 4.2, 4.5_
  - _Note: This is CRITICAL - without this table, heartbeats fail and printer status shows offline_

- [ ] 7. Update documentation and user guidance
  - [ ] 7.1 Update printer setup documentation
    - Document automatic heartbeat mechanism
    - Update troubleshooting guide with new UI
    - Add screenshots of simplified printer status
    - _Requirements: 3.2_
  
  - [ ] 7.2 Create migration guide for existing users
    - Explain removal of "Auto-Configure" button
    - Clarify that existing installations continue working
    - Document new status indicators
    - _Requirements: 1.4_

- [ ] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The simplified UI removes redundant configuration steps while maintaining all functionality
- Existing TabezaConnect installations continue working without changes
- No database schema changes required
