/**
 * Printer Settings Page
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 * 
 * Complete web-based printer management - no terminal required
 */

'use client';

import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  Download, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Wrench,
  Activity,
  FileText,
  Zap,
  Folder,
  FolderOpen,
  Copy,
  BookOpen,
  ChevronRight,
  Monitor,
  Settings as SettingsIcon
} from 'lucide-react';
import PrinterDriversList from '@/components/printer/PrinterDriversList';
import { useAuth } from '@/lib/useAuth';

interface ServiceStatus {
  status: 'running' | 'stopped' | 'unknown';
  version?: string;
  configured: boolean;
  barId?: string;
  driverId?: string;
  ssl?: {
    issuesDetected: number;
    lastError: any;
    fixApplied: boolean;
    nodeOptions: string;
  };
}

interface DiagnosticsResult {
  timestamp: string;
  service: {
    configured: boolean;
    barId: string;
    driverId: string;
  };
  ssl: {
    nodeOptions: string;
    issuesDetected: number;
    tests: any[];
  };
  connectivity: {
    tests: Array<{
      name: string;
      url: string;
      status: 'passed' | 'failed';
      error?: string;
      solution?: string;
    }>;
  };
  solutions: Array<{
    priority: string;
    action: string;
    command: string;
  }>;
}

export default function PrinterSettingsPage() {
  const { user, bar } = useAuth();
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'diagnostics' | 'drivers' | 'setup-guide'>('overview');
  const [watchFolder, setWatchFolder] = useState('C:\\ProgramData\\Tabeza\\TabezaPrints');
  const [copiedFolder, setCopiedFolder] = useState(false);

  const checkServiceStatus = async () => {
    try {
      const response = await fetch('http://localhost:8765/api/status');
      if (response.ok) {
        const data = await response.json();
        setServiceStatus({
          status: 'running',
          version: data.version,
          configured: data.configured,
          barId: data.barId,
          driverId: data.driverId,
          ssl: data.ssl,
        });
        // Update watch folder from service
        if (data.watchFolder) {
          setWatchFolder(data.watchFolder);
        }
      } else {
        setServiceStatus({ status: 'stopped', configured: false });
      }
    } catch (error) {
      setServiceStatus({ status: 'stopped', configured: false });
    } finally {
      setLoading(false);
    }
  };

  const runDiagnostics = async () => {
    setTesting(true);
    try {
      const response = await fetch('http://localhost:8765/api/diagnostics');
      if (response.ok) {
        const data = await response.json();
        setDiagnostics(data);
      }
    } catch (error) {
      console.error('Diagnostics failed:', error);
    } finally {
      setTesting(false);
    }
  };

  const sendTestPrint = async () => {
    setTesting(true);
    try {
      const response = await fetch('http://localhost:8765/api/test-print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testMessage: `Test from ${bar?.name || 'Tabeza'} at ${new Date().toLocaleString()}`,
        }),
      });

      if (response.ok) {
        alert('✅ Test print sent successfully! Check your receipts.');
      } else {
        const error = await response.json();
        alert(`❌ Test print failed: ${error.error}`);
      }
    } catch (error) {
      alert('❌ Could not connect to printer service.');
    } finally {
      setTesting(false);
    }
  };

  const openTroubleshooter = () => {
    window.open('http://localhost:8765/troubleshoot', '_blank');
  };

  const copyFolderPath = () => {
    navigator.clipboard.writeText(watchFolder);
    setCopiedFolder(true);
    setTimeout(() => setCopiedFolder(false), 2000);
  };

  const openWatchFolder = () => {
    // This will attempt to open the folder in Windows Explorer
    // Note: This requires the service to have an endpoint that triggers folder opening
    fetch('http://localhost:8765/api/open-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: watchFolder }),
    }).catch(() => {
      alert('Could not open folder. Please navigate to:\n' + watchFolder);
    });
  };

  useEffect(() => {
    checkServiceStatus();
    const interval = setInterval(checkServiceStatus, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const isServiceRunning = serviceStatus?.status === 'running';
  const isConfigured = serviceStatus?.configured;
  const hasSSLIssues = (serviceStatus?.ssl?.issuesDetected || 0) > 0;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Printer Management</h1>
          <p className="text-gray-600 mt-1">Manage your Tabeza printer service and drivers</p>
        </div>
        <button
          onClick={checkServiceStatus}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Service Status Card */}
      <div className={`p-6 rounded-xl border-2 ${
        isServiceRunning 
          ? isConfigured 
            ? 'bg-green-50 border-green-200' 
            : 'bg-yellow-50 border-yellow-200'
          : 'bg-red-50 border-red-200'
      }`}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-lg ${
              isServiceRunning 
                ? isConfigured ? 'bg-green-100' : 'bg-yellow-100'
                : 'bg-red-100'
            }`}>
              <Printer className={`w-8 h-8 ${
                isServiceRunning 
                  ? isConfigured ? 'text-green-600' : 'text-yellow-600'
                  : 'text-red-600'
              }`} />
            </div>
            
            <div>
              <div className="flex items-center gap-2">
                {isServiceRunning ? (
                  isConfigured ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <h2 className="text-xl font-semibold text-green-900">Service Running & Configured</h2>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-yellow-600" />
                      <h2 className="text-xl font-semibold text-yellow-900">Service Running - Needs Configuration</h2>
                    </>
                  )
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-red-600" />
                    <h2 className="text-xl font-semibold text-red-900">Service Not Running</h2>
                  </>
                )}
              </div>
              
              {isServiceRunning && (
                <div className="mt-2 space-y-1 text-sm">
                  <p className="text-gray-700">Version: {serviceStatus.version}</p>
                  {serviceStatus.driverId && (
                    <p className="text-gray-700">Driver ID: {serviceStatus.driverId}</p>
                  )}
                  {serviceStatus.barId && (
                    <p className="text-gray-700">Bar ID: {serviceStatus.barId}</p>
                  )}
                  {hasSSLIssues && (
                    <p className="text-yellow-700 font-medium">
                      ⚠️ {serviceStatus.ssl?.issuesDetected} SSL issue(s) detected (auto-fixing)
                    </p>
                  )}
                </div>
              )}
              
              {!isServiceRunning && (
                <div className="mt-2 space-y-2">
                  <p className="text-red-700">
                    The Tabeza printer service is not running on this computer.
                  </p>
                  <div className="flex items-center gap-2">
                    <a
                      href="https://github.com/billoapp/TabezaConnect/releases/download/v1.2.0/TabezaConnect-Setup-v1.1.0.exe"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                    >
                      <Download className="w-4 h-4" />
                      Download Printer Service
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      {isServiceRunning && (
        <>
          <div className="border-b border-gray-200">
            <nav className="flex gap-4">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2 border-b-2 transition ${
                  activeTab === 'overview'
                    ? 'border-blue-500 text-blue-600 font-medium'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Overview
                </div>
              </button>
              <button
                onClick={() => setActiveTab('diagnostics')}
                className={`px-4 py-2 border-b-2 transition ${
                  activeTab === 'diagnostics'
                    ? 'border-blue-500 text-blue-600 font-medium'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4" />
                  Diagnostics
                </div>
              </button>
              <button
                onClick={() => setActiveTab('drivers')}
                className={`px-4 py-2 border-b-2 transition ${
                  activeTab === 'drivers'
                    ? 'border-blue-500 text-blue-600 font-medium'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Printer className="w-4 h-4" />
                  Drivers
                </div>
              </button>
              <button
                onClick={() => setActiveTab('setup-guide')}
                className={`px-4 py-2 border-b-2 transition ${
                  activeTab === 'setup-guide'
                    ? 'border-blue-500 text-blue-600 font-medium'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Setup Guide
                </div>
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="mt-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={sendTestPrint}
                    disabled={!isConfigured || testing}
                    className="p-6 bg-white border-2 border-gray-200 hover:border-blue-300 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FileText className="w-8 h-8 text-blue-600 mb-3" />
                    <h3 className="font-semibold text-lg mb-1">Send Test Print</h3>
                    <p className="text-sm text-gray-600">Test your printer connection</p>
                  </button>

                  <button
                    onClick={runDiagnostics}
                    disabled={testing}
                    className="p-6 bg-white border-2 border-gray-200 hover:border-blue-300 rounded-xl transition disabled:opacity-50"
                  >
                    <Wrench className="w-8 h-8 text-purple-600 mb-3" />
                    <h3 className="font-semibold text-lg mb-1">Run Diagnostics</h3>
                    <p className="text-sm text-gray-600">Check for issues</p>
                  </button>

                  <button
                    onClick={openTroubleshooter}
                    className="p-6 bg-white border-2 border-gray-200 hover:border-blue-300 rounded-xl transition"
                  >
                    <ExternalLink className="w-8 h-8 text-orange-600 mb-3" />
                    <h3 className="font-semibold text-lg mb-1">Troubleshooter</h3>
                    <p className="text-sm text-gray-600">Open advanced tools</p>
                  </button>
                </div>

                {/* Watch Folder Info */}
                <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Folder className="w-5 h-5 text-blue-600" />
                      Watch Folder
                    </h3>
                    <button
                      onClick={copyFolderPath}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition text-sm"
                    >
                      {copiedFolder ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy Path
                        </>
                      )}
                    </button>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
                    <code className="text-sm font-mono text-gray-800">{watchFolder}</code>
                  </div>

                  <p className="text-sm text-gray-600 mb-4">
                    This is where your POS system should save receipt files. The Tabeza service monitors this folder and automatically processes any new files.
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={openWatchFolder}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm"
                    >
                      <FolderOpen className="w-4 h-4" />
                      Open Folder
                    </button>
                    <button
                      onClick={() => setActiveTab('setup-guide')}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition text-sm"
                    >
                      <BookOpen className="w-4 h-4" />
                      View Setup Guide
                    </button>
                  </div>
                </div>

                {/* Setup Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    POS Setup Instructions
                  </h3>
                  <ol className="space-y-3 text-sm text-gray-700">
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                      <span>In your POS system, add a new printer</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                      <span>Choose "Generic / Text Only" printer driver</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                      <span>Set printer port to: <code className="bg-white px-2 py-1 rounded">FILE</code></span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
                      <span>Set output folder to: <code className="bg-white px-2 py-1 rounded">C:\ProgramData\Tabeza\TabezaPrints</code></span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">5</span>
                      <span>Test print from your POS - it should appear in Tabeza!</span>
                    </li>
                  </ol>
                </div>
              </div>
            )}

            {activeTab === 'diagnostics' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">System Diagnostics</h2>
                  <button
                    onClick={runDiagnostics}
                    disabled={testing}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
                  >
                    {testing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Wrench className="w-4 h-4" />
                        Run Diagnostics
                      </>
                    )}
                  </button>
                </div>

                {diagnostics ? (
                  <div className="space-y-4">
                    {/* SSL Status */}
                    <div className={`p-4 rounded-lg border ${
                      diagnostics.ssl.nodeOptions.includes('use-openssl-ca')
                        ? 'bg-green-50 border-green-200'
                        : 'bg-yellow-50 border-yellow-200'
                    }`}>
                      <h3 className="font-semibold mb-2">SSL Configuration</h3>
                      <p className="text-sm">
                        Mode: {diagnostics.ssl.nodeOptions.includes('use-openssl-ca') 
                          ? '✅ OpenSSL (recommended)' 
                          : '⚠️ Windows Schannel'}
                      </p>
                      <p className="text-sm">Issues detected: {diagnostics.ssl.issuesDetected}</p>
                    </div>

                    {/* Connectivity Tests */}
                    <div className="bg-white border rounded-lg p-4">
                      <h3 className="font-semibold mb-3">Connectivity Tests</h3>
                      <div className="space-y-2">
                        {diagnostics.connectivity.tests.map((test, idx) => (
                          <div key={idx} className={`p-3 rounded border ${
                            test.status === 'passed' 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-red-50 border-red-200'
                          }`}>
                            <div className="flex items-center gap-2">
                              {test.status === 'passed' ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-600" />
                              )}
                              <span className="font-medium">{test.name}</span>
                            </div>
                            {test.error && (
                              <p className="text-sm text-red-600 mt-1">{test.error}</p>
                            )}
                            {test.solution && (
                              <p className="text-sm text-blue-600 mt-1">💡 {test.solution}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Solutions */}
                    {diagnostics.solutions.length > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h3 className="font-semibold mb-3">Recommended Actions</h3>
                        <div className="space-y-3">
                          {diagnostics.solutions.map((solution, idx) => (
                            <div key={idx} className="bg-white p-3 rounded border border-blue-200">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                  {solution.priority.toUpperCase()}
                                </span>
                                <span className="font-medium">{solution.action}</span>
                              </div>
                              <code className="text-sm bg-gray-100 px-2 py-1 rounded block mt-2">
                                {solution.command}
                              </code>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Wrench className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>Click "Run Diagnostics" to check your system</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'drivers' && bar?.id && (
              <PrinterDriversList barId={bar.id} showInactive={false} autoRefresh={true} />
            )}

            {activeTab === 'setup-guide' && (
              <div className="space-y-8">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Complete POS Integration Guide</h2>
                  <p className="text-gray-700">
                    Follow these step-by-step instructions to connect your POS system to Tabeza. 
                    This guide works with most POS systems that support "Print to File" functionality.
                  </p>
                </div>

                {/* Method 1: Generic POS Setup */}
                <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Monitor className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Method 1: Generic POS System</h3>
                      <p className="text-sm text-gray-600">Works with most POS systems</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Step 1 */}
                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                          1
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg mb-2">Open POS Printer Settings</h4>
                        <p className="text-gray-700 mb-3">
                          Navigate to your POS system's printer configuration. This is usually found in:
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                          <li>Settings → Printers</li>
                          <li>Configuration → Hardware → Printers</li>
                          <li>System → Devices → Printers</li>
                        </ul>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                          2
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg mb-2">Add New Printer</h4>
                        <p className="text-gray-700 mb-3">
                          Click "Add Printer" or "New Printer" and configure:
                        </p>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
                          <div className="flex justify-between">
                            <span className="font-medium">Printer Name:</span>
                            <span className="text-gray-700">Tabeza Receipt Printer</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium">Printer Type:</span>
                            <span className="text-gray-700">Generic / Text Only</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium">Driver:</span>
                            <span className="text-gray-700">Generic Text Driver</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                          3
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg mb-2">Configure Printer Port</h4>
                        <p className="text-gray-700 mb-3">
                          Set the printer port to <strong>FILE</strong> (Print to File):
                        </p>
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          <p className="text-sm text-yellow-800 mb-2">
                            <strong>Important:</strong> The port must be set to "FILE" - not USB, COM, or LPT
                          </p>
                          <div className="bg-white p-3 rounded border border-yellow-300">
                            <code className="text-sm">Port: FILE</code>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Step 4 */}
                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                          4
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg mb-2">Set Output Folder</h4>
                        <p className="text-gray-700 mb-3">
                          Configure where receipt files should be saved:
                        </p>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">Output Folder:</span>
                            <button
                              onClick={copyFolderPath}
                              className="flex items-center gap-1 px-2 py-1 bg-blue-100 hover:bg-blue-200 rounded text-sm"
                            >
                              <Copy className="w-3 h-3" />
                              {copiedFolder ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                          <div className="bg-white p-3 rounded border border-blue-300">
                            <code className="text-sm font-mono break-all">{watchFolder}</code>
                          </div>
                          <p className="text-xs text-blue-700 mt-2">
                            💡 Tip: Copy this path and paste it into your POS printer settings
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Step 5 */}
                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                          5
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg mb-2">Test the Connection</h4>
                        <p className="text-gray-700 mb-3">
                          Print a test receipt from your POS system:
                        </p>
                        <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
                          <li>Create a test order in your POS</li>
                          <li>Print the receipt to "Tabeza Receipt Printer"</li>
                          <li>Check the Tabeza dashboard - the receipt should appear within seconds</li>
                          <li>Verify the receipt details are correct</li>
                        </ol>
                        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-sm text-green-800">
                            ✅ <strong>Success!</strong> If you see the receipt in Tabeza, your POS is connected!
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Method 2: Windows Print to PDF */}
                <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <SettingsIcon className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Method 2: Windows "Print to File"</h3>
                      <p className="text-sm text-gray-600">Alternative method using Windows built-in features</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-gray-700">
                      If your POS doesn't support custom printer ports, you can use Windows' built-in "Print to File" feature:
                    </p>

                    <ol className="space-y-3">
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                        <span className="text-gray-700">In your POS, select "Microsoft Print to PDF" as the printer</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                        <span className="text-gray-700">When printing, save the file to: <code className="bg-gray-100 px-2 py-1 rounded">{watchFolder}</code></span>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                        <span className="text-gray-700">Tabeza will automatically process the file</span>
                      </li>
                    </ol>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                      <p className="text-sm text-yellow-800">
                        <strong>Note:</strong> This method requires manual file saving for each receipt. 
                        Method 1 (Generic POS) is recommended for automatic processing.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Troubleshooting */}
                <div className="bg-white border-2 border-orange-200 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-orange-100 rounded-lg">
                      <AlertCircle className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Troubleshooting</h3>
                      <p className="text-sm text-gray-600">Common issues and solutions</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="border-l-4 border-orange-400 pl-4">
                      <h4 className="font-semibold mb-1">Receipts not appearing in Tabeza?</h4>
                      <ul className="text-sm text-gray-700 space-y-1 ml-4 list-disc">
                        <li>Verify the Tabeza service is running (check status above)</li>
                        <li>Confirm the watch folder path is correct</li>
                        <li>Check that files are being created in the watch folder</li>
                        <li>Run diagnostics to check for connection issues</li>
                      </ul>
                    </div>

                    <div className="border-l-4 border-orange-400 pl-4">
                      <h4 className="font-semibold mb-1">POS can't find the printer?</h4>
                      <ul className="text-sm text-gray-700 space-y-1 ml-4 list-disc">
                        <li>Make sure you selected "Generic / Text Only" driver</li>
                        <li>Try restarting your POS system</li>
                        <li>Check Windows printer settings (Control Panel → Devices and Printers)</li>
                      </ul>
                    </div>

                    <div className="border-l-4 border-orange-400 pl-4">
                      <h4 className="font-semibold mb-1">Files created but not processed?</h4>
                      <ul className="text-sm text-gray-700 space-y-1 ml-4 list-disc">
                        <li>Check the "processed" and "errors" subfolders in the watch folder</li>
                        <li>Verify the service has permission to access the folder</li>
                        <li>Look for error messages in the diagnostics tab</li>
                      </ul>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => setActiveTab('diagnostics')}
                      className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition"
                    >
                      <Wrench className="w-4 h-4" />
                      Run Diagnostics
                    </button>
                    <button
                      onClick={openTroubleshooter}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Advanced Troubleshooter
                    </button>
                  </div>
                </div>

                {/* Quick Reference Card */}
                <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-xl p-6">
                  <h3 className="text-xl font-bold mb-4">Quick Reference</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-blue-100 mb-1">Watch Folder:</p>
                      <code className="text-sm bg-white/20 px-2 py-1 rounded block break-all">{watchFolder}</code>
                    </div>
                    <div>
                      <p className="text-sm text-blue-100 mb-1">Printer Name:</p>
                      <code className="text-sm bg-white/20 px-2 py-1 rounded block">Tabeza Receipt Printer</code>
                    </div>
                    <div>
                      <p className="text-sm text-blue-100 mb-1">Printer Type:</p>
                      <code className="text-sm bg-white/20 px-2 py-1 rounded block">Generic / Text Only</code>
                    </div>
                    <div>
                      <p className="text-sm text-blue-100 mb-1">Port:</p>
                      <code className="text-sm bg-white/20 px-2 py-1 rounded block">FILE</code>
                    </div>
                  </div>
                  <button
                    onClick={copyFolderPath}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-white text-blue-600 hover:bg-blue-50 rounded-lg transition font-medium"
                  >
                    {copiedFolder ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Folder Path Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy Watch Folder Path
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
