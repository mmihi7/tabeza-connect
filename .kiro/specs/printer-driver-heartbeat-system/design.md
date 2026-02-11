# Printer Driver Heartbeat System - Design

## System Architecture

### Component Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    Cloud Infrastructure                       │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Next.js API Routes (Vercel)                           │  │
│  │  ├─ GET  /api/printer/driver-status                    │  │
│  │  └─ POST /api/printer/heartbeat                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                           ↕                                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Supabase Database                                     │  │
│  │  └─ printer_drivers table                              │  │
│  │     ├─ Stores driver registrations                     │  │
│  │     ├─ Tracks last_heartbeat timestamps                │  │
│  │     └─ Real-time subscriptions enabled                 │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                           ↕ HTTPS
                    (Heartbeat every 30s)
                           ↕
┌──────────────────────────────────────────────────────────────┐
│                    Venue's Computer                           │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Tabeza Connect (localhost:8765)                       │  │
│  │  └─ Heartbeat Service                                  │  │
│  │     ├─ Sends heartbeat every 30 seconds                │  │
│  │     ├─ Includes: bar_id, driver_id, version            │  │
│  │     └─ Retries on failure (max 3 attempts)             │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## Database Design

### printer_drivers Table

```sql
CREATE TABLE printer_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  driver_id TEXT NOT NULL UNIQUE,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'online',
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT printer_drivers_status_check CHECK (
    status IN ('online', 'offline', 'error')
  )
);

-- Indexes for performance
CREATE INDEX idx_printer_drivers_bar_id ON printer_drivers(bar_id);
CREATE INDEX idx_printer_drivers_driver_id ON printer_drivers(driver_id);
CREATE INDEX idx_printer_drivers_last_heartbeat ON printer_drivers(last_heartbeat DESC);
CREATE INDEX idx_printer_drivers_status ON printer_drivers(status);

-- Composite index for common query pattern
CREATE INDEX idx_printer_drivers_bar_status ON printer_drivers(bar_id, status, last_heartbeat DESC);
```

### Row Level Security Policies

```sql
-- Enable RLS
ALTER TABLE printer_drivers ENABLE ROW LEVEL SECURITY;

-- Policy: Bar staff can view their bar's drivers
CREATE POLICY printer_drivers_bar_staff_select ON printer_drivers
  FOR SELECT
  USING (
    bar_id IN (
      SELECT bar_id FROM user_bars 
      WHERE user_id = auth.uid()
    )
  );

-- Policy: System can insert/update drivers (for heartbeat endpoint)
CREATE POLICY printer_drivers_system_upsert ON printer_drivers
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

## API Implementation

### GET /api/printer/driver-status

**File:** `apps/staff/app/api/printer/driver-status/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    );
    
    // Get bar_id from query params
    const searchParams = request.nextUrl.searchParams;
    const barId = searchParams.get('barId');
    
    if (!barId) {
      return NextResponse.json(
        { error: 'Bar ID is required' },
        { status: 400 }
      );
    }
    
    // Query for active drivers (heartbeat within last 2 minutes)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    
    const { data: drivers, error } = await supabase
      .from('printer_drivers')
      .select('*')
      .eq('bar_id', barId)
      .gte('last_heartbeat', twoMinutesAgo)
      .order('last_heartbeat', { ascending: false });
    
    if (error) {
      console.error('Error querying printer drivers:', error);
      return NextResponse.json(
        { error: 'Failed to check driver status' },
        { status: 500 }
      );
    }
    
    // Determine status
    if (!drivers || drivers.length === 0) {
      return NextResponse.json({
        connected: false,
        status: 'not_configured',
        message: 'No printer drivers registered for this venue',
      });
    }
    
    const activeDriver = drivers[0];
    const lastSeenMinutes = Math.floor(
      (Date.now() - new Date(activeDriver.last_heartbeat).getTime()) / 60000
    );
    
    return NextResponse.json({
      connected: true,
      status: 'online',
      driver: {
        id: activeDriver.driver_id,
        version: activeDriver.version,
        lastSeen: activeDriver.last_heartbeat,
        firstSeen: activeDriver.first_seen,
        lastSeenMinutes,
      },
      message: `Printer connected (last seen ${lastSeenMinutes}m ago)`,
    });
    
  } catch (error) {
    console.error('Error checking driver status:', error);
    return NextResponse.json(
      { error: 'Failed to check driver status' },
      { status: 500 }
    );
  }
}
```

### POST /api/printer/heartbeat

**File:** `apps/staff/app/api/printer/heartbeat/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { barId, driverId, version, status, metadata } = body;
    
    // Validate required fields
    if (!barId || !driverId || !version) {
      return NextResponse.json(
        { error: 'Missing required fields: barId, driverId, version' },
        { status: 400 }
      );
    }
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    );
    
    // Verify bar exists
    const { data: bar, error: barError } = await supabase
      .from('bars')
      .select('id')
      .eq('id', barId)
      .single();
    
    if (barError || !bar) {
      return NextResponse.json(
        { error: 'Invalid bar ID' },
        { status: 400 }
      );
    }
    
    // Upsert driver record (insert or update)
    const { error: upsertError } = await supabase
      .from('printer_drivers')
      .upsert({
        bar_id: barId,
        driver_id: driverId,
        version,
        status: status || 'online',
        last_heartbeat: new Date().toISOString(),
        metadata: metadata || {},
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'driver_id',
      });
    
    if (upsertError) {
      console.error('Error upserting printer driver:', upsertError);
      return NextResponse.json(
        { error: 'Failed to update heartbeat' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Heartbeat received',
    });
    
  } catch (error) {
    console.error('Error processing heartbeat:', error);
    return NextResponse.json(
      { error: 'Failed to process heartbeat' },
      { status: 500 }
    );
  }
}
```

## Printer Service Implementation

### Heartbeat Service

**File:** `packages/printer-service/index.js` (additions)

```javascript
// Heartbeat configuration
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const HEARTBEAT_RETRY_ATTEMPTS = 3;
const HEARTBEAT_RETRY_DELAY = 5000; // 5 seconds

