# Design Document: Electron App clawPDF Integration

## Overview

This design specifies the migration of the Tabeza Connect Electron application from Windows printer pooling detection to clawPDF virtual printer detection. The system has transitioned from using printer pooling (which has fundamental limitations) to using clawPDF as a virtual printer foundation. The Electron app must be updated to detect, configure, and monitor clawPDF instead of the legacy printer pooling setup.

### Current State

The Electron app currently uses PowerShell scripts to detect and configure Windows printer pooling. This approach has proven unreliable and is being replaced by clawPDF-based virtual printing.

### Design Goals

1. **Seamless Migration** - Detect clawPDF installation and configuration automatically
2. **Backward Compatibility** - Continue supporting printer pooling during migration period
3. **Clear User Feedback** - Provide real-time status updates via system tray and UI
4. **Automatic Setup Completion** - Mark setup steps complete when clawPDF is properly configured
5. **Performance** - Complete detection within 2 seconds without blocking UI
6. **Maintainability** - Remove legacy printer pooling code cleanly

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Electron Main Process                         │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  clawPDF Detector Module (NEW)                             │ │
│  │  - Registry access for installation check                  │ │
│  │  - File system access for profile verification             │ │
│  │  - Spool folder validation                                 │ │
│  │  - Status caching (30 seconds)                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Setup State Manager (EXISTING)                            │ │
│  │  - Tracks onboarding step completion                       │ │
│  │  - Auto-marks printer step when fully configured           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Broadcast Manager (EXISTING)                              │ │
│  │  - Sends status updates to all windows                     │ │
│  │  - Real-time printer status synchronization                │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  System Tray Manager (EXISTING - UPDATED)                  │ │
│  │  - Icon color based on printer status                      │ │
│  │  - Tooltip shows current status                            │ │
│  │  - Menu reflects configuration state                       │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ IPC Messages
                                │
┌─────────────────────────────────────────────────────────────────┐
│                    Renderer Processes                            │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Management UI (UPDATED)                                   │ │
│  │  - Displays clawPDF installation status                    │ │
│  │  - Shows profile configuration state                       │ │
│  │  - Displays spool folder path and status                   │ │
│  │  - Provides manual refresh button                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Printer Setup Wizard (UPDATED)                            │ │
│  │  - Guides through clawPDF installation                     │ │
│  │  - Provides test print functionality                       │ │
│  │  - Shows migration prompt if needed                        │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```


### Data Flow

```
Startup Flow:
─────────────
1. Electron app starts
2. clawPDFDetector.getFullPrinterStatus() called
3. Check registry: HKLM\SOFTWARE\clawSoft\clawPDF
4. If installed:
   a. Read version from registry
   b. Check profile: C:\ProgramData\clawSoft\clawPDF\Profiles\Tabeza Agent.ini
   c. If profile exists:
      - Read AutoSaveDirectory setting
      - Verify spool folder exists
      - Validate configuration
5. Determine status: not_installed | profile_missing | misconfigured | fully_configured
6. Cache result for 30 seconds
7. If fully_configured:
   - Check Setup State Manager
   - Auto-mark printer step complete if needed
8. Update system tray icon color
9. Broadcast status to all windows

User Opens Management UI:
─────────────────────────
1. Window requests printer status via IPC
2. Main process returns cached status (if < 30s old)
3. UI displays status information
4. User clicks "Refresh Status"
5. Main process bypasses cache, runs fresh detection
6. Updated status broadcast to all windows

Test Print Flow:
────────────────
1. User clicks "Send Test Print" in wizard
2. Generate test receipt data
3. Send print job to "Tabeza Agent"
4. Start monitoring spool folder
5. Wait up to 5 seconds for file to appear
6. If file appears: display success message
7. If timeout: display error with troubleshooting steps
```

## Components and Interfaces

### 1. clawPDF Detector Module

**Location:** `src/utils/clawpdf-detector.js` (NEW)

**Responsibility:** Detect and validate clawPDF installation and configuration.

**Interface:**
```javascript
/**
 * clawPDF detection and validation module
 */
class ClawPDFDetector {
    constructor() {
        this.cache = null;
        this.cacheTimestamp = null;
        this.CACHE_DURATION_MS = 30000; // 30 seconds
    }
    
    /**
     * Check if clawPDF is installed
     * @returns {Promise<{installed: boolean, version: string|null}>}
     */
    async checkClawPDFInstallation() {
        // Read registry: HKLM\SOFTWARE\clawSoft\clawPDF
        // Return installation status and version
    }
    
    /**
     * Check if "Tabeza Agent" profile exists and is valid
     * @returns {Promise<{exists: boolean, configPath: string|null, valid: boolean}>}
     */
    async checkPrinterProfile() {
        // Check file: C:\ProgramData\clawSoft\clawPDF\Profiles\Tabeza Agent.ini
        // Validate profile configuration
        // Return profile status
    }
    
    /**
     * Verify spool folder configuration
     * @returns {Promise<{configured: boolean, path: string|null, exists: boolean, writable: boolean}>}
     */
    async verifySpoolFolder() {
        // Read AutoSaveDirectory from profile
        // Verify path is C:\TabezaPrints\spool\
        // Check folder exists and is writable
        // Return spool folder status
    }
    
    /**
     * Get complete printer status (uses cache if available)
     * @param {boolean} bypassCache - Force fresh detection
     * @returns {Promise<PrinterStatus>}
     */
    async getFullPrinterStatus(bypassCache = false) {
        // Check cache validity
        // If cache valid and not bypassed, return cached result
        // Otherwise run full detection
        // Cache and return result
    }
    
