'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// CORE TRUTH: Manual service always exists. 
// Digital authority is singular. 
// Tabeza adapts to the venue — never the reverse.

interface PrinterDriver {
  id: string;
  bar_id: string;
  driver_id: string;
  version: string;
  status: 'online' | 'offline' | 'error';
  last_heartbeat: string;
  first_seen: string;
  metadata: Record<string, any>;
}

interface PrinterStatusProps {
  barId: string;
  venueMode?: 'basic' | 'venue';
  authorityMode?: 'pos' | 'tabeza';
  compact?: boolean;
}

export default function PrinterStatus({ barId }: PrinterStatusProps) {
  const [drivers, setDrivers] = useState<PrinterDriver[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create Supabase client with environment variables
  // Using typeof window check to ensure we're on client side
  const supabaseUrl = typeof window !== 'undefined' 
    ? process.env.NEXT_PUBLIC_SUPABASE_URL 
    : '';
  const supabaseKey = typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    : '';
    
  const supabase = createClient(
    supabaseUrl || '',
    supabaseKey || ''
  );

  useEffect(() => {
    loadDrivers();

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
          loadDrivers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [barId]);

  async function loadDrivers() {
    try {
      const { data, error } = await supabase
        .from('printer_drivers')
        .select('*')
        .eq('bar_id', barId)
        .order('last_heartbeat', { ascending: false });

      if (error) throw error;

      // Show only the most recent active driver
      // Priority: 1) Most recent online driver, 2) Most recent driver overall
      const allDrivers = data || [];
      
      if (allDrivers.length === 0) {
        setDrivers([]);
        return;
      }
      
      // Find the most recent online driver
      const onlineDriver = allDrivers.find(d => d.status === 'online');
      
      // Show only one: either the most recent online driver, or the most recent driver
      const driverToShow = onlineDriver || allDrivers[0];
      setDrivers([driverToShow]);
      
    } catch (error) {
      console.error('Failed to load printer drivers:', error);
    } finally {
      setLoading(false);
    }
  }


  function getStatusColor(status: string): string {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'offline':
        return 'bg-gray-400';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  }

  function getStatusText(status: string): string {
    switch (status) {
      case 'online':
        return 'Connected';
      case 'offline':
        return 'Disconnected';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  }

  function formatLastSeen(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);

    if (diffSecs < 60) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else {
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) {
        return `${diffHours}h ago`;
      } else {
        return date.toLocaleDateString();
      }
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center space-x-3">
          <div className="h-3 w-3 animate-pulse rounded-full bg-gray-300"></div>
          <span className="text-sm text-gray-500">Loading printer status...</span>
        </div>
      </div>
    );
  }

  if (drivers.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center space-x-3">
          <div className="h-3 w-3 rounded-full bg-gray-400"></div>
          <div>
            <p className="text-sm font-medium text-gray-900">No Printer Connected</p>
            <p className="text-xs text-gray-500">
              Install TabezaConnect to capture POS receipts
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {drivers.map((driver) => (
        <div
          key={driver.id}
          className="rounded-lg border border-gray-200 bg-white p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div
                className={`h-3 w-3 rounded-full ${getStatusColor(driver.status)} ${
                  driver.status === 'online' ? 'animate-pulse' : ''
                }`}
              ></div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {getStatusText(driver.status)}
                </p>
                <p className="text-xs text-gray-500">
                  {driver.driver_id} • v{driver.version}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">
                Last seen: {formatLastSeen(driver.last_heartbeat)}
              </p>
              {driver.metadata?.captureMode && (
                <p className="text-xs text-gray-400">
                  Mode: {driver.metadata.captureMode}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
