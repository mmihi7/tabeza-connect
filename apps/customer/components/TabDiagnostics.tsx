/**
 * Tab Diagnostics Component
 * Helps customers diagnose and fix "Tab not found" issues
 */

'use client';

import React, { useState } from 'react';
import { AlertCircle, CheckCircle, RefreshCw, Wrench } from 'lucide-react';

interface DiagnosticResult {
  check: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  action?: string;
}

export default function TabDiagnostics() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const runDiagnostics = async () => {
    setIsRunning(true);
    setResults([]);

    const diagnosticResults: DiagnosticResult[] = [];

    // Check 1: Device ID exists
    try {
      const deviceId = localStorage.getItem('Tabeza_device_id') || 
                     localStorage.getItem('tabeza_device_id_v2') || 
                     localStorage.getItem('device_id');
      
      if (deviceId) {
        diagnosticResults.push({
          check: 'Device ID',
          status: 'pass',
          message: `Device ID found: ${deviceId.substring(0, 20)}...`
        });
      } else {
        diagnosticResults.push({
          check: 'Device ID',
          status: 'fail',
          message: 'No device ID found in storage',
          action: 'Scan QR code again to generate new device ID'
        });
      }
    } catch (error) {
      diagnosticResults.push({
        check: 'Device ID',
        status: 'fail',
        message: 'Error accessing device storage',
        action: 'Check browser permissions and try again'
      });
    }

    // Check 2: Current tab data
    try {
      const currentTabData = sessionStorage.getItem('currentTab');
      if (currentTabData) {
        const currentTab = JSON.parse(currentTabData);
        
        if (currentTab.id && currentTab.bar_id && currentTab.tab_number) {
          diagnosticResults.push({
            check: 'Tab Data',
            status: 'pass',
            message: `Tab #${currentTab.tab_number} data found`
          });
        } else {
          diagnosticResults.push({
            check: 'Tab Data',
            status: 'warning',
            message: 'Tab data exists but may be corrupted',
            action: 'Refresh page to repair tab data'
          });
        }
      } else {
        diagnosticResults.push({
          check: 'Tab Data',
          status: 'fail',
          message: 'No tab data found in session',
          action: 'Scan QR code to create new tab'
        });
      }
    } catch (error) {
      diagnosticResults.push({
        check: 'Tab Data',
        status: 'fail',
        message: 'Error parsing tab data',
        action: 'Clear browser data and scan QR code again'
      });
    }

    // Check 3: Bar information
    try {
      const barId = sessionStorage.getItem('Tabeza_current_bar');
      if (barId) {
        diagnosticResults.push({
          check: 'Bar Info',
          status: 'pass',
          message: 'Bar information available'
        });
      } else {
        diagnosticResults.push({
          check: 'Bar Info',
          status: 'warning',
          message: 'No bar information found',
          action: 'Scan QR code to link to bar'
        });
      }
    } catch (error) {
      diagnosticResults.push({
        check: 'Bar Info',
        status: 'fail',
        message: 'Error accessing bar information'
      });
    }

    // Check 4: Test database connection (if possible)
    try {
      const currentTabData = sessionStorage.getItem('currentTab');
      if (currentTabData) {
        const currentTab = JSON.parse(currentTabData);
        
        // Try to verify tab exists in database
        const response = await fetch('/api/tab-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tabId: currentTab.id })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.exists) {
            diagnosticResults.push({
              check: 'Database Connection',
              status: 'pass',
              message: 'Tab found in database'
            });
          } else {
            diagnosticResults.push({
              check: 'Database Connection',
              status: 'fail',
              message: 'Tab not found in database',
              action: 'Scan QR code to create new tab'
            });
          }
        } else {
          diagnosticResults.push({
            check: 'Database Connection',
            status: 'warning',
            message: 'Unable to verify tab status',
            action: 'Check internet connection'
          });
        }
      }
    } catch (error) {
      diagnosticResults.push({
        check: 'Database Connection',
        status: 'warning',
        message: 'Could not test database connection'
      });
    }

    setResults(diagnosticResults);
    setIsRunning(false);
  };

  const clearStorageAndRestart = () => {
    // Clear all storage
    ['Tabeza_device_id', 'tabeza_device_id_v2', 'device_id'].forEach(key => {
      localStorage.removeItem(key);
    });
    
    ['currentTab', 'Tabeza_current_bar', 'orders', 'payments', 'cart'].forEach(key => {
      sessionStorage.removeItem(key);
    });

    // Redirect to home to scan QR again
    window.location.href = '/';
  };

  const getStatusIcon = (status: 'pass' | 'fail' | 'warning') => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'fail':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
  };

  if (!showDiagnostics) {
    return (
      <button
        onClick={() => setShowDiagnostics(true)}
        className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
      >
        <Wrench className="w-4 h-4" />
        Troubleshoot Payment Issues
      </button>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Payment Diagnostics</h3>
        <button
          onClick={() => setShowDiagnostics(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          ×
        </button>
      </div>

      <div className="space-y-4">
        <button
          onClick={runDiagnostics}
          disabled={isRunning}
          className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 flex items-center justify-center gap-2"
        >
          {isRunning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Running Diagnostics...
            </>
          ) : (
            <>
              <Wrench className="w-4 h-4" />
              Run Diagnostics
            </>
          )}
        </button>

        {results.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-gray-700">Diagnostic Results:</h4>
            
            {results.map((result, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-white rounded border">
                {getStatusIcon(result.status)}
                <div className="flex-1">
                  <div className="font-medium text-gray-800">{result.check}</div>
                  <div className="text-sm text-gray-600">{result.message}</div>
                  {result.action && (
                    <div className="text-sm text-blue-600 mt-1">
                      Action: {result.action}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Show repair options if there are failures */}
            {results.some(r => r.status === 'fail') && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <h5 className="font-medium text-yellow-800 mb-2">Quick Fixes:</h5>
                <div className="space-y-2">
                  <button
                    onClick={() => window.location.reload()}
                    className="block w-full text-left text-sm text-yellow-700 hover:text-yellow-900 underline"
                  >
                    1. Refresh this page
                  </button>
                  <button
                    onClick={clearStorageAndRestart}
                    className="block w-full text-left text-sm text-yellow-700 hover:text-yellow-900 underline"
                  >
                    2. Clear data and scan QR code again
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}