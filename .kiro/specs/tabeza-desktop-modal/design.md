# Design Document: POS Receipt Assignment Modal

## Overview

The POS Receipt Assignment Modal is a browser-based interface integrated into the Tabeza Staff PWA that enables waiters to assign POS receipts to customer tabs in real-time. The system leverages the existing Tabeza Printer Service (a minimal Windows service) for print interception, while all UI and assignment logic resides in the Staff PWA.

### Key Design Principles

1. **Browser-Native**: Modal appears within the Staff PWA, no separate application needed
2. **Real-Time Events**: Uses Server-Sent Events (SSE) for instant receipt delivery
3. **Offline-First**: Caches tab data and queues assignments for network resilience
4. **Zero Context Switching**: Waiter stays in their primary work environment (browser)
5. **Minimal Dependencies**: Reuses existing infrastructure (Printer Service, Cloud API, Staff PWA)

### Architecture Philosophy

The application follows a three-tier architecture:
- **Print Interception Layer**: Existing Tabeza Printer Service (Windows service on port 8765)
- **Cloud Layer**: Tabeza Cloud API with real-time event broadcasting
- **Presentation Layer**: React components in Staff PWA with SSE connection

## Architecture

### System Context

```
┌─────────────────┐         ┌──────────────────────┐
│   POS System    │────────▶│  TABEZA Printer Port │
│                 │  Print  │   (127.0.0.1:8765)   │
└─────────────────┘  Job    └──────────┬───────────┘
                                       │
                                       │ Intercept
                                       ▼
                            ┌──────────────────────┐
                            │ Tabeza Printer Svc   │
                            │ (Existing Service)   │
                            │  - Parse ESC/POS     │
                            │  - POST to cloud     │
                            └──────────┬───────────┘
                                       │ HTTPS
                                       ▼
                            ┌──────────────────────┐
                            │  Tabeza Cloud API    │
                            │  - Save receipt      │
                            │  - Broadcast event   │
                            └──────────┬───────────┘
                                       │ SSE/WebSocket
                                       ▼
                            ┌──────────────────────┐
                            │  Staff PWA (Browser) │
                            │  - Receive event     │
                            │  - Show modal        │
                            │  - Assign to tab     │
                            └──────────────────────┘
```

### Component Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Tabeza Staff PWA (Browser)                  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │           React Application Layer                   │ │
│  │                                                      │ │
│  │  ┌──────────────────────────────────────────────┐  │ │
│  │  │  ReceiptAssignmentModal Component            │  │ │
│  │  │  - Receipt display                           │  │ │
│  │  │  - Tab selection list                        │  │ │
│  │  │  - Search/filter                             │  │ │
│  │  │  - Assignment button                         │  │ │
│  │  │  - Status indicators                         │  │ │
│  │  └──────────────────────────────────────────────┘  │ │
│  │                                                      │ │
│  │  ┌──────────────────────────────────────────────┐  │ │
│  │  │  UnmatchedReceipts Component                 │  │ │
│  │  │  - List of unassigned receipts               │  │ │
│  │  │  - Manual assignment interface               │  │ │
│  │  └──────────────────────────────────────────────┘  │ │
│  │                                                      │ │
│  └──────────────────────┬───────────────────────────────┘ │
│                         │                                 │
│  ┌──────────────────────▼───────────────────────────────┐ │
│  │           Custom Hooks Layer                         │ │
│  │  - useRealtimeReceipts (SSE connection)             │ │
│  │  - useTabCache (IndexedDB caching)                  │ │
│  │  - useAssignmentQueue (offline queue)               │ │
│  └──────────────────────┬───────────────────────────────┘ │
│                         │                                 │
│  ┌──────────────────────▼───────────────────────────────┐ │
│  │           Browser APIs                               │ │
│  │  - EventSource (SSE)                                 │ │
│  │  - IndexedDB (caching)                               │ │
│  │  - Notification API                                  │ │
│  │  - fetch (HTTP client)                               │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Real-Time Receipt Hook

**Purpose**: Manages SSE connection and receipt event handling.

**Interface**:
```typescript
interface UseRealtimeReceipts {
  receipts: Receipt[];
  connectionStatus: ConnectionStatus;
  reconnect: () => void;
}

interface Receipt {
  id: string;
  venueId: string;
  venueName: string;
  timestamp: Date;
  items: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'pending' | 'assigned' | 'expired';
}

interface LineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

enum ConnectionStatus {
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  DISCONNECTED = 'disconnected'
}
```

