# Printer Driver Queries - Usage Guide

## Overview

The printer driver query system provides functions and UI components for displaying and monitoring printer drivers connected to a venue.

## Core Components

### 1. Query Functions (`@tabeza/shared`)

Located in `packages/shared/lib/services/printer-driver-queries.ts`

#### `getActiveDrivers(barId: string)`
Returns drivers with heartbeat within the last 5 minutes.

```typescript
import { getActiveDrivers } from '@tabeza/shared';

const { data, error } = await getActiveDrivers(barId);
if (data) {
  console.log(`Found ${data.length} active drivers`);
}
```

#### `getAllDrivers(barId: string)`
Returns all drivers for a bar, including inactive/stale ones.

```typescript
import { getAllDrivers } from '@tabeza/shared';

const { data, error } = await getAllDrivers(barId);
// Useful for debugging and administrative purposes
```

#### `isDriverActive(lastHeartbeat: string)`
Checks if a driver is currently active based on last heartbeat timestamp.

```typescript
import { isDriverActive } from '@tabeza/shared';

const active = isDriverActive(driver.last_heartbeat);
// Returns true if heartbeat within 5 minutes
```

#### `getTimeSinceHeartbeat(lastHeartbeat: string)`
Returns human-readable time since last heartbeat.

```typescript
import { getTimeSinceHeartbeat } from '@tabeza/shared';

const timeSince = getTimeSinceHeartbeat(driver.last_heartbeat);
// Returns: "2 minutes ago", "1 hour ago", etc.
```

#### `getDriverStatus(driver: PrinterDriver)`
Returns enhanced status information for a driver.

```typescript
import { getDriverStatus } from '@tabeza/shared';

const status = getDriverStatus(driver);
// Returns: { isActive, timeSince, statusText, statusColor }
```

### 2. UI Component - PrinterDriversList

Located in `apps/staff/components/printer/PrinterDriversList.tsx`

A React component that displays a list of printer drivers with real-time updates.

#### Basic Usage

```tsx
import { PrinterDriversList } from '@/components/printer';

export default function PrinterSettings() {
  return (
    <div>
      <h1>Printer Drivers</h1>
      <PrinterDriversList barId={barId} />
    </div>
  );
}
```

#### Props

- `barId` (required): The bar ID to query drivers for
- `showInactive` (optional, default: false): Show inactive drivers by default
- `autoRefresh` (optional, default: true): Enable automatic refresh
- `refreshInterval` (optional, default: 30000): Refresh interval in milliseconds

#### Advanced Usage

```tsx
<PrinterDriversList
  barId={barId}
  showInactive={false}
  autoRefresh={true}
  refreshInterval={30000}
/>
```

## Features

### Active Driver Detection
- Drivers with heartbeat within 5 minutes are considered "active"
- Visual indicators show online/offline status
- Color-coded backgrounds (green for online, gray for offline)

### Real-time Updates
- Automatic refresh every 30 seconds (configurable)
- Manual refresh button available
- Shows time since last heartbeat

### Toggle View
- "Active Only" mode: Shows only drivers with recent heartbeat
- "Show All" mode: Shows all drivers including stale ones
- Useful for debugging and troubleshooting

### Visual Indicators
- ✅ Green background + CheckCircle icon = Online
- ❌ Gray background + XCircle icon = Offline
- Status badges with "Online" or "Offline" text
- Clock icon showing time since last heartbeat

## Integration Example

### Settings Page

```tsx
'use client';

import { PrinterDriversList } from '@/components/printer';
import { useBarContext } from '@/contexts/BarContext';

export default function PrinterSettingsPage() {
  const { currentBar } = useBarContext();

  if (!currentBar) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Printer Settings</h1>
      
      <div className="space-y-6">
        {/* Printer Status Indicator */}
        <PrinterStatusIndicator barId={currentBar.id} />
        
        {/* Printer Drivers List */}
        <PrinterDriversList barId={currentBar.id} />
      </div>
    </div>
  );
}
```

### Dashboard Widget

```tsx
<div className="grid grid-cols-2 gap-4">
  <div className="col-span-1">
    <h3>Active Printers</h3>
    <PrinterDriversList
      barId={barId}
      showInactive={false}
      autoRefresh={true}
      refreshInterval={60000}
    />
  </div>
</div>
```

## Database Schema

The queries interact with the `printer_drivers` table:

```sql
create table public.printer_drivers (
  id uuid not null default gen_random_uuid(),
  bar_id uuid not null,
  driver_id text not null,
  version text not null,
  status text not null default 'online',
  last_heartbeat timestamp with time zone not null,
  first_seen timestamp with time zone not null,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  
  constraint printer_drivers_pkey primary key (id),
  constraint printer_drivers_driver_id_key unique (driver_id),
  constraint printer_drivers_bar_id_fkey foreign key (bar_id) 
    references bars (id) on delete cascade
);
```

## Constants

- `ACTIVE_THRESHOLD_MINUTES = 5`: Drivers are considered active if heartbeat within 5 minutes
- Default refresh interval: 30 seconds
- Heartbeat interval (TabezaConnect): 30 seconds

## Error Handling

All query functions return a result object with `data` and `error` properties:

```typescript
const { data, error } = await getActiveDrivers(barId);

if (error) {
  console.error('Failed to fetch drivers:', error);
  // Handle error
} else {
  // Use data
}
```

The UI component displays error states with retry functionality.

## Testing

To test the driver queries:

1. Start TabezaConnect service with the fixed driver ID generation
2. Verify driver appears in the list as "Online"
3. Stop the service
4. Wait 5+ minutes
5. Verify driver shows as "Offline"
6. Toggle "Show All" to see inactive drivers

## Related Components

- `PrinterStatusIndicator`: Shows overall printer service status
- `VirtualPrinterIntegration`: Handles POS receipt distribution
- `ReceiptDistributionModal`: Modal for distributing receipts to customers

## CORE TRUTH

Manual service always exists. Digital authority is singular. Tabeza adapts to the venue — never the reverse.

This printer driver system supports venues operating in POS-authoritative mode, where Tabeza mirrors receipts from the POS system.
