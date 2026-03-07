# Onboarding System Flow - Visual Reference

**Version:** 1.7.11  
**Purpose:** Visual representation of how the onboarding system works

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MAIN PROCESS                              │
│                     (electron-main.js)                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              IPC Handlers                               │    │
│  │  • get-setup-state                                      │    │
│  │  • mark-step-complete                                   │    │
│  │  • get-config                                           │    │
│  │  • save-bar-id                                          │    │
│  │  • check-printer-setup                                  │    │
│  │  • check-template-status                                │    │
│  │  • launch-printer-setup                                 │    │
│  │  • launch-template-generator                            │    │
│  └────────────────────────────────────────────────────────┘    │
│                           ↕                                      │
│                    Context Bridge                                │
│                      (preload.js)                                │
└─────────────────────────────────────────────────────────────────┘
                             ↕
┌─────────────────────────────────────────────────────────────────┐
│                     RENDERER PROCESS                             │
│                  (management-ui.html)                            │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              JavaScript Modules                         │    │
│  │                                                         │    │
│  │  shared.js          → Utility functions                │    │
│  │  mode-router.js     → Mode detection & switching       │    │
│  │  setup-mode.js      → Setup flow logic                 │    │
│  │  normal-mode.js     → Dashboard logic                  │    │
│  │  whats-new-dialog.js → Version notifications           │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                  UI Components                          │    │
│  │                                                         │    │
│  │  • Welcome Screen                                       │    │
│  │  • Setup Progress Tracker                               │    │
│  │  • Step Configuration Panels                            │    │
│  │  • Setup Complete Screen                                │    │
│  │  • Normal Mode Dashboard                                │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Initialization Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION STARTUP                           │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  1. Electron Main Process Starts                                │
│     • Creates BrowserWindow                                      │
│     • Loads preload.js                                           │
│     • Registers IPC handlers                                     │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. Preload Script Executes                                      │
│     • contextBridge.exposeInMainWorld('electronAPI', {...})      │
│     • console.log('[Preload] Context bridge established')        │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. HTML Loads (management-ui.html)                              │
│     • Shows loading screen                                       │
│     • Runs diagnostic script (checks electronAPI)                │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  4. JavaScript Modules Load (in order)                           │
│     • shared.js → exports utilities to window                    │
│     • mode-router.js → exports mode functions to window          │
│     • setup-mode.js → exports setup functions to window          │
│     • normal-mode.js → exports dashboard functions to window     │
│     • whats-new-dialog.js → handles version notifications        │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  5. Verification Script Runs                                     │
│     • Confirms all functions available                           │
│     • console.log('[Diagnostic] All scripts loaded')             │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  6. Mode Router Initializes                                      │
│     • initializeModeRouter() auto-runs                           │
│     • Calls determineMode()                                      │
└─────────────────────────────────────────────────────────────────┘
                             ↓
                    ┌────────┴────────┐
                    │  determineMode  │
                    └────────┬────────┘
                             ↓
              ┌──────────────┼──────────────┐
              ↓              ↓              ↓
      ┌──────────┐   ┌──────────┐   ┌──────────┐
      │FIRST_RUN │   │SETUP_MODE│   │NORMAL_MODE│
      │          │   │          │   │          │
      │Welcome   │   │Progress  │   │Dashboard │
      │Screen    │   │Tracker   │   │          │
      └──────────┘   └──────────┘   └──────────┘
```

---

## Setup Mode Flow (Detailed)

```
┌─────────────────────────────────────────────────────────────────┐
│              USER ENTERS SETUP MODE                              │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  showMode(SETUP_MODE)                                            │
│  • Hides loading screen                                          │
│  • Shows setup-mode container                                    │
│  • Calls showSetupProgress()                                     │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  showSetupProgress()                                             │
│  • Hides welcome screen                                          │
│  • Shows progress tracker                                        │
│  • Calls window.initializeSetupMode() ← CRITICAL                 │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  initializeSetupMode()                                           │
│  • Calls autoDetectCompletedSteps()                              │
│  • Calls updateSetupProgress()                                   │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  autoDetectCompletedSteps()                                      │
│  • Checks if Bar ID exists → mark complete                       │
│  • Checks if Printer configured → mark complete                  │
│  • Checks if Template exists → mark complete                     │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  updateSetupProgress()                                           │
│  • Calculates completion percentage                              │
│  • Updates progress bar                                          │
│  • Updates step icons (⚪ → ✅)                                   │
│  • Updates step status text                                      │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│              PROGRESS TRACKER DISPLAYED                          │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Setup Progress                                         │    │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │    │
│  │  0/3 steps complete                                     │    │
│  │                                                         │    │
│  │  ⚪ Bar ID Configuration      [Configure]              │    │
│  │  ⚪ Printer Setup              [Configure]              │    │
│  │  ⚪ Receipt Template           [Configure]              │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Button Click Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  USER CLICKS "Configure" BUTTON FOR BAR ID                       │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  HTML: onclick="goToStep('barId')"                               │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  window.goToStep('barId')                                        │
│  • console.log('[SetupMode] window.goToStep called')             │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  goToStep('barId')                                               │
│  • Validates step name                                           │
│  • console.log('[SetupMode] goToStep called with: barId')        │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  Hide Progress Tracker                                           │
│  • document.getElementById('setup-progress')                     │
│  • .classList.add('hidden')                                      │
│  • console.log('[SetupMode] Hidden setup-progress')              │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  Show Step Panels Container                                      │
│  • document.getElementById('step-panels')                        │
│  • .classList.remove('hidden')                                   │
│  • console.log('[SetupMode] Shown step-panels')                  │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  Hide All Step Panels                                            │
│  • document.querySelectorAll('.step-panel')                      │
│  • forEach(panel => panel.classList.remove('active'))            │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  Show Target Step Panel                                          │
│  • document.getElementById('panel-barId')                        │
│  • .classList.add('active')                                      │
│  • console.log('[SetupMode] Activated panel-barId')              │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  Load Step Data                                                  │
│  • loadStepData('barId')                                         │
│  • Calls loadBarIdData()                                         │
│  • Populates input field if Bar ID exists                        │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│              BAR ID PANEL DISPLAYED                              │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Configure Bar ID                                       │    │
│  │                                                         │    │
│  │  Enter your Bar ID from the Tabeza staff app.          │    │
│  │                                                         │    │
│  │  Bar ID: [_____________________________]               │    │
│  │                                                         │    │
│  │  [Back]                    [Save & Continue]            │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Save Bar ID Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  USER ENTERS BAR ID AND CLICKS "Save & Continue"                 │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  HTML: onclick="saveBarId()"                                     │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  window.saveBarId()                                              │
│  • console.log('[SetupMode] window.saveBarId called')            │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  saveBarId()                                                     │
│  • Gets input value                                              │
│  • Validates not empty                                           │
│  • console.log('[SetupMode] Saving Bar ID...')                   │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  IPC: window.electronAPI.saveBarId(barId)                        │
│  • Sends to main process                                         │
│  • Main process saves to config file                             │
│  • Returns success/failure                                       │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  IPC: window.electronAPI.markStepComplete('barId')               │
│  • Sends to main process                                         │
│  • Main process updates setup state                              │
│  • Returns success/failure                                       │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  Show Success Notification                                       │
│  • showNotification('Bar ID saved successfully', 'success')      │
│  • Green notification appears                                    │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  backToProgress()                                                │
│  • Hides step panel                                              │
│  • Shows progress tracker                                        │
│  • Calls updateSetupProgress()                                   │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│              PROGRESS TRACKER UPDATED                            │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Setup Progress                                         │    │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │    │
│  │  1/3 steps complete (33%)                               │    │
│  │                                                         │    │
│  │  ✅ Bar ID Configuration      Complete                  │    │
│  │  ⚪ Printer Setup              [Configure]              │    │
│  │  ⚪ Receipt Template           [Configure]              │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Function Call Chain