**Implementation Details**:
- Uses browser EventSource API for SSE connection
- Endpoint: `/api/events?venueId={venueId}`
- Automatically reconnects on connection loss (5-second interval)
- Emits receipt events to React components
- Handles connection status updates

### 2. Tab Cache Hook

**Purpose**: Manages local caching of open tabs for offline support.

**Interface**:
```typescript
interface UseTabCache {
  tabs: Tab[];
  isStale: boolean;
  refresh: () => Promise<void>;
  getCacheAge: () => number;
}

interface Tab {
  id: string;
  tabNumber: number;
  tableNumber?: string;
  customerIdentifier: string;
  openedAt: Date;
  status: 'open' | 'overdue' | 'closed';
}
```

**Implementation Details**:
- Uses IndexedDB for persistent caching
- Cache TTL: 30 seconds
- Auto-refresh when online
- Provides stale indicator when cache is old


### 3. Assignment Queue Hook

**Purpose**: Manages offline assignment queue with automatic retry.

**Interface**:
```typescript
interface UseAssignmentQueue {
  queuedCount: number;
  assignReceipt: (receiptId: string, tabId: string) => Promise<AssignmentResult>;
  retryAll: () => Promise<void>;
}

interface AssignmentResult {
  success: boolean;
  message: string;
  receiptId?: string;
  error?: string;
}
```

**Implementation Details**:
- Uses IndexedDB for persistent queue storage
- Automatically retries queued assignments when online
- Exponential backoff for failed retries (1s, 2s, 4s)
- Maximum 3 retry attempts per assignment

### 4. Receipt Assignment Modal Component

**Purpose**: Displays intercepted receipts and provides tab selection interface.

**Interface**:
```typescript
interface ReceiptAssignmentModalProps {
  receipt: Receipt;
  isOpen: boolean;
  onClose: () => void;
  onAssign: (tabId: string) => Promise<void>;
}

interface ReceiptAssignmentModalState {
  selectedTabId: string | null;
  searchQuery: string;
  filteredTabs: Tab[];
  assignmentStatus: 'idle' | 'assigning' | 'success' | 'error';
  errorMessage: string | null;
}
```

**Component Structure**:
```tsx
<ReceiptAssignmentModal isOpen={isOpen} receipt={receipt}>
  <ModalOverlay onClick={onClose} />
  
  <ModalContent>
    <ModalHeader>
      <Title>New Order from POS</Title>
      <ConnectionIndicator status={connectionStatus} />
      <CloseButton onClick={onClose} />
    </ModalHeader>
    
    <ReceiptDisplay>
      <VenueName>{receipt.venueName}</VenueName>
      <Timestamp>{formatTimestamp(receipt.timestamp)}</Timestamp>
      <LineItems>
        {receipt.items.map(item => (
          <LineItem key={item.name}>
            <ItemName>{item.quantity}x {item.name}</ItemName>
            <ItemPrice>KES {item.total}</ItemPrice>
          </LineItem>
        ))}
      </LineItems>
      <Totals>
        <TotalRow>
          <Label>Subtotal:</Label>
          <Value>KES {receipt.subtotal}</Value>
        </TotalRow>
        <TotalRow>
          <Label>Tax (16%):</Label>
          <Value>KES {receipt.tax}</Value>
        </TotalRow>
        <TotalRow bold>
          <Label>Total:</Label>
          <Value>KES {receipt.total}</Value>
        </TotalRow>
      </Totals>
    </ReceiptDisplay>
    
    <TabSelection>
      <SearchInput 
        placeholder="Search by tab or table number..."
        value={searchQuery}
        onChange={handleSearch}
        autoFocus
      />
      <TabList>
        {filteredTabs.map(tab => (
          <TabItem 
            key={tab.id}
            selected={selectedTabId === tab.id}
            onClick={() => setSelectedTabId(tab.id)}
          >
            <TabNumber>Tab #{tab.tabNumber}</TabNumber>
            {tab.tableNumber && <TableNumber>Table {tab.tableNumber}</TableNumber>}
            <CustomerInfo>{tab.customerIdentifier}</CustomerInfo>
          </TabItem>
        ))}
      </TabList>
      {filteredTabs.length === 0 && (
        <EmptyState>No open tabs available</EmptyState>
      )}
    </TabSelection>
    
    <ModalFooter>
      <CancelButton onClick={onClose}>Cancel</CancelButton>
      <AssignButton 
        onClick={handleAssign} 
        disabled={!selectedTabId || assignmentStatus === 'assigning'}
      >
        {assignmentStatus === 'assigning' ? (
          <>
            <Spinner /> Sending...
          </>
        ) : (
          'Send to Customer'
        )}
      </AssignButton>
    </ModalFooter>
    
    {assignmentStatus === 'success' && (
      <SuccessOverlay>
        <CheckIcon />
        <Message>Receipt sent to Tab #{selectedTab.tabNumber}</Message>
      </SuccessOverlay>
    )}
    
    {assignmentStatus === 'error' && (
      <ErrorOverlay>
        <ErrorIcon />
        <Message>{errorMessage}</Message>
        <RetryButton onClick={handleRetry}>Retry</RetryButton>
      </ErrorOverlay>
    )}
  </ModalContent>
</ReceiptAssignmentModal>
```

