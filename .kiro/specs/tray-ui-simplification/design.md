# Design Document: Tray UI Simplification

## Overview

This design document specifies the redesign of the Tabeza Connect system tray interaction and Management UI to improve discoverability and user experience. The redesign consolidates all management actions into a centralized Management UI while simplifying the tray context menu to essential service controls only.

The key innovation is a customer-friendly first-run onboarding experience that guides users through three critical setup steps: Bar ID configuration, printer setup, and receipt template generation. The UI uses progressive disclosure to emphasize critical setup items while minimizing secondary features until setup is complete.

### Design Goals

1. **Single-click tray access**: Users can click the tray icon once to open the Management UI
2. **Onboarding-first experience**: First-run users see a guided setup flow immediately
3. **Progressive disclosure**: Critical setup steps are prominent; advanced features are hidden until setup completes
4. **Minimal context menu**: Right-click menu contains only essential service controls
5. **State persistence**: UI remembers window position, size, and setup completion status

### Key Technical Decisions

- **Setup state storage**: Use Electron's `app.getPath('userData')` to store setup completion state in a JSON file
- **Mode detection**: Check setup state on every Management UI launch to determine Setup_Mode vs Normal_Mode
- **IPC communication**: Use Electron IPC for tray-to-window and window-to-service communication
- **Window management**: Use Electron's BrowserWindow API for window state persistence
- **UI framework**: Pure HTML/CSS/JavaScript (no framework) for simplicity and performance


## Architecture

### Component Structure

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron Main Process                    │
│  (electron-main.js)                                          │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Tray Manager │  │ Window       │  │ Setup State  │     │
│  │              │  │ Manager      │  │ Manager      │     │
│  │ - Icon       │  │ - Create     │  │ - Load       │     │
│  │ - Menu       │  │ - Focus      │  │ - Save       │     │
│  │ - Click      │  │ - Persist    │  │ - Check      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                  │                  │             │
│         └──────────────────┼──────────────────┘             │
│                            │                                │
│                     IPC Handlers                            │
│                            │                                │
└────────────────────────────┼────────────────────────────────┘
                             │
                             │ IPC Messages
                             │
┌────────────────────────────┼────────────────────────────────┐
│                  Renderer Process (Management UI)            │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Mode Router                              │  │
│  │  - Detects First_Run vs Setup_Mode vs Normal_Mode    │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                │
│         ┌──────────────────┴──────────────────┐            │
│         │                                      │            │
│  ┌──────▼──────┐                      ┌───────▼──────┐    │
│  │ Setup Mode  │                      │ Normal Mode  │    │
│  │ UI          │                      │ UI           │    │
│  │             │                      │              │    │
│  │ - Welcome   │                      │ - Dashboard  │    │
│  │ - Progress  │                      │ - Printer    │    │
│  │ - Bar ID    │                      │ - Template   │    │
│  │ - Printer   │                      │ - System     │    │
│  │ - Template  │                      │ - Logs       │    │
│  └─────────────┘                      └──────────────┘    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### State Management

The application maintains three types of state:

1. **Setup State** (persistent, stored in `userData/setup-state.json`):
   - `firstRunComplete`: boolean
   - `barIdConfigured`: boolean
   - `printerConfigured`: boolean
   - `templateConfigured`: boolean

2. **Window State** (persistent, stored in `userData/window-state.json`):
   - `width`: number
   - `height`: number
   - `x`: number
   - `y`: number
   - `lastActiveSection`: string

3. **Runtime State** (in-memory):
   - Service status (running/stopped)
   - Folder structure status
   - Current UI mode (Setup_Mode/Normal_Mode)


## Components and Interfaces

### 1. Tray Manager (Electron Main Process)

**Responsibilities:**
- Create and manage system tray icon
- Handle tray icon clicks (single, double, right-click)
- Build and update context menu based on service status
- Open/focus Management UI window

**Key Methods:**
```javascript
createTray()
  - Creates tray icon with appropriate color (green/yellow/red/grey)
  - Sets up click handlers
  - Builds initial context menu

updateTrayMenu()
  - Rebuilds context menu based on current service status
  - Updates menu items (Start/Stop Service)
  - Updates icon color based on setup completion

handleTrayClick()
  - Opens Management UI if closed
  - Focuses Management UI if already open

handleTrayRightClick()
  - Shows context menu
```

**Context Menu Structure:**
```
┌─────────────────────────────┐
│ Start Service / Stop Service│  (dynamic based on status)
├─────────────────────────────┤
│ Tabeza Connect v1.7.10      │  (disabled, shows version)
├─────────────────────────────┤
│ Quit                        │
└─────────────────────────────┘
```

### 2. Setup State Manager (Electron Main Process)

**Responsibilities:**
- Load and save setup completion state
- Check individual step completion
- Determine if first-run is complete

