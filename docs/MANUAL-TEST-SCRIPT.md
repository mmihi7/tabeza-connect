# Manual Test Script - TabezaConnect v1.7.0

**Date**: March 4, 2026  
**Tester**: _________________  
**Build**: TabezaConnect-Setup-1.7.0.exe

---

## Pre-Test Setup

- [ ] Uninstall any previous version of Tabeza Connect
- [ ] Delete `C:\TabezaPrints\` folder if it exists
- [ ] Delete `C:\Program Files\TabezaConnect\` folder if it exists
- [ ] Close all browsers
- [ ] Note: You'll need a Bar ID from Tabeza dashboard for Test 3

---

## Test 1: Installation Flow

**Objective**: Verify installer creates correct folder structure and launches app

### Steps

1. **Run installer**
   - [ ] Double-click `TabezaConnect-Setup-1.7.0.exe`
   - [ ] Installer window opens
   - [ ] Click "Next" through installation wizard

2. **Verify installation directory prompt**
   - [ ] Default path shows: `C:\Program Files\TabezaConnect`
   - [ ] Path does NOT show nested "Tabeza Connect" folder
   - [ ] Click "Next"

3. **Printer pooling prompt (may not appear)**
   - [ ] Installer MAY ask: "Would you like to configure printer pooling now?"
   - [ ] If prompt appears: Click "No" (we'll configure later from tray menu)
   - [ ] If prompt doesn't appear: That's OK, continue to next step
   - [ ] Installation continues

4. **Verify folder creation**
   - [ ] Open File Explorer
   - [ ] Navigate to `C:\TabezaPrints\`
   - [ ] Verify folders exist:
     - [ ] `processed\`
     - [ ] `failed\`
     - [ ] `logs\`
     - [ ] `queue\`
     - [ ] `queue\pending\`
     - [ ] `queue\uploaded\`
     - [ ] `templates\`
   - [ ] Verify file exists: `order.prn` (should be empty)

5. **Verify installation path**
   - [ ] Navigate to `C:\Program Files\TabezaConnect\`
   - [ ] Verify executable exists: `TabezaConnect.exe`
   - [ ] Verify NO nested "Tabeza Connect" folder inside
   - [ ] Path should be: `C:\Program Files\TabezaConnect\TabezaConnect.exe`

6. **Post-install message**
   - [ ] Message box appears with title: "Tabeza Connect has been installed successfully!"
   - [ ] Message shows next steps:
     - [ ] "The app will open automatically"
     - [ ] "Configure your Bar ID in the management UI"
     - [ ] "Set up printer pooling from the system tray menu"
   - [ ] Click "OK"

7. **Auto-launch verification**
   - [ ] App launches automatically (within 2-3 seconds)
   - [ ] No visible window appears (runs in background)
   - [ ] Proceed to Test 2

### Expected Results
✅ Installer completes without errors  
✅ Folders created at `C:\TabezaPrints\`  
✅ Executable at `C:\Program Files\TabezaConnect\TabezaConnect.exe` (no nesting)  
✅ Post-install message appears  
✅ App launches automatically  

### Actual Results
- Installation path: _________________
- Folders created: ☐ Yes ☐ No
- Post-install message: ☐ Yes ☐ No
- Auto-launch: ☐ Yes ☐ No
- Issues: _________________

---

## Test 2: First Launch Flow

**Objective**: Verify app creates config, tray icon, and starts service

### Steps

1. **System tray icon**
   - [ ] Look at system tray (bottom-right corner of screen, near clock)
   - [ ] Verify Tabeza Connect icon appears
   - [ ] Icon should be visible (not hidden in overflow menu)
   - [ ] Hover over icon
   - [ ] Tooltip shows: "Tabeza Connect"

2. **Notification**
   - [ ] Windows notification appears (bottom-right)
   - [ ] Title: "Tabeza Connect Started"
   - [ ] Message: "Receipt capture service is running"

3. **Tray menu**
   - [ ] Right-click the tray icon
   - [ ] Menu appears with these items:
     - [ ] "● Service Running" (disabled, shows status)
     - [ ] "📁 Folders OK" (disabled, shows status)
     - [ ] Separator line
     - [ ] "Open Management UI"
     - [ ] "Open Template Generator"
     - [ ] Separator line
     - [ ] "Configure Printer Pooling..."
     - [ ] "Repair Folder Structure"
     - [ ] "View Logs"
     - [ ] "Open Capture Folder"
     - [ ] Separator line
     - [ ] "Restart Service"
     - [ ] Separator line
     - [ ] "Version 1.7.0" (disabled)
     - [ ] "Quit"

4. **Config file creation**
   - [ ] Open File Explorer
   - [ ] Navigate to `C:\TabezaPrints\`
   - [ ] Verify file exists: `config.json`
   - [ ] Right-click `config.json` → Open with Notepad
   - [ ] Verify content:
     ```json
     {
       "barId": "",
       "apiUrl": "https://tabeza.co.ke",
       "watchFolder": "C:\\TabezaPrints",
       "httpPort": 8765
     }
     ```
   - [ ] Note: `barId` should be empty string `""`

5. **Service running**
   - [ ] Open browser (Chrome, Edge, Firefox)
   - [ ] Navigate to: `http://localhost:8765`
   - [ ] Page loads (may show configuration page)
   - [ ] Service is running on port 8765

