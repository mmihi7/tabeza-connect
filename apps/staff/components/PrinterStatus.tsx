'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Printer, CheckCircle, XCircle, AlertCircle, RefreshCw, Download, Zap } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// CORE TRUTH: Manual service always exists. 
// Digital authority is singular. 
// Tabeza adapts to the venue — never the reverse.

type PrinterConnectionStatus = 'online' | 'connecting' | 'offline' | 'error';

interface PrinterDriver {
  id: string;
  version: string;
  lastHeartbeat: string;
  lastSeenMinutes: number;
}

interface PrinterState {
  status: PrinterConnectionStatus;
  driver?: PrinterDriver;
  isRefreshing: boolean;
  isTesting: boolean;
  message: string;
  error?: string;
}

interface PrinterStatusProps {
  barId: string;
  venueMode: 'basic' | 'venue';
  authorityMode: 'pos' | 'tabeza';
  compact?: boolean; // For header display
}

/**
 * Calculate printer status based on last heartbeat timestamp
 * - < 2 minutes: Online (🟢)
 * - 2-5 minutes: Connecting (🟡)
 * - > 5 minutes: Offline (🔴)
 */
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

/**
 * Format last seen time in human-readable format
 */
function formatLastSeen(minutes: number): string {
  if (minutes < 1) {
    return 'just now';
  } else if (minutes === 1) {
    return '1 minute ago';
  } else if (minutes < 60) {
    return `${Math.floor(minutes)} minutes ago`;
  } else {
    const hours = Math.floor(minutes / 60);
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
}

export default function PrinterStatus({
  barId,
  venueMode,
  authorityMode,
  compact = false,
}: PrinterStatusProps) {
  const [state, setState] = useState<PrinterState>({
    status: 'connecting',
    isRefreshing: false,
    isTesting: false,
    message: 'Checking printer service...',
  });

  const [lastSeenText, setLastSeenText] = useState<string>('');

  /**
   * Check printer status via API
   */
  const checkPrinterStatus = useCallback(async () => {
    setState(prev => ({ ...prev, isRefreshing: true }));
    
    try {
      const response = await fetch(`/api/printer/driver-status?barId=${barId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.connected && data.driver) {
        const status = calculatePrinterStatus(data.driver.lastSeen);
        setState({
          status,
          driver: {
            id: data.driver.id,
            version: data.driver.version,
            lastHeartbeat: data.driver.lastSeen,
            lastSeenMinutes: data.driver.lastSeenMinutes,
          },
          isRefreshing: false,
          isTesting: false,
          message: data.message,
        });
        setLastSeenText(formatLastSeen(data.driver.lastSeenMinutes));
      } else {
        setState({
          status: 'offline',
          isRefreshing: false,
          isTesting: false,
          message: data.message || 'Printer service not configured',
        });
      }
    } catch (error) {
      console.error('Error checking printer status:', error);
      setState({
        status: 'error',
        isRefreshing: false,
        isTesting: false,
        message: 'Failed to check printer service',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [barId]);

  /**
   * Handle reconnect button click
   */
  const handleReconnect = useCallback(async () => {
    setState(prev => ({ ...prev, isRefreshing: true, message: 'Reconnecting...' }));
    
    try {
      const response = await fetch('/api/printer/reconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barId }),
      });

      const data = await response.json();
      
      if (data.success) {
        // Refresh status after reconnect
        await checkPrinterStatus();
      } else {
        setState(prev => ({
          ...prev,
          isRefreshing: false,
          message: data.message || 'Reconnect failed',
        }));
      }
    } catch (error) {
      console.error('Error reconnecting printer:', error);
      setState(prev => ({
        ...prev,
        isRefreshing: false,
        message: 'Failed to reconnect',
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [barId, checkPrinterStatus]);

  /**
   * Handle test print button click
   */
  const handleTestPrint = useCallback(async () => {
    setState(prev => ({ ...prev, isTesting: true }));
    
    try {
      const response = await fetch('/api/printer/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barId }),
      });

      const data = await response.json();
      
      if (data.success) {
        alert('✅ Test print sent successfully! Check your printer.');
      } else {
        const errorMsg = data.error || 'Unknown error';
        
        if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('fetch failed')) {
          alert(
            '❌ Cannot connect to printer service.\n\n' +
            'The Tabeza Printer Service is not running.\n\n' +
            'Please:\n' +
            '1. Download and install the printer service from tabeza.co.ke, OR\n' +
            '2. Start the service if already installed\n\n' +
            'Error: ' + errorMsg
          );
        } else {
          alert('❌ Test print failed: ' + errorMsg);
        }
      }
    } catch (error) {
      console.error('Error testing printer:', error);
      alert(
        '❌ Failed to send test print.\n\n' +
        'Make sure the Tabeza Printer Service is running.'
      );
    } finally {
      setState(prev => ({ ...prev, isTesting: false }));
    }
  }, [barId]);

  /**
   * Setup realtime subscription and polling
   */
  useEffect(() => {
    // Initial status check
    checkPrinterStatus();

    // Setup Supabase realtime subscription
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    );

    const channel = supabase
      .channel('printer-drivers-status')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'printer_drivers',
          filter: `bar_id=eq.${barId}`,
        },
        (payload) => {
          console.log('Printer driver update received:', payload);
          // Refresh status when heartbeat received
          checkPrinterStatus();
        }
      )
      .subscribe();

    // Polling fallback (15 second interval)
    const pollInterval = setInterval(checkPrinterStatus, 15000);

    // Cleanup on unmount
    return () => {
      channel.unsubscribe();
      clearInterval(pollInterval);
    };
  }, [barId, checkPrinterStatus]);

  /**
   * Update "last seen" text every minute
   */
  useEffect(() => {
    if (!state.driver?.lastSeenMinutes) return;

    const interval = setInterval(() => {
      if (state.driver?.lastSeenMinutes !== undefined) {
        setLastSeenText(formatLastSeen(state.driver.lastSeenMinutes + 1));
      }
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [state.driver?.lastSeenMinutes]);

  /**
   * Get status color classes
   */
  const getStatusColor = (): string => {
    switch (state.status) {
      case 'online':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'connecting':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'offline':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'error':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  /**
   * Get status icon
   */
  const getStatusIcon = () => {
    switch (state.status) {
      case 'online':
        return <CheckCircle className="w-5 h-5" data-testid="printer-status-icon" />;
      case 'connecting':
        return <RefreshCw className="w-5 h-5 animate-spin" data-testid="printer-status-icon" />;
      case 'offline':
        return <XCircle className="w-5 h-5" data-testid="printer-status-icon" />;
      case 'error':
        return <AlertCircle className="w-5 h-5" data-testid="printer-status-icon" />;
      default:
        return <Printer className="w-5 h-5" data-testid="printer-status-icon" />;
    }
  };

  /**
   * Get status text
   */
  const getStatusText = (): string => {
    switch (state.status) {
      case 'online':
        return 'Online';
      case 'connecting':
        return 'Connecting';
      case 'offline':
        return 'Offline';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  /**
   * Render troubleshooting guidance for offline state
   */
  const renderTroubleshooting = () => {
    if (state.status === 'online') return null;

    return (
      <div className="mt-3 space-y-3">
        <div className="text-sm">
          <p className="font-medium mb-2">To connect your printer:</p>
          <ol className="list-decimal list-inside space-y-1 text-sm opacity-90">
            <li>Download TabezaConnect from <a href="/download" className="text-blue-600 hover:text-blue-700 underline">Downloads page</a></li>
            <li>Run the installer as administrator</li>
            <li>Service will connect automatically</li>
          </ol>
        </div>
        
        <div className="flex gap-2">
          <a
            href="/download"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-lg hover:bg-opacity-90 transition text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Download TabezaConnect
          </a>
          
          <button
            onClick={handleReconnect}
            disabled={state.isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-lg hover:bg-opacity-90 transition text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${state.isRefreshing ? 'animate-spin' : ''}`} />
            Reconnect
          </button>
        </div>
      </div>
    );
  };

  /**
   * Compact view for header/navbar
   */
  if (compact) {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${getStatusColor()}`}>
        <Printer className="w-4 h-4" />
        {getStatusIcon()}
        <span className="text-sm font-medium">{getStatusText()}</span>
      </div>
    );
  }

  /**
   * Full detailed view
   */
  return (
    <div className={`rounded-lg border p-4 ${getStatusColor()}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div className="p-2 rounded-lg bg-white bg-opacity-50">
            <Printer className="w-6 h-6" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <h3 className="font-semibold text-lg">
                Printer Service: {getStatusText()}
              </h3>
            </div>
            
            <p className="text-sm mt-1 opacity-90">
              {state.message}
            </p>
            
            {/* Driver details when online */}
            {state.status === 'online' && state.driver && (
              <div className="mt-2 space-y-1 text-xs opacity-75">
                <div>Driver ID: {state.driver.id.substring(0, 8)}...</div>
                <div>Version: {state.driver.version}</div>
                <div>Last seen: {lastSeenText}</div>
              </div>
            )}

            {/* Troubleshooting when offline */}
            {renderTroubleshooting()}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={checkPrinterStatus}
            disabled={state.isRefreshing}
            className="p-2 rounded-lg bg-white bg-opacity-50 hover:bg-opacity-75 transition disabled:opacity-50"
            title="Refresh status"
          >
            <RefreshCw className={`w-4 h-4 ${state.isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {state.status === 'online' && (
            <button
              onClick={handleTestPrint}
              disabled={state.isTesting}
              className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg hover:bg-opacity-90 transition text-sm font-medium disabled:opacity-50"
              title="Send test print"
            >
              <Zap className="w-4 h-4" />
              {state.isTesting ? 'Testing...' : 'Test Print'}
            </button>
          )}
        </div>
      </div>

      {/* Error details */}
      {state.error && (
        <div className="mt-3 p-2 bg-white bg-opacity-50 rounded text-xs font-mono">
          Error: {state.error}
        </div>
      )}
    </div>
  );
}