**Data Structure:**
```javascript
{
  firstRunComplete: false,
  steps: {
    barId: {
      completed: false,
      completedAt: null
    },
    printer: {
      completed: false,
      completedAt: null
    },
    template: {
      completed: false,
      completedAt: null
    }
  }
}
```

**Key Methods:**
```javascript
loadSetupState()
  - Reads setup-state.json from userData
  - Returns default state if file doesn't exist

saveSetupState(state)
  - Writes setup-state.json to userData
  - Validates state structure before saving

isSetupComplete()
  - Returns true if all three steps are complete
  - Returns false otherwise

markStepComplete(stepName)
  - Marks a specific step as complete
  - Updates completedAt timestamp
  - Checks if all steps are complete and updates firstRunComplete

getSetupProgress()
  - Returns { completed: number, total: 3, steps: {...} }
```

**IPC Handlers:**
```javascript
ipcMain.handle('get-setup-state', async () => {...})
ipcMain.handle('mark-step-complete', async (event, stepName) => {...})
ipcMain.handle('reset-setup-state', async () => {...})
```


### 3. Window Manager (Electron Main Process)

**Responsibilities:**
- Create Management UI window
- Persist and restore window state
- Handle window lifecycle events

**Key Methods:**
```javascript
createManagementWindow()
  - Creates BrowserWindow with saved dimensions/position
  - Loads appropriate HTML based on setup state
  - Sets up window event handlers

saveWindowState()
  - Saves current window dimensions and position
  - Triggered on window resize/move events (debounced)

restoreWindowState()
  - Loads saved window state from userData
  - Returns default state if no saved state exists
  - Default: { width: 900, height: 700, centered: true }

focusWindow()
  - Brings window to foreground if minimized
  - Focuses window if already visible
```

**IPC Handlers:**
```javascript
ipcMain.handle('get-window-state', async () => {...})
ipcMain.handle('save-active-section', async (event, section) => {...})
```

### 4. Mode Router (Renderer Process)

**Responsibilities:**
- Determine which UI mode to display
- Route to appropriate UI component
- Handle mode transitions

**Decision Logic:**
```javascript
async function determineMode() {
  const setupState = await ipcRenderer.invoke('get-setup-state');
  
  if (!setupState.firstRunComplete) {
    return 'FIRST_RUN';
  }
  
  const allStepsComplete = 
    setupState.steps.barId.completed &&
    setupState.steps.printer.completed &&
    setupState.steps.template.completed;
  
  if (!allStepsComplete) {
    return 'SETUP_MODE';
  }
  
  return 'NORMAL_MODE';
}
```

**Mode Transitions:**
```
FIRST_RUN → (click "Start Setup") → SETUP_MODE
SETUP_MODE → (all steps complete) → NORMAL_MODE
NORMAL_MODE → (never goes back to SETUP_MODE automatically)
```


### 5. Setup Mode UI (Renderer Process)

**Responsibilities:**
- Display welcome screen on first run
- Show setup progress tracker
- Provide interfaces for three critical steps
- Handle step completion

**UI Structure:**
```html
<div id="setup-mode">
  <!-- Welcome Screen (First Run Only) -->
  <div id="welcome-screen" class="hidden">
    <h1>Welcome to Tabeza Connect</h1>
    <p>Complete these 3 steps to start capturing receipts:</p>
    <ul>
      <li>Configure Bar ID</li>
      <li>Set up Printer</li>
      <li>Generate Receipt Template</li>
    </ul>
    <button onclick="startSetup()">Start Setup</button>
  </div>
  
  <!-- Setup Progress Tracker -->
  <div id="setup-progress">
    <div class="progress-bar">
      <span id="progress-text">0/3 steps complete</span>
      <div class="progress-fill" style="width: 0%"></div>
    </div>
    
    <div class="step-list">
      <div class="step" data-step="barId">
        <span class="step-icon">⚪</span>
        <span class="step-name">Bar ID Configuration</span>
        <span class="step-status">Not Started</span>
        <button onclick="goToStep('barId')">Configure</button>
      </div>
      
      <div class="step" data-step="printer">
        <span class="step-icon">⚪</span>
        <span class="step-name">Printer Setup</span>
        <span class="step-status">Not Started</span>
        <button onclick="goToStep('printer')">Configure</button>
      </div>
      
      <div class="step" data-step="template">
        <span class="step-icon">⚪</span>
        <span class="step-name">Receipt Template</span>
        <span class="step-status">Not Started</span>
        <button onclick="goToStep('template')">Configure</button>
      </div>
    </div>
  </div>
  
  <!-- Step Configuration Panels -->
  <div id="step-panels">
    <!-- Bar ID Panel -->
    <!-- Printer Panel -->
    <!-- Template Panel -->
  </div>
  
  <!-- Success Screen -->
  <div id="setup-complete" class="hidden">
    <h1>✓ Setup Complete!</h1>
    <p>Tabeza Connect is ready to capture receipts.</p>
    <button onclick="goToNormalMode()">Go to Dashboard</button>
  </div>
</div>
```