### 5. Unmatched Receipts Component

**Purpose**: Displays list of receipts that were dismissed or missed.

**Interface**:
```typescript
interface UnmatchedReceiptsProps {
  venueId: string;
}

interface UnmatchedReceiptsState {
  receipts: Receipt[];
  selectedReceipt: Receipt | null;
  isLoading: boolean;
}
```

**Implementation Details**:
- Fetches unmatched receipts from `/api/receipts/unmatched?venueId={id}`
- Displays receipts from past hour
- Allows manual assignment via modal
- Auto-refreshes every 30 seconds

### 6. Cloud API Endpoints

**Purpose**: Backend endpoints for receipt management and assignment.

**Endpoints**:

```typescript
// SSE endpoint for real-time events
GET /api/events?venueId={venueId}
Response: text/event-stream
Event format:
{
  type: 'new_receipt',
  data: {
    receiptId: string,
    receipt: Receipt
  }
}

// Assign receipt to tab
POST /api/receipts/{receiptId}/assign
Body: { tabId: string }
Response: {
  success: boolean,
  message: string,
  orderId?: string
}

// Get unmatched receipts
GET /api/receipts/unmatched?venueId={venueId}
Response: {
  receipts: Receipt[]
}

// Get open tabs (with caching)
GET /api/tabs?venueId={venueId}&status=open
Response: {
  tabs: Tab[]
}
```

## Data Models

### Receipt Data Flow

```
POS System prints
       ↓
Printer Service intercepts (port 8765)
       ↓
Printer Service parses ESC/POS
       ↓
POST /api/printer/relay
{
  venueId: "venue-123",
  rawData: Buffer,
  parsedReceipt: {
    venueName: "Joe's Bar",
    items: [...],
    total: 812
  }
}
       ↓
Cloud API saves to database
INSERT INTO unmatched_receipts (...)
       ↓
Cloud API broadcasts SSE event
event: new_receipt
data: { receiptId: "...", receipt: {...} }
       ↓
Staff PWA receives event (EventSource)
       ↓
React state updated
       ↓
Modal displayed
       ↓
Waiter selects tab
       ↓
POST /api/receipts/{id}/assign
{ tabId: "tab-123" }
       ↓
Cloud API creates order
INSERT INTO tab_orders (tab_id, items, total, ...)
       ↓
Cloud API updates receipt status
UPDATE unmatched_receipts SET status = 'assigned'
       ↓
Cloud API sends push notification to customer
       ↓
Customer receives digital receipt
```

### State Persistence

The PWA maintains three persistent data stores:

1. **IndexedDB - Tab Cache** (`tabeza_tab_cache`)
   - Stores: Open tabs with timestamp
   - TTL: 30 seconds
   - Size limit: 1000 tabs
   - Cleared on logout

2. **IndexedDB - Assignment Queue** (`tabeza_assignment_queue`)
   - Stores: Pending assignments
   - Persists across page reloads
   - Cleared after successful retry
   - Maximum 100 queued items

3. **IndexedDB - Receipt History** (`tabeza_receipt_history`)
   - Stores: Recent receipts (past hour)
   - Used for "Unmatched Receipts" view
   - Auto-expires after 1 hour
   - Maximum 500 receipts