    /**
     * Validate clawPDF configuration
     * @returns {Promise<ValidationResult>}
     */
    async validateConfiguration() {
        // Check version >= 0.9.0
        // Verify AutoSave enabled
        // Verify output format is PostScript
        // Check spool folder permissions
        // Return validation results
    }
}

/**
 * Printer status object
 * @typedef {Object} PrinterStatus
 * @property {boolean} installed - clawPDF is installed
 * @property {string|null} version - clawPDF version
 * @property {boolean} profileExists - "Tabeza Agent" profile exists
 * @property {boolean} spoolConfigured - Spool folder correctly configured
 * @property {string} status - Overall status: not_installed | profile_missing | misconfigured | fully_configured
 * @property {string} statusMessage - Human-readable status description
 * @property {Object} details - Additional details for troubleshooting
 */

/**
 * Validation result object
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - All validations passed
 * @property {Array<ValidationIssue>} issues - List of validation issues
 */

/**
 * Validation issue
 * @typedef {Object} ValidationIssue
 * @property {string} type - Issue type: version | autosave | format | permissions
 * @property {string} message - Human-readable issue description
 * @property {string} resolution - Steps to resolve the issue
 */

module.exports = { ClawPDFDetector };
```


**Key Algorithms:**

1. **Installation Detection Algorithm**
```
FUNCTION checkClawPDFInstallation():
    1. Try to read registry key: HKLM\SOFTWARE\clawSoft\clawPDF
    2. IF registry key exists:
        a. Read "Version" value
        b. Return { installed: true, version: <version> }
    3. ELSE:
        a. Return { installed: false, version: null }
    4. CATCH registry access errors:
        a. Log error with details
        b. Return { installed: false, version: null, error: <error> }
```

2. **Profile Detection Algorithm**
```
FUNCTION checkPrinterProfile():
    1. Define profile path: C:\ProgramData\clawSoft\clawPDF\Profiles\Tabeza Agent.ini
    2. Check if file exists
    3. IF file exists:
        a. Try to read file contents
        b. Parse INI format
        c. Validate required sections exist
        d. Return { exists: true, configPath: <path>, valid: true }
    4. ELSE:
        a. Return { exists: false, configPath: null, valid: false }
    5. CATCH file read errors:
        a. Log error with file path
        b. Return { exists: true, configPath: <path>, valid: false, error: <error> }
```

3. **Spool Folder Verification Algorithm**
```
FUNCTION verifySpoolFolder():
    1. Read profile configuration
    2. Extract AutoSaveDirectory setting
    3. Expected path: C:\TabezaPrints\spool\
    4. IF AutoSaveDirectory === expected path:
        a. Check if folder exists on file system
        b. IF folder exists:
            - Try to create test file to verify write permissions
            - Delete test file
            - Return { configured: true, path: <path>, exists: true, writable: true }
        c. ELSE:
            - Return { configured: true, path: <path>, exists: false, writable: false }
    5. ELSE:
        a. Return { configured: false, path: <actual_path>, exists: false, writable: false }
    6. CATCH errors:
        a. Log error with details
        b. Return { configured: false, path: null, exists: false, writable: false, error: <error> }
```

4. **Status Determination Algorithm**
```
FUNCTION getFullPrinterStatus(bypassCache):
    1. IF cache valid AND NOT bypassCache:
        a. Return cached status
    
    2. Run detection:
        a. installStatus = checkClawPDFInstallation()
        b. IF NOT installStatus.installed:
            - status = "not_installed"
            - statusMessage = "clawPDF is not installed"
            - GOTO step 3
        
        c. profileStatus = checkPrinterProfile()
        d. IF NOT profileStatus.exists:
            - status = "profile_missing"
            - statusMessage = "Tabeza Agent profile not found"
            - GOTO step 3
        
        e. spoolStatus = verifySpoolFolder()
        f. IF NOT spoolStatus.configured OR NOT spoolStatus.exists:
            - status = "misconfigured"
            - statusMessage = "Spool folder not configured correctly"
            - GOTO step 3
        
        g. status = "fully_configured"
        h. statusMessage = "Printer is fully configured and ready"
    
    3. Create status object:
        - installed: installStatus.installed
        - version: installStatus.version
        - profileExists: profileStatus.exists
        - spoolConfigured: spoolStatus.configured AND spoolStatus.exists
        - status: <determined status>
        - statusMessage: <determined message>
        - details: { installStatus, profileStatus, spoolStatus }
    
    4. Cache result with current timestamp
    
    5. Return status object
```

5. **Configuration Validation Algorithm**
```
FUNCTION validateConfiguration():
    1. Initialize issues array
    
    2. Get full printer status
    3. IF NOT fully_configured:
        a. Return { valid: false, issues: [{ type: 'setup', message: 'Printer not fully configured' }] }
    
    4. Validate version:
        a. Parse version string
        b. IF version < 0.9.0:
            - Add issue: { type: 'version', message: 'clawPDF version too old', resolution: 'Update to 0.9.0 or higher' }
    
    5. Validate AutoSave:
        a. Read profile configuration
        b. IF AutoSave not enabled:
            - Add issue: { type: 'autosave', message: 'AutoSave not enabled', resolution: 'Enable AutoSave in profile settings' }
    
    6. Validate output format:
        a. Read OutputFormat setting
        b. IF OutputFormat !== 'PostScript':
            - Add issue: { type: 'format', message: 'Output format incorrect', resolution: 'Set output format to PostScript' }
    
    7. Validate permissions:
        a. Try to write test file to spool folder
        b. IF write fails:
            - Add issue: { type: 'permissions', message: 'No write permission', resolution: 'Grant write access to spool folder' }
    
    8. Return { valid: issues.length === 0, issues: issues }
