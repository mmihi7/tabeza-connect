# Testing Checklist - Version 1.7.11

**Quick Reference for Testing Onboarding Buttons**

---

## Pre-Test Setup

- [ ] Build completed: `pnpm build`
- [ ] Installer created: `dist/TabezaConnect-Setup-1.7.11.exe`
- [ ] Application installed
- [ ] DevTools open (F12)
- [ ] Console tab visible

---

## Phase 1: Initialization Verification

### Expected Console Logs (in order):
```
✓ [Preload] Context bridge established - electronAPI exposed to renderer
✓ [Diagnostic] Checking electronAPI availability...
✓ [Diagnostic] window.electronAPI exists: true
✓ [Diagnostic] electronAPI methods: [...]
✓ [Shared] Module loaded - Global functions registered: {...}
✓ [ModeRouter] Module loaded - Global functions registered: {...}
✓ [SetupMode] Module loaded - Global functions registered: {...}
✓ [Diagnostic] Verifying all scripts loaded...
✓ [Diagnostic] All scripts loaded successfully
✓ [ModeRouter] Initializing...
✓ [ModeRouter] Showing SETUP_MODE (progress tracker)
✓ [SetupMode] Initializing...
✓ [SetupMode] Auto-detecting completed steps...
✓ [SetupMode] Updating setup progress...
```

### Checklist:
- [ ] All logs appear in correct order
- [ ] No errors in console
- [ ] Setup progress tracker visible
- [ ] Three steps visible (Bar ID, Printer, Template)
- [ ] Each step has "Configure" button

---

## Phase 2: Bar ID Button Test

### Action:
Click "Configure" button for Bar ID step

### Expected Console Logs:
```
✓ [SetupMode] window.goToStep called with: barId
✓ [SetupMode] goToStep called with: barId
✓ [SetupMode] Hidden setup-progress
✓ [SetupMode] Shown step-panels
✓ [SetupMode] Found 3 step panels
✓ [SetupMode] Activated panel-barId
```

### Expected UI Changes:
- [ ] Progress tracker disappears
- [ ] Bar ID input panel appears
- [ ] Input field visible
- [ ] "Back" button visible
- [ ] "Save & Continue" button visible

### Result:
- [ ] ✅ PASS - Button works correctly
- [ ] ❌ FAIL - Button doesn't work (note error in console)

---

## Phase 3: Back Button Test

### Action:
Click "Back" button

### Expected Console Logs:
```
✓ [SetupMode] window.backToProgress called
✓ [SetupMode] Returning to progress tracker
✓ [SetupMode] Updating setup progress...
```

### Expected UI Changes:
- [ ] Bar ID panel disappears
- [ ] Progress tracker reappears
- [ ] All three steps visible again

### Result:
- [ ] ✅ PASS - Back button works
- [ ] ❌ FAIL - Back button doesn't work

---

## Phase 4: Printer Button Test

### Action:
Click "Configure" button for Printer step

### Expected Console Logs:
```
✓ [SetupMode] window.goToStep called with: printer
✓ [SetupMode] goToStep called with: printer
✓ [SetupMode] Activated panel-printer
```

### Expected UI Changes:
- [ ] Progress tracker disappears
- [ ] Printer setup panel appears
- [ ] "Launch Printer Setup" button visible

### Result:
- [ ] ✅ PASS - Button works correctly
- [ ] ❌ FAIL - Button doesn't work

---

## Phase 5: Template Button Test

### Action:
Click "Back", then click "Configure" for Template step

### Expected Console Logs:
```
✓ [SetupMode] window.goToStep called with: template
✓ [SetupMode] goToStep called with: template
✓ [SetupMode] Activated panel-template
```

### Expected UI Changes:
- [ ] Progress tracker disappears
- [ ] Template generator panel appears
- [ ] "Launch Template Generator" button visible

### Result:
- [ ] ✅ PASS - Button works correctly
- [ ] ❌ FAIL - Button doesn't work

---

## Phase 6: Save Bar ID Test

### Action:
1. Click "Back" to return to progress tracker
2. Click "Configure" for Bar ID
3. Enter "test-bar-123" in input field
4. Click "Save & Continue"

### Expected Console Logs:
```
✓ [SetupMode] window.saveBarId called
✓ [SetupMode] Saving Bar ID...
✓ [SetupMode] Bar ID saved successfully
✓ [SetupMode] Returning to progress tracker
```

### Expected UI Changes:
- [ ] Success notification appears (green)
- [ ] Returns to progress tracker
- [ ] Bar ID step shows green checkmark (✅)
- [ ] Progress bar updates to 33%
- [ ] Bar ID step status changes to "Complete"

### Result:
- [ ] ✅ PASS - Save works correctly
- [ ] ❌ FAIL - Save doesn't work

---

## Phase 7: electronAPI Verification (If Buttons Fail)

### Action:
In DevTools Console, type and execute:

```javascript
window.electronAPI
```

### Expected Result:
```javascript
{
  getSetupState: ƒ (),
  markStepComplete: ƒ (stepName),
  getConfig: ƒ (),
  saveBarId: ƒ (barId),
  checkPrinterSetup: ƒ (),
  checkTemplateStatus: ƒ (),
  launchPrinterSetup: ƒ (),
  launchTemplateGenerator: ƒ (),
  // ... more methods
}
```

### Checklist:
- [ ] Object with methods appears
- [ ] All required methods present
- [ ] No "undefined" result

### If electronAPI is undefined:
**Problem:** Preload script didn't run or context bridge failed  
**Location:** `src/preload.js` or electron-main.js BrowserWindow config

---

## Phase 8: IPC Handler Test (If electronAPI Exists But Buttons Fail)

### Action:
In DevTools Console, type and execute:

```javascript
await window.electronAPI.getSetupState()
```

### Expected Result:
```javascript
{
  firstRunComplete: false,
  steps: {
    barId: { completed: false },
    printer: { completed: false },
    template: { completed: false }
  }
}
```

### Checklist:
- [ ] Promise resolves successfully
- [ ] Object with setup state returned
- [ ] No errors in console

### If Promise rejects or returns undefined:
**Problem:** IPC handler not registered in main process  
**Location:** `src/electron-main.js` - check `ipcMain.handle('get-setup-state', ...)`

---

## Summary

### All Tests Pass ✅
**Status:** Onboarding system working correctly  
**Action:** Mark as complete, proceed with normal usage

### Some Tests Fail ❌
**Status:** Issue identified  
**Action:** 
1. Note which phase failed
2. Copy console error messages
3. Check if electronAPI exists (Phase 7)
4. Check if IPC handlers work (Phase 8)
5. Report findings with:
   - Failed phase number
   - Console logs
   - electronAPI verification result
   - IPC handler test result

---

## Quick Diagnostic Commands

Copy and paste these into DevTools Console:

```javascript
// Check if electronAPI exists
console.log('electronAPI exists:', typeof window.electronAPI !== 'undefined');

// Check if setup functions exist
console.log('Functions exist:', {
  goToStep: typeof window.goToStep,
  saveBarId: typeof window.saveBarId,
  initializeSetupMode: typeof window.initializeSetupMode
});

// Test IPC communication
window.electronAPI.getSetupState().then(
  state => console.log('Setup state:', state),
  error => console.error('IPC error:', error)
);

// Check if buttons have onclick handlers
document.querySelectorAll('button[onclick]').forEach(btn => {
  console.log('Button:', btn.textContent.trim(), 'onclick:', btn.getAttribute('onclick'));
});
```

---

**Version:** 1.7.11  
**Created:** 2026-03-05  
**Purpose:** Systematic testing of onboarding button functionality
