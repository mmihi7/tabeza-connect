# Simplify Printer Setup UI - Design Document

## Overview

This design simplifies the printer setup experience in the Staff app by removing redundant UI elements and making printer registration fully automatic via heartbeat. The current implementation has duplicate sections ("Printer Setup" tab AND "Configure Printer Service" button) and requires manual configuration steps. This design consolidates everything into a single, clear printer status section that automatically detects and displays printer connectivity.

**Core Principle**: The printer service should "just work" after installation. No manual configuration buttons, no confusing multi-step flows. Install → Automatic heartbeat → Status shows online.

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User installs TabezaConnect                             │
│    - Installer writes Bar ID to Windows Registry           │
│    - Service starts automatically                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. TabezaConnect Service (Automatic)                       │
│    - Reads Bar ID from registry on startup                 │
│    - Sends heartbeat every 30 seconds                      │
│    - Payload: { barId, driverId, version, status }         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Heartbeat API (/api/printer/heartbeat)                 │
│    - Validates Bar ID exists                               │
│    - Upserts to printer_drivers table                      │
│    - Updates last_heartbeat timestamp                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Staff App UI (Automatic Detection)                     │
│    - Subscribes to printer_drivers table changes          │
│    - Polls status every 15 seconds (backup)               │
│    - Shows: 🟢 Online / 🟡 Connecting / 🔴 Offline        │
│    - Displays driver details when online                   │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Remove "Auto-Configure" Button**: The heartbeat mechanism already handles registration automatically. The button is redundant and confusing.

2. **Single Printer Section**: Consolidate all printer-related UI into one section in Settings. Remove the separate "Printer Setup" tab.

3. **Automatic Status Detection**: Use Supabase realtime subscriptions + polling to automatically detect when the printer comes online. No manual refresh needed.

4. **Clear Status Indicators**: Use color-coded icons (🟢 🟡 🔴) that are immediately understandable.

5. **Contextual Troubleshooting**: Show different guidance based on status:
   - Never installed → Download link
   - Installed but offline → "Start the service" instructions
   - Online → Driver details and test print button

## Components and Interfaces

### 1. Simplified Printer Status Component

**Location**: `apps/staff/components/PrinterStatus.tsx` (renamed from PrinterStatusIndicator)

**Purpose**: Display printer connection status with automatic detection and contextual actions.

**Props**:
```typescript
interface PrinterStatusProps {
  barId: string;
  venueMode: 'basic' | 'venue';
  authorityMode: 'pos' | 'tabeza';
  compact?: boolean; // For header display
}
```

**State**:
```typescript
type PrinterConnectionStatus = 'online' | 'connecting' | 'offline' | 'error';

interface PrinterState {
  status: PrinterConnectionStatus;
  driver?: {
    id: string;
    version: string;
    lastHeartbeat: string;
    lastSeenMinutes: number;
  };
  isRefreshing: boolean;
  isTesting: boolean;
}
```

**Behavior**:
- Automatically subscribes to `printer_drivers` table for realtime updates
- Polls status every 15 seconds as backup to realtime
- Calculates status based on `last_heartbeat` timestamp:
  - `< 2 minutes` → Online (🟢)
  - `2-5 minutes` → Connecting (🟡)
  - `> 5 minutes` → Offline (🔴)
- Shows contextual actions based on status
- No manual "configure" or "register" buttons

### 2. Settings Page Integration

**Location**: `apps/staff/app/settings/page.tsx`

**Changes**:
1. Remove "Printer Setup" tab from tab navigation
2. Add printer status section within "Venue Configuration" tab
3. Show printer section only when `printer_required === true`
4. Remove all "Auto-Configure Printer Service" buttons
5. Remove manual configuration UI

