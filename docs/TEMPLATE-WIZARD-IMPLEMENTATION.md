# Template Generation Wizard Implementation

## Overview

This document describes the implementation of the Template Generation Wizard for Tabeza Connect, which implements a guided 3-step real-time workflow for generating receipt parsing templates.

## Implementation Date

March 2026

## Spec Reference

- **Spec**: Redmon-Based Receipt Capture
- **Task**: Task 12 - Implement Template Generation Wizard
- **Requirements**: Requirement 12 (Template Generation Workflow)
- **Design**: Section on Template Setup workflow

## Architecture

### Components

1. **Frontend UI** (`template-wizard.html`)
   - Modern, responsive wizard interface
   - 4-step progress indicator
   - Real-time receipt detection feedback
   - Success/error handling with retry logic

2. **Client-side Logic** (`template-wizard.js`)
   - State management for wizard flow
   - Real-time polling for new receipts (every 2 seconds)
   - Timer tracking for each step
   - API integration for template generation

3. **Backend API** (`routes/template.js`)
   - `GET /api/template/status` - Check template existence
   - `POST /api/template/generate` - Generate template from 3 receipts
   - `GET /api/receipts/recent` - Get recently captured receipts

4. **Tests** (`__tests__/template-wizard.test.js`)
   - UI serving tests
   - API endpoint tests
   - Error handling tests
   - Client logic validation

## User Flow

### Step 1: First Receipt
1. User opens wizard at `http://localhost:8765/template-wizard.html`
2. Wizard displays: "Print your first test receipt from your POS"
3. Timer starts counting seconds
4. User prints receipt from POS
5. Redmon captures receipt → saved to queue
6. Wizard polls `/api/receipts/recent` every 2 seconds
7. When receipt detected: Shows "✓ Receipt 1 received!"
8. Auto-advances to Step 2 after 1.5 seconds

### Step 2: Second Receipt
1. Wizard displays: "Print a DIFFERENT receipt"
2. Timer starts for step 2
3. User prints different receipt
4. Wizard detects receipt
5. Shows "✓ Receipt 2 received!"
6. Auto-advances to Step 3

### Step 3: Third Receipt
1. Wizard displays: "Print one more DIFFERENT receipt"
2. Timer starts for step 3
3. User prints third receipt
4. Wizard detects receipt
5. Shows "✓ Receipt 3 received!"
6. Auto-advances to Step 4 (Generate)

### Step 4: Generate Template
1. Wizard displays: "All receipts captured!"
2. User clicks "Generate Template" button
3. Wizard sends POST to `/api/template/generate` with 3 receipt texts
4. Shows loading spinner: "Generating template... (30-60 seconds)"
5. Backend calls cloud API: `POST /api/receipts/generate-template`
6. Cloud AI analyzes receipts and returns template
7. Backend saves template to `C:\ProgramData\Tabeza\template.json`
8. Wizard shows success screen

### Step 5: Success
1. Shows success checkmark and message
2. Displays template preview (version, patterns)
3. Provides buttons:
   - "Go to Dashboard" - Navigate to main dashboard
   - "Generate Another" - Restart wizard

## Technical Details

### Real-time Receipt Detection

The wizard uses polling to detect new receipts:

```javascript
// Poll every 2 seconds
setInterval(async () => {
  const response = await fetch('/api/receipts/recent');
  const data = await response.json();
  
  // Filter receipts captured during wizard session
  const newReceipts = data.receipts.filter(receipt => {
    return new Date(receipt.timestamp) >= wizardStartTime;
  });
  
  // Check if we have a new receipt
  if (newReceipts.length > capturedReceipts.length) {
    onReceiptCaptured(newReceipts[0]);
  }
}, 2000);
```

### Template Generation API

The backend validates and forwards requests to the cloud:

```javascript
POST /api/template/generate
{
  "receipts": [
    "receipt text 1...",
    "receipt text 2...",
    "receipt text 3..."
  ]
}

// Validation:
// - Must have exactly 3 receipts
// - All receipts must be non-empty strings
// - API URL must be configured

// Forwards to cloud:
POST https://tabeza.co.ke/api/receipts/generate-template
{
  "receipts": [...],
  "barId": "venue-bar-id"
}

// Cloud returns:
{
  "success": true,
  "template": {
    "version": "1.2",
    "posSystem": "AccelPOS",
    "patterns": {
      "item_line": "regex...",
      "total_line": "regex...",
      "receipt_number": "regex..."
    },
    "confidence_threshold": 0.85
  }
}

// Backend saves to:
C:\ProgramData\Tabeza\template.json
```

### Error Handling

The wizard handles multiple error scenarios:

1. **Network Errors**
   - Shows error alert with retry button
   - Allows user to retry generation
   - Provides clear error messages

