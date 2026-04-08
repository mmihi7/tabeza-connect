# CRITICAL FIX - Version 1.7.12

**Date:** 2026-03-05  
**Previous Version:** 1.7.11  
**Issue:** Infinite recursion causing "Maximum call stack size exceeded"

---

## The Real Problem (Finally Found!)

The error was:
```
setup-mode.js:584 [SetupMode] window.goToStep called with: barId
setup-mode.js:584 Uncaught RangeError: Maximum call stack size exceeded
    at window.goToStep (setup-mode.js:584:3)
    at window.goToStep (setup-mode.js:585:3)
    at window.goToStep (setup-mode.js:585:3)
    ... (infinite recursion)
```

### Root Cause: JavaScript Scoping Issue

The problem was in how we exported functions to the window object:

**BROKEN CODE (1.7.11):**
```javascript
// Internal function
async function goToStep(stepName) {
  // ... implementation
}

// Global export
window.goToStep = function(stepName) {
  goToStep(stepName);  // ❌ This calls window.goToStep, not the internal function!
};
```

**Why This Fails:**
When JavaScript evaluates `goToStep(stepName)` inside the wrapper function, it looks for `goToStep` in the scope. Since `window.goToStep` is already defined, it resolves to `window.goToStep` instead of the internal `goToStep` function, creating infinite recursion!

```
User clicks button
  → onclick="goToStep('barId')"
  → window.goToStep('barId')
  → calls goToStep('barId')
  → resolves to window.goToStep('barId')  ← INFINITE LOOP!
  → calls goToStep('barId')
  → resolves to window.goToStep('barId')
  → ... forever until stack overflow
```

---

## The Fix

Renamed all internal functions to have `Internal` suffix to avoid name collision:

**FIXED CODE (1.7.12):**
```javascript
// Internal function with unique name
async function goToStepInternal(stepName) {
  // ... implementation
}

// Global export
window.goToStep = function(stepName) {
  goToStepInternal(stepName);  // ✅ Calls the internal function correctly!
};
```

---

## Functions Fixed

All 8 functions that had this issue:

1. ✅ `initializeSetupMode` → `initializeSetupModeInternal`
2. ✅ `goToStep` → `goToStepInternal`
3. ✅ `backToProgress` → `backToProgressInternal`
4. ✅ `saveBarId` → `saveBarIdInternal`
5. ✅ `launchPrinterWizard` → `launchPrinterWizardInternal`
6. ✅ `launchTemplateWizard` → `launchTemplateWizardInternal`
7. ✅ `showSetupComplete` → `showSetupCompleteInternal`
8. ✅ `updateSetupProgress` → `updateSetupProgressInternal`

---

## Files Modified

### `src/public/js/setup-mode.js`
- Renamed 8 internal functions to add `Internal` suffix
- Updated all internal calls to use new names
- Window exports now call correctly named internal functions

### `src/public/js/mode-router.js`
- Updated call to `initializeSetupModeInternal` (auto-updated by semantic rename)

### `package.json`
- Version bumped to 1.7.12

---

## Why This Wasn't Caught Earlier

1. **The code looked correct** - The pattern `window.fn = function() { fn(); }` seems logical
2. **JavaScript scoping is subtle** - The name resolution happens at runtime
3. **No syntax errors** - This is valid JavaScript, just creates infinite recursion
4. **Audit focused on structure** - We verified functions existed, not how they were called

---

## Testing

### Build and Install
```bash
cd tabeza-connect
pnpm build
```

Installer: `dist/TabezaConnect-Setup-1.7.12.exe`

### Expected Behavior

When you click "Configure" for Bar ID:

**Console Output:**
```
[SetupMode] window.goToStep called with: barId
[SetupMode] goToStep called with: barId
[SetupMode] Hidden setup-progress
[SetupMode] Shown step-panels
[SetupMode] Found 3 step panels
[SetupMode] Activated panel-barId
```

**UI:**
- Progress tracker disappears
- Bar ID input panel appears
- No errors in console
- No infinite loop

### All Buttons Should Work

- ✅ Configure Bar ID
- ✅ Configure Printer
- ✅ Configure Template
- ✅ Back button
- ✅ Save & Continue
- ✅ Launch Printer Setup
- ✅ Launch Template Generator

---

## Confidence Level

**VERY HIGH** - This was the actual bug causing the infinite recursion. The fix is straightforward and addresses the root cause.

---

## Lessons Learned

1. **Name collisions are dangerous** - Always use unique names for internal vs exported functions
2. **Test early** - Should have tested 1.7.10 before creating 1.7.11
3. **Console errors are gold** - The stack trace showed exactly where the problem was
4. **JavaScript scoping is tricky** - Function name resolution can be counterintuitive

---

**Status:** ✅ READY FOR BUILD AND TEST  
**Version:** 1.7.12  
**Created:** 2026-03-05