### When User Clicks "Configure" Button:

```
HTML onclick="goToStep('barId')"
    ↓
window.goToStep('barId')  [Global function exported by setup-mode.js]
    ↓
goToStep('barId')  [Internal function in setup-mode.js]
    ↓
    ├─→ Validate step name
    ├─→ Hide progress tracker
    ├─→ Show step panels container
    ├─→ Hide all panels
    ├─→ Show target panel
    └─→ loadStepData('barId')
            ↓
        loadBarIdData()
            ↓
        window.electronAPI.getConfig()
            ↓
        IPC: 'get-config' handler in main process
            ↓
        Returns config object
            ↓
        Populate input field
```

### When User Clicks "Save & Continue":

```
HTML onclick="saveBarId()"
    ↓
window.saveBarId()  [Global function exported by setup-mode.js]
    ↓
saveBarId()  [Internal function in setup-mode.js]
    ↓
    ├─→ Get input value
    ├─→ Validate not empty
    ├─→ window.electronAPI.saveBarId(barId)
    │       ↓
    │   IPC: 'save-bar-id' handler in main process
    │       ↓
    │   Save to config file
    │       ↓
    │   Return success
    │
    ├─→ window.electronAPI.markStepComplete('barId')
    │       ↓
    │   IPC: 'mark-step-complete' handler in main process
    │       ↓
    │   Update setup state
    │       ↓
    │   Return success
    │
    ├─→ showNotification('Bar ID saved successfully', 'success')
    │
    └─→ backToProgress()
            ↓
        Hide step panel
            ↓
        Show progress tracker
            ↓
        updateSetupProgress()
            ↓
        Update UI with new state
```

---

## Critical Success Factors

### ✅ For Buttons to Work:

1. **Preload Script Must Run**
   - Context bridge must expose electronAPI
   - All IPC methods must be available

2. **Scripts Must Load in Order**
   - shared.js → mode-router.js → setup-mode.js
   - Each must export functions to window object

3. **Functions Must Be Global**
   - `window.goToStep` must exist
   - `window.saveBarId` must exist
   - `window.backToProgress` must exist

4. **HTML Must Have Correct Handlers**
   - `onclick="goToStep('barId')"` (not `onclick="window.goToStep('barId')"`)
   - Browser automatically looks for global functions

5. **IPC Handlers Must Be Registered**
   - Main process must have all handlers
   - Handlers must return proper responses

---

## Debugging Decision Tree

```
Buttons don't work?
    ↓
Open DevTools Console
    ↓
Check: window.electronAPI exists?
    ↓
    ├─→ NO → Preload script issue
    │         Check: electron-main.js BrowserWindow config
    │         Check: preload.js loaded correctly
    │
    └─→ YES → Check: window.goToStep exists?
              ↓
              ├─→ NO → Script loading issue
              │         Check: setup-mode.js loaded?
              │         Check: Functions exported to window?
              │
              └─→ YES → Check: onclick handlers correct?
                        ↓
                        ├─→ NO → HTML issue
                        │         Fix onclick attributes
                        │
                        └─→ YES → Check: IPC handlers work?
                                  ↓
                                  Test: window.electronAPI.getSetupState()
                                  ↓
                                  ├─→ Fails → Main process issue
                                  │           Check: IPC handlers registered
                                  │
                                  └─→ Works → Logic issue
                                              Check: goToStep() implementation
                                              Check: Console for errors
```

---

**Version:** 1.7.11  
**Created:** 2026-03-05  
**Purpose:** Visual reference for understanding onboarding system flow