**Step Status Icons:**
- Not Started: ⚪ (grey circle)
- In Progress: 🟡 (yellow spinner animation)
- Complete: ✅ (green checkmark)

**Key Functions:**
```javascript
async function updateSetupProgress() {
  const state = await ipcRenderer.invoke('get-setup-state');
  const completed = Object.values(state.steps)
    .filter(step => step.completed).length;
  
  // Update progress bar
  document.getElementById('progress-text').textContent = 
    `${completed}/3 steps complete`;
  document.querySelector('.progress-fill').style.width = 
    `${(completed / 3) * 100}%`;
  
  // Update step icons and status
  for (const [stepName, stepData] of Object.entries(state.steps)) {
    updateStepUI(stepName, stepData.completed);
  }
  
  // Check if all complete
  if (completed === 3) {
    showSetupComplete();
  }
}

function updateStepUI(stepName, completed) {
  const stepEl = document.querySelector(`[data-step="${stepName}"]`);
  const icon = stepEl.querySelector('.step-icon');
  const status = stepEl.querySelector('.step-status');
  
  if (completed) {
    icon.textContent = '✅';
    status.textContent = 'Complete';
    status.className = 'step-status complete';
  } else {
    icon.textContent = '⚪';
    status.textContent = 'Not Started';
    status.className = 'step-status not-started';
  }
}
```


### 6. Normal Mode UI (Renderer Process)

**Responsibilities:**
- Display full dashboard with all features
- Provide tabbed/sectioned navigation
- Show service status and statistics
- Provide access to all management functions

**UI Structure:**
```html
<div id="normal-mode">
  <!-- Navigation Tabs -->
  <nav class="tabs">
    <button class="tab active" data-section="dashboard">Dashboard</button>
    <button class="tab" data-section="printer">Printer Setup</button>
    <button class="tab" data-section="template">Template Generator</button>
    <button class="tab" data-section="system">System</button>
    <button class="tab" data-section="logs">Logs</button>
  </nav>
  
  <!-- Section Content -->
  <div class="sections">
    <div id="dashboard-section" class="section active">
      <!-- Service status, folder status, quick actions -->
    </div>
    
    <div id="printer-section" class="section">
      <!-- Printer configuration interface -->
    </div>
    
    <div id="template-section" class="section">
      <!-- Template generator interface -->
    </div>
    
    <div id="system-section" class="section">
      <!-- Folder repair, diagnostics -->
    </div>
    
    <div id="logs-section" class="section">
      <!-- Log viewer -->
    </div>
  </div>
</div>
```

**Section Switching:**
```javascript
function switchSection(sectionName) {
  // Hide all sections
  document.querySelectorAll('.section').forEach(s => {
    s.classList.remove('active');
  });
  
  // Show target section
  document.getElementById(`${sectionName}-section`)
    .classList.add('active');
  
  // Update tab highlighting
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.remove('active');
  });
  document.querySelector(`[data-section="${sectionName}"]`)
    .classList.add('active');
  
  // Save active section
  ipcRenderer.invoke('save-active-section', sectionName);
}
```

**Keyboard Shortcuts:**
```javascript
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey) {
    switch(e.key) {
      case '1': switchSection('dashboard'); break;
      case '2': switchSection('printer'); break;
      case '3': switchSection('template'); break;
      case '4': switchSection('system'); break;
      case '5': switchSection('logs'); break;
      case 'r': restartService(); break;
    }
  }
});
```


## Data Models

### Setup State Model

```typescript
interface SetupState {
  firstRunComplete: boolean;
  steps: {
    barId: StepStatus;
    printer: StepStatus;
    template: StepStatus;
  };
}

interface StepStatus {
  completed: boolean;
  completedAt: string | null;  // ISO 8601 timestamp
}
```

**Storage Location:** `app.getPath('userData')/setup-state.json`

**Example:**
```json
{
  "firstRunComplete": false,
  "steps": {
    "barId": {
      "completed": true,
      "completedAt": "2026-03-04T10:30:00.000Z"
    },
    "printer": {
      "completed": false,
      "completedAt": null
    },
    "template": {
      "completed": false,
      "completedAt": null
    }
  }
}
```

### Window State Model

```typescript
interface WindowState {
  width: number;
  height: number;
  x: number | null;  // null means centered
  y: number | null;  // null means centered
  lastActiveSection: string;
}
```

**Storage Location:** `app.getPath('userData')/window-state.json`

**Example:**
```json
{
  "width": 900,
  "height": 700,
  "x": 100,
  "y": 100,
  "lastActiveSection": "dashboard"
}
```

### Configuration Model (Existing)

```typescript
interface Config {
  barId: string;
  apiUrl: string;
  watchFolder: string;
  httpPort: number;
}
```

**Storage Location:** `C:\TabezaPrints\config.json`

