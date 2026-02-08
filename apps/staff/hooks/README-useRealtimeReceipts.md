# useRealtimeReceipts Hook

React hook for managing real-time receipt delivery via Supabase Realtime in the Tabeza Staff PWA.

## Purpose

This hook establishes and manages a Supabase Realtime connection to receive POS receipt events in real-time. When a receipt is printed from the POS system and intercepted by the Tabeza Printer Service, it's inserted into the `unmatched_receipts` table, triggering a real-time event that this hook receives.

## Features

- ✅ Automatic Supabase Realtime connection establishment
- ✅ Real-time receipt event delivery (< 1 second)
- ✅ Automatic reconnection on connection loss (5-second interval)
- ✅ Connection status tracking (connecting, connected, reconnecting, disconnected, error)
- ✅ Venue-specific filtering (only receives receipts for current bar)
- ✅ Manual reconnection support
- ✅ Graceful cleanup on unmount
- ✅ Console logging for debugging

## Usage

### Basic Usage

```typescript
import { useRealtimeReceipts } from '@/hooks/useRealtimeReceipts';

function ReceiptManager() {
  const { receipts, connectionStatus, isConnected, reconnect } = useRealtimeReceipts({
    barId: 'your-bar-id',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  });

  return (
    <div>
      <div>Status: {connectionStatus}</div>
      <div>Receipts: {receipts.length}</div>
      
      {receipts.map(receipt => (
        <div key={receipt.id}>
          {receipt.receipt_data.venueName} - KES {receipt.receipt_data.total}
        </div>
      ))}
    </div>
  );
}
```

### With Callbacks

```typescript
const { receipts, connectionStatus } = useRealtimeReceipts({
  barId: currentBar.id,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  
  // Called when a new receipt arrives
  onReceiptReceived: (receipt) => {
    console.log('New receipt:', receipt);
    playNotificationSound();
    showModal(receipt);
  },
  
  // Called when connection status changes
  onConnectionStatusChange: (status) => {
    console.log('Connection status:', status);
    updateStatusIndicator(status);
  }
});
```

### With Custom Reconnection

```typescript
const { 
  receipts, 
  connectionStatus, 
  reconnect, 
  disconnect 
} = useRealtimeReceipts({
  barId: currentBar.id,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  autoReconnect: false, // Disable automatic reconnection
  reconnectInterval: 10000 // 10 seconds (default is 5000)
});

// Manual reconnection
function handleReconnect() {
  reconnect();
}

// Manual disconnection
function handleDisconnect() {
  disconnect();
}
```

## API

### Options

```typescript
interface UseRealtimeReceiptsOptions {
  barId: string;                                    // Required: Current venue ID
  supabaseUrl: string;                              // Required: Supabase project URL
  supabaseKey: string;                              // Required: Supabase anon/service key
  onReceiptReceived?: (receipt: Receipt) => void;   // Optional: Receipt callback
  onConnectionStatusChange?: (status: ConnectionStatus) => void; // Optional: Status callback
  autoReconnect?: boolean;                          // Optional: Enable auto-reconnect (default: true)
  reconnectInterval?: number;                       // Optional: Reconnect delay in ms (default: 5000)
}
```

### Return Value

```typescript
interface UseRealtimeReceiptsResult {
  receipts: Receipt[];              // Array of received receipts (newest first)
  connectionStatus: ConnectionStatus; // Current connection status
  isConnected: boolean;             // True if status is 'connected'
  reconnect: () => void;            // Manually trigger reconnection
  disconnect: () => void;           // Manually disconnect
  clearReceipts: () => void;        // Clear receipts array
}
```

### Types

```typescript
type ConnectionStatus = 
  | 'connecting'    // Initial connection attempt
  | 'connected'     // Successfully connected and subscribed
  | 'reconnecting'  // Attempting to reconnect after failure
  | 'disconnected'  // Manually disconnected or connection closed
  | 'error';        // Connection error occurred

interface Receipt {
  id: string;
  bar_id: string;
  receipt_data: {
    venueName: string;
    timestamp: string;
    items: LineItem[];
    subtotal: number;
    tax: number;
    total: number;
  };
  status: 'pending' | 'assigned' | 'expired';
  created_at: string;
  assigned_at: string | null;
  assigned_to_tab_id: string | null;
  expires_at: string;
}

interface LineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}
```

## Connection Lifecycle

1. **Connecting**: Initial connection attempt when hook mounts
2. **Connected**: Successfully subscribed to Supabase Realtime channel
3. **Reconnecting**: Connection lost, attempting to reconnect
4. **Disconnected**: Manually disconnected or connection closed
5. **Error**: Connection error (channel error or timeout)

## Automatic Reconnection

The hook automatically attempts to reconnect when:
- Connection error occurs (`CHANNEL_ERROR`)
- Connection times out (`TIMED_OUT`)
- Connection is closed unexpectedly (`CLOSED`)

Reconnection behavior:
- Waits 5 seconds (configurable) before attempting reconnection
- Cleans up old channel before creating new one
- Resets reconnect attempts counter on successful connection
- Can be disabled with `autoReconnect: false`

## Venue Filtering

The hook automatically filters receipts by `bar_id`:
- Only receives receipts for the specified venue
- Uses Supabase Realtime filter: `bar_id=eq.{barId}`
- Prevents cross-venue receipt leakage

## Testing

### Unit Tests

```bash
cd apps/staff
npm test -- useRealtimeReceipts.test.ts
```

### Manual Testing

```bash
# Terminal 1: Start listening for receipts
node dev-tools/scripts/test-realtime-hook.js

# Terminal 2: Insert a test receipt
node dev-tools/scripts/insert-test-receipt.js
```

## Requirements Validated

- ✅ **Requirement 1.1**: Establishes persistent Supabase Realtime connection
- ✅ **Requirement 1.2**: Receives receipt events from cloud API
- ✅ **Requirement 1.4**: Automatically reconnects every 5 seconds on failure
- ✅ **Requirement 1.5**: Maintains connection as long as component is mounted
- ✅ **Requirement 9.1**: Displays connection status indicator
- ✅ **Requirement 9.2**: Shows reconnecting status
- ✅ **Requirement 9.3**: Shows disconnected status
- ✅ **Requirement 9.5**: Logs connection events to console

## Performance

- **Event Delivery**: < 1 second from database insert to hook receipt
- **Reconnection**: 5 seconds (configurable)
- **Memory**: Receipts stored in React state (cleared on unmount)
- **Network**: Persistent WebSocket connection (minimal overhead)

## Security

- Uses Supabase RLS policies for access control
- Filters receipts by venue ID at database level
- Supports both anon key (for authenticated users) and service key (for testing)
- No sensitive data stored in browser after assignment

## Troubleshooting

### No receipts received

1. Verify Realtime is enabled in Supabase Dashboard:
   - Database > Replication > Enable for `unmatched_receipts`
2. Check RLS policies allow reading receipts
3. Verify `bar_id` matches the venue
4. Check browser console for connection errors

### Connection keeps disconnecting

1. Check network connectivity
2. Verify Supabase project is active
3. Check for rate limiting
4. Review Supabase logs for errors

### Receipts not filtered correctly

1. Verify `bar_id` is correct
2. Check Supabase Realtime filter syntax
3. Ensure RLS policies don't interfere with filtering

## Next Steps

After implementing this hook:
1. Create `ReceiptAssignmentModal` component (Task 3)
2. Integrate hook with modal to display receipts
3. Add browser notifications for background tabs (Task 7)
4. Implement unmatched receipts page (Task 8)

