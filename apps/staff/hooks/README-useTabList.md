# useTabList Hook

## Overview

The `useTabList` hook manages fetching and caching of open tabs for receipt assignment in the Tabeza Staff PWA. It provides automatic refresh, stale data detection, and error handling for displaying available tabs in the receipt assignment modal.

## Features

- **Automatic Fetching**: Fetches open tabs on mount and when venue changes
- **Auto-Refresh**: Refreshes tab list every 30 seconds (configurable)
- **Stale Detection**: Indicates when cached data is older than 30 seconds
- **Cache Age Tracking**: Provides cache age in milliseconds
- **Manual Refresh**: Allows on-demand refresh via `refresh()` function
- **Loading States**: Tracks loading state during fetch operations
- **Error Handling**: Captures and exposes fetch errors
- **Venue Filtering**: Only fetches tabs for the specified venue
- **Cleanup**: Properly cleans up intervals on unmount

## Usage

### Basic Usage

```typescript
import { useTabList } from '../hooks/useTabList';

function ReceiptAssignmentModal({ venueId }: { venueId: string }) {
  const { tabs, isLoading, error, refresh } = useTabList({ venueId });

  if (isLoading) return <div>Loading tabs...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>Select a Tab</h2>
      <ul>
        {tabs.map(tab => (
          <li key={tab.id}>
            Tab #{tab.tabNumber} - {tab.customerIdentifier}
          </li>
        ))}
      </ul>
      <button onClick={refresh}>Refresh</button>
    </div>
  );
}
```

### With Custom Refresh Interval

```typescript
const { tabs, isLoading } = useTabList({
  venueId: 'venue-123',
  refreshInterval: 10000 // Refresh every 10 seconds
});
```

### With Stale Data Indicator

```typescript
const { tabs, isStale, getCacheAge } = useTabList({ venueId });

return (
  <div>
    {isStale && (
      <div className="warning">
        Data is stale (age: {Math.round(getCacheAge() / 1000)}s)
      </div>
    )}
    {/* Tab list */}
  </div>
);
```

### Conditional Fetching

```typescript
const [modalOpen, setModalOpen] = useState(false);

const { tabs } = useTabList({
  venueId: 'venue-123',
  enabled: modalOpen // Only fetch when modal is open
});
```

## API

### Parameters

```typescript
interface UseTabListOptions {
  venueId: string;           // Required: Venue ID to filter tabs
  enabled?: boolean;         // Optional: Enable/disable fetching (default: true)
  refreshInterval?: number;  // Optional: Auto-refresh interval in ms (default: 30000)
}
```

### Return Value

```typescript
interface UseTabListReturn {
  tabs: Tab[];                    // Array of open tabs
  isLoading: boolean;             // True during fetch operations
  isStale: boolean;               // True if cache is > 30 seconds old
  error: Error | null;            // Fetch error if any
  refresh: () => Promise<void>;   // Manual refresh function
  getCacheAge: () => number;      // Returns cache age in milliseconds
}
```

### Tab Interface

```typescript
interface Tab {
  id: string;                     // Unique tab ID
  tabNumber: number;              // Tab number (e.g., 42)
  tableNumber?: string;           // Optional table number (e.g., "A1")
  customerIdentifier: string;     // Customer name or "Tab #42" fallback
  openedAt: Date;                 // When tab was opened
  status: 'open' | 'overdue' | 'closed';  // Tab status
}
```

## Implementation Details

### Caching Strategy

- **Storage**: React state (no IndexedDB)
- **TTL**: 30 seconds (configurable via `refreshInterval`)
- **Staleness**: Marked stale after 30 seconds
- **Refresh**: Automatic every 30 seconds + manual via `refresh()`

### API Endpoint

Fetches from: `GET /api/tabs?venueId={venueId}&status=open`

Expected response:
```json
{
  "tabs": [
    {
      "id": "tab-uuid",
      "tab_number": 42,
      "table_number": "A1",
      "owner_identifier": "John Doe",
      "opened_at": "2024-01-15T14:00:00.000Z",
      "status": "open"
    }
  ]
}
```

### Error Handling

- Network errors are caught and exposed via `error` property
- HTTP errors (non-200 status) are converted to Error objects
- Errors are cleared on successful retry
- Component state is only updated if still mounted

### Cleanup

- Intervals are cleared on unmount
- Intervals are cleared when dependencies change
- Component mount status tracked to prevent state updates after unmount

## Testing

The hook includes comprehensive unit tests covering:

- Initial fetch on mount
- Data transformation from API to Tab interface
- Automatic refresh every 30 seconds
- Custom refresh intervals
- Manual refresh functionality
- Cache staleness detection
- Cache age calculation
- Error handling (network errors, HTTP errors)
- Venue filtering
- Loading state management
- Empty state handling
- Cleanup on unmount

Run tests:
```bash
npm test -- useTabList.test.ts
```

## Requirements Satisfied

- **3.1**: Fetch and display list of open tabs
- **6.1**: Implement automatic refresh
- **6.2**: Display stale data indicator
- **6.5**: Handle empty tab list
- **12.1**: Venue-specific filtering
- **12.2**: Loading state management
- **12.3**: Error handling

## Design Decisions

### Why React State Instead of IndexedDB?

Per the design document, we use React state for caching because:
- Simpler implementation
- Tabs change constantly (high churn)
- No offline requirement for tab list
- Easier to debug and test
- Sufficient for 30-second refresh cycle

### Why 30-Second Refresh?

- Balances freshness with API load
- Matches cache TTL for consistency
- Sufficient for staff workflow (receipts arrive infrequently)
- Can be customized via `refreshInterval` prop if needed

## Related Files

- `apps/staff/hooks/useTabList.ts` - Hook implementation
- `apps/staff/hooks/__tests__/useTabList.test.ts` - Unit tests
- `apps/staff/components/ReceiptAssignmentModal.tsx` - Primary consumer
- `.kiro/specs/tabeza-desktop-modal/design.md` - Design document