**Note:** This model already exists and is not changed by this feature. The Bar ID step completion is determined by checking if `config.barId` is non-empty.


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Setup Mode Persistence

*For any* Management UI session, if all three critical steps (Bar ID, Printer, Template) are marked complete, then the UI should remain in Normal_Mode on subsequent launches until setup state is manually reset.

**Validates: Requirements 1.6, 1.7, 14.7**

### Property 2: Setup Progress Accuracy

*For any* setup state, the displayed progress (X/3 steps complete) should equal the count of steps where `completed === true`.

**Validates: Requirements 2.6**

### Property 3: Step Status Visual Consistency

*For any* step in the setup progress tracker, the visual indicator (icon and text) should match the step's completion state: grey circle + "Not Started" for incomplete, green checkmark + "Complete" for completed.

**Validates: Requirements 2.3, 2.5**

### Property 4: Bar ID Configuration Round Trip

*For any* valid Bar ID string, saving it to configuration and then reading it back should return the same value.

**Validates: Requirements 3.4**

### Property 5: Bar ID Validation

*For any* empty or whitespace-only string, attempting to save it as a Bar ID should be rejected and the configuration should remain unchanged.

**Validates: Requirements 3.3**

### Property 6: Bar ID Auto-Detection

*For any* existing configuration with a non-empty Bar ID, when the Management UI loads, the Bar ID step should be automatically marked as Complete.

**Validates: Requirements 3.7**

### Property 7: Tray Click Opens Window

*For any* tray icon click (single or double), if the Management UI window is not open, the window should be created and displayed.

**Validates: Requirements 4.1, 4.2**

### Property 8: Tray Click Focuses Existing Window

*For any* tray icon click when the Management UI window is already open, the window should be brought to the foreground and focused without creating a new window.

**Validates: Requirements 4.3**

### Property 9: Context Menu Structure

*For any* context menu rendering, the menu should contain exactly 3 items: service control (Start/Stop), version info (disabled), and Quit, with no additional items.

**Validates: Requirements 4.5, 5.8**

### Property 10: Service Control Menu Text

*For any* service state (running or stopped), the context menu should display "Stop Service" when running and "Start Service" when stopped.

**Validates: Requirements 5.1, 5.2**

### Property 11: Mode-Based Feature Visibility

*For any* UI rendering in Setup_Mode, secondary features (diagnostics, advanced settings, folder management) should be hidden or minimized, and should become visible when transitioning to Normal_Mode.

**Validates: Requirements 6.2, 6.4**

### Property 12: Window State Round Trip

*For any* window dimensions and position, saving the state, closing the window, and reopening should restore the same dimensions and position.

**Validates: Requirements 14.1, 14.2, 14.3**

### Property 13: Default Window State

*For any* first launch with no saved window state, the Management UI should open with dimensions 900x700 pixels and be centered on the primary monitor.

**Validates: Requirements 14.4**

### Property 14: Section State Persistence

*For any* active section selection, closing the Management UI and reopening should restore the same active section.

**Validates: Requirements 14.5, 14.6**

### Property 15: UI Responsiveness During Background Operations

*For any* background operation (folder repair, service restart), the Management UI should remain interactive and respond to user input without blocking.

**Validates: Requirements 19.5**


## Error Handling

### 1. Setup State File Corruption

**Scenario:** `setup-state.json` is corrupted or contains invalid JSON

**Handling:**
- Catch JSON parse errors in `loadSetupState()`
- Log error to electron.log
- Return default setup state (all steps incomplete)
- Display warning notification to user: "Setup state was reset due to file corruption"

**Code:**
```javascript
function loadSetupState() {
  try {
    const data = fs.readFileSync(setupStatePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    log('ERROR', `Setup state corrupted: ${error.message}`);
    showNotification('Setup State Reset', 
      'Setup state was reset due to file corruption');
    return getDefaultSetupState();
  }
}
```

### 2. Window State File Corruption

**Scenario:** `window-state.json` is corrupted or contains invalid data

**Handling:**
- Catch JSON parse errors in `restoreWindowState()`
- Log error to electron.log
- Return default window state (900x700, centered)
- Do not notify user (graceful degradation)

### 3. IPC Communication Failure

**Scenario:** Renderer process cannot communicate with main process

**Handling:**
- Wrap all `ipcRenderer.invoke()` calls in try-catch
- Display error notification in UI
- Provide retry button
- Log error details for debugging

**Code:**
```javascript
async function getSetupState() {
  try {
    return await ipcRenderer.invoke('get-setup-state');
  } catch (error) {
    console.error('IPC error:', error);
    showAlert('Cannot connect to service. Please restart the application.', 'error');
    return null;
  }
}
```

### 4. Step Completion Failure

**Scenario:** User completes a step but marking it complete fails

**Handling:**
- Display error notification with specific error message
- Keep step in "In Progress" state
- Provide "Retry" button
- Log error for debugging

