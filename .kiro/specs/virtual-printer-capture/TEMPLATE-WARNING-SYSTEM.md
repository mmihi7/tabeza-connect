# Template Warning System

## Problem Statement

Without a regex template (`template.json`), Tabeza Connect can capture receipts but **cannot parse them into structured data**. This means:

- ❌ No items, quantities, or prices extracted
- ❌ No data uploaded to tabeza.co.ke
- ❌ Cloud integration doesn't work
- ❌ Digital receipts cannot be delivered to customers

**The system is essentially non-functional without a template.**

---

## Solution: Multi-Layer Warning System

### 1. Service Startup Warning

```
[2026-03-07 10:00:00][WARN] No receipt template found - receipts will be captured but not parsed
[2026-03-07 10:00:00][WARN] Please generate a template using the Management UI at http://localhost:8765
```

### 2. Management UI Warning Banner

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️  SETUP REQUIRED                                          │
│                                                              │
│ Generate receipt template to enable cloud integration       │
│                                                              │
│ Without a template, receipts cannot be parsed or uploaded.  │
│                                                              │
│ [ Generate Template Now ]                                   │
└─────────────────────────────────────────────────────────────┘
```

### 3. System Tray Icon States

| State | Icon Color | Tooltip | Meaning |
|-------|-----------|---------|---------|
| No Template | 🟠 Orange | "Setup incomplete - template required" | Blocking issue |
| Template Exists, Service Running | 🟢 Green | "Tabeza Connect - Online" | Fully operational |
| Service Offline | 🔴 Red | "Tabeza Connect - Offline" | Service stopped |
| Template Exists, Printer Offline | 🟡 Yellow | "Printer offline - jobs queued" | Non-blocking issue |

### 4. Dashboard Status Indicator

```
┌─────────────────────────────────────────────────────────────┐
│ TabezaConnect Dashboard                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Template Status: ❌ Not configured                          │
│                  [ Setup Now ]                              │
│                                                              │
│ Service Status:  ✅ Running                                 │
│ Jobs Captured:   12 (not parsed - no template)             │
│ Jobs Uploaded:   0 (waiting for template)                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5. Blocked Pages

When user tries to access certain pages without a template:

```
┌─────────────────────────────────────────────────────────────┐
│ View Receipts                                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│         🚫 Complete template setup first                    │
│                                                              │
│ Receipt parsing requires a template to be configured.       │
│                                                              │
│ [ Generate Template Now ]                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Blocked pages:**
- `/receipts` - View Receipts
- `/queue` - Upload Queue
- `/analytics` - Receipt Analytics

**Accessible pages:**
- `/` - Dashboard (with warning)
- `/settings` - Configuration
- `/template/generate` - Template Generator
- `/logs` - Service Logs

### 6. Receipt Capture Behavior Without Template

```javascript
// When no template exists:
async processReceipt(receiptText) {
  if (!this.templateExists()) {
    // Save to failed folder (not processed)
    await this.saveToFailedFolder(receiptText);
    
    // Log warning
    this.log('WARN', 'Receipt captured but not parsed - no template configured');
    
    // DO NOT upload to cloud (unparsed data is useless)
    return {
      success: false,
      reason: 'no_template',
      message: 'Template required for parsing'
    };
  }
  
  // Normal parsing flow...
}
```

### 7. Installer Post-Installation

After installation completes:

1. ✅ Installer finishes
2. ✅ Service starts
3. ✅ Browser opens automatically to `http://localhost:8765/template/generate`
4. ✅ User sees template generation wizard immediately
5. ✅ User prints 3 test receipts
6. ✅ Template generated and saved
7. ✅ System becomes fully operational

---

## User Experience Flow

### First-Time Setup (Ideal Path)

```
1. User installs Tabeza Connect
   ↓
2. Installer completes, opens browser to template wizard
   ↓
3. User sees: "Welcome! Let's set up your receipt parser"
   ↓
4. User prints test receipt 1 → "✓ Receipt 1 received"
   ↓
5. User prints test receipt 2 → "✓ Receipt 2 received"
   ↓
6. User prints test receipt 3 → "✓ Receipt 3 received"
   ↓
7. AI generates template (30-60 seconds)
   ↓
8. "✅ Setup complete! Your system is ready."
   ↓
9. Dashboard shows green status, system fully operational
```

### User Skips Setup (Problem Path)

```
1. User installs Tabeza Connect
   ↓
2. Installer opens browser, but user closes it
   ↓
3. User starts printing receipts from POS
   ↓
4. Receipts captured but NOT parsed
   ↓
5. User opens dashboard later
   ↓
6. Sees: "⚠️ SETUP REQUIRED - Generate template"
   ↓
7. User clicks "Generate Template Now"
   ↓
8. Completes 3-receipt wizard
   ↓
9. System becomes operational
   ↓
10. Previously captured receipts remain unparsed (in failed folder)
```

---

## Technical Implementation

### Template Check Function

```javascript
class TemplateManager {
  constructor() {
    this.templatePath = 'C:\\TabezaPrints\\template.json';
    this.template = null;
  }
  
  exists() {
    return fs.existsSync(this.templatePath);
  }
  
  load() {
    if (!this.exists()) {
      return null;
    }
    
    try {
      const data = fs.readFileSync(this.templatePath, 'utf8');
      this.template = JSON.parse(data);
      return this.template;
    } catch (err) {
      console.error('Failed to load template:', err);
      return null;
    }
  }
  
  isValid() {
    if (!this.template) {
      return false;
    }
    
    // Check required fields
    return (
      this.template.version &&
      this.template.patterns &&
      this.template.patterns.item_line &&
      this.template.patterns.total_line
    );
  }
}
```

### Service Startup Check

```javascript
async start() {
  // ... other startup code ...
  
  // Check for template
  const templateManager = new TemplateManager();
  if (!templateManager.exists()) {
    this.log('WARN', '═══════════════════════════════════════════════════');
    this.log('WARN', '⚠️  NO RECEIPT TEMPLATE FOUND');
    this.log('WARN', '');
    this.log('WARN', 'Receipts will be captured but NOT parsed.');
    this.log('WARN', 'Cloud integration will NOT work.');
    this.log('WARN', '');
    this.log('WARN', 'Please generate a template:');
    this.log('WARN', 'http://localhost:8765/template/generate');
    this.log('WARN', '═══════════════════════════════════════════════════');
    
    // Set warning state
    this.state.templateMissing = true;
    this.updateTrayIcon('warning');
  } else {
    this.log('INFO', '✅ Receipt template loaded successfully');
    this.state.templateMissing = false;
    this.updateTrayIcon('online');
  }
}
```

---

## Benefits of This Approach

1. ✅ **Clear Communication** - User knows exactly what's wrong
2. ✅ **Guided Resolution** - "Generate Template Now" button provides clear path
3. ✅ **Prevents Confusion** - Blocked pages prevent user from seeing "empty" data
4. ✅ **Graceful Degradation** - System still captures receipts (can be reprocessed later)
5. ✅ **Visual Feedback** - Tray icon color immediately shows status
6. ✅ **Post-Install Flow** - Installer guides user to complete setup immediately
7. ✅ **Non-Blocking** - Physical receipts still print normally

---

## Related Requirements

- **Requirement 15**: Template Generation Workflow
- **Requirement 15A**: Template Requirement Warning and Blocking (NEW)
- **Requirement 18**: System Tray Indicator

## Related Tasks

- **Phase 4.1A**: Template Requirement Warning System (14 tasks)