**New Structure**:
```
Settings Page
├── General Tab
├── Venue Configuration Tab
│   ├── Current Configuration Summary
│   ├── Printer Status Section (if printer_required)
│   │   ├── Status Indicator (🟢/🟡/🔴)
│   │   ├── Driver Details (when online)
│   │   ├── Troubleshooting (when offline)
│   │   └── Test Print Button (when online)
│   └── Mode Change Controls
└── Other Tabs...
```

### 3. Printer Status API Endpoint

**Location**: `apps/staff/app/api/printer/driver-status/route.ts`

**Purpose**: Check current printer driver status for a bar.

**Endpoint**: `GET /api/printer/driver-status?barId={barId}`

**Response**:
```typescript
interface DriverStatusResponse {
  connected: boolean;
  status: 'online' | 'offline' | 'not_configured' | 'checking' | 'error';
  driver?: {
    id: string;
    version: string;
    lastSeen: string;
    firstSeen: string;
    lastSeenMinutes: number;
  };
  message: string;
  error?: string;
}
```

**Logic**:
1. Query `printer_drivers` table for `bar_id = {barId}`
2. If no driver found → `not_configured`
3. If driver found:
   - Calculate minutes since `last_heartbeat`
   - `< 2 min` → `online`
   - `2-5 min` → `offline` (connecting)
   - `> 5 min` → `offline`
4. Return driver details and status

### 4. Manual Reconnect Endpoint

**Location**: `apps/staff/app/api/printer/reconnect/route.ts`

**Purpose**: Trigger a manual heartbeat check (for troubleshooting).

**Endpoint**: `POST /api/printer/reconnect`

**Body**:
```typescript
{
  barId: string;
}
```

**Response**:
```typescript
{
  success: boolean;
  message: string;
  status?: 'online' | 'offline';
}
```

**Logic**:
1. Check if driver exists for bar
2. If exists and recently active → Return current status
3. If exists but stale → Return offline with guidance
4. If not exists → Return not configured

## Data Models

### Existing: printer_drivers Table

```sql
CREATE TABLE printer_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  driver_id TEXT NOT NULL UNIQUE,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'online',
  last_heartbeat TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_printer_drivers_bar_id ON printer_drivers(bar_id);
CREATE INDEX idx_printer_drivers_last_heartbeat ON printer_drivers(last_heartbeat);
```

**No schema changes required** - the existing table already supports the automatic heartbeat mechanism.

### Status Calculation Logic

```typescript
function calculatePrinterStatus(lastHeartbeat: string): PrinterConnectionStatus {
  const now = new Date();
  const lastSeen = new Date(lastHeartbeat);
  const minutesSinceLastSeen = (now.getTime() - lastSeen.getTime()) / (1000 * 60);
  
  if (minutesSinceLastSeen < 2) {
    return 'online';
  } else if (minutesSinceLastSeen < 5) {
    return 'connecting';
  } else {
    return 'offline';
  }
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Status Indicator Correctness
*For any* printer driver state, the status indicator should display the correct visual state (🟢 Online, 🟡 Connecting, or 🔴 Offline) based on the last heartbeat timestamp.

**Validates: Requirements 2.2**

### Property 2: Offline Troubleshooting Display
*For any* printer status that is offline or not configured, the UI should display contextual troubleshooting guidance appropriate to that specific state.

**Validates: Requirements 3.1**

### Property 3: Reconnect Action Trigger
*For any* click on the reconnect button, the system should trigger a status check and update the UI with the result without requiring a page refresh.

**Validates: Requirements 5.2, 5.4**

### Property 4: Immediate Feedback Display
*For any* user action (reconnect, test print), the UI should immediately display feedback (loading state, then success/error message) without delay.

**Validates: Requirements 5.3**

## Error Handling

### 1. Service Not Installed
**Scenario**: User has never installed TabezaConnect

**Detection**: No driver record in `printer_drivers` table

**UI Response**:
```
🔴 Printer Service Not Installed

To connect your POS printer:
1. Download TabezaConnect installer
2. Run as administrator
3. Service will connect automatically