### 5. Window Creation Failure

**Scenario:** Management UI window fails to create

**Handling:**
- Log error with full stack trace
- Display system notification: "Failed to open Management UI"
- Keep tray icon active
- Allow user to retry via tray menu

### 6. Missing HTML Files

**Scenario:** Management UI HTML file not found at expected path

**Handling:**
- Log error with expected path
- Display error page with diagnostic information
- Show paths checked (dev and production)
- Provide "Open Logs" button


## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs

Both testing approaches are complementary and necessary. Unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across a wide range of inputs.

### Property-Based Testing Configuration

**Library:** fast-check (JavaScript property-based testing library)

**Configuration:**
- Minimum 100 iterations per property test (due to randomization)
- Each property test must reference its design document property
- Tag format: `Feature: tray-ui-simplification, Property {number}: {property_text}`

**Example Property Test:**
```javascript
// Feature: tray-ui-simplification, Property 2: Setup Progress Accuracy
test('setup progress count matches completed steps', () => {
  fc.assert(
    fc.property(
      fc.record({
        barId: fc.boolean(),
        printer: fc.boolean(),
        template: fc.boolean()
      }),
      (stepStates) => {
        const setupState = {
          steps: {
            barId: { completed: stepStates.barId, completedAt: null },
            printer: { completed: stepStates.printer, completedAt: null },
            template: { completed: stepStates.template, completedAt: null }
          }
        };
        
        const expectedCount = Object.values(stepStates)
          .filter(v => v).length;
        const actualCount = calculateProgress(setupState);
        
        return actualCount === expectedCount;
      }
    ),
    { numRuns: 100 }
  );
});
```

### Unit Testing Focus Areas

1. **Setup State Management**
   - Loading default state when file doesn't exist
   - Handling corrupted JSON files
   - Marking individual steps complete
   - Detecting when all steps are complete

2. **Window State Persistence**
   - Saving window dimensions on resize
   - Saving window position on move
   - Restoring saved state on launch
   - Using default state when no saved state exists

3. **Mode Detection**
   - First run detection
   - Setup mode detection (some steps incomplete)
   - Normal mode detection (all steps complete)

4. **UI Rendering**
   - Correct step icons for each state
   - Progress bar percentage calculation
   - Section visibility in Setup vs Normal mode

5. **Error Handling**
   - Graceful degradation on file corruption
   - IPC communication failures
   - Missing configuration files

### Integration Testing

**Scenario 1: First-Run Experience**
1. Delete setup-state.json
2. Launch application
3. Click tray icon
4. Verify welcome screen displays
5. Click "Start Setup"
6. Verify setup progress tracker displays
7. Complete all three steps
8. Verify success screen displays
9. Close and reopen
10. Verify Normal Mode displays

**Scenario 2: Partial Setup Resume**
1. Set setup state with Bar ID complete, others incomplete
2. Launch application
3. Click tray icon
4. Verify Setup Mode displays (not welcome screen)
5. Verify Bar ID shows green checkmark
6. Verify other steps show grey circles

**Scenario 3: Window State Persistence**
1. Open Management UI
2. Resize to 1200x800
3. Move to position (200, 200)
4. Switch to Printer section
5. Close window
6. Reopen via tray icon
7. Verify dimensions are 1200x800
8. Verify position is (200, 200)
9. Verify Printer section is active

### Performance Testing

**Metrics to Measure:**
- Window open time (target: < 500ms)
- Section switch time (target: < 100ms)
- Status update time (target: < 1000ms)
- Log load time (target: < 500ms)

**Testing Approach:**
- Use `performance.now()` to measure operation times
- Run each test 10 times and calculate average
- Fail test if average exceeds target


## Implementation Notes

### File Structure Changes

**New Files:**
```
src/
├── electron-main.js (modified)
├── public/
│   ├── management-ui.html (new - replaces dashboard.html)
│   ├── css/
│   │   ├── setup-mode.css (new)
│   │   └── normal-mode.css (new)
│   └── js/
│       ├── mode-router.js (new)
│       ├── setup-mode.js (new)
│       ├── normal-mode.js (new)
│       └── shared.js (new - common utilities)
└── lib/
    ├── setup-state-manager.js (new)
    └── window-state-manager.js (new)
```

**Modified Files:**
- `electron-main.js`: Simplified tray menu, added setup state management
- `public/dashboard.html`: Replaced by `management-ui.html`

**Deprecated Files:**
- `public/index.html`: No longer used (replaced by management-ui.html)

### Migration Strategy

**For Existing Installations:**

1. **Detect existing configuration:**
   - Check if `C:\TabezaPrints\config.json` exists and has Bar ID
   - Check if printer is configured via `check-printer-setup` IPC
   - Check if template exists at `C:\TabezaPrints\templates\template.json`