6. **Log file creation**
   - [ ] Navigate to `C:\TabezaPrints\logs\`
   - [ ] Verify file exists: `electron.log`
   - [ ] Open `electron.log` with Notepad
   - [ ] Verify log entries show:
     - [ ] "Tabeza Connect v1.7.0 starting..."
     - [ ] "Ensuring TabezaPrints folder structure..."
     - [ ] "System tray created"
     - [ ] "Background service started successfully"

### Expected Results
✅ System tray icon appears  
✅ Notification shows "Tabeza Connect Started"  
✅ Tray menu has all expected items  
✅ config.json created with empty barId  
✅ Service running on port 8765  
✅ electron.log shows startup messages  

### Actual Results
- Tray icon visible: ☐ Yes ☐ No
- Notification appeared: ☐ Yes ☐ No
- Menu items correct: ☐ Yes ☐ No
- config.json created: ☐ Yes ☐ No
- Service accessible: ☐ Yes ☐ No
- Issues: _________________

---

## Test 3: Bar ID Configuration Flow

**Objective**: Verify user can configure Bar ID via Management UI

**Prerequisites**: You need a Bar ID from Tabeza dashboard (format: UUID like `438c80c1-fe11-4ac5-8a48-2fc45104ba31`)

### Steps

1. **Open Management UI**
   - [ ] Right-click tray icon
   - [ ] Click "Open Management UI"
   - [ ] Browser opens automatically
   - [ ] URL is: `http://localhost:8765` or `http://127.0.0.1:8765`

2. **Verify configuration page**
   - [ ] Page title: "Tabeza Printer Service - Configuration"
   - [ ] Page shows status card with:
     - [ ] "Service Status: Running" (green)
     - [ ] "Bar ID: Not configured" (red)
     - [ ] "Configuration: Not configured" (red)
   - [ ] Form section shows:
     - [ ] Label: "Your Bar ID"
     - [ ] Input field (empty)
     - [ ] Placeholder text: "e.g., 438c80c1-fe11-4ac5-8a48-2fc45104ba31"
     - [ ] Help text: "Find your Bar ID in the Tabeza Settings page"
     - [ ] "Save Configuration" button

3. **Instructions section**
   - [ ] Section title: "📋 How to find your Bar ID:"
   - [ ] Instructions show:
     - [ ] "Open Tabeza Staff App Settings"
     - [ ] "Look for the 'Printer Setup' section"
     - [ ] "Copy your Bar ID"
     - [ ] "Paste it in the field above"

4. **Test validation - Empty Bar ID**
   - [ ] Leave Bar ID field empty
   - [ ] Click "Save Configuration"
   - [ ] Error message appears: "Please enter your Bar ID"
   - [ ] Form does not submit