[Download TabezaConnect] button
```

### 2. Service Installed But Not Running
**Scenario**: Service was installed but is currently stopped

**Detection**: Driver exists but `last_heartbeat > 5 minutes ago`

**UI Response**:
```
🔴 Printer Service Offline

The service is installed but not running.

To fix:
1. Open Windows Services (services.msc)
2. Find "Tabeza Connect"
3. Click "Start"

Or restart your computer.

[Reconnect] button
```

### 3. Service Running But Wrong Bar ID
**Scenario**: Service is running but configured for different bar

**Detection**: No driver for this bar, but service is reachable

**UI Response**:
```
🔴 Printer Service Misconfigured

The service is running but connected to a different venue.

To fix:
1. Stop the TabezaConnect service
2. Reinstall with the correct Bar ID:
   [Copy Bar ID] button
3. Restart the service

[Troubleshooting Guide] link
```

### 4. Network/Firewall Issues
**Scenario**: Service can't reach Supabase API

**Detection**: Service logs show connection errors (not detectable from UI)

**UI Response**:
```
🟡 Connecting...

If this persists:
- Check your internet connection
- Verify firewall allows HTTPS (port 443)
- Contact support if issue continues

[Run Diagnostics] button → Opens localhost:8765/troubleshoot
```

### 5. Realtime Subscription Failure
**Scenario**: Supabase realtime connection drops

**Handling**:
- Fall back to polling every 15 seconds
- Log error to console
- No user-visible error (polling continues working)
- Attempt to reconnect realtime on next status check

## Testing Strategy

### Unit Tests

**Component Tests** (`PrinterStatus.test.tsx`):
- Renders correct status icon for each state (online/connecting/offline)
- Shows driver details when status is online
- Hides driver details when status is offline
- Shows download link when not configured
- Shows troubleshooting when offline
- Test print button only visible when online
- Reconnect button only visible when offline

**API Tests** (`driver-status.test.ts`):
- Returns correct status based on last_heartbeat timestamp
- Returns not_configured when no driver exists
- Calculates lastSeenMinutes correctly
- Handles missing barId parameter
- Handles invalid barId

### Property-Based Tests

Each property test should run minimum 100 iterations with randomized inputs.

**Property 1 Test** (`status-indicator-correctness.property.test.ts`):
```typescript
// Feature: simplify-printer-setup-ui, Property 1: Status Indicator Correctness
// For any printer driver state, the status indicator should display the correct 
// visual state based on the last heartbeat timestamp

fc.assert(
  fc.property(
    fc.record({
      lastHeartbeatMinutesAgo: fc.integer({ min: 0, max: 60 }),
      driverId: fc.uuid(),
      version: fc.constantFrom('1.0.0', '1.1.0', '2.0.0'),
    }),
    (driverState) => {
      const lastHeartbeat = new Date(Date.now() - driverState.lastHeartbeatMinutesAgo * 60 * 1000);
      
      const { getByTestId } = render(
        <PrinterStatus 
          barId="test-bar-id"
          venueMode="basic"
          authorityMode="pos"
          initialStatus={{
            status: calculateStatus(lastHeartbeat),
            driver: {
              id: driverState.driverId,
              version: driverState.version,
              lastHeartbeat: lastHeartbeat.toISOString(),
              lastSeenMinutes: driverState.lastHeartbeatMinutesAgo,
            }
          }}
        />
      );
      
      const statusIcon = getByTestId('printer-status-icon');
      
      if (driverState.lastHeartbeatMinutesAgo < 2) {
        expect(statusIcon).toHaveClass('text-green-600'); // Online
      } else if (driverState.lastHeartbeatMinutesAgo < 5) {
        expect(statusIcon).toHaveClass('text-yellow-600'); // Connecting
      } else {
        expect(statusIcon).toHaveClass('text-red-600'); // Offline
      }
    }
  ),
  { numRuns: 100 }
);
```

**Property 2 Test** (`offline-troubleshooting-display.property.test.ts`):
```typescript
// Feature: simplify-printer-setup-ui, Property 2: Offline Troubleshooting Display
// For any printer status that is offline or not configured, the UI should display
// contextual troubleshooting guidance

