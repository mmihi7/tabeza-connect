'use client';

import React, { useState, useEffect } from 'react';
import { Printer, CheckCircle, XCircle, AlertCircle, RefreshCw, Download, Zap } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

type PrinterStatus = {
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
};

interface PrinterStatusIndicatorProps {
  barId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
  showDetails?: boolean;
  compact?: boolean;
}

export default function PrinterStatusIndicator({
  barId,
  autoRefresh = true,
  refreshInterval = 60000, // 60 seconds (reduced from 10s to match heartbeat interval)
  showDetails = true,
  compact = false,
}: PrinterStatusIndicatorProps) {
  const [status, setStatus] = useState<PrinterStatus>({
    connected: false,
    status: 'checking',
    message: 'Checking printer service...',
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [testingPrinter, setTestingPrinter] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [lastSeenText, setLastSeenText] = useState<string>('');

  const checkPrinterStatus = async () => {
    if (!barId) {
      setStatus({
        connected: false,
        status: 'error',
        message: 'Bar ID is required',
      });
      return;
    }

    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/printer/driver-status?barId=${barId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: PrinterStatus = await response.json();
      setStatus(data);
      setLastChecked(new Date());
      
      // Update last seen text
      if (data.driver?.lastSeenMinutes !== undefined) {
        updateLastSeenText(data.driver.lastSeenMinutes);
      }
    } catch (error) {
      console.error('Error checking printer status:', error);
      setStatus({
        connected: false,
        status: 'error',
        message: 'Failed to check printer service',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const updateLastSeenText = (minutes: number) => {
    if (minutes < 1) {
      setLastSeenText('just now');
    } else if (minutes === 1) {
      setLastSeenText('1 minute ago');
    } else if (minutes < 60) {
      setLastSeenText(`${minutes} minutes ago`);
    } else {
      const hours = Math.floor(minutes / 60);
      setLastSeenText(hours === 1 ? '1 hour ago' : `${hours} hours ago`);
    }
  };

  const testPrinter = async () => {
    if (!barId) {
      alert('Bar ID is required to test printer');
      return;
    }

    setTestingPrinter(true);
    try {
      const response = await fetch('/api/printer/driver-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barId }),
      });

      const data = await response.json();
      
      if (data.success) {
        alert('✅ Test print sent successfully! Check your printer.');
      } else {
        const errorMsg = data.error || 'Unknown error';
        
        // Check if it's a connection error (printer service not running)
        if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('fetch failed')) {
          alert(
            '❌ Cannot connect to printer service.\n\n' +
            'The Tabeza Printer Service is not running.\n\n' +
            'Please:\n' +
            '1. Download and install the printer service, OR\n' +
            '2. Start it manually from packages/printer-service\n\n' +
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
        'Make sure the Tabeza Printer Service is running on localhost:8765'
      );
    } finally {
      setTestingPrinter(false);
    }
  };

  // Initial check and setup realtime subscription
  useEffect(() => {
    if (!barId) return;

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

    // Cleanup subscription on unmount
    return () => {
      channel.unsubscribe();
    };
  }, [barId]);

  // Auto-refresh polling (backup to realtime)
  useEffect(() => {
    if (!autoRefresh || !barId) return;

    const interval = setInterval(checkPrinterStatus, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, barId]);

  // Update "last seen" text every minute
  useEffect(() => {
    if (!status.driver?.lastSeenMinutes) return;

    const interval = setInterval(() => {
      if (status.driver?.lastSeenMinutes !== undefined) {
        updateLastSeenText(status.driver.lastSeenMinutes + 1);
      }
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [status.driver?.lastSeenMinutes]);

  const getStatusColor = () => {
    switch (status.status) {
      case 'online':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'offline':
      case 'not_configured':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'error':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'checking':
        return 'text-gray-600 bg-gray-50 border-gray-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = () => {
    switch (status.status) {
      case 'online':
        return <CheckCircle className="w-5 h-5" />;
      case 'offline':
      case 'not_configured':
        return <XCircle className="w-5 h-5" />;
      case 'error':
        return <AlertCircle className="w-5 h-5" />;
      case 'checking':
        return <RefreshCw className="w-5 h-5 animate-spin" />;
      default:
        return <Printer className="w-5 h-5" />;
    }
  };

  const getStatusText = () => {
    switch (status.status) {
      case 'online':
        return 'Connected';
      case 'offline':
        return 'Disconnected';
      case 'not_configured':
        return 'Not Configured';
      case 'error':
        return 'Error';
      case 'checking':
        return 'Checking...';
      default:
        return 'Unknown';
    }
  };

  // Compact view for header/navbar
  if (compact) {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${getStatusColor()}`}>
        <Printer className="w-4 h-4" />
        {getStatusIcon()}
        <span className="text-sm font-medium">{getStatusText()}</span>
      </div>
    );
  }

  // Full detailed view
  return (
    <div className={`rounded-lg border p-4 ${getStatusColor()}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-white bg-opacity-50">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <h3 className="font-semibold text-lg">
                Printer Service: {getStatusText()}
              </h3>
            </div>
            <p className="text-sm mt-1 opacity-90">
              {status.message}
            </p>
            
            {showDetails && status.status === 'online' && status.driver && (
              <div className="mt-2 space-y-1 text-xs opacity-75">
                <div>Driver ID: {status.driver.id.substring(0, 8)}...</div>
                <div>Version: {status.driver.version}</div>
                <div>Last seen: {lastSeenText}</div>
                {lastChecked && (
                  <div>Status checked: {lastChecked.toLocaleTimeString()}</div>
                )}
              </div>
            )}

            {(status.status === 'not_configured' || status.status === 'offline') && (
              <div className="mt-3">
                <a
                  href="https://github.com/billoapp/TabezaConnect/releases/latest/download/TabezaConnect-Setup-v1.0.0.zip"
                  download
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-lg hover:bg-opacity-90 transition text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  Download Printer Service
                </a>
                <p className="text-xs mt-2 opacity-75">
                  Install on the computer connected to your POS printer
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={checkPrinterStatus}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-white bg-opacity-50 hover:bg-opacity-75 transition disabled:opacity-50"
            title="Refresh status"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {status.status === 'online' && barId && (
            <button
              onClick={testPrinter}
              disabled={testingPrinter}
              className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg hover:bg-opacity-90 transition text-sm font-medium disabled:opacity-50"
              title="Send test print"
            >
              <Zap className="w-4 h-4" />
              {testingPrinter ? 'Testing...' : 'Test Print'}
            </button>
          )}
        </div>
      </div>

      {status.error && showDetails && (
        <div className="mt-3 p-2 bg-white bg-opacity-50 rounded text-xs font-mono">
          Error: {status.error}
        </div>
      )}
    </div>
  );
}