2. **Validation Errors**
   - Validates 3 receipts before allowing generation
   - Checks for empty or invalid receipts
   - Displays specific validation messages

3. **API Errors**
   - Handles connection refused (offline)
   - Handles timeout (60 second limit)
   - Handles 4xx/5xx responses
   - Shows user-friendly error messages

4. **Template Errors**
   - Detects malformed templates
   - Validates template structure
   - Allows regeneration if needed

### State Management

The wizard maintains state throughout the flow:

```javascript
const state = {
  currentStep: 1,              // Current wizard step (1-5)
  receipts: [],                // Raw receipt texts
  capturedReceipts: [],        // Full receipt objects
  timers: {},                  // Step timers
  pollingInterval: null,       // Polling interval ID
  lastReceiptCount: 0,         // Last known receipt count
  wizardStartTime: Date.now()  // When wizard started
};
```

## UI/UX Features

### Visual Design
- Modern gradient header (purple/blue)
- Clean white card-based layout
- Smooth animations and transitions
- Responsive design for all screen sizes

### Progress Indicator
- 4-step visual progress bar
- Animated progress fill
- Step circles with checkmarks
- Clear step labels

### Feedback
- Real-time receipt detection
- Timer showing wait time
- Success animations (pulse effect)
- Loading spinners for async operations

### Accessibility
- Clear, descriptive labels
- High contrast colors
- Large, easy-to-click buttons
- Keyboard navigation support

## Testing

### Unit Tests
- UI serving tests
- API endpoint validation
- Error handling scenarios
- State management logic

### Integration Tests
- End-to-end wizard flow
- Receipt detection polling
- Template generation workflow
- Error recovery

### Manual Testing Checklist
- [ ] Wizard loads correctly
- [ ] Step 1 detects first receipt
- [ ] Step 2 detects second receipt
- [ ] Step 3 detects third receipt
- [ ] Generate button becomes enabled
- [ ] Template generation succeeds
- [ ] Success screen displays template
- [ ] Error handling works for network issues
- [ ] Retry functionality works
- [ ] Restart wizard resets state

## Configuration

### Environment Variables
- `TABEZA_API_URL` - Cloud API URL (default: https://tabeza.co.ke)
- `TABEZA_BAR_ID` - Venue identifier (required)

### File Paths
- Template: `C:\ProgramData\Tabeza\template.json`
- Queue: `C:\TabezaPrints\queue\pending\`
- Uploaded: `C:\TabezaPrints\queue\uploaded\`

## Performance

### Metrics
- Polling interval: 2 seconds
- Template generation timeout: 60 seconds
- Auto-advance delay: 1.5 seconds
- Alert auto-hide: 5 seconds

### Optimization
- Efficient polling (only checks new receipts)
- Minimal DOM updates
- Debounced state changes
- Lazy loading of template preview

## Security

### Validation
- Input validation on all API endpoints
- Receipt count validation (exactly 3)
- Receipt content validation (non-empty strings)
- API URL validation

### Data Protection
- Localhost-only API access
- No sensitive data in URLs
- Secure HTTPS for cloud API
- Template stored with restricted permissions

## Future Enhancements

### Phase 2 Features
1. **Visual Receipt Preview**
   - Show captured receipt text in wizard
   - Highlight detected patterns
   - Allow manual correction

2. **Template Testing**
   - Test template against sample receipts
   - Show parsing results in real-time
   - Confidence score visualization

3. **Advanced Options**
   - Custom pattern editing
   - Multiple POS system templates
   - Template versioning and rollback

4. **Improved Feedback**
   - WebSocket for real-time updates
   - Progress percentage for AI generation
   - Detailed error diagnostics

## Troubleshooting

### Common Issues

**Issue: Receipts not detected**
- Check if Redmon is configured correctly
- Verify capture service is running
- Check queue folder permissions
- Review service logs

**Issue: Template generation fails**
- Verify internet connectivity
- Check API URL configuration
- Ensure Bar ID is set correctly
- Review cloud API logs

**Issue: Wizard stuck on step**
- Check if receipts are being captured
- Verify polling is working (check console)
- Restart wizard with "Start Over" button
- Clear browser cache and reload

**Issue: Template not saving**
- Check folder permissions
- Verify disk space available
- Review file system logs
- Check template path configuration

## Support

For issues or questions:
- Check logs: `C:\ProgramData\Tabeza\logs\service.log`
- Review documentation: `/docs/ARCHITECTURE.md`
- Contact support: support@tabeza.co.ke

## References

- [Redmon Receipt Capture Spec](../.kiro/specs/redmon-receipt-capture/)
- [Requirements Document](../.kiro/specs/redmon-receipt-capture/requirements.md)
- [Design Document](../.kiro/specs/redmon-receipt-capture/design.md)
- [Tasks List](../.kiro/specs/redmon-receipt-capture/tasks.md)