2. **Auto-populate setup state:**
   ```javascript
   function migrateExistingInstallation() {
     const config = loadConfig();
     const printerStatus = checkPrinterSetup();
     const templateExists = fs.existsSync(templatePath);
     
     const setupState = {
       firstRunComplete: true,  // Skip welcome screen
       steps: {
         barId: {
           completed: !!config.barId,
           completedAt: config.barId ? new Date().toISOString() : null
         },
         printer: {
           completed: printerStatus.status === 'FullyConfigured',
           completedAt: printerStatus.status === 'FullyConfigured' 
             ? new Date().toISOString() : null
         },
         template: {
           completed: templateExists,
           completedAt: templateExists ? new Date().toISOString() : null
         }
       }
     };
     
     saveSetupState(setupState);
   }
   ```

3. **Show "What's New" message:**
   - Display brief modal on first launch after upgrade
   - Explain new single-click tray behavior
   - Provide "Don't show again" checkbox

### Backward Compatibility

**Configuration Files:**
- Existing `config.json` format unchanged
- New setup state files are additive (don't break existing installs)

**IPC Handlers:**
- All existing IPC handlers remain functional
- New handlers are additive

**Window Behavior:**
- Existing users see Normal Mode immediately (via migration)
- No disruption to existing workflows

### Development vs Production Paths

**Setup State Location:**
```javascript
const setupStatePath = path.join(
  app.getPath('userData'),
  'setup-state.json'
);
```

**Window State Location:**
```javascript
const windowStatePath = path.join(
  app.getPath('userData'),
  'window-state.json'
);
```

**HTML File Location:**
```javascript
const htmlPath = isDev
  ? path.join(__dirname, '../public/management-ui.html')
  : path.join(process.resourcesPath, 'public/management-ui.html');
```

### Accessibility Considerations

**ARIA Labels:**
```html
<button 
  aria-label="Configure Bar ID"
  aria-describedby="barId-description">
  Configure
</button>
<span id="barId-description" class="sr-only">
  Enter your Bar ID from the Tabeza staff app
</span>
```

**Keyboard Navigation:**
- All interactive elements must be keyboard accessible
- Tab order follows logical flow
- Focus indicators clearly visible
- Keyboard shortcuts documented in UI

**Screen Reader Support:**
```html
<div role="status" aria-live="polite" id="setup-progress-status">
  2 of 3 steps complete
</div>
```

**Color Contrast:**
- All text meets WCAG AA standards (4.5:1 for normal text)
- Status indicators use both color and icons (not color alone)
- Focus indicators have 3:1 contrast ratio


## UI/UX Specifications

### Visual Design System

**Color Palette:**
```css
:root {
  /* Primary Colors */
  --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --primary-color: #667eea;
  
  /* Status Colors */
  --status-success: #10b981;
  --status-warning: #f59e0b;
  --status-error: #ef4444;
  --status-inactive: #9ca3af;
  
  /* Neutral Colors */
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --text-primary: #333333;
  --text-secondary: #666666;
  --border-color: #e0e0e0;
}
```

**Typography:**
```css
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.5;
}

h1 { font-size: 32px; font-weight: 600; }
h2 { font-size: 24px; font-weight: 600; }
h3 { font-size: 18px; font-weight: 600; }
```

**Spacing System:**
```css
:root {
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
}
```

### Setup Mode Layout

**Welcome Screen:**
```
┌─────────────────────────────────────────────────┐
│                                                 │
│              🖨️ Welcome to Tabeza Connect       │
│                                                 │
│     Complete these 3 steps to start capturing  │
│                    receipts:                    │
│                                                 │
│     1. Configure Bar ID                         │
│     2. Set up Printer                           │
│     3. Generate Receipt Template                │
│                                                 │
│              [Start Setup →]                    │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Setup Progress Tracker:**
```
┌─────────────────────────────────────────────────┐
│  Setup Progress: 1/3 steps complete             │
│  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│                                                 │
│  ✅ Bar ID Configuration          [Complete]   │
│     Your Bar ID is configured                   │
│                                                 │
│  ⚪ Printer Setup                 [Configure]   │
│     Set up printer pooling                      │
│                                                 │
│  ⚪ Receipt Template              [Configure]   │
│     Generate parsing template                   │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Normal Mode Layout

**Dashboard Section:**
```
┌─────────────────────────────────────────────────┐
│ [Dashboard] [Printer] [Template] [System] [Logs]│
├─────────────────────────────────────────────────┤
│                                                 │
│  Service Status                                 │
│  ● Running                                      │
│  Uptime: 2h 15m                                 │
│                                                 │
│  Configuration                                  │
│  Bar ID: bar-abc123                             │
│  Watch Folder: C:\TabezaPrints                  │
│                                                 │
│  Quick Actions                                  │
│  [Restart Service] [Open Folder] [View Logs]   │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Animation Specifications

**Progress Bar Fill:**
```css
.progress-fill {
  transition: width 0.3s ease-in-out;
}
```

**Step Icon Change:**
```css
.step-icon {
  transition: all 0.2s ease-in-out;
}

.step-icon.complete {
  animation: checkmark-pop 0.3s ease-out;
}

@keyframes checkmark-pop {
  0% { transform: scale(0); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}
```

**Section Transition:**
```css
.section {
  opacity: 0;
  transition: opacity 0.15s ease-in-out;
}

.section.active {
  opacity: 1;
}
```

### Responsive Behavior

**Minimum Window Size:**
- Width: 800px
- Height: 600px

**Maximum Window Size:**
- Width: 1400px
- Height: 1000px

**Scaling:**
- UI elements scale proportionally within min/max bounds
- Text remains readable at all sizes
- Buttons maintain minimum touch target size (44x44px)


## Security Considerations

### File System Access

**Setup State File:**
- Stored in Electron's userData directory (user-specific, not system-wide)
- No sensitive data stored (only boolean completion flags)
- File permissions: User read/write only

**Window State File:**
- Stored in Electron's userData directory
- Contains only window dimensions and position
- No security implications

**Configuration File:**
- Existing location: `C:\TabezaPrints\config.json`
- Contains Bar ID (not sensitive, but should not be world-readable)
- File permissions should be restricted to user and SYSTEM account

### IPC Security

**Context Isolation:**
```javascript
webPreferences: {
  nodeIntegration: false,      // Disable Node.js in renderer
  contextIsolation: true,      // Enable context isolation
  preload: path.join(__dirname, 'preload.js')
}
```

**Preload Script:**
```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSetupState: () => ipcRenderer.invoke('get-setup-state'),
  markStepComplete: (step) => ipcRenderer.invoke('mark-step-complete', step),
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  // ... other safe IPC methods
});
```

**Input Validation:**
- Validate all IPC parameters in main process
- Sanitize file paths to prevent directory traversal
- Validate step names against whitelist

### XSS Prevention

**Content Security Policy:**
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self'; 
               style-src 'self' 'unsafe-inline';">
```

