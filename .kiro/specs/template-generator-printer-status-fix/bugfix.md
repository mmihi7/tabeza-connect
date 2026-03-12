# Bugfix Requirements Document

## Introduction

This document specifies the requirements for fixing multiple bugs in the Tabeza Connect application related to template generation, printer configuration, and receipt capture. The bugs affect the user's ability to set up the system and generate receipt parsing templates.

The Tabeza Connect application is a Windows desktop application that captures receipts from POS systems using a virtual printer (Redmon), parses them, and uploads them to the cloud. The application consists of:
- Electron-based management UI (dashboard and template generator)
- Node.js background service for receipt capture
- PowerShell scripts for printer configuration
- Redmon virtual printer integration

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the user opens the template generator page THEN the system displays "Printer: Not configured" even though the dashboard shows "Printer: ✅ Tabeza POS Printer" and the printer actually exists in Windows

1.2 WHEN the user opens the template generator page THEN the system displays a "Generate Template" button instead of the guided 3-step real-time workflow (Print receipt 1 → wait → Print receipt 2 → wait → Print receipt 3 → auto-generate)

1.3 WHEN the dashboard calls the IPC handler `check-printer-setup` THEN it receives a response with status "FullyConfigured" but the template generator calling the same handler receives a different response showing "Not configured"

1.4 WHEN receipts are captured and queued in `C:\TabezaPrints\queue\pending\` THEN the template generator does not detect them and does not show "✓ Receipt received" feedback

1.5 WHEN the IPC handler `check-printer-setup` executes the PowerShell script `printer-pooling-setup.ps1` THEN it checks for printer pooling configuration but the actual printer uses Redmon, causing incorrect status detection

### Expected Behavior (Correct)

2.1 WHEN the user opens the template generator page THEN the system SHALL display the same printer status as the dashboard ("Printer: ✅ Tabeza POS Printer" when the printer exists in Windows)

2.2 WHEN the user opens the template generator page and no template exists THEN the system SHALL display a guided 3-step workflow with real-time feedback: "Step 1/3: Print your first test receipt" → detects receipt in queue → "✓ Receipt 1 received" → "Step 2/3: Print a DIFFERENT receipt" → detects receipt → "✓ Receipt 2 received" → "Step 3/3: Print one more DIFFERENT receipt" → detects receipt → "✓ Receipt 3 received" → auto-generates template

2.3 WHEN any UI component calls the IPC handler `check-printer-setup` THEN it SHALL receive a consistent response indicating whether the "Tabeza POS Printer" exists in Windows (checking via `Get-Printer` cmdlet)

2.4 WHEN receipts are captured and queued in `C:\TabezaPrints\queue\pending\` THEN the template generator SHALL poll the queue folder every 2 seconds and display "✓ Receipt X received" for each new receipt detected

2.5 WHEN the IPC handler `check-printer-setup` executes THEN it SHALL check for the actual "Tabeza POS Printer" existence using `Get-Printer` cmdlet instead of checking for printer pooling configuration

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the dashboard displays printer status THEN the system SHALL CONTINUE TO show the correct status based on actual printer existence

3.2 WHEN the user saves Bar ID configuration THEN the system SHALL CONTINUE TO persist the configuration to config.json and update the UI

3.3 WHEN the background service captures a receipt THEN the system SHALL CONTINUE TO process it with ESC/POS stripping, template parsing, and cloud upload

3.4 WHEN the user opens the dashboard THEN the system SHALL CONTINUE TO display all status information (Bar ID, printer status, template status)

3.5 WHEN the HTTP server starts on port 8765 THEN the system SHALL CONTINUE TO serve the management UI and API endpoints

3.6 WHEN the installer completes THEN the system SHALL CONTINUE TO open the browser to localhost:8765 for initial configuration

## Bug Condition Analysis

### Bug Condition 1: Printer Status Inconsistency

**Bug Condition Function:**
```pascal
FUNCTION isBugCondition1(X)
  INPUT: X of type UIComponentRequest
  OUTPUT: boolean
  
  // Returns true when template generator requests printer status
  RETURN X.component = "template-generator" AND X.action = "check-printer-status"
END FUNCTION
```

**Property Specification:**
```pascal
// Property: Fix Checking - Consistent Printer Status
FOR ALL X WHERE isBugCondition1(X) DO
  dashboardStatus ← checkPrinterStatus(dashboard)
  templateGenStatus ← checkPrinterStatus(template-generator)
  ASSERT dashboardStatus = templateGenStatus