### Database Schema (Cloud API)

The system interacts with existing Tabeza database tables:

**Relevant Tables**:
- `bars` - Venue information
- `tabs` - Customer tabs (filtered by `status = 'open'`)
- `tab_orders` - Orders linked to tabs
- `unmatched_receipts` - Receipts awaiting assignment (existing table)

**New Table** (if not exists):
```sql
CREATE TABLE unmatched_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES bars(id),
  receipt_data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_at TIMESTAMPTZ,
  assigned_to_tab_id UUID REFERENCES tabs(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour')
);

CREATE INDEX idx_unmatched_receipts_bar_status 
  ON unmatched_receipts(bar_id, status);
CREATE INDEX idx_unmatched_receipts_expires 
  ON unmatched_receipts(expires_at);
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property Reflection

After analyzing all acceptance criteria, I identified several areas of redundancy:

**Timing Properties**: Requirements 1.3, 2.1, and 13.1 all test modal display timing - these can be combined.

**Reconnection Properties**: Requirements 1.4 and 10.1 both test SSE reconnection - these are the same property.

**Offline Queueing Properties**: Requirements 6.3 and 10.2 both test offline assignment queueing - these are the same property.

**Success Confirmation Properties**: Requirements 4.3 and 7.2 both test success confirmation timing - these are the same property.

After reflection, I've consolidated 75 acceptance criteria into 42 unique correctness properties that provide comprehensive validation without redundancy.

### Core Properties

**Property 1: SSE Connection Establishment**
*For any* Staff PWA load, the application should establish a persistent SSE connection to the cloud API.
**Validates: Requirements 1.1**

**Property 2: Receipt Event Broadcasting**
*For any* receipt sent to the cloud, the Cloud API should broadcast a real-time event to all connected Staff PWA clients for that venue.
**Validates: Requirements 1.2**

**Property 3: Modal Display Timing**
*For any* receipt event received, the Staff PWA should display the modal within 500ms.
**Validates: Requirements 1.3, 2.1, 13.1**

**Property 4: Automatic SSE Reconnection**
*For any* SSE connection loss, the Staff PWA should automatically attempt reconnection every 5 seconds.
**Validates: Requirements 1.4, 10.1**

**Property 5: SSE Connection Persistence**
*For any* browser tab state (active or inactive), the Staff PWA should maintain the SSE connection as long as the tab remains open.
**Validates: Requirements 1.5**

**Property 6: Modal Positioning and Backdrop**
*For any* modal display, the modal should appear centered on the screen with a semi-transparent backdrop.
**Validates: Requirements 2.2**

**Property 7: Receipt Display Completeness**
*For any* receipt, the modal should display all required fields: venue name, timestamp, line items with quantities and prices, subtotal, tax, and total.
**Validates: Requirements 2.3, 11.1**

**Property 8: Modal Persistence**
*For any* user interaction sequence (except assignment completion or cancel), the modal should remain visible until explicitly dismissed.
**Validates: Requirements 2.4**

**Property 9: Notification Sound Playback**
*For any* modal display event, the Staff PWA should play the configured notification sound.
**Validates: Requirements 2.5**

**Property 10: Tab Fetching on Modal Display**
*For any* modal display event, the Staff PWA should fetch open tabs from cache or API.
**Validates: Requirements 3.1**

**Property 11: Tab List Display Completeness**
*For any* list of open tabs, the modal should display tab number, table number (if present), and customer identifier for each tab.
**Validates: Requirements 3.2**

**Property 12: Real-Time Search Filtering**
*For any* search query and tab list, the displayed tabs should be filtered in real-time to match the query against tab number or table number.
**Validates: Requirements 3.3**

**Property 13: Tab List Sorting**
*For any* list of open tabs, the modal should display them in descending order by creation time (most recent first).
**Validates: Requirements 3.4**

**Property 14: Button State Management**
*For any* tab selection event, the "Send to Customer" button should transition from disabled to enabled.
**Validates: Requirements 4.1**

**Property 15: Assignment API Communication**
*For any* assignment action, the Staff PWA should send the receipt ID and tab ID to the Tabeza Cloud API.
**Validates: Requirements 4.2**

**Property 16: Success Confirmation Display**
*For any* successful assignment, the modal should display a success confirmation for exactly 2 seconds before auto-closing.
**Validates: Requirements 4.3, 7.1, 7.2**

**Property 17: Error Display and Retry**
*For any* failed assignment, the modal should display the error message and provide a retry option.
**Validates: Requirements 4.4, 7.3**

**Property 18: Modal Auto-Close on Success**
*For any* successful assignment, the modal should close automatically after displaying the confirmation.
**Validates: Requirements 4.5**

**Property 19: Background Tab Notifications**
*For any* receipt event received when the Staff PWA tab is not active, the application should display a browser notification.
**Validates: Requirements 5.1**

**Property 20: Notification Content**
*For any* browser notification, it should show the receipt total and a preview of items.
**Validates: Requirements 5.2**

**Property 21: Notification Click Handling**
*For any* browser notification click, the browser should focus the Staff PWA tab and display the modal.
**Validates: Requirements 5.3**

**Property 22: Permission Request Display**
*For any* state where browser notifications are not permitted, the Staff PWA should display an in-app banner requesting permission.
**Validates: Requirements 5.4**

**Property 23: Notification Preferences Persistence**
*For any* notification preference change, the Staff PWA should persist the setting and respect it for all future notifications.
**Validates: Requirements 5.5**

**Property 24: Tab List Caching**
*For any* successful tab fetch, the Staff PWA should cache the tab list in browser storage with a timestamp.
**Validates: Requirements 6.1**

**Property 25: Offline Mode with Cached Data**
*For any* network connectivity loss, the Staff PWA should use the cached tab list and display a "Using cached data" indicator.
**Validates: Requirements 6.2**

**Property 26: Offline Assignment Queueing**
*For any* assignment attempt while offline, the Staff PWA should queue the assignment request in IndexedDB for later retry.
**Validates: Requirements 6.3, 10.2**

**Property 27: Automatic Queue Processing**
*For any* network connectivity restoration, the Staff PWA should automatically retry all queued assignments in order.
**Validates: Requirements 6.4**

**Property 28: Periodic Cache Refresh**
*For any* 30-second interval while online, the Staff PWA should refresh the cached tab list.
**Validates: Requirements 6.5**

**Property 29: Loading State UI**
*For any* in-progress assignment, the modal should display a loading spinner and disable all buttons.
**Validates: Requirements 7.4**

**Property 30: Cancel Functionality**
*For any* modal state, the cancel button should allow dismissal without assignment.
**Validates: Requirements 7.5**

**Property 31: Unmatched Receipt Storage**
*For any* dismissed or ignored receipt, the Staff PWA should store it in the "Unmatched Receipts" list.
**Validates: Requirements 8.1**

**Property 32: Unmatched Receipts Display**
*For any* unmatched receipts view, the Staff PWA should display all receipts from the past hour sorted by timestamp.
**Validates: Requirements 8.3**

**Property 33: Unmatched Receipt Modal Trigger**
*For any* unmatched receipt click, the Staff PWA should display the assignment modal for that receipt.
**Validates: Requirements 8.4**

**Property 34: Automatic Receipt Expiration**
*For any* receipt older than 1 hour, the Staff PWA should automatically remove it from the unmatched list.
**Validates: Requirements 8.5**

**Property 35: Connection Status Indication**
*For any* SSE connection state change, the Staff PWA should display the appropriate status indicator (green for connected, yellow for reconnecting, red for disconnected).
**Validates: Requirements 9.1, 9.2, 9.3**

**Property 36: Manual Reconnection**
*For any* manual reconnect button click, the Staff PWA should attempt to reestablish the SSE connection.
**Validates: Requirements 9.4**

**Property 37: Connection Event Logging**
*For any* connection event, the Staff PWA should log it to the browser console.
**Validates: Requirements 9.5**

**Property 38: Incomplete Receipt Handling**
*For any* receipt with incomplete or malformed data, the Staff PWA should display available data and allow manual tab assignment.
**Validates: Requirements 10.3**

**Property 39: Unhandled Error Logging**
*For any* unhandled error, the Staff PWA should log the error to the console and display a user-friendly message.
**Validates: Requirements 10.4**

**Property 40: Receipt Display Structure**
*For any* receipt, the modal should display data in a structured format with clear sections for header, line items, and totals.
**Validates: Requirements 11.2**

**Property 41: Special Character Handling**
*For any* receipt containing special characters or non-ASCII text, the modal should handle them correctly.
**Validates: Requirements 11.4**

**Property 42: Incomplete Data Display**
*For any* receipt with incomplete data, the modal should display available fields and mark missing fields as "N/A".
**Validates: Requirements 11.5**

**Property 43: Venue Determination**
*For any* Staff PWA load, the application should determine the current venue from the user's session.
**Validates: Requirements 12.1**

**Property 44: Venue-Specific Data Isolation**
*For any* tab display or receipt event, the Staff PWA should only process data for the current venue.
**Validates: Requirements 12.2, 12.3**

**Property 45: Venue Name Display**
*For any* modal display, the modal header should prominently display the current venue name.
**Validates: Requirements 12.4**

**Property 46: Venue Switch Connection Management**
*For any* venue switch in the PWA, the Staff PWA should reestablish the SSE connection for the new venue.
**Validates: Requirements 12.5**

**Property 47: Tab List Rendering Performance**
*For any* modal display, the Staff PWA should render the tab selection list within 300ms.
**Validates: Requirements 13.2**

**Property 48: Search Filtering Performance**
*For any* search query input, the Staff PWA should filter results within 100ms.
**Validates: Requirements 13.3**

**Property 49: Assignment API Performance**
*For any* assignment API call under normal network conditions, the Staff PWA should complete it within 3 seconds.
**Validates: Requirements 13.4**

**Property 50: Large Dataset Performance**
*For any* tab list with 100+ tabs, the Staff PWA should maintain smooth scrolling and interactions.
**Validates: Requirements 13.5**

**Property 51: HTTPS-Only Communication**
*For any* API request, the Staff PWA should transmit data over HTTPS only.
**Validates: Requirements 14.1**

**Property 52: Receipt Data Deletion**
*For any* successful assignment, the Staff PWA should not store receipt content in browser storage after completion.
**Validates: Requirements 14.2**

**Property 53: Sensitive Data Redaction**
*For any* error log entry, the Staff PWA should redact sensitive information including customer names and payment details.
**Validates: Requirements 14.3**

**Property 54: SSL Certificate Validation**
*For any* API connection, the Staff PWA should validate SSL certificates.
**Validates: Requirements 14.4**

**Property 55: Logout Data Cleanup**
*For any* user logout, the Staff PWA should clear all cached receipt data.
**Validates: Requirements 14.5**

**Property 56: Graceful API Degradation**
*For any* unsupported browser API, the Staff PWA should gracefully degrade features without breaking core functionality.
**Validates: Requirements 15.4**

### Edge Cases

**Edge Case 1: Empty Tab List**
When no open tabs exist, the modal should display "No open tabs available" and disable the assignment button.
**Validates: Requirements 3.5**

**Edge Case 2: Large Receipt Display**
When line items exceed 10 items, the modal should display a scrollable list with the total always visible.
**Validates: Requirements 11.3**

### Example-Based Tests

**Example 1: Unmatched Receipts Navigation**
The Staff PWA should provide an "Unmatched Receipts" section accessible from the main navigation.
**Validates: Requirements 8.2**

**Example 2: Error Reporting Flow**
The Staff PWA should provide a "Report Issue" button that captures error logs and allows feedback submission.
**Validates: Requirements 10.5**

**Example 3: Unsupported Browser Warning**
The Staff PWA should display a warning if the browser version is unsupported.
**Validates: Requirements 15.5**


## Error Handling

### Error Categories

1. **Network Errors**
   - SSE connection lost: Automatic reconnection every 5 seconds
   - API unreachable: Queue assignments in IndexedDB, display offline status
   - Timeout: Retry with exponential backoff (1s, 2s, 4s)
   - SSL certificate invalid: Reject connection, log error

2. **Data Errors**
   - Incomplete receipt data: Display available fields, mark missing as "N/A"
   - Malformed JSON: Log error, display fallback UI
   - Missing required fields: Use defaults, log warning

3. **Browser API Errors**
   - Notifications not supported: Display in-app banner, degrade gracefully
   - IndexedDB not available: Use memory-only cache, warn user
   - EventSource not supported: Display browser upgrade warning

4. **Assignment Errors**
   - Tab not found (404): Display "Tab no longer open" error
   - Tab already closed: Suggest refreshing tab list
   - Server error (500): Retry with backoff, queue if persistent
   - Rate limiting (429): Implement exponential backoff

### Error Recovery Strategies

**Automatic Recovery**:
- SSE reconnection every 5 seconds
- API retry with exponential backoff (3 attempts)
- Queue persistence across page reloads
- Automatic queue processing on reconnection

**User-Initiated Recovery**:
- Manual reconnect button for SSE
- Retry button on error modals
- Refresh button for tab list
- "Report Issue" for unrecoverable errors

**Graceful Degradation**:
- Use cached tab list when API unavailable
- Display available receipt data when incomplete
- Continue core functionality during partial failures
- Provide clear status indicators

## Testing Strategy

### Dual Testing Approach

The POS Receipt Assignment Modal requires both unit testing and property-based testing:

**Unit Tests**: Verify specific examples, edge cases, and error conditions
- Empty tab list display
- Large receipt scrolling behavior
- Browser notification interactions
- Unmatched receipts navigation
- Error reporting flow

**Property Tests**: Verify universal properties across all inputs
- SSE connection establishment for random loads
- Receipt event broadcasting for random receipts
- Modal timing for random receipt sizes
- Search filtering for random queries
- Offline queueing for random assignments

### Property-Based Testing Configuration

**Testing Library**: fast-check (JavaScript/TypeScript property-based testing)

**Test Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with feature name and property number
- Tag format: `Feature: tabeza-desktop-modal, Property {N}: {property_text}`

**Example Property Test**:
```typescript
// Feature: tabeza-desktop-modal, Property 12: Real-Time Search Filtering
test('search filtering works for all queries', () => {
  fc.assert(
    fc.property(
      fc.array(fc.record({
        tabNumber: fc.integer({ min: 1, max: 1000 }),
        tableNumber: fc.option(fc.string()),
        customerIdentifier: fc.string(),
      })),
      fc.string(),
      (tabs, query) => {
        const filtered = filterTabs(tabs, query);
        filtered.forEach(tab => {
          expect(
            tab.tabNumber.toString().includes(query) ||
            tab.tableNumber?.includes(query)
          ).toBe(true);
        });
      }
    ),
    { numRuns: 100 }
  );
});
```

### Test Coverage Requirements

**Core Functionality** (Must have 100% coverage):
- SSE connection management
- Receipt event handling
- Modal display and interaction
- Tab assignment API calls
- Offline queueing

**Error Handling** (Must have 90%+ coverage):
- Network failures
- Data errors
- Browser API unavailability
- Assignment errors

**UI Components** (Must have 80%+ coverage):
- Modal rendering
- Tab list display
- Search filtering
- Status indicators

### Integration Testing

**End-to-End Scenarios**:
1. Receipt event → Modal display → Assign → Confirm (happy path)
2. Receipt event → Network loss → Queue → Reconnect → Retry
3. Multiple receipts in rapid succession
4. Background tab → Notification → Click → Modal display
5. Page reload with queued assignments

**External Integration Points**:
- Tabeza Cloud API (mock API server)
- SSE endpoint (mock event stream)
- IndexedDB (test database)
- Browser Notification API (mock)

### Performance Testing

**Benchmarks**:
- Modal display: < 500ms (P95)
- Tab list rendering: < 300ms (P95)
- Search filtering: < 100ms (P95)
- Assignment API call: < 3 seconds (P95)

**Load Testing**:
- 100 receipt events in 1 minute
- 1000 tab list with search
- 50 queued assignments
- 8-hour continuous operation

**Resource Monitoring**:
- Memory usage: < 50MB for PWA
- CPU usage: < 10% average
- IndexedDB size: < 10MB
- Network bandwidth: < 500KB/hour

## Deployment and Integration

### Prerequisites

**Existing Infrastructure**:
- Tabeza Printer Service (already deployed)
- Tabeza Cloud API (already deployed)
- Staff PWA (already deployed)
- Database with `unmatched_receipts` table

**New Requirements**:
- SSE endpoint in Cloud API
- Receipt assignment endpoint
- Browser support for EventSource API
- IndexedDB support in browser

### Integration Steps

1. **Cloud API Updates** (Week 1):
   - Add SSE endpoint `/api/events`
   - Add receipt assignment endpoint `/api/receipts/{id}/assign`
   - Update `unmatched_receipts` table schema
   - Add real-time event broadcasting

2. **Staff PWA Updates** (Week 2):
   - Add `useRealtimeReceipts` hook
   - Add `ReceiptAssignmentModal` component
   - Add `UnmatchedReceipts` component
   - Add IndexedDB caching layer

3. **Testing** (Week 3):
   - Unit tests for all components
   - Property tests for core logic
   - Integration tests for end-to-end flows
   - Performance testing

4. **Deployment** (Week 4):
   - Deploy Cloud API updates
   - Deploy Staff PWA updates
   - Monitor SSE connections
   - Gather user feedback

### Rollout Strategy

**Phase 1: Beta Testing** (1 week)
- Deploy to 3 pilot venues
- Monitor SSE connection stability
- Gather waiter feedback
- Fix critical bugs

**Phase 2: Gradual Rollout** (2 weeks)
- Deploy to 25% of venues
- Monitor performance metrics
- Adjust based on feedback
- Deploy to 50% of venues

**Phase 3: Full Deployment** (1 week)
- Deploy to all venues
- Monitor system health
- Provide support documentation
- Collect success metrics

### Monitoring and Observability

**Key Metrics**:
- SSE connection uptime (target: 99.5%)
- Modal display latency (target: < 500ms P95)
- Assignment success rate (target: > 99%)
- Offline queue size (alert if > 50)
- Receipt expiration rate (alert if > 10%)

**Logging**:
- SSE connection events (connect, disconnect, reconnect)
- Receipt events received
- Assignment attempts (success/failure)
- Queue operations (enqueue, dequeue, retry)
- Error events with stack traces

**Alerts**:
- SSE connection down for > 1 minute
- Assignment failure rate > 5%
- Queue size > 50 items
- Modal display latency > 2 seconds
- Receipt expiration rate > 20%

## Security Considerations

### Data Protection

**Receipt Data**:
- Receipts not stored in browser after assignment
- Temporary receipt data cleared from memory after modal close
- No receipt data in console logs (only metadata)

**Customer Data**:
- Customer identifiers never logged to console
- Tab information cached with 30-second TTL
- Cache cleared on logout

**Audit Logging**:
- Log only non-sensitive metadata
- Redact customer names, payment details
- Logs stored server-side only

### Network Security

**API Communication**:
- HTTPS only (TLS 1.2+)
- SSL certificate validation enforced
- No credentials in URLs or logs

**SSE Security**:
- Authenticated SSE connections
- Venue-specific event filtering
- Connection timeout after 1 hour idle

### Browser Security

**Content Security Policy**:
- Restrict script sources
- Disable inline scripts
- Allow only HTTPS resources

**Data Storage**:
- IndexedDB encrypted by browser
- No sensitive data in localStorage
- Clear all data on logout

## Maintenance and Support

### Logging

**Log Levels**:
- ERROR: Critical failures requiring attention
- WARN: Recoverable errors, degraded functionality
- INFO: Normal operations, state changes
- DEBUG: Detailed diagnostic information

**Browser Console Logs**:
```javascript
{
  timestamp: "2024-01-15T14:30:00.000Z",
  level: "INFO",
  component: "SSEConnection",
  event: "receipt_received",
  metadata: {
    receiptId: "receipt-123",
    venueId: "venue-456",
    itemCount: 3,
    total: 812
  }
}
```

### Support Documentation

**User Guide**:
- How to assign receipts
- How to access unmatched receipts
- How to handle errors
- How to report issues

**Troubleshooting Guide**:
1. **Modal not appearing**: Check SSE connection status, refresh page
2. **Assignment failed**: Check network, retry from unmatched receipts
3. **Tabs not loading**: Check cache, refresh tab list
4. **Notifications not working**: Check browser permissions

### Browser Compatibility

**Supported Browsers**:
- Chrome 90+ (recommended)
- Firefox 88+
- Safari 14+
- Edge 90+

**Required APIs**:
- EventSource (SSE)
- IndexedDB
- Notification API (optional)
- Service Worker (for PWA)

**Fallback Behavior**:
- No EventSource: Display upgrade warning
- No IndexedDB: Use memory-only cache
- No Notifications: In-app alerts only
- No Service Worker: Online-only mode