let heartbeatInterval = null;
let heartbeatFailures = 0;

// Start heartbeat service
function startHeartbeat() {
  if (!config.barId) {
    console.log('⚠️  Heartbeat disabled - Bar ID not configured');
    return;
  }
  
  console.log('💓 Starting heartbeat service...');
  
  // Send initial heartbeat immediately
  sendHeartbeat();
  
  // Then send every 30 seconds
  heartbeatInterval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
}

// Stop heartbeat service
function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    console.log('💔 Heartbeat service stopped');
  }
}

// Send heartbeat to cloud
async function sendHeartbeat(attempt = 1) {
  try {
    const response = await fetch(`${config.apiUrl}/api/printer/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barId: config.barId,
        driverId: config.driverId,
        version: '1.0.0',
        status: 'running',
        metadata: {
          hostname: require('os').hostname(),
          platform: process.platform,
          nodeVersion: process.version,
        },
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Heartbeat failed: ${response.status}`);
    }
    
    // Reset failure counter on success
    if (heartbeatFailures > 0) {
      console.log('✅ Heartbeat connection restored');
      heartbeatFailures = 0;
    }
    
  } catch (error) {
    heartbeatFailures++;
    
    console.error(`❌ Heartbeat failed (attempt ${attempt}/${HEARTBEAT_RETRY_ATTEMPTS}):`, error.message);
    
    // Retry with exponential backoff
    if (attempt < HEARTBEAT_RETRY_ATTEMPTS) {
      const delay = HEARTBEAT_RETRY_DELAY * Math.pow(2, attempt - 1);
      console.log(`   Retrying in ${delay / 1000}s...`);
      
      setTimeout(() => {
        sendHeartbeat(attempt + 1);
      }, delay);
    } else {
      console.error(`   Max retries reached. Will try again in ${HEARTBEAT_INTERVAL / 1000}s`);
    }
  }
}
```

## UI Component Updates

### PrinterStatusIndicator.tsx

```typescript
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Printer, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

interface PrinterStatusIndicatorProps {
  barId: string;
}

export default function PrinterStatusIndicator({ barId }: PrinterStatusIndicatorProps) {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [lastSeen, setLastSeen] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  useEffect(() => {
    const supabase = createClient();
    
    // Initial status check
    checkStatus();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel('printer-drivers')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'printer_drivers',
          filter: `bar_id=eq.${barId}`,
        },
        (payload) => {
          console.log('Printer driver update:', payload);
          checkStatus();
        }
      )
      .subscribe();
    
    // Poll every 60 seconds as backup
    const interval = setInterval(checkStatus, 60000);
    
    return () => {
      channel.unsubscribe();
      clearInterval(interval);
    };
  }, [barId]);
  
  async function checkStatus() {
    try {
      const response = await fetch(`/api/printer/driver-status?barId=${barId}`);
      const data = await response.json();
      
      setStatus(data.connected ? 'online' : 'offline');
      if (data.driver?.lastSeen) {
        setLastSeen(new Date(data.driver.lastSeen));
      }
    } catch (error) {
      console.error('Error checking printer status:', error);
      setStatus('offline');
    }
  }
  
  const getStatusIcon = () => {
    switch (status) {
      case 'online':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'offline':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'checking':
        return <RefreshCw className="w-5 h-5 text-gray-600 animate-spin" />;
    }
  };
  
  return (
    <div className="flex items-center gap-2">
      <Printer className="w-5 h-5" />
      {getStatusIcon()}
      <span className="text-sm font-medium">
        {status === 'online' ? 'Connected' : status === 'offline' ? 'Disconnected' : 'Checking...'}
      </span>
      {lastSeen && status === 'online' && (
        <span className="text-xs text-gray-500">
          (last seen {Math.floor((Date.now() - lastSeen.getTime()) / 60000)}m ago)
        </span>
      )}
    </div>
  );
}
```

## Deployment Strategy

1. **Phase 1:** Deploy database migration
2. **Phase 2:** Deploy API endpoints
3. **Phase 3:** Update printer service with heartbeat
4. **Phase 4:** Update UI components
5. **Phase 5:** Monitor and iterate

## Rollback Plan

If issues arise:
1. Disable heartbeat in printer service (config flag)
2. Revert API endpoints to stub implementation
3. Keep database table for future use
4. No data loss - only feature degradation