END FOR
```

**Preservation Goal:**
```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition1(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

### Bug Condition 2: Receipt Capture Not Working

**Bug Condition Function:**
```pascal
FUNCTION isBugCondition2(X)
  INPUT: X of type PrintJob
  OUTPUT: boolean
  
  // Returns true when print job sent to Tabeza POS Printer
  RETURN X.printerName = "Tabeza POS Printer" AND X.portName = "TabezaCapturePort"
END FUNCTION
```

**Property Specification:**
```pascal
// Property: Fix Checking - Receipt Captured and Processed
FOR ALL X WHERE isBugCondition2(X) DO
  result ← processPrintJob'(X)
  capturedFile ← checkProcessedFolder(X.timestamp)
  ASSERT capturedFile EXISTS AND 
         result.captured = true AND
         result.processingTime < 3000ms
END FOR
```

**Preservation Goal:**
```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition2(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

### Bug Condition 3: Template Generator UI Flow

**Bug Condition Function:**
```pascal
FUNCTION isBugCondition3(X)
  INPUT: X of type TemplateGeneratorState
  OUTPUT: boolean
  
  // Returns true when template generator is opened without template
  RETURN X.templateExists = false AND X.printerConfigured = true
END FUNCTION
```

**Property Specification:**
```pascal
// Property: Fix Checking - Guided 3-Step Workflow
FOR ALL X WHERE isBugCondition3(X) DO
  ui ← renderTemplateGenerator'(X)
  ASSERT ui.showsStep1 = true AND
         ui.showsGenerateButton = false AND
         ui.pollsForReceipts = true AND
         ui.stepsCount = 3
END FOR
```

**Preservation Goal:**
```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition3(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

### Bug Condition 4: Receipt Capture Failure

**Bug Condition Function:**
```pascal
FUNCTION isBugCondition4(X)
  INPUT: X of type PrintJob
  OUTPUT: boolean
  
  // Returns true when print job sent to Tabeza POS Printer
  RETURN X.printerName = "Tabeza POS Printer" AND X.portType = "Redmon"
END FUNCTION
```

**Property Specification:**
```pascal
// Property: Fix Checking - Receipt Captured
FOR ALL X WHERE isBugCondition4(X) DO
  result ← processPrintJob'(X)
  capturedFile ← checkProcessedFolder(X.timestamp)
  ASSERT capturedFile EXISTS AND result.captured = true
END FOR
```

**Preservation Goal:**
```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition4(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

## Root Cause Analysis

### Bug 1: Printer Status Inconsistency
**Root Cause:** The IPC handler `check-printer-setup` calls a PowerShell script `printer-pooling-setup.ps1` which checks for printer pooling configuration. However, the actual printer "Tabeza POS Printer" exists and uses Redmon (not pooling). The script is checking for the wrong configuration type, causing it to return "Not configured" even though the printer exists.

**Evidence:** 
- Printer exists: `Get-Printer` shows "Tabeza POS Printer" with port "TabezaCapturePort"
- Redmon port is properly configured in registry with correct capture.exe path
- Dashboard shows "Configured" (likely using a different check method or caching)
- Template generator shows "Not configured" (using the IPC handler that checks for pooling)

**Fix:** Update the IPC handler to check for "Tabeza POS Printer" existence using `Get-Printer` cmdlet instead of checking for pooling configuration.

### Bug 2: Template Generator UI Flow
**Root Cause:** The template generator HTML shows a static "Generate Template" button instead of implementing the real-time guided workflow described in the architecture. The UI does not poll the queue folder for captured receipts or provide step-by-step feedback.

**Evidence:**
- template-generator.html shows static button and basic step display
- No polling logic for receipt detection in queue folder
- No step-by-step UI state management
- Receipts ARE being captured successfully (confirmed in `C:\TabezaPrints\queue\pending\`)

**Fix:** Implement real-time polling of `C:\TabezaPrints\queue\pending\` folder and update UI to show step-by-step progress as receipts are detected.

### Bug 3: Receipt Detection Not Working in UI
**Root Cause:** The template generator is not polling the queue folder to detect captured receipts. Receipts are being successfully captured by capture.exe and queued, but the UI doesn't know about them.

**Evidence:**
- Receipt found in queue: `233264da-0370-4924-8a45-24ceeabc875f.json`
- Receipt contains parsed data with rawText showing "CAPTAIN'S ORDER" from "MIHI LOUNGE & GRILL"
- Template generator UI shows "Receipts captured: 0 / 3"
- No polling mechanism in template-generator.html to check queue folder

**Fix:** Add polling logic to check `C:\TabezaPrints\queue\pending\` folder every 2 seconds and count receipt files, updating the UI in real-time.