```

### 2. Setup State Manager Integration

**Location:** `src/lib/setup-state-manager.js` (EXISTING - UPDATED)

**Updates Required:**
- Add method to check if printer step is complete
- Add method to mark printer step complete
- Emit event when printer step is auto-completed

**New Interface Methods:**
```javascript
class SetupStateManager {
    // ... existing methods ...
    
    /**
     * Check if printer setup step is complete
     * @returns {boolean}
     */
    isPrinterStepComplete() {
        // Check state for printer step completion
    }
    
    /**
     * Mark printer setup step as complete
     * @param {string} reason - Reason for completion (e.g., "auto-detected")
     * @returns {Promise<void>}
     */
    async markPrinterStepComplete(reason) {
        // Update state
        // Log completion with reason
        // Emit 'printer-step-completed' event
        // Broadcast state change
    }
}
```

**Integration Algorithm:**
```
FUNCTION handlePrinterStatusUpdate(status):
    1. IF status.status === "fully_configured":
        a. Check if printer step already complete
        b. IF NOT complete:
            - Call setupStateManager.markPrinterStepComplete("auto-detected")
            - Log: "Printer step auto-completed: clawPDF fully configured"
            - Update system tray icon
        c. ELSE:
            - Log: "Printer step already complete, no action needed"
    2. ELSE:
        a. Log current status for monitoring
```


### 3. System Tray Icon Updates

**Location:** `src/tray/tray-app.js` (EXISTING - UPDATED)

**Updates Required:**
- Update icon color based on printer status
- Update tooltip to show printer status
- Add menu item for printer configuration

**Icon Color Mapping:**
```javascript
const ICON_COLORS = {
    'not_installed': 'grey',      // clawPDF not installed
    'profile_missing': 'orange',  // Installed but not configured
    'misconfigured': 'orange',    // Configuration issues
    'fully_configured': 'green',  // Ready to use
    'error': 'red'                // Service error
};
```

**Tooltip Format:**
```
Status: <status_message>
Version: <clawPDF_version>
Profile: <configured|not configured>
Spool: <configured|not configured>
```

**Algorithm:**
```
FUNCTION updateTrayIcon(printerStatus, serviceStatus):
    1. Determine icon color:
        a. IF serviceStatus === 'error':
            - color = 'red'
        b. ELSE IF printerStatus.status === 'fully_configured' AND serviceStatus === 'running':
            - color = 'green'
        c. ELSE:
            - color = ICON_COLORS[printerStatus.status]
    
    2. Set tray icon to color
    
    3. Build tooltip:
        a. Start with "Tabeza Connect\n"
        b. Add "Status: " + printerStatus.statusMessage
        c. IF printerStatus.installed:
            - Add "Version: " + printerStatus.version
            - Add "Profile: " + (printerStatus.profileExists ? "configured" : "not configured")
            - Add "Spool: " + (printerStatus.spoolConfigured ? "configured" : "not configured")
    
    4. Set tray tooltip
    
    5. Update context menu:
        a. IF printerStatus.status !== 'fully_configured':
            - Add "Configure Printer..." menu item
        b. ELSE:
            - Add "Printer Status: Ready" menu item (disabled)
```

### 4. Management UI Updates

**Location:** `src/public/management-ui.html` and `src/public/js/management-ui.js` (EXISTING - UPDATED)

**UI Components to Add:**

1. **Printer Status Section**
```html
<div class="status-section">
    <h3>Printer Configuration</h3>
    <div class="status-grid">
        <div class="status-item">
            <span class="label">clawPDF Installation:</span>
            <span id="clawpdf-installed" class="value"></span>
        </div>
        <div class="status-item">
            <span class="label">Version:</span>
            <span id="clawpdf-version" class="value"></span>
        </div>
        <div class="status-item">
            <span class="label">Printer Profile:</span>
            <span id="printer-profile" class="value"></span>
        </div>
        <div class="status-item">
            <span class="label">Spool Folder:</span>
            <span id="spool-folder" class="value"></span>
        </div>
        <div class="status-item">
            <span class="label">Last Print Job:</span>
            <span id="last-print-job" class="value"></span>
        </div>
    </div>
    <button id="refresh-printer-status" class="btn-primary">Refresh Status</button>
    <button id="open-printer-wizard" class="btn-secondary">Configure Printer</button>
</div>
```

2. **Migration Notice (Conditional)**
```html
<div id="migration-notice" class="notice warning" style="display: none;">
    <h4>Migration Required</h4>
    <p>Your system is currently using printer pooling. We recommend migrating to clawPDF for improved reliability.</p>
    <button id="start-migration" class="btn-primary">Install clawPDF</button>
    <a href="#" id="migration-guide">View Migration Guide</a>
</div>
```

**IPC Communication:**
```javascript
// Request printer status
ipcRenderer.invoke('get-printer-status').then(status => {
    updatePrinterStatusUI(status);
});

// Listen for status updates
ipcRenderer.on('printer-status-updated', (event, status) => {
    updatePrinterStatusUI(status);
});

