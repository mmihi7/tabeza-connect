# Requirements Document

## Introduction

This specification addresses critical bugs in the TabezaConnect v1.6.1 installer that prevent complete installation tracking and proper configuration. The v1.6.1 installer has the core functionality working (service starts, printer registers in Supabase), but has specific failures that need fixing:

1. **Port configuration bug**: configure-bridge.ps1 still has port creation code that should be removed (v1.5.1 worked correctly)
2. **Status tracking bug**: Only step 1 writes to installation-status.json, steps 2-7 fail silently
3. **Config update bug**: driverId field not being added to config.json despite successful API registration
4. **UI visibility bug**: No installation checklist displayed to user (not even at end)
5. **PowerShell windows**: Scripts show visible windows during installation

This is a bugfix spec to restore v1.5.1 functionality and complete the v1.6.1 feature set.

**Context**: TabezaConnect uses a silent bridge architecture where:
- POS prints to a thermal printer configured with a folder port (C:\TabezaPrints\)
- Each print job creates a separate file in the capture folder
- The bridge service (final-bridge.js) watches the folder, uploads receipts to Tabeza cloud, and forwards to the physical printer
- The installer must configure this bridge correctly for the forwarding system to work

**Core Truth**: In POS-authoritative mode (Tabeza Basic), the physical printer is the source of authority. The bridge MUST forward every receipt to the physical printer - digital capture is secondary. If forwarding fails, the receipt must still print physically. This aligns with the principle: "Manual service always exists. Digital authority is singular. Tabeza adapts to the venue — never the reverse."

## Glossary

- **TabezaConnect**: Windows service that captures POS receipt data and syncs with Tabeza cloud
- **Installer**: Inno Setup-based installation package that configures the TabezaConnect service
- **Bridge**: Silent component that redirects printer output to file capture folder
- **Folder Port**: Windows Local Port configured to write each print job as a separate file to C:\TabezaPrints\
- **Installation Status**: JSON file tracking completion of installation steps
- **Driver ID**: Unique identifier for printer driver registration in Tabeza API
- **Supabase**: Backend database service hosting printer_drivers table
- **Print Spooler**: Windows service managing print jobs
- **POS**: Point of Sale system that generates receipts
- **Critical Step**: Installation step whose failure prevents the service from functioning (steps 1-5)
- **Non-Critical Step**: Installation step whose failure is logged but doesn't prevent service operation (steps 6-7)

## Requirements

### Requirement 1: Fix Port Configuration in configure-bridge.ps1

**User Story:** As a venue owner, I want the installer to use the correct port configuration approach, so that receipt capture works reliably without errors.

#### Acceptance Criteria

1. WHEN configure-bridge.ps1 runs, THE System SHALL remove the port creation code that attempts to create a new port
2. WHEN the printer is configured, THE System SHALL use the folder port approach (Local Port to C:\TabezaPrints\)
3. WHEN the bridge configuration completes, THE System SHALL write the detected printer name to config.json as the forwarding target
4. WHEN the bridge configuration completes, THE System SHALL write step 3 status to installation-status.json
5. WHEN the print spooler is restarted, THE System SHALL wait for spooler to be fully running before proceeding
6. WHEN port configuration completes, THE System SHALL verify the printer status is Normal or Ready

### Requirement 2: Fix Missing Status Writes in All Scripts

**User Story:** As a venue owner, I want to see which installation steps complete successfully, so that I can troubleshoot failures and verify successful installation.

#### Acceptance Criteria

1. WHEN create-folders.ps1 completes, THE System SHALL call write-status.ps1 with step 1 details
2. WHEN detect-thermal-printer.ps1 completes, THE System SHALL call write-status.ps1 with step 2 details
3. WHEN configure-bridge.ps1 completes, THE System SHALL call write-status.ps1 with step 3 details (already exists)
4. WHEN register-service-pkg.ps1 completes, THE System SHALL call write-status.ps1 with step 4 details (already exists)
5. WHEN check-service-started.ps1 completes, THE System SHALL call write-status.ps1 with step 5 details
6. WHEN register-printer-with-api.ps1 completes, THE System SHALL call write-status.ps1 with step 6 details (already exists)
7. WHEN verify-bridge.ps1 completes, THE System SHALL call write-status.ps1 with step 7 details
8. WHEN all steps complete, THE System SHALL have 7 status entries in installation-status.json

