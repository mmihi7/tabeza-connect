'use client';

import React, { useState, useEffect } from 'react';
import { Printer, CheckCircle, XCircle, AlertCircle, RefreshCw, Download, Zap } from 'lucide-react';

type PrinterStatus = {
  installed: boolean;
  status: 'running' | 'error' | 'not_found' | 'checking';
  version?: string;
  printerName?: string;
  lastSeen?: string;
  message?: string;
  downloadUrl?: string;
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
  refreshInterval = 10000, // 10 seconds
  showDetails = true,
  compact = false,
}: PrinterStatusIndicatorProps) {
  const [status, setStatus] = useState<PrinterStatus>({
    installed: false,
    status: 'checking',
    message: 'Checking printer service...',
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [testingPrinter, setTestingPrinter] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkPrinterStatus = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/printer/driver-status', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      setStatus(data);
      setLastChecked(new Date());
    } catch (error) {
      console.error('Error checking printer status:', error);
      setStatus({
        installed: false,
        status: 'error',
        message: 'Failed to check printer service',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsRefreshing(false);
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

  useEffect(() => {
    checkPrinterStatus();

    if (autoRefresh) {
      const interval = setInterval(checkPrinterStatus, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  const getStatusColor = () => {
    switch (status.status) {
      case 'running':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'error':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'not_found':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'checking':
        return 'text-gray-600 bg-gray-50 border-gray-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = () => {
    switch (status.status) {
      case 'running':
        return <CheckCircle className="w-5 h-5" />;
      case 'error':
        return <AlertCircle className="w-5 h-5" />;
      case 'not_found':
        return <XCircle className="w-5 h-5" />;
      case 'checking':
        return <RefreshCw className="w-5 h-5 animate-spin" />;
      default:
        return <Printer className="w-5 h-5" />;
    }
  };

  const getStatusText = () => {
    switch (status.status) {
      case 'running':
        return 'Connected';
      case 'error':
        return 'Error';
      case 'not_found':
        return 'Disconnected';
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
              {status.message || 'No status message'}
            </p>
            
            {showDetails && status.status === 'running' && (
              <div className="mt-2 space-y-1 text-xs opacity-75">
                {status.printerName && (
                  <div>Printer: {status.printerName}</div>
                )}
                {status.version && (
                  <div>Version: {status.version}</div>
                )}
                {lastChecked && (
                  <div>Last checked: {lastChecked.toLocaleTimeString()}</div>
                )}
              </div>
            )}

            {status.status === 'not_found' && (
              <div className="mt-3">
                <a
                  href="https://github.com/billoapp/tabeza-printer-service/releases/latest/download/tabeza-printer-service.exe"
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

          {status.status === 'running' && barId && (
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