fc.assert(
  fc.property(
    fc.constantFrom('offline', 'not_configured', 'error'),
    (offlineStatus) => {
      const { getByText, queryByText } = render(
        <PrinterStatus 
          barId="test-bar-id"
          venueMode="basic"
          authorityMode="pos"
          initialStatus={{
            status: offlineStatus,
            message: 'Printer service is not available',
          }}
        />
      );
      
      // Should show some form of troubleshooting guidance
      const hasTroubleshooting = 
        queryByText(/download/i) !== null ||
        queryByText(/install/i) !== null ||
        queryByText(/start/i) !== null ||
        queryByText(/fix/i) !== null ||
        queryByText(/troubleshoot/i) !== null;
      
      expect(hasTroubleshooting).toBe(true);
      
      // Should NOT show driver details
      expect(queryByText(/driver id/i)).toBeNull();
      expect(queryByText(/version/i)).toBeNull();
    }
  ),
  { numRuns: 100 }
);
```

**Property 3 Test** (`reconnect-action-trigger.property.test.ts`):
```typescript
// Feature: simplify-printer-setup-ui, Property 3: Reconnect Action Trigger
// For any click on the reconnect button, the system should trigger a status check
// and update the UI without page refresh

fc.assert(
  fc.property(
    fc.record({
      initialStatus: fc.constantFrom('offline', 'error'),
      newStatus: fc.constantFrom('online', 'offline', 'connecting'),
    }),
    async (scenario) => {
      const mockCheckStatus = jest.fn().mockResolvedValue({
        status: scenario.newStatus,
        connected: scenario.newStatus === 'online',
      });
      
      const { getByText, findByTestId } = render(
        <PrinterStatus 
          barId="test-bar-id"
          venueMode="basic"
          authorityMode="pos"
          initialStatus={{ status: scenario.initialStatus }}
          onCheckStatus={mockCheckStatus}
        />
      );
      
      const reconnectButton = getByText(/reconnect/i);
      fireEvent.click(reconnectButton);
      
      // Should call status check
      expect(mockCheckStatus).toHaveBeenCalledTimes(1);
      
      // Should update UI with new status (no page refresh)
      const statusIcon = await findByTestId('printer-status-icon');
      expect(statusIcon).toBeInTheDocument();
      
      // Verify no page navigation occurred
      expect(window.location.href).toBe('http://localhost/');
    }
  ),
  { numRuns: 100 }
);
```

**Property 4 Test** (`immediate-feedback-display.property.test.ts`):
```typescript
// Feature: simplify-printer-setup-ui, Property 4: Immediate Feedback Display
// For any user action, the UI should immediately display feedback