// Request status refresh
document.getElementById('refresh-printer-status').addEventListener('click', () => {
    ipcRenderer.invoke('refresh-printer-status').then(status => {
        updatePrinterStatusUI(status);
    });
});
```

**UI Update Algorithm:**
```
FUNCTION updatePrinterStatusUI(status):
    1. Update installation status:
        a. IF status.installed:
            - Set text: "Installed"
            - Set class: "status-success"
        b. ELSE:
            - Set text: "Not Installed"
            - Set class: "status-error"
    
    2. Update version:
        a. Set text: status.version || "N/A"
    
    3. Update profile status:
        a. IF status.profileExists:
            - Set text: "Configured"
            - Set class: "status-success"
        b. ELSE:
            - Set text: "Not Configured"
            - Set class: "status-warning"
    
    4. Update spool folder:
        a. IF status.spoolConfigured:
            - Set text: status.details.spoolStatus.path + " (Ready)"
            - Set class: "status-success"
        b. ELSE:
            - Set text: "Not Configured"
            - Set class: "status-error"
    
    5. Update last print job:
        a. IF lastPrintTimestamp available:
            - Format timestamp
            - Set text: formatted time
        b. ELSE:
            - Set text: "No recent prints"
    
    6. Show/hide migration notice:
        a. IF printer pooling detected AND NOT clawPDF fully configured:
            - Show migration notice
        b. ELSE:
            - Hide migration notice
```

### 5. Printer Setup Wizard

**Location:** `src/setup-wizard/printer-setup.html` (EXISTING - UPDATED)

**Wizard Flow:**

```
Step 1: Check Current Status
────────────────────────────
Display current printer status
IF fully_configured:
    → Show success message
    → Offer test print
    → Exit wizard
ELSE:
    → Continue to Step 2

Step 2: Installation Check
───────────────────────────
IF clawPDF not installed:
    → Display installation instructions
    → Provide download link
    → Wait for installation
    → Re-check status
ELSE:
    → Continue to Step 3

Step 3: Profile Configuration
──────────────────────────────
IF profile not configured:
    → Display profile creation instructions
    → Provide configuration template
    → Wait for configuration
    → Re-check status
ELSE:
    → Continue to Step 4

Step 4: Spool Folder Setup
───────────────────────────
IF spool folder not configured:
    → Display spool folder instructions
    → Offer to create folder automatically
    → Update profile configuration
    → Re-check status
ELSE:
    → Continue to Step 5

Step 5: Test Print
──────────────────
→ Offer to send test print
→ Monitor for captured file
→ Display result
→ Mark setup complete if successful
```

**Test Print Algorithm:**
```
FUNCTION sendTestPrint():
    1. Generate test receipt data:
        - Header: "TABEZA TEST RECEIPT"
        - Items: Sample items with prices
        - Total: Sum of items
        - Footer: "This is a test print"
    
    2. Format as ESC/POS commands
    
    3. Send to "Tabeza Agent":
        a. Use Windows printing API
        b. Target printer: "Tabeza Agent"
    
    4. Start monitoring spool folder:
        a. Watch: C:\TabezaPrints\spool\
        b. Timeout: 5 seconds
    
    5. Wait for file to appear:
        a. IF file appears within timeout:
            - Read file
            - Verify contains test data
            - Display success message
            - Return true
        b. ELSE:
            - Display error message with troubleshooting:
              * Check clawPDF is running
              * Verify profile configuration
              * Check spool folder permissions
            - Return false
```


## Data Models

### Printer Status Model

```typescript
interface PrinterStatus {
    // Installation state
    installed: boolean;              // clawPDF is installed
    version: string | null;          // clawPDF version (e.g., "0.9.3")
    
    // Configuration state
    profileExists: boolean;          // "Tabeza Agent" profile exists
    spoolConfigured: boolean;        // Spool folder correctly configured
    
    // Overall status
    status: PrinterStatusType;       // Overall status enum
    statusMessage: string;           // Human-readable status
    
    // Detailed information
    details: {
        installStatus: InstallStatus;
        profileStatus: ProfileStatus;
        spoolStatus: SpoolStatus;
    };
    
    // Metadata
    lastChecked: string;             // ISO 8601 timestamp
    cached: boolean;                 // Result from cache
}

type PrinterStatusType = 
    | 'not_installed'      // clawPDF not installed
    | 'profile_missing'    // Installed but profile missing
    | 'misconfigured'      // Profile exists but spool folder wrong
    | 'fully_configured';  // Ready to use

interface InstallStatus {
    installed: boolean;
    version: string | null;
    registryPath: string;
    error?: string;
}

interface ProfileStatus {
    exists: boolean;
    configPath: string | null;
    valid: boolean;
    error?: string;
}

interface SpoolStatus {
    configured: boolean;    // AutoSaveDirectory set correctly
    path: string | null;    // Actual path from config
    exists: boolean;        // Folder exists on file system
    writable: boolean;      // Has write permissions
    error?: string;
}
```

### Validation Result Model

```typescript
interface ValidationResult {
    valid: boolean;                  // All validations passed
    issues: ValidationIssue[];       // List of issues found
    timestamp: string;               // When validation ran
}

interface ValidationIssue {
    type: ValidationIssueType;       // Issue category
    severity: 'error' | 'warning';   // Issue severity
    message: string;                 // Human-readable description
    resolution: string;              // Steps to fix
    details?: any;                   // Additional context
}

type ValidationIssueType =
    | 'version'        // clawPDF version too old
    | 'autosave'       // AutoSave not enabled
    | 'format'         // Output format incorrect
    | 'permissions'    // No write permission
    | 'path'           // Spool path incorrect
    | 'missing';       // Required component missing