5. **Test validation - Invalid format**
   - [ ] Enter invalid Bar ID: `test123`
   - [ ] Click "Save Configuration"
   - [ ] Error message appears: "Invalid Bar ID format. Please check and try again."
   - [ ] Form does not submit

6. **Configure valid Bar ID**
   - [ ] Enter your actual Bar ID from Tabeza dashboard
   - [ ] Bar ID format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (UUID)
   - [ ] Click "Save Configuration"
   - [ ] Button shows "Saving..." (briefly)
   - [ ] Success message appears: "Configuration saved successfully!"
   - [ ] Page refreshes or updates

7. **Verify configuration saved**
   - [ ] Status card now shows:
     - [ ] "Bar ID: [your-bar-id]" (green)
     - [ ] "Configuration: Configured" (green)
   - [ ] Input field now shows your Bar ID

8. **Verify config file updated**
   - [ ] Open File Explorer
   - [ ] Navigate to `C:\TabezaPrints\`
   - [ ] Open `config.json` with Notepad
   - [ ] Verify `barId` field now contains your Bar ID:
     ```json
     {
       "barId": "438c80c1-fe11-4ac5-8a48-2fc45104ba31",
       "apiUrl": "https://tabeza.co.ke",
       "watchFolder": "C:\\TabezaPrints",
       "httpPort": 8765
     }
     ```

9. **Verify service status**
   - [ ] Right-click tray icon
   - [ ] Menu still shows "● Service Running"
   - [ ] Service continues running with new Bar ID

10. **Test double-click tray icon**
    - [ ] Double-click the tray icon
    - [ ] Management UI opens in browser
    - [ ] Shows configured Bar ID

### Expected Results
✅ Management UI opens from tray menu  
✅ Configuration page loads correctly  
✅ Validation works (rejects empty/invalid Bar IDs)  
✅ Valid Bar ID saves successfully  
✅ config.json updated with Bar ID  
✅ Service continues running  
✅ Double-click tray opens Management UI  

### Actual Results
- Management UI opened: ☐ Yes ☐ No
- Configuration page loaded: ☐ Yes ☐ No
- Validation worked: ☐ Yes ☐ No
- Bar ID saved: ☐ Yes ☐ No
- config.json updated: ☐ Yes ☐ No
- Service running: ☐ Yes ☐ No
- Bar ID used: _________________
- Issues: _________________

---

## Test 4: Additional Tray Menu Functions (Optional)

### Test 4.1: View Logs
- [ ] Right-click tray icon → "View Logs"
- [ ] File Explorer opens to `C:\TabezaPrints\logs\`
- [ ] Folder contains `electron.log`

### Test 4.2: Open Capture Folder
- [ ] Right-click tray icon → "Open Capture Folder"
- [ ] File Explorer opens to `C:\TabezaPrints\`
- [ ] Folder contains all expected subfolders

### Test 4.3: Restart Service
- [ ] Right-click tray icon → "Restart Service"
- [ ] Menu briefly shows "○ Service Stopped"
- [ ] After 2-3 seconds, shows "● Service Running"
- [ ] Management UI still accessible at http://localhost:8765

### Test 4.4: Quit Application
- [ ] Right-click tray icon → "Quit"
- [ ] Tray icon disappears
- [ ] Service stops (http://localhost:8765 no longer accessible)
- [ ] App fully closed

---

## Overall Test Results

### Summary
- [ ] Test 1 (Installation): ☐ PASS ☐ FAIL
- [ ] Test 2 (First Launch): ☐ PASS ☐ FAIL
- [ ] Test 3 (Bar ID Config): ☐ PASS ☐ FAIL
- [ ] Test 4 (Additional Functions): ☐ PASS ☐ FAIL

### Critical Issues Found
1. _________________
2. _________________
3. _________________

### Non-Critical Issues Found
1. _________________
2. _________________
3. _________________

### Notes
_________________
_________________
_________________

### Recommendation
☐ Ready for production  
☐ Needs fixes before release  
☐ Major issues - requires rework  

---

**Tester Signature**: _________________  
**Date Completed**: _________________  
**Time Spent**: _________ minutes