**DOM Manipulation:**
- Use `textContent` instead of `innerHTML` for user-provided data
- Sanitize any HTML before rendering
- Avoid `eval()` and `Function()` constructors

### Privilege Escalation

**Printer Setup:**
- Printer pooling setup requires admin privileges
- Use Electron's `shell.openExternal()` with UAC prompt
- Never store admin credentials
- Validate PowerShell script paths before execution

**Service Control:**
- Service start/stop operations run as current user
- No privilege escalation required
- Validate service name before operations


## Performance Optimization

### Window Creation

**Lazy Loading:**
- Don't create Management UI window until user clicks tray icon
- Keep window hidden when closed (don't destroy)
- Reuse existing window instance when possible

**Code:**
```javascript
let mainWindow = null;

function showManagementUI() {
  if (mainWindow) {
    // Reuse existing window
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  } else {
    // Create new window
    mainWindow = createManagementWindow();
  }
}
```

### State Loading

**Caching:**
- Cache setup state in memory after first load
- Only reload from disk when explicitly needed
- Use file watchers to detect external changes

**Debouncing:**
- Debounce window state saves (500ms delay)
- Prevent excessive disk writes during resize/move

**Code:**
```javascript
let saveWindowStateTimeout = null;

function scheduleWindowStateSave() {
  if (saveWindowStateTimeout) {
    clearTimeout(saveWindowStateTimeout);
  }
  
  saveWindowStateTimeout = setTimeout(() => {
    saveWindowState();
  }, 500);
}
```

### UI Rendering

**Virtual Scrolling:**
- Use virtual scrolling for log viewer (only render visible lines)
- Improves performance with large log files

**Incremental Updates:**
- Update only changed DOM elements
- Use `requestAnimationFrame` for animations
- Batch DOM updates to minimize reflows

**Code:**
```javascript
function updateStepStatus(stepName, completed) {
  // Only update if status changed
  const stepEl = document.querySelector(`[data-step="${stepName}"]`);
  const currentStatus = stepEl.dataset.completed === 'true';
  
  if (currentStatus !== completed) {
    requestAnimationFrame(() => {
      stepEl.dataset.completed = completed;
      updateStepIcon(stepEl, completed);
    });
  }
}
```

### Memory Management

**Event Listener Cleanup:**
```javascript
function cleanupWindow() {
  if (mainWindow) {
    mainWindow.removeAllListeners();
    mainWindow = null;
  }
}
```

**IPC Handler Cleanup:**
```javascript
app.on('before-quit', () => {
  ipcMain.removeHandler('get-setup-state');
  ipcMain.removeHandler('mark-step-complete');
  // ... remove all handlers
});
```

### Startup Optimization

**Parallel Initialization:**
```javascript
async function initialize() {
  // Run these in parallel
  await Promise.all([
    createTray(),
    loadSetupState(),
    loadWindowState(),
    startBackgroundService()
  ]);
}
```

**Deferred Operations:**
- Don't check printer status until user opens Management UI
- Don't load logs until user opens Logs section
- Defer non-critical operations until after window is visible


## Deployment Considerations

### Installer Changes

**Setup State Initialization:**
- Installer should NOT create setup-state.json
- Let application create it on first run
- This ensures first-run experience triggers correctly

**Migration Script:**
- Include migration logic in application startup
- Detect existing installations and auto-populate setup state
- Run migration only once (set flag after completion)

### Update Process

**Preserving User Data:**
- Setup state file persists across updates (in userData)
- Window state file persists across updates (in userData)
- Configuration file persists (in C:\TabezaPrints)

**Version Detection:**
```javascript
function checkForUpdates() {
  const lastVersion = loadLastVersion();
  const currentVersion = app.getVersion();
  
  if (lastVersion !== currentVersion) {
    // Show "What's New" dialog
    showWhatsNew(lastVersion, currentVersion);
    saveLastVersion(currentVersion);
  }
}
```

### Rollback Strategy

**If Update Fails:**
1. Setup state and window state are preserved
2. User can continue using previous version
3. No data loss occurs

**Manual Rollback:**
- User can delete setup-state.json to reset to first-run
- User can delete window-state.json to reset window position
- Configuration file remains untouched

### Monitoring and Telemetry

**Events to Track:**
- First-run completion rate
- Time to complete each setup step
- Setup abandonment rate (which step users quit on)
- Window open frequency
- Section usage frequency
- Error rates by type

**Privacy:**
- No personally identifiable information collected
- Bar ID is hashed before sending
- User can opt out of telemetry

### Documentation Updates

**User Guide:**
- Update screenshots to show new UI
- Document single-click tray behavior
- Explain setup process with step-by-step guide
- Document keyboard shortcuts

**Developer Guide:**
- Document new IPC handlers
- Explain setup state management
- Provide examples of extending UI

**Release Notes:**
- Highlight single-click tray access
- Explain new onboarding flow
- Note simplified context menu
- Mention backward compatibility


## Open Questions and Future Enhancements

### Open Questions

1. **Setup State Reset:**
   - Should there be a UI option to reset setup state?
   - If yes, should it require confirmation?
   - Should it be in Normal Mode or only accessible via developer tools?

2. **Multi-Monitor Support:**
   - How should window positioning work with multiple monitors?
   - Should we detect if saved position is off-screen and auto-center?
   - Should we remember which monitor the window was on?

3. **Setup Step Order:**
   - Should steps be completed in a specific order?
   - Or can users complete them in any order?
   - Current design: any order is fine

4. **Template Auto-Detection:**
   - Should we auto-detect if template exists and mark step complete?
   - Or require explicit user confirmation?
   - Current design: auto-detect like Bar ID and Printer

### Future Enhancements

**Phase 2: Enhanced Onboarding**
- Video tutorials embedded in setup steps
- Interactive tooltips explaining each field
- Test receipt printing from within setup wizard
- Automatic printer detection and recommendation

**Phase 3: Advanced Features**
- Multiple Bar ID support (for multi-location venues)
- Setup profiles (save/load different configurations)
- Remote configuration via Tabeza cloud
- Setup progress sync across devices

**Phase 4: Analytics Dashboard**
- Receipt capture statistics
- Parsing accuracy metrics
- Service uptime tracking
- Error rate monitoring

**Phase 5: Customization**
- Theme selection (light/dark mode)
- Custom keyboard shortcuts
- Configurable dashboard widgets
- Layout customization

### Known Limitations

1. **Single Instance:**
   - Only one Management UI window can be open at a time
   - Multiple windows would complicate state management
   - Future: Consider multi-window support for advanced users

2. **No Undo:**
   - Marking a step complete cannot be undone via UI
   - User must manually edit setup-state.json or reset entirely
   - Future: Add "Mark as Incomplete" button in developer mode

3. **No Setup Validation:**
   - Steps can be marked complete even if configuration is invalid
   - Example: Bar ID can be any string, not validated against server
   - Future: Add server-side validation before marking complete

4. **No Progress Persistence During Setup:**
   - If user closes window during Bar ID entry, progress is lost
   - Only saved when user clicks "Save"
   - Future: Auto-save draft state every 30 seconds

### Migration Path for Future Changes

**Adding New Setup Steps:**
```javascript
// Backward compatible: existing users skip new steps
function migrateSetupState(oldState) {
  return {
    ...oldState,
    steps: {
      ...oldState.steps,
      newStep: {
        completed: true,  // Auto-complete for existing users
        completedAt: new Date().toISOString()
      }
    }
  };
}
```

**Changing Setup State Structure:**
```javascript
// Version-based migration
function loadSetupState() {
  const state = readSetupStateFile();
  const version = state.version || 1;
  
  if (version < 2) {
    return migrateV1ToV2(state);
  }
  
  return state;
}
```