### Requirement 3: Fix driverId Not Being Added to config.json

**User Story:** As a venue owner, I want my printer's driver ID saved in the config file, so that the service can identify itself to the Tabeza API.

#### Acceptance Criteria

1. WHEN register-printer-with-api.ps1 successfully registers the printer, THE System SHALL read the existing config.json
2. WHEN updating config.json, THE System SHALL add the driverId field to the root level of the JSON object
3. WHEN updating config.json, THE System SHALL preserve all existing fields (barId, apiUrl, bridge, service, sync)
4. WHEN config.json is written, THE System SHALL use UTF-8 encoding
5. WHEN the service starts, THE System SHALL be able to read the driverId from config.json

### Requirement 4: Add Installation Checklist UI

**User Story:** As a venue owner, I want to see installation progress in a professional interface, so that I know the installer is working and not frozen.

#### Acceptance Criteria

1. WHEN installation runs, THE System SHALL display an Inno Setup progress page showing all 7 steps
2. WHEN each step begins, THE System SHALL update the progress page to show the step is in progress
3. WHEN each step completes, THE System SHALL update the progress page with ✅ (success) or ❌ (failure)
4. WHEN installation completes, THE System SHALL show a summary page with all step statuses
5. WHEN the user clicks Next, THE System SHALL proceed to the completion page

### Requirement 5: Hide PowerShell Windows During Installation

**User Story:** As a venue owner, I want a clean installation experience without flashing windows, so that the installation looks professional.

#### Acceptance Criteria

1. WHEN installation scripts run, THE System SHALL hide all PowerShell windows except the checklist
2. WHEN the Inno Setup [Run] section executes scripts, THE System SHALL use the runhidden flag
3. WHEN the checklist script runs, THE System SHALL NOT use the runhidden flag (user needs to see it)
4. WHEN scripts write to installation-status.json, THE System SHALL do so without displaying output windows
5. WHEN installation completes, THE System SHALL only show the checklist window to the user

### Requirement 6: Error Handling and Recovery

**User Story:** As a venue owner, I want clear error messages when installation fails, so that I can fix issues and retry installation.

#### Acceptance Criteria

1. WHEN a script fails, THE System SHALL capture the error message and write it to installation-status.json
2. WHEN a critical step fails (steps 1-5), THE System SHALL display the error in the checklist
3. WHEN a non-critical step fails (steps 6-7), THE System SHALL log the error and continue installation
4. WHEN installation completes with errors, THE System SHALL display which steps failed in the checklist
5. WHEN an error occurs, THE System SHALL include the error details in the status JSON for debugging

### Requirement 7: Upgrade and Reinstallation Handling

**User Story:** As a venue owner, I want to upgrade or reinstall TabezaConnect without losing my configuration, so that I can fix issues or update versions easily.

#### Acceptance Criteria

1. WHEN the installer detects an existing TabezaConnect service, THE System SHALL stop it before proceeding
2. WHEN the installer detects an existing config.json, THE System SHALL preserve the barId and driverId fields
3. WHEN the installer detects an existing printer port, THE System SHALL reuse it instead of creating a duplicate
4. WHEN reinstalling, THE System SHALL remove the old service registration before creating a new one
5. WHEN upgrade completes, THE System SHALL restart the service with the preserved configuration

## Special Requirements Guidance

### Parser and Serializer Requirements

This feature involves JSON parsing and serialization for:
- installation-status.json (installation step tracking)
- config.json (service configuration)
- detected-printer.json (printer detection results)

**JSON Handling Requirements**:

1. WHEN reading JSON files, THE System SHALL handle missing or malformed files gracefully
2. WHEN writing JSON files, THE System SHALL use UTF-8 encoding
3. WHEN updating JSON files, THE System SHALL preserve existing structure and fields
4. FOR ALL valid JSON objects, parsing then serializing then parsing SHALL produce equivalent objects (round-trip property)

### Printer Configuration Requirements

The printer configuration must use the folder port approach for reliable receipt capture:

1. WHEN configuring the printer port, THE System SHALL create a Local Port pointing to C:\TabezaPrints\
2. THE System SHALL configure the port to create one file per print job
3. WHEN the printer is reconfigured, THE System SHALL restart the print spooler
4. WHEN the spooler restarts, THE System SHALL wait for it to reach Running status before proceeding
5. THE System SHALL NOT use the NULL: port or attempt to capture from the Windows spooler directory