```

### Test Print Result Model

```typescript
interface TestPrintResult {
    success: boolean;                // Test print succeeded
    timestamp: string;               // When test was run
    captureTime?: number;            // Time to capture (ms)
    capturedFile?: string;           // Path to captured file
    error?: string;                  // Error message if failed
    troubleshooting?: string[];      // Troubleshooting steps
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Status Determination Consistency

*For any* system state (registry, file system, configuration), the clawPDFDetector SHALL always determine the same printer status given identical inputs.

**Validates: Requirements 1.1, 1.3, 1.4, 2.4, 2.5, 3.5, 3.6**

### Property 2: Detection Completeness

*For any* detection run, the clawPDFDetector SHALL check all required components: registry installation, profile file existence, and spool folder configuration.

**Validates: Requirements 1.1, 1.2, 2.1, 2.2, 3.1, 3.2**

### Property 3: Cache Validity

*For any* cached detection result, if less than 30 seconds have elapsed since caching, getFullPrinterStatus() SHALL return the cached result unless bypassCache is true.

**Validates: Requirements 12.3, 12.4, 12.5**

### Property 4: Auto-Completion Idempotency

*For any* fully_configured printer status, if the printer setup step is already marked complete, the Setup State Manager SHALL not mark it complete again.

**Validates: Requirements 4.2, 4.5**

### Property 5: Tray Icon State Consistency

*For any* printer status, the system tray icon color SHALL match the status according to the mapping: not_installed→grey, profile_missing→orange, misconfigured→orange, fully_configured+running→green, error→red.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

### Property 6: Logging Completeness

*For any* detection run, configuration change, or auto-completion action, the system SHALL create a log entry with timestamp and relevant details.

**Validates: Requirements 1.5, 4.3, 4.5, 10.2, 11.1, 14.6**

### Property 7: Error Message Actionability

*For any* error condition (registry access failure, file read error, missing folder), the error message SHALL include specific resolution steps.

**Validates: Requirements 11.2, 11.3, 11.4, 11.5**

### Property 8: Broadcast Consistency

*For any* printer status change, the Broadcast Manager SHALL send the updated status to all open windows within 100ms.

**Validates: Requirements 15.2, 15.4, 15.5**

### Property 9: Test Print Round-Trip

*For any* test print sent to "Tabeza Agent", if the printer is fully configured, a corresponding file SHALL appear in the spool folder within 5 seconds.

**Validates: Requirements 13.2, 13.3, 13.4, 13.5, 13.6**

### Property 10: Configuration Validation Completeness

*For any* fully_configured printer, the validation SHALL check all required settings: version ≥ 0.9.0, AutoSave enabled, output format = PostScript, and spool folder writable.

**Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5**

### Property 11: Migration Priority

*For any* system with both printer pooling and clawPDF detected, the clawPDFDetector SHALL prioritize clawPDF status and log a migration notice.

**Validates: Requirements 10.1, 10.2**

### Property 12: Detection Performance

*For any* detection run, the clawPDFDetector SHALL complete within 2 seconds and SHALL NOT block the UI thread.

**Validates: Requirements 12.1, 12.2**

### Property 13: IPC Status Delivery

*For any* Management UI window requesting printer status, the main process SHALL respond with a valid PrinterStatus object via IPC.

**Validates: Requirements 9.1**

### Property 14: Setup Step Auto-Completion

*For any* transition to fully_configured status, if the printer setup step is not complete, the Setup State Manager SHALL mark it complete and broadcast the state change.

**Validates: Requirements 4.1, 4.2, 4.4**

### Property 15: Backward Compatibility

*For any* system with only printer pooling configured (no clawPDF), the Electron app SHALL continue to function and SHALL display a migration prompt.

**Validates: Requirements 10.3, 10.4, 10.5**


## Error Handling

### Registry Access Errors

**Scenario:** Cannot read HKLM\SOFTWARE\clawSoft\clawPDF

**Handling:**
```
1. Catch registry access exception
2. Log error with details:
   - Error message
   - Registry path attempted
   - User permissions
3. Return status:
   - installed: false
   - error: "Registry access denied"
4. Display in UI:
   - "Unable to check clawPDF installation"
   - "Please run as administrator or check permissions"
```

### File System Errors

**Scenario:** Cannot read profile configuration file

**Handling:**
```
1. Catch file read exception
2. Log error with details:
   - File path
   - Error message
   - File permissions
3. Return status:
   - profileExists: true (file exists but can't read)
   - valid: false
   - error: "Cannot read profile configuration"
4. Display in UI:
   - "Profile file exists but cannot be read"
   - "File path: <path>"
   - "Check file permissions"
```

**Scenario:** Spool folder does not exist

**Handling:**
```
1. Detect folder missing
2. Log warning:
   - Expected path
   - Actual configuration
3. Return status:
   - configured: true (path is correct)
   - exists: false
   - error: "Folder does not exist"
4. Display in UI:
   - "Spool folder not found"
   - "Expected: C:\TabezaPrints\spool\"
   - "Click here to create folder"
5. Offer automatic creation:
   - Create folder with correct permissions
   - Re-run detection
```

### Test Print Failures

**Scenario:** Test print times out (no file appears)

**Handling:**
```
1. Wait 5 seconds for file
2. If timeout:
   a. Log: "Test print timeout"
   b. Display error message:
      - "Test print did not complete"
      - "Troubleshooting steps:"
        * Verify clawPDF service is running
        * Check profile AutoSave is enabled
        * Verify spool folder path is correct
        * Check spool folder permissions
        * Try printing from another application
   c. Provide "Retry" button
   d. Provide "Open Logs" button
```

**Scenario:** Test print file appears but is empty

**Handling:**
```
1. Detect file with 0 bytes
2. Log: "Test print file empty"
3. Display error:
   - "Test print captured but file is empty"
   - "This may indicate a printer driver issue"
   - "Check clawPDF logs for details"
4. Provide "View clawPDF Logs" button
```

### Configuration Validation Errors

**Scenario:** clawPDF version too old

**Handling:**
```
1. Detect version < 0.9.0
2. Add validation issue:
   - type: 'version'
   - severity: 'error'
   - message: "clawPDF version 0.8.x detected"
   - resolution: "Update to version 0.9.0 or higher"
3. Display warning in UI:
   - "Your clawPDF version is outdated"
   - "Current: 0.8.x"
   - "Required: 0.9.0+"
   - "Download latest version"
4. Provide download link
```

**Scenario:** Output format not PostScript

**Handling:**
```
1. Detect OutputFormat !== 'PostScript'
2. Add validation issue:
   - type: 'format'
   - severity: 'warning'
   - message: "Output format is <format>"
   - resolution: "Change to PostScript in profile settings"
3. Display warning:
   - "Incorrect output format detected"
   - "Current: <format>"
   - "Required: PostScript"
   - "This may cause parsing issues"
4. Provide link to configuration guide
```

### Migration Errors

**Scenario:** Both printer pooling and clawPDF detected

**Handling:**
```
1. Detect both configurations
2. Log migration notice:
   - "Both printer pooling and clawPDF detected"
   - "Prioritizing clawPDF"
3. Display info message:
   - "Migration in progress"
   - "Using clawPDF for new prints"
   - "Printer pooling will be removed in next update"
4. Continue with clawPDF status
```

### Recovery Strategies

**Automatic Recovery:**
- Cache invalidation on errors (force fresh detection)
- Retry registry access with different permissions
- Automatic folder creation when missing
- Fallback to printer pooling if clawPDF fails

**Manual Recovery:**
- "Refresh Status" button to re-run detection
- "Configure Printer" wizard to fix issues
- "View Logs" to diagnose problems
- "Contact Support" with diagnostic information

**Graceful Degradation:**
- If detection fails, show last known status
- If clawPDF not ready, continue with printer pooling
- If validation fails, allow usage with warnings
- If test print fails, allow manual verification

## Testing Strategy

### Dual Testing Approach

This feature requires both unit testing and property-based testing for comprehensive coverage:

**Unit Tests:**
- Specific examples of registry states (installed/not installed)
- Edge cases (missing files, permission errors, invalid configurations)
- Error conditions (registry access denied, file read failures)
- Integration points (IPC communication, state manager updates, tray icon updates)

**Property-Based Tests:**
- Universal properties across all inputs (status determination, caching, broadcasting)
- Comprehensive input coverage through randomization
- Minimum 100 iterations per property test

### Property-Based Testing Configuration

**Library:** fast-check (JavaScript/TypeScript property-based testing library)

**Test Configuration:**
```javascript
// Example property test configuration
const fc = require('fast-check');

describe('Property 1: Status Determination Consistency', () => {
    /**
     * Feature: electron-clawpdf-integration
     * Property 1: Status Determination Consistency
     * 
     * For any system state (registry, file system, configuration),
     * the clawPDFDetector SHALL always determine the same printer
     * status given identical inputs.
     */
    it('should determine consistent status for identical inputs', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    registryInstalled: fc.boolean(),
                    registryVersion: fc.option(fc.string()),
                    profileExists: fc.boolean(),
                    spoolPath: fc.option(fc.string()),
                    spoolExists: fc.boolean()
                }),
                async (systemState) => {
                    // Mock system state
                    mockRegistry(systemState.registryInstalled, systemState.registryVersion);
                    mockFileSystem(systemState.profileExists, systemState.spoolPath, systemState.spoolExists);
                    
                    // Run detection twice
                    const detector = new ClawPDFDetector();
                    const status1 = await detector.getFullPrinterStatus(true);
                    const status2 = await detector.getFullPrinterStatus(true);
                    
                    // Status should be identical
                    return status1.status === status2.status &&
                           status1.installed === status2.installed &&
                           status1.profileExists === status2.profileExists &&
                           status1.spoolConfigured === status2.spoolConfigured;
                }
            ),
            { numRuns: 100 }
        );
    });
});
```

**Property Test Tags:**
Each property test must reference its design document property:
```javascript
/**
 * Feature: electron-clawpdf-integration
 * Property 3: Cache Validity
 * 
 * For any cached detection result, if less than 30 seconds have
 * elapsed since caching, getFullPrinterStatus() SHALL return the
 * cached result unless bypassCache is true.
 */
test('Property 3: Cache validity', async () => {
    // Property test implementation
});
```

### Unit Test Coverage

**clawPDF Detector Tests:**
- Registry reading (installed/not installed)
- Version parsing (valid/invalid formats)
- Profile file reading (exists/missing/unreadable)
- Spool folder verification (correct/incorrect/missing)
- Status determination (all status types)
- Cache behavior (hit/miss/expiry/bypass)
- Error handling (registry errors, file errors)

**Setup State Manager Tests:**
- Printer step completion check
- Auto-completion logic
- Event emission
- State persistence

**System Tray Tests:**
- Icon color updates
- Tooltip updates
- Menu updates
- Status change handling

**Management UI Tests:**
- Status display updates
- IPC communication
- Refresh button functionality
- Migration notice display

**Printer Setup Wizard Tests:**
- Wizard flow navigation
- Test print functionality
- File monitoring
- Success/failure handling

### Integration Tests

**End-to-End Detection Flow:**
1. Start Electron app
2. Verify detection runs automatically
3. Check system tray icon color
4. Open Management UI
5. Verify status displayed correctly
6. Click refresh button
7. Verify fresh detection runs
8. Check cache behavior

**Auto-Completion Flow:**
1. Mock fully_configured status
2. Start app with incomplete printer step
3. Verify detection runs
4. Verify printer step marked complete
5. Verify tray icon updates
6. Verify broadcast sent to windows

**Test Print Flow:**
1. Open printer setup wizard
2. Click "Send Test Print"
3. Verify print job sent
4. Verify file monitoring starts
5. Mock file appearance
6. Verify success message displayed
7. Verify wizard completion

**Migration Flow:**
1. Mock both printer pooling and clawPDF
2. Start app
3. Verify clawPDF prioritized
4. Verify migration notice logged
5. Open Management UI
6. Verify migration prompt displayed

### Performance Tests

**Detection Speed:**
- Target: < 2 seconds for full detection
- Measure: Time from start to status returned
- Test with various system states

**Cache Performance:**
- Target: < 10ms for cached result
- Measure: Time for cached vs fresh detection
- Verify 30-second cache duration

**UI Responsiveness:**
- Target: UI remains responsive during detection
- Measure: Frame rate during detection
- Verify async execution

**Broadcast Latency:**
- Target: < 100ms from status change to window update
- Measure: Time from broadcast to UI update
- Test with multiple open windows


## Migration Strategy

### Phase 1: Add clawPDF Detection (Week 1)

**Goal:** Add clawPDF detection alongside existing printer pooling without disruption.

**Steps:**
1. Create `src/utils/clawpdf-detector.js` module
2. Implement all detection functions
3. Add unit tests for detector
4. Add property-based tests
5. Integrate with electron-main.js (parallel to existing detection)
6. Add logging for both detection methods
7. Test on development machines

**Rollback:** Simply remove new code, existing functionality unchanged.

**Validation:**
- [ ] clawPDF detector module created
- [ ] All detection functions implemented
- [ ] Unit tests passing
- [ ] Property tests passing (100 iterations each)
- [ ] Detection runs without errors
- [ ] Logs show both detection methods

### Phase 2: Update UI Components (Week 2)

**Goal:** Update Management UI and system tray to show clawPDF status.

**Steps:**
1. Update Management UI HTML/CSS
2. Add printer status section
3. Update IPC handlers for printer status
4. Update system tray icon logic
5. Add migration notice UI
6. Test UI updates with various statuses
7. Verify real-time updates work

**Rollback:** Revert UI changes, detector still works in background.

**Validation:**
- [ ] Management UI shows clawPDF status
- [ ] System tray icon reflects status
- [ ] IPC communication working
- [ ] Real-time updates functioning
- [ ] Migration notice displays when appropriate

### Phase 3: Add Printer Setup Wizard (Week 3)

**Goal:** Create guided setup wizard for clawPDF configuration.

**Steps:**
1. Create printer-setup.html wizard
2. Implement wizard flow logic
3. Add test print functionality
4. Add file monitoring for test prints
5. Integrate with Setup State Manager
6. Add auto-completion logic
7. Test complete wizard flow

**Rollback:** Wizard is optional, existing setup still works.

**Validation:**
- [ ] Wizard guides through setup steps
- [ ] Test print functionality works
- [ ] File monitoring detects captures
- [ ] Auto-completion marks step complete
- [ ] Success/error messages display correctly

### Phase 4: Remove Printer Pooling Code (Week 4)

**Goal:** Clean up legacy printer pooling detection code.

**Steps:**
1. Verify clawPDF detection working in production
2. Remove printer-pooling-setup.ps1 references
3. Remove autoDetectPrinterSetup function
4. Update all comments and documentation
5. Remove printer pooling configuration checks
6. Update installer to not create pooling printer
7. Test that removal doesn't break anything

**Rollback:** Restore printer pooling code from git history.

**Validation:**
- [ ] No references to printer-pooling-setup.ps1
- [ ] autoDetectPrinterSetup function removed
- [ ] Comments updated to reference clawPDF
- [ ] No printer pooling checks remain
- [ ] Installer updated
- [ ] All tests still passing

### Backward Compatibility Considerations

**During Migration Period (Phases 1-3):**
- Both printer pooling and clawPDF detection run
- clawPDF prioritized if both detected
- Migration notice shown to users with pooling only
- Existing printer pooling continues to work
- No breaking changes to existing functionality

**After Migration (Phase 4):**
- Only clawPDF detection remains
- Users must have clawPDF installed
- Installer includes clawPDF setup
- Migration guide provided for existing users

**Configuration Files:**
- config.json format unchanged
- template.json format unchanged
- No data migration required

**User Experience:**
- System tray icon behavior consistent
- Management UI URLs unchanged (localhost:8765)
- Keyboard shortcuts unchanged
- Window positions preserved

### Migration Validation Checklist

**Pre-Migration:**
- [ ] clawPDF detector fully tested
- [ ] UI components updated and tested
- [ ] Wizard tested end-to-end
- [ ] Performance targets met (< 2s detection)
- [ ] All property tests passing
- [ ] Integration tests passing

**During Migration:**
- [ ] Both detection methods working
- [ ] clawPDF prioritized correctly
- [ ] Migration notices displaying
- [ ] No errors in logs
- [ ] User feedback collected

**Post-Migration:**
- [ ] Printer pooling code removed
- [ ] No references to legacy code
- [ ] Documentation updated
- [ ] Installer updated
- [ ] All tests passing
- [ ] Production deployment successful

## File System Changes

### New Files

```
src/utils/
└── clawpdf-detector.js          # NEW: clawPDF detection module

src/utils/__tests__/
└── clawpdf-detector.test.js     # NEW: Unit tests for detector

src/setup-wizard/
└── printer-setup.html           # UPDATED: clawPDF wizard

src/public/
└── management-ui.html           # UPDATED: Add printer status section

src/public/js/
└── management-ui.js             # UPDATED: Add printer status handlers
```

### Modified Files

```
src/electron-main.js             # UPDATED: Integrate clawPDF detector
src/lib/setup-state-manager.js   # UPDATED: Add printer step methods
src/tray/tray-app.js             # UPDATED: Update icon based on status
src/public/css/management-ui.css # UPDATED: Add printer status styles
```

### Deleted Files (Phase 4)

```
src/installer/printer-pooling-setup.ps1       # REMOVED
src/installer/printer-pooling-setup-new.ps1   # REMOVED
```

## Registry and File System Locations

### Registry Keys Read

```
HKEY_LOCAL_MACHINE\SOFTWARE\clawSoft\clawPDF
├── Version                      # clawPDF version string
├── InstallPath                  # Installation directory
└── ConfigPath                   # Configuration directory
```

### File System Paths

```
C:\ProgramData\clawSoft\clawPDF\
├── Profiles\
│   └── Tabeza Agent.ini   # Profile configuration
└── Logs\
    └── clawPDF.log              # clawPDF logs

C:\TabezaPrints\
└── spool\                       # Spool folder for captured prints
    └── *.ps                     # PostScript files from clawPDF
```

### Configuration File Format

**Profile INI Format:**
```ini
[General]
ProfileName=Tabeza Agent
AutoSave=true
OutputFormat=PostScript

[AutoSave]
AutoSaveDirectory=C:\TabezaPrints\spool\
AutoSaveFilename=<DateTime>_<JobID>.ps
```

## Security Considerations

### Registry Access

**Permissions Required:**
- Read access to HKLM\SOFTWARE\clawSoft\clawPDF
- No write access needed for detection
- Runs with user privileges (no elevation required)

**Security Measures:**
- Validate registry data before use
- Handle access denied errors gracefully
- Log security-related errors
- Never expose registry paths in UI errors

### File System Access

**Permissions Required:**
- Read access to C:\ProgramData\clawSoft\clawPDF\Profiles\
- Read/write access to C:\TabezaPrints\spool\
- No system directory access needed

**Security Measures:**
- Validate file paths before access
- Use path.join() to prevent path traversal
- Check file permissions before operations
- Handle permission errors gracefully

### Test Print Security

**Considerations:**
- Test print contains no sensitive data
- Uses sample items and prices only
- No customer or venue information included
- Captured file deleted after verification

**Security Measures:**
- Generate test data programmatically
- Never include real transaction data
- Clean up test files after use
- Log test print actions for audit

## Performance Optimization

### Detection Caching

**Strategy:**
- Cache detection results for 30 seconds
- Invalidate cache on manual refresh
- Invalidate cache on configuration changes
- Store cache in memory (not disk)

**Benefits:**
- Reduces registry access frequency
- Improves UI responsiveness
- Reduces file system operations
- Lowers CPU usage

### Async Operations

**Implementation:**
- All detection functions return Promises
- Use async/await for sequential operations
- Run detection in background (not main thread)
- Never block UI during detection

**Benefits:**
- UI remains responsive
- Better user experience
- Prevents app freezing
- Allows parallel operations

### Lazy Loading

**Strategy:**
- Load detector module only when needed
- Defer wizard loading until opened
- Load UI components on demand
- Initialize tray icon immediately

**Benefits:**
- Faster app startup
- Lower initial memory usage
- Better perceived performance
- Reduced resource consumption

## Monitoring and Observability

### Logging Strategy

**Log Levels:**
- ERROR: Detection failures, configuration errors
- WARN: Validation issues, migration notices
- INFO: Status changes, auto-completions
- DEBUG: Detailed detection steps, cache hits/misses

**Log Format:**
```
[2026-03-04T14:30:22.001Z][INFO][clawPDF] Detection started
[2026-03-04T14:30:22.123Z][INFO][clawPDF] Installation detected: version 0.9.3
[2026-03-04T14:30:22.234Z][INFO][clawPDF] Profile found: Tabeza Agent
[2026-03-04T14:30:22.345Z][INFO][clawPDF] Spool folder configured: C:\TabezaPrints\spool\
[2026-03-04T14:30:22.456Z][INFO][clawPDF] Status: fully_configured
[2026-03-04T14:30:22.567Z][INFO][SetupState] Printer step auto-completed
```

### Metrics to Track

**Detection Metrics:**
- Detection duration (target: < 2s)
- Cache hit rate (target: > 80%)
- Detection success rate (target: > 99%)
- Error rate by type

**Status Metrics:**
- Distribution of status types
- Time to fully_configured
- Auto-completion rate
- Migration completion rate

**Performance Metrics:**
- UI responsiveness during detection
- Broadcast latency (target: < 100ms)
- Test print success rate
- File monitoring accuracy

### Health Checks

**Startup Health Check:**
```
1. Run detection
2. Verify detector module loaded
3. Check registry access
4. Verify file system access
5. Test cache functionality
6. Log health check results
```

**Periodic Health Check (every 5 minutes):**
```
1. Verify clawPDF still installed
2. Check profile still exists
3. Verify spool folder accessible
4. Update status if changed
5. Broadcast updates if needed
```

## Documentation Updates Required

### User Documentation

**Installation Guide:**
- Add clawPDF installation instructions
- Update printer setup section
- Add troubleshooting for clawPDF
- Include screenshots of wizard

**Migration Guide:**
- Explain why migration is needed
- Step-by-step migration instructions
- How to verify migration success
- Rollback instructions if needed

**Troubleshooting Guide:**
- clawPDF not detected
- Profile configuration issues
- Spool folder problems
- Test print failures

### Developer Documentation

**Architecture Documentation:**
- Update component diagrams
- Document clawPDF detector API
- Explain detection algorithm
- Document IPC messages

**Testing Documentation:**
- Property-based test examples
- How to run tests
- How to add new tests
- Test data generators

**Deployment Documentation:**
- Migration deployment plan
- Rollback procedures
- Monitoring setup
- Alert configuration