fc.assert(
  fc.property(
    fc.record({
      action: fc.constantFrom('reconnect', 'test-print'),
      result: fc.constantFrom('success', 'error'),
      delay: fc.integer({ min: 100, max: 2000 }), // Simulate API delay
    }),
    async (scenario) => {
      const mockAction = jest.fn().mockImplementation(() => 
        new Promise((resolve) => 
          setTimeout(() => resolve({ success: scenario.result === 'success' }), scenario.delay)
        )
      );
      
      const { getByText, findByText, queryByText } = render(
        <PrinterStatus 
          barId="test-bar-id"
          venueMode="basic"
          authorityMode="pos"
          initialStatus={{ status: 'online' }}
          onAction={mockAction}
        />
      );
      
      const actionButton = getByText(new RegExp(scenario.action, 'i'));
      fireEvent.click(actionButton);
      
      // Should immediately show loading state
      expect(queryByText(/loading|processing|sending/i)).toBeInTheDocument();
      
      // Should show result after action completes
      const feedback = await findByText(
        scenario.result === 'success' ? /success|sent|complete/i : /error|failed/i,
        {},
        { timeout: scenario.delay + 1000 }
      );
      
      expect(feedback).toBeInTheDocument();
    }
  ),
  { numRuns: 100 }
);
```

### Integration Tests

**End-to-End Flow**:
1. Install TabezaConnect with Bar ID
2. Verify service starts and sends heartbeat
3. Open Staff app Settings page
4. Verify printer status shows "Online" within 30 seconds
5. Click "Test Print"
6. Verify test print is sent successfully
7. Stop TabezaConnect service
8. Verify status changes to "Offline" within 2 minutes
9. Verify troubleshooting guidance appears

**Realtime Subscription Test**:
1. Open Settings page with printer offline
2. Start TabezaConnect service
3. Verify UI updates to "Online" without manual refresh
4. Verify driver details appear automatically

## Backward Compatibility

### Existing Installations

**Scenario**: Users who already have TabezaConnect installed

**Handling**:
- Existing heartbeat mechanism continues working unchanged
- Old "Auto-Configure" button removed from UI
- If driver already registered, status shows immediately
- No migration or re-installation required

### Database

**No schema changes required**:
- `printer_drivers` table already exists
- Heartbeat API already functional
- All existing data remains valid

### Service

**No service changes required**:
- TabezaConnect already sends heartbeats automatically
- Registry reading already implemented
- No new service version needed

### Settings Page

**Migration Path**:
1. Remove "Printer Setup" tab from navigation
2. Move printer status to "Venue Configuration" tab
3. Remove all "Auto-Configure" buttons
4. Update component to use simplified PrinterStatus component
5. Existing functionality preserved (test print, status checking)

## Implementation Notes

### Conditional Display Logic

```typescript
// Only show printer section when printer is required
const showPrinterSection = 
  venueMode === 'basic' || 
  (venueMode === 'venue' && authorityMode === 'pos');

// CORE TRUTH: Manual service always exists. 
// Digital authority is singular. 
// Tabeza adapts to the venue — never the reverse.
```

### Status Polling Strategy

```typescript
// Primary: Realtime subscription (instant updates)
const channel = supabase
  .channel('printer-status')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'printer_drivers',
    filter: `bar_id=eq.${barId}`,
  }, handleStatusUpdate)
  .subscribe();

// Backup: Polling every 15 seconds
const pollInterval = setInterval(checkStatus, 15000);

// Cleanup on unmount
return () => {
  channel.unsubscribe();
  clearInterval(pollInterval);
};
```

### Performance Considerations

1. **Debounce Status Checks**: Prevent excessive API calls when realtime updates are frequent
2. **Cache Status**: Store last known status in component state to avoid flicker
3. **Lazy Load Troubleshooting**: Only render troubleshooting content when status is offline
4. **Optimize Realtime**: Use single channel for all printer-related subscriptions

### Security Considerations

1. **Bar ID Validation**: Always validate Bar ID exists before showing printer status
2. **API Authentication**: Ensure printer status API requires valid session
3. **Rate Limiting**: Prevent abuse of reconnect/test print endpoints
4. **Error Messages**: Don't expose internal system details in error messages

## Success Metrics

### User Experience
- **Setup Time**: Reduce from 5+ steps to 1 (install only)
- **Time to Online**: < 30 seconds from service start to UI showing "Online"
- **Support Tickets**: 80% reduction in printer configuration issues

### Technical
- **API Calls**: Reduce manual configuration API calls to zero
- **Realtime Updates**: 95% of status changes detected via realtime (not polling)
- **Error Rate**: < 1% of heartbeats fail due to network/API issues

### Business
- **Onboarding Completion**: Increase printer setup completion rate by 50%
- **User Satisfaction**: Improve printer setup satisfaction score from 3/5 to 4.5/5
- **Time to First Print**: Reduce from 10+ minutes to < 2 minutes
