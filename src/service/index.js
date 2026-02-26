#!/usr/bin/env node
/**
 * Tabeza Printer Service (TabezaConnect Capture Service)
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 * 
 * This service operates in one of two capture modes controlled by CAPTURE_MODE:
 * 
 * MODE 'spooler':   (active capture) – Pauses printer, copies .SPL/.SHD files, resumes printer.
 *                    Introduces ~200‑500ms latency, but guarantees capture even if spool files are deleted quickly.
 * 
 * MODE 'bridge':    (legacy) – Silent Bridge for parallel + physical printing (via folder port)
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// Add Windows registry reading
const winreg = require('winreg');

// Import active pause‑copy capture (replaces passive spool monitor)
const WindowsSpoolCapture = require('./windowsSpoolCapture');
const SimpleCapture = require('./simpleCapture');
const LocalQueue = require('./localQueue');
const UploadWorker = require('./uploadWorker');
const PrintBridge = require('./final-bridge');

const app = express();
const PORT = 8765;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================================
// SSL Auto-Fix System
// ============================================================================

// Track SSL issues for diagnostics
let sslIssuesDetected = 0;
let lastSSLError = null;
let sslFixApplied = false;

// Wrap global fetch with automatic SSL error detection and retry
const originalFetch = global.fetch;
global.fetch = async function(url, options = {}) {
  try {
    // First attempt with default settings
    return await originalFetch(url, options);
  } catch (error) {
    // Check for Windows SSL revocation error
    if (error.cause?.code === 'CRYPT_E_NO_REVOCATION_CHECK' || 
        error.message?.includes('CRYPT_E_NO_REVOCATION_CHECK')) {
      
      sslIssuesDetected++;
      lastSSLError = {
        timestamp: new Date().toISOString(),
        url,
        error: error.message,
      };
      
      console.log('⚠️  SSL revocation check failed, retrying with OpenSSL...');
      
      // Create a custom HTTPS agent with OpenSSL-compatible settings
      const agent = new https.Agent({
        rejectUnauthorized: true, // Keep security enabled
        secureOptions: require('constants').SSL_OP_IGNORE_UNEXPECTED_EOF,
      });
      
      // Retry with custom agent
      try {
        return await originalFetch(url, {
          ...options,
          agent,
        });
      } catch (retryError) {
        console.error('❌ Retry with OpenSSL also failed:', retryError.message);
        throw retryError;
      }
    }
    
    // For other errors, just throw
    throw error;
  }
};

// Generate unique driver ID
function generateDriverId() {
  const { hostname } = require('os');
  return `driver-${hostname()}`;
}

// Heartbeat configuration
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const HEARTBEAT_RETRY_ATTEMPTS = 3;
const HEARTBEAT_RETRY_DELAY = 5000; // 5 seconds

// Heartbeat state tracking
let heartbeatInterval = null;
let heartbeatFailures = 0;

// Load configuration - prioritize environment variables, then registry, then config file
function loadConfig() {
  console.log('🔍 Loading configuration...');
  console.log('');
  console.log('DEBUG: Checking environment variables...');
  
  // Check environment variables first (highest priority)
  const envBarId = process.env.TABEZA_BAR_ID;
  const envApiUrl = process.env.TABEZA_API_URL;
  const envWatchFolder = process.env.TABEZA_WATCH_FOLDER;
  const envPrinterName = process.env.TABEZA_PRINTER_NAME;
  const envVercelBypassToken = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || process.env.VERCEL_BYPASS_TOKEN;
  const envCaptureMode = process.env.CAPTURE_MODE || 'pooling'; // 'spooler' or 'bridge'
  
  console.log('  TABEZA_BAR_ID:', envBarId || '(not set)');
  console.log('  TABEZA_API_URL:', envApiUrl || '(not set)');
  console.log('  TABEZA_WATCH_FOLDER:', envWatchFolder || '(not set)');
  console.log('  TABEZA_PRINTER_NAME:', envPrinterName || '(not set)');
  console.log('  CAPTURE_MODE:', envCaptureMode);
  console.log('');
  
  if (envBarId && envApiUrl) {
    console.log('✅ Using configuration from environment variables');
    console.log('   Bar ID:', envBarId);
    console.log('   API URL:', envApiUrl);
    console.log('   Watch Folder:', envWatchFolder || 'C:\\ProgramData\\Tabeza\\TabezaPrints');
    console.log('   Printer Name:', envPrinterName || '(default will be used)');
    console.log('   Capture Mode:', envCaptureMode);
    console.log('');
    return {
      barId: envBarId,
      apiUrl: envApiUrl,
      printerName: envPrinterName || null,
      vercelBypassToken: envVercelBypassToken || '',
      driverId: generateDriverId(),
      watchFolder: envWatchFolder || 'C:\\ProgramData\\Tabeza\\TabezaPrints',
      captureMode: envCaptureMode,
    };
  }
  
  // Try to read from Windows Registry (second priority)
  console.log('🔍 Checking Windows Registry for configuration...');
  let registryBarId = null;
  let registryPrinterName = null;
  let registryCaptureMode = 'pooling'; // default
  try {
    const { execSync } = require('child_process');
    
    // Read Bar ID from registry
    try {
      const regResult = execSync(
        'reg query "HKLM\\SOFTWARE\\Tabeza\\TabezaConnect" /v BarID',
        { encoding: 'utf8', windowsHide: true }
      );
      const match = regResult.match(/BarID\s+REG_SZ\s+(.+)/);
      if (match && match[1]) {
        registryBarId = match[1].trim();
        console.log('  Found BarID in registry:', registryBarId);
      }
    } catch (regError) {
      console.log('  BarID not found in registry');
    }
    
    // Read Printer Name from registry
    try {
      const printerResult = execSync(
        'reg query "HKLM\\SOFTWARE\\Tabeza\\TabezaConnect" /v PrinterName',
        { encoding: 'utf8', windowsHide: true }
      );
      const match = printerResult.match(/PrinterName\s+REG_SZ\s+(.+)/);
      if (match && match[1]) {
        registryPrinterName = match[1].trim();
        console.log('  Found PrinterName in registry:', registryPrinterName);
      }
    } catch (regError) {
      console.log('  PrinterName not found in registry');
    }
    
    // Read CaptureMode from registry
    try {
      const captureResult = execSync(
        'reg query "HKLM\\SOFTWARE\\Tabeza\\TabezaConnect" /v CaptureMode',
        { encoding: 'utf8', windowsHide: true }
      );
      const captureMatch = captureResult.match(/CaptureMode\s+REG_SZ\s+(.+)/);
      if (captureMatch && captureMatch[1]) {
        registryCaptureMode = captureMatch[1].trim();
        console.log('  Found CaptureMode in registry:', registryCaptureMode);
      }
    } catch (captureError) {
      console.log('  CaptureMode not found in registry, using default pooling');
    }
    
    // Read API URL from registry (default if not found)
    const defaultApiUrl = 'https://bkaigyrrzsqbfscyznzw.supabase.co';
    
    if (registryBarId && registryBarId !== 'YOUR_BAR_ID_HERE') {
      console.log('✅ Using configuration from Windows Registry');
      console.log('   Bar ID:', registryBarId);
      console.log('   Printer Name:', registryPrinterName || '(not set)');
      console.log('   API URL:', defaultApiUrl);
      console.log('   Watch Folder: C:\\ProgramData\\Tabeza\\TabezaPrints');
      console.log('   Capture Mode:', registryCaptureMode);
      console.log('');
      return {
        barId: registryBarId,
        apiUrl: defaultApiUrl,
        printerName: registryPrinterName || null,
        vercelBypassToken: '',
        driverId: generateDriverId(),
        watchFolder: 'C:\\ProgramData\\Tabeza\\TabezaPrints',
        captureMode: registryCaptureMode,
      };
    }
  } catch (error) {
    console.log('  Registry read failed:', error.message);
  }
  
  // Try to load from config file as fallback
  console.log('🔍 Checking config.json for configuration...');
  try {
    const configPath = process.pkg 
      ? path.join(path.dirname(process.execPath), 'config.json')
      : path.join(__dirname, '..', '..', 'config.json');
    
    console.log('📂 Looking for config.json at:', configPath);
    
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configData);
      
      // Validate required fields
      if (!config.barId || config.barId === '') {
        console.error('❌ ERROR: config.barId is empty or missing');
        return null;
      }
      
      if (!config.watchFolder) {
        console.error('❌ ERROR: config.watchFolder is missing');
        return null;
      }
      
      // Add driverId if not present
      if (!config.driverId) {
        config.driverId = generateDriverId();
      }
      
      // Add captureMode if not present (default to spooler)
      if (!config.captureMode) {
        config.captureMode = 'pooling';
      }
      
      // Ensure printerName is present (maybe from bridge object or top-level)
      if (!config.printerName && config.bridge && config.bridge.printerName) {
        config.printerName = config.bridge.printerName;
      }
      
      console.log('✅ Loaded configuration from config.json');
      console.log('   Bar ID:', config.barId);
      console.log('   API URL:', config.apiUrl);
      console.log('   Printer Name:', config.printerName || '(not set, will use default)');
      console.log('   Watch Folder:', config.watchFolder);
      console.log('   Capture Mode:', config.captureMode);
      return config;
    } else {
      console.warn('⚠️  config.json not found at:', configPath);
    }
  } catch (error) {
    console.error('❌ Could not load config.json:', error.message);
  }
  
  // No valid config found
  if (!registryBarId) {
    console.error('');
    console.error('╔═══════════════════════════════════════════════════════════╗');
    console.error('║                                                           ║');
    console.error('║   ❌ FATAL ERROR: Cannot start service                    ║');
    console.error('║                                                           ║');
    console.error('║   No valid configuration found!                          ║');
    console.error('║                                                           ║');
    console.error('║   The service requires either:                           ║');
    console.error('║   1. Environment variables (TABEZA_BAR_ID, etc.)         ║');
    console.error('║   2. Valid config.json file                              ║');
    console.error('║                                                           ║');
    console.error('║   Check Windows Service environment variables in:        ║');
    console.error('║   HKLM\\SYSTEM\\CurrentControlSet\\Services\\              ║');
    console.error('║        TabezaConnect\\Environment                         ║');
    console.error('║                                                           ║');
    console.error('╚═══════════════════════════════════════════════════════════╝');
    console.error('');
    process.exit(1);
  }
}

// Load configuration
let config = loadConfig();

// Ensure watch folder exists
if (!fs.existsSync(config.watchFolder)) {
  console.log('📁 Creating watch folder:', config.watchFolder);
  fs.mkdirSync(config.watchFolder, { recursive: true });
}

// File watcher (legacy, used only in bridge mode)
let watcher = null;

// Spool capture instance (active pause‑copy)
let spoolMonitor = null;

// Simple capture instance (pooling mode)
let simpleCapture = null;

// Local queue and upload worker
let localQueue = null;
let uploadWorker = null;

// Print bridge for silent bridge mode
let printBridge = null;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.raw({ type: 'application/octet-stream', limit: '10mb' }));

// Health check endpoint
app.get('/api/status', (req, res) => {
  const spoolStats = spoolMonitor ? spoolMonitor.getStats() : null;
  
  // Get pooling stats if pooling mode is active
  const poolingStats = simpleCapture ? simpleCapture.getStats() : null;
  
  // Get bridge stats if bridge is running
  const bridgeStats = printBridge ? {
    enabled: true,
    printerName: config.bridge?.printerName || config.printerName || 'Not configured',
    captureFolder: config.bridge?.captureFolder || config.watchFolder,
    lastActivity: printBridge.lastActivity || null,
    status: printBridge.isRunning ? 'running' : 'stopped',
    filesProcessed: printBridge.filesProcessed || 0
  } : {
    enabled: false,
    status: 'not configured'
  };
  
  res.json({
    status: 'running',
    version: '1.6.0',
    printerName: config.printerName || config.bridge?.printerName || 'Tabeza POS Connect',
    timestamp: new Date().toISOString(),
    barId: config.barId,
    apiUrl: config.apiUrl,  
    vercelBypassToken: config.vercelBypassToken ? '[configured]' : '[not set]',
    driverId: config.driverId,
    watchFolder: config.watchFolder,
    captureMode: config.captureMode || 'spooler',
    configured: !!config.barId,
    spoolMonitor: spoolStats,
    pooling: poolingStats,
    bridge: bridgeStats,
    ssl: {
      issuesDetected: sslIssuesDetected,
      lastError: lastSSLError,
      fixApplied: sslFixApplied,
      nodeOptions: process.env.NODE_OPTIONS || 'not set',
    },
  });
});

// Diagnostics endpoint for troubleshooting
app.get('/api/diagnostics', async (req, res) => {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    service: {
      version: '1.0.0',
      configured: !!config.barId,
      barId: config.barId || 'not configured',
      driverId: config.driverId,
      watchFolder: config.watchFolder,
      captureMode: config.captureMode || 'spooler',
      printerName: config.printerName || config.bridge?.printerName || 'not set',
    },
    ssl: {
      nodeOptions: process.env.NODE_OPTIONS || 'not set',
      issuesDetected: sslIssuesDetected,
      lastError: lastSSLError,
      fixApplied: sslFixApplied,
      tests: [],
    },
    connectivity: {
      tests: [],
    },
    solutions: [],
  };
  
  // Test connectivity to critical endpoints
  const endpoints = [
    { name: 'Tabeza API', url: config.apiUrl || 'https://tabeza.co.ke' },
  ];
  
  for (const endpoint of endpoints) {
    try {
      const startTime = Date.now();
      const response = await fetch(`${endpoint.url}/api/health`, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      const duration = Date.now() - startTime;
      
      diagnostics.connectivity.tests.push({
        name: endpoint.name,
        url: endpoint.url,
        status: 'passed',
        statusCode: response.status,
        duration: `${duration}ms`,
      });
    } catch (error) {
      const issue = {
        name: endpoint.name,
        url: endpoint.url,
        status: 'failed',
        error: error.message,
        code: error.code || error.cause?.code,
      };
      
      // Provide specific solutions based on error type
      if (error.cause?.code === 'CRYPT_E_NO_REVOCATION_CHECK') {
        issue.solution = 'Windows SSL revocation check issue - OpenSSL mode recommended';
        diagnostics.solutions.push({
          priority: 'high',
          action: 'Apply OpenSSL fix',
          command: 'Run fix-ssl-for-service-direct.bat as Administrator',
        });
      } else if (error.code === 'ENOTFOUND') {
        issue.solution = 'DNS resolution failed - check internet connection';
        diagnostics.solutions.push({
          priority: 'critical',
          action: 'Check internet connection',
          command: 'ping tabeza.co.ke',
        });
      } else if (error.code === 'ECONNREFUSED') {
        issue.solution = 'Connection refused - firewall may be blocking HTTPS';
        diagnostics.solutions.push({
          priority: 'high',
          action: 'Check firewall settings',
          command: 'Allow HTTPS (port 443) in Windows Firewall',
        });
      } else if (error.code === 'ECONNRESET') {
        issue.solution = 'Connection reset - network restrictions or firewall blocking';
        diagnostics.solutions.push({
          priority: 'critical',
          action: 'Check network restrictions',
          command: 'Contact IT department - HTTPS connections are being blocked',
        });
      }
      
      diagnostics.connectivity.tests.push(issue);
    }
  }
  
  // Check if OpenSSL mode is enabled
  if (!process.env.NODE_OPTIONS?.includes('use-openssl-ca')) {
    diagnostics.solutions.push({
      priority: 'medium',
      action: 'Enable OpenSSL mode (prevents SSL revocation issues)',
      command: 'Run fix-ssl-for-service-direct.bat as Administrator',
    });
  }
  
  res.json(diagnostics);
});

// Troubleshooting page
app.get('/troubleshoot', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Tabeza Connect Troubleshooter</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 900px;
      margin: 40px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 {
      color: #2563eb;
      margin-top: 0;
    }
    .status {
      padding: 15px;
      border-radius: 6px;
      margin: 15px 0;
    }
    .status.success {
      background: #d1fae5;
      border-left: 4px solid #10b981;
    }
    .status.warning {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
    }
    .status.error {
      background: #fee2e2;
      border-left: 4px solid #ef4444;
    }
    button {
      background: #2563eb;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 16px;
      margin: 10px 5px 10px 0;
    }
    button:hover {
      background: #1d4ed8;
    }
    .test-result {
      padding: 10px;
      margin: 8px 0;
      border-radius: 4px;
      background: #f9fafb;
    }
    .solution {
      background: #eff6ff;
      padding: 15px;
      border-radius: 6px;
      margin: 10px 0;
      border-left: 4px solid #3b82f6;
    }
    .code {
      background: #1f2937;
      color: #f3f4f6;
      padding: 12px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      margin: 8px 0;
      overflow-x: auto;
    }
    .loading {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 3px solid #f3f3f3;
      border-top: 3px solid #2563eb;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔧 Tabeza Connect Troubleshooter</h1>
    <p>This tool helps diagnose and fix connection issues with your Tabeza printer service.</p>
    
    <button onclick="runDiagnostics()">🔍 Run Diagnostics</button>
    <button onclick="window.location.href='/api/status'">📊 View Status JSON</button>
    
    <div id="results"></div>
  </div>
  
  <script>
    async function runDiagnostics() {
      const resultsDiv = document.getElementById('results');
      resultsDiv.innerHTML = '<div class="loading"></div> Running diagnostics...';
      
      try {
        const res = await fetch('/api/diagnostics');
        const data = await res.json();
        
        let html = '<h2>Diagnostic Results</h2>';
        
        // Service status
        html += '<div class="status ' + (data.service.configured ? 'success' : 'warning') + '">';
        html += '<strong>Service Status:</strong> ';
        html += data.service.configured ? '✅ Configured' : '⚠️ Not configured';
        html += '<br><strong>Bar ID:</strong> ' + data.service.barId;
        html += '<br><strong>Driver ID:</strong> ' + data.service.driverId;
        html += '</div>';
        
        // SSL status
        html += '<div class="status ' + (data.ssl.nodeOptions.includes('use-openssl-ca') ? 'success' : 'warning') + '">';
        html += '<strong>SSL Mode:</strong> ';
        if (data.ssl.nodeOptions.includes('use-openssl-ca')) {
          html += '✅ OpenSSL (recommended)';
        } else {
          html += '⚠️ Windows Schannel (may cause issues)';
        }
        html += '<br><strong>SSL Issues Detected:</strong> ' + data.ssl.issuesDetected;
        html += '</div>';
        
        // Connectivity tests
        html += '<h3>Connectivity Tests</h3>';
        data.connectivity.tests.forEach(test => {
          html += '<div class="test-result">';
          html += test.status === 'passed' 
            ? '✅ <strong>' + test.name + '</strong> - OK (' + test.duration + ')'
            : '❌ <strong>' + test.name + '</strong> - FAILED';
          if (test.error) {
            html += '<br><span style="color: #ef4444;">Error: ' + test.error + '</span>';
          }
          if (test.solution) {
            html += '<br><span style="color: #3b82f6;">💡 ' + test.solution + '</span>';
          }
          html += '</div>';
        });
        
        // Solutions
        if (data.solutions.length > 0) {
          html += '<h3>Recommended Actions</h3>';
          data.solutions.forEach((solution, index) => {
            html += '<div class="solution">';
            html += '<strong>' + (index + 1) + '. ' + solution.action + '</strong>';
            html += '<br>Priority: ' + solution.priority.toUpperCase();
            html += '<div class="code">' + solution.command + '</div>';
            html += '</div>';
          });
        } else {
          html += '<div class="status success">';
          html += '✅ <strong>All systems operational!</strong> No issues detected.';
          html += '</div>';
        }
        
        resultsDiv.innerHTML = html;
      } catch (error) {
        resultsDiv.innerHTML = '<div class="status error">❌ Failed to run diagnostics: ' + error.message + '</div>';
      }
    }
  </script>
</body>
</html>
  `);
});

// Test print endpoint
app.post('/api/test-print', async (req, res) => {
  const { testMessage } = req.body;
  
  if (!config.barId) {
    console.log('❌ Test print failed: Service not configured');
    return res.status(400).json({
      success: false,
      error: 'Service not configured. Please configure the service first.',
      hint: 'Go to Settings and click "Auto-Configure Printer Service"',
    });
  }
  
  if (!config.apiUrl) {
    console.log('❌ Test print failed: API URL not configured');
    return res.status(400).json({
      success: false,
      error: 'API URL not configured. Please configure the service first.',
    });
  }
  
  console.log(`📄 Test print for bar: ${config.barId} to ${config.apiUrl}`);
  
  try {
    // Send test receipt to cloud
    const testReceipt = createTestReceipt(testMessage);
    await sendToCloud(testReceipt);
    
    res.json({
      success: true,
      jobId: `test-${Date.now()}`,
      message: 'Test print sent successfully',
    });
  } catch (error) {
    console.error('Test print failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Configure endpoint
app.post('/api/configure', (req, res) => {
  const { barId, apiUrl, watchFolder, captureMode, printerName } = req.body;
  
  const wasConfigured = !!config.barId;
  
  if (barId) config.barId = barId;
  if (apiUrl) config.apiUrl = apiUrl;
  if (printerName) config.printerName = printerName;
  if (captureMode && ['spooler', 'bridge'].includes(captureMode)) {
    config.captureMode = captureMode;
    console.log(`🔄 Capture mode changed to: ${captureMode}`);
  }
  if (watchFolder) {
    config.watchFolder = watchFolder;
    // Recreate watcher with new folder
    if (watcher) {
      watcher.close();
    }
    startWatcher();
  }
  
  // Save config to file
  saveConfig(config);
  
  if (!wasConfigured && config.barId) {
    console.log('🔄 Bar ID configured - starting heartbeat service...');
    stopHeartbeat();
    startHeartbeat();
  }
  
  res.json({
    success: true,
    config: {
      barId: config.barId,
      apiUrl: config.apiUrl,
      printerName: config.printerName,
      driverId: config.driverId,
      watchFolder: config.watchFolder,
      captureMode: config.captureMode || 'spooler',
    },
  });
});

// Manual print job submission
app.post('/api/print-job', async (req, res) => {
  try {
    const printData = req.body;
    
    console.log(`🖨️ Print job received (${printData.length} bytes)`);
    
    const jobId = await processPrintJob(printData);
    
    res.json({
      success: true,
      jobId,
    });
  } catch (error) {
    console.error('Print job processing failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// List available printers
app.get('/api/printers/list', async (req, res) => {
  try {
    const { execSync } = require('child_process');
    
    const psCommand = `
      Get-Printer | Where-Object { 
        $_.Name -notmatch "Microsoft|OneNote|Fax|PDF|AnyDesk|XPS|Send To|Adobe" 
      } | Select-Object Name, PortName, PrinterStatus, DriverName | ConvertTo-Json
    `;
    
    const result = execSync(`powershell -Command "${psCommand}"`, {
      encoding: 'utf8',
      windowsHide: true
    });
    
    const printers = JSON.parse(result);
    const printerList = Array.isArray(printers) ? printers : [printers];
    
    res.json({
      success: true,
      printers: printerList.map(p => ({
        name: p.Name,
        port: p.PortName,
        status: p.PrinterStatus,
        driver: p.DriverName
      }))
    });
  } catch (error) {
    console.error('Failed to list printers:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update physical printer
app.post('/api/printers/set-physical', async (req, res) => {
  try {
    const { printerName } = req.body;
    
    if (!printerName) {
      return res.status(400).json({
        success: false,
        error: 'printerName is required'
      });
    }
    
    const { execSync } = require('child_process');
    try {
      execSync(`powershell -Command "Get-Printer -Name '${printerName}'"`, {
        windowsHide: true
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: `Printer not found: ${printerName}`
      });
    }
    
    if (!config.bridge) {
      config.bridge = {};
    }
    
    const oldPrinter = config.bridge.printerName;
    config.bridge.printerName = printerName;
    config.printerName = printerName; // also set top-level for pause-copy
    
    saveConfig(config);
    
    console.log(`🔄 Printer changed: ${oldPrinter} → ${printerName}`);
    
    if (printBridge) {
      console.log('🔄 Restarting bridge with new printer...');
      printBridge.restart(printerName);
      console.log('✅ Bridge restarted successfully');
    }
    
    res.json({
      success: true,
      message: `Physical printer updated to: ${printerName}`,
      oldPrinter,
      newPrinter: printerName
    });
  } catch (error) {
    console.error('Failed to update printer:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Send test print (to physical printer via bridge)
app.post('/api/printers/test', async (req, res) => {
  try {
    if (!config.bridge || !config.bridge.enabled) {
      return res.status(400).json({
        success: false,
        error: 'Bridge not enabled'
      });
    }
    
    const now = new Date();
    const testReceipt = `
========================================
       TABEZA TEST PRINT
========================================
Date: ${now.toLocaleString()}
Printer: ${config.bridge.printerName}

This is a test print to verify your
printer configuration is working.

If you can read this, your printer
is configured correctly!

========================================
    Powered by Tabeza
========================================
    `;
    
    const testFile = path.join(
      config.bridge.captureFolder,
      `test_${Date.now()}.prn`
    );
    
    fs.writeFileSync(testFile, testReceipt);
    
    console.log('📄 Test print sent to bridge');
    console.log(`   File: ${testFile}`);
    
    res.json({
      success: true,
      message: 'Test print sent successfully',
      file: path.basename(testFile)
    });
  } catch (error) {
    console.error('Test print failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Send print job to physical printer (via folder)
app.post('/api/print-to-physical', async (req, res) => {
  try {
    const { rawData, printerName } = req.body;
    
    if (!rawData) {
      return res.status(400).json({
        success: false,
        error: 'rawData is required',
      });
    }
    
    console.log(`🖨️ Sending print job to physical printer...`);
    
    const printBuffer = Buffer.from(rawData, 'base64');
    
    const outputFolder = path.join(config.watchFolder, 'output');
    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true });
    }
    
    const outputFile = path.join(outputFolder, `print-${Date.now()}.prn`);
    fs.writeFileSync(outputFile, printBuffer);
    
    console.log(`✅ Print job saved to: ${outputFile}`);
    console.log(`📋 Configure your POS printer to monitor: ${outputFolder}`);
    
    res.json({
      success: true,
      message: 'Print job sent to physical printer',
      outputFile,
    });
  } catch (error) {
    console.error('Failed to send to physical printer:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Poll cloud for print jobs (for venues behind firewall/NAT)
let pollInterval = null;

function startCloudPolling() {
  if (!config.barId) {
    console.log('⚠️  Skipping cloud polling - Bar ID not configured');
    return;
  }
  
  console.log('🔄 Starting cloud polling for print jobs...');
  
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (config.vercelBypassToken) {
    headers['x-vercel-protection-bypass'] = config.vercelBypassToken;
  }
  
  pollInterval = setInterval(async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/printer/pending-prints?barId=${config.barId}&driverId=${config.driverId}`, { headers });
      
      if (!response.ok) {
        return;
      }
      
      const { prints } = await response.json();
      
      if (prints && prints.length > 0) {
        console.log(`📥 Received ${prints.length} print job(s) from cloud`);
        
        for (const print of prints) {
          try {
            const printBuffer = Buffer.from(print.rawData, 'base64');
            const outputFolder = path.join(config.watchFolder, 'output');
            if (!fs.existsSync(outputFolder)) {
              fs.mkdirSync(outputFolder, { recursive: true });
            }
            
            const outputFile = path.join(outputFolder, `cloud-print-${Date.now()}.prn`);
            fs.writeFileSync(outputFile, printBuffer);
            
            console.log(`✅ Cloud print job saved: ${outputFile}`);
            
            await fetch(`${config.apiUrl}/api/printer/acknowledge-print`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                printId: print.id,
                driverId: config.driverId,
              }),
            });
          } catch (error) {
            console.error('Error processing cloud print:', error);
          }
        }
      }
    } catch (error) {
      // Silently fail
    }
  }, 5000);
}

// Initialize local queue and upload worker
async function initializeQueue() {
  console.log('🗂️  Initializing local queue and upload worker...');
  
  localQueue = new LocalQueue({
    queuePath: 'C:\\ProgramData\\Tabeza\\queue',
  });
  
  await localQueue.initialize();
  
  uploadWorker = new UploadWorker({
    localQueue,
    apiEndpoint: config.apiUrl,
    barId: config.barId,
    deviceId: config.driverId,
  });
  
  await uploadWorker.start();
  
  console.log('✅ Queue and upload worker initialized');
}

/**
 * Start the active pause‑copy spool capture (replaces passive monitor)
 */
function startActiveSpoolerCapture() {
  console.log('🚀 Starting active spool capture (pause‑copy)...');
  
  // Determine printer name to use
  const printerName = config.printerName || config.bridge?.printerName || 'EPSON L3210 Series';
  console.log(`   Printer: ${printerName}`);
  
  // Create a dedicated capture folder inside watchFolder
  const captureFolder = path.join(config.watchFolder, 'spool_captures');
  if (!fs.existsSync(captureFolder)) {
    fs.mkdirSync(captureFolder, { recursive: true });
  }
  console.log(`   Capture folder: ${captureFolder}`);
  
  const capture = new WindowsSpoolCapture({
    printerName: printerName,
    captureFolder: captureFolder,
    spoolPath: 'C:\\Windows\\System32\\spool\\PRINTERS',
  });
  
  capture.on('job-captured', async ({ jobId, files }) => {
    console.log(`📄 Job ${jobId} captured, files: ${files.join(', ')}`);
    
    // Find the .SPL file (contains raw print data)
    const splFile = files.find(f => f.endsWith('.SPL'));
    if (!splFile) {
      console.warn(`⚠️ No .SPL file found for job ${jobId}`);
      return;
    }
    
    try {
      const splPath = path.join(captureFolder, splFile);
      const data = await fs.promises.readFile(splPath);
      
      await localQueue.enqueue({
        barId: config.barId,
        deviceId: config.driverId,
        timestamp: new Date().toISOString(),
        escposBytes: data.toString('base64'),
        text: null, // raw data; cloud will parse
        metadata: {
          source: 'spooler-active',
          jobId,
          fileName: splFile,
          printerName,
        },
      });
      
      console.log(`✅ Job ${jobId} enqueued for upload (${data.length} bytes)`);
    } catch (err) {
      console.error(`❌ Failed to enqueue job ${jobId}:`, err.message);
    }
  });
  
  capture.on('error', (error) => {
    console.error('❌ Active spool capture error:', error.message);
  });
  
  capture.start();
  
  return capture;
}

/**
 * Start the pooling capture mode (SimpleCapture)
 * Monitors a single capture file written by a Windows printer pool
 */
async function startPoolingCapture() {
  console.log('🔄 Starting pooling capture mode...');
  
  // Read captureFile path from config with default
  const captureFile = config.pooling?.captureFile || 
                      path.join(config.watchFolder || 'C:\\TabezaPrints', 'order.prn');
  
  // Read tempFolder path from config with default
  const tempFolder = config.pooling?.tempFolder || 
                     path.join(config.watchFolder || 'C:\\TabezaPrints', 'captures');
  
  console.log(`   Capture file: ${captureFile}`);
  console.log(`   Temp folder: ${tempFolder}`);
  
  // Initialize SimpleCapture with config values
  const capture = new SimpleCapture({
    captureFile: captureFile,
    tempFolder: tempFolder,
    localQueue: localQueue,
    barId: config.barId,
    deviceId: config.driverId,
    stabilityChecks: config.pooling?.stabilityChecks || 3,
    stabilityDelay: config.pooling?.stabilityDelay || 100,
  });
  
  // Register event handler for 'file-captured' event
  capture.on('file-captured', (receiptId) => {
    console.log(`✅ Pooling capture: Receipt ${receiptId} captured and enqueued`);
  });
  
  // Register event handler for 'error' event
  capture.on('error', (error) => {
    console.error('❌ Pooling capture error:', error.message);
  });
  
  // Start the capture service
  await capture.start();
  
  console.log('✅ Pooling capture started successfully');
  
  return capture;
}

// Start monitoring based on capture mode
async function startWatcher() {
  console.log(`👀 Starting capture service...`);
  console.log(`   Mode: ${config.captureMode === 'spooler' ? 'Active Pause‑Copy' : config.captureMode === 'pooling' ? 'Printer Pooling' : 'Silent Bridge'}`);
  console.log('');
  
  if (config.captureMode === 'spooler') {
    await initializeQueue();
    spoolMonitor = startActiveSpoolerCapture();
    
  } else if (config.captureMode === 'pooling') {
    await initializeQueue();
    simpleCapture = await startPoolingCapture();
    
  } else if (config.captureMode === 'bridge') {
    await initializeQueue();
    
    console.log('🌉 Starting Silent Bridge Mode... (FINAL VERSION)');
    console.log('   This enables digital capture + physical receipt printing');
    console.log('   Physical printing requires this service to stay running!');
    console.log('');
    
    printBridge = new PrintBridge();
    printBridge.start();
    
  } else {
    console.error('❌ Invalid capture mode. Please set "captureMode": "pooling", "pooling", or "bridge" in config.json');
    process.exit(1);
  }
}

// Process print job and send to cloud
async function processPrintJob(printData, fileName = 'receipt.prn') {
  const jobId = `job-${Date.now()}`;
  
  if (!config.barId) {
    throw new Error('Service not configured - Bar ID missing');
  }
  
  const base64Data = Buffer.from(printData).toString('base64');
  
  await sendToCloud({
    driverId: config.driverId,
    barId: config.barId,
    timestamp: new Date().toISOString(),
    rawData: base64Data,
    printerName: config.printerName || config.bridge?.printerName || 'Tabeza POS Connect',
    documentName: fileName,
    metadata: {
      jobId,
      source: 'file-watcher',
      fileSize: printData.length,
    },
  });
  
  return jobId;
}

// Send data to Tabeza cloud
async function sendToCloud(payload) {
  const url = `${config.apiUrl}/api/printer/relay`;
  
  console.log(`📤 Sending to cloud: ${url}`);
  
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (config.vercelBypassToken) {
    headers['x-vercel-protection-bypass'] = config.vercelBypassToken;
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloud API error: ${response.status} - ${errorText}`);
  }
  
  return await response.json();
}

// Send heartbeat to cloud
async function sendHeartbeat(attempt = 1) {
  try {
    const payload = {
      barId: config.barId,
      driverId: config.driverId,
      version: '1.0.0',
      status: 'online',
      metadata: {
        hostname: require('os').hostname(),
        platform: process.platform,
        nodeVersion: process.version,
      },
    };
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (config.vercelBypassToken) {
      headers['x-vercel-protection-bypass'] = config.vercelBypassToken;
    }
    
    const productionUrl = config.apiUrl;
    console.log(`💓 Sending heartbeat to production: ${productionUrl}`);
    
    const productionResponse = await fetch(`${productionUrl}/api/printer/heartbeat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    
    if (!productionResponse.ok) {
      throw new Error(`Production heartbeat failed: ${productionResponse.status}`);
    }
    
    const localUrl = 'http://localhost:3003';
    if (productionUrl !== localUrl) {
      console.log(`💓 Also sending heartbeat to local: ${localUrl}`);
      
      try {
        const localResponse = await fetch(`${localUrl}/api/printer/heartbeat`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        
        if (!localResponse.ok) {
          console.warn(`⚠️ Local heartbeat failed: ${localResponse.status}`);
        } else {
          console.log(`✅ Local heartbeat sent successfully`);
        }
      } catch (localError) {
        console.warn(`⚠️ Local heartbeat error: ${localError.message}`);
      }
    }
    
    if (heartbeatFailures > 0) {
      console.log('✅ Heartbeat connection restored');
      heartbeatFailures = 0;
    }
    
  } catch (error) {
    heartbeatFailures++;
    
    console.error(`❌ Heartbeat failed (attempt ${attempt}/${HEARTBEAT_RETRY_ATTEMPTS}):`, error.message);
    
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

// Start heartbeat service
function startHeartbeat() {
  if (!config.barId) {
    console.log('⚠️  Heartbeat disabled - Bar ID not configured');
    return;
  }
  
  console.log('💓 Starting heartbeat service...');
  
  sendHeartbeat();
  
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

// Create test receipt
function createTestReceipt(message) {
  const now = new Date();
  const receiptNumber = `RCP-${now.getTime().toString().slice(-6)}`;
  
  const items = [
    { qty: 2, name: 'Tusker Lager 500ml', price: 250.00 },
    { qty: 1, name: 'Nyama Choma (Half Kg)', price: 800.00 },
    { qty: 3, name: 'Pilsner 500ml', price: 200.00 },
    { qty: 1, name: 'Chips Masala', price: 150.00 },
    { qty: 2, name: 'Soda (Coke)', price: 80.00 },
  ];
  
  const subtotal = items.reduce((sum, item) => sum + (item.qty * item.price), 0);
  const tax = subtotal * 0.16;
  const total = subtotal + tax;
  
  const testData = `
========================================
         TABEZA TEST RECEIPT
========================================
Receipt #: ${receiptNumber}
Date: ${now.toLocaleDateString()}
Time: ${now.toLocaleTimeString()}
${message ? `\nNote: ${message}\n` : ''}
========================================

QTY  ITEM                      AMOUNT
----------------------------------------
${items.map(item => {
  const qtyStr = item.qty.toString().padEnd(4);
  const itemStr = item.name.padEnd(20);
  const amountStr = (item.qty * item.price).toFixed(2).padStart(10);
  return `${qtyStr} ${itemStr} ${amountStr}`;
}).join('\n')}
----------------------------------------

Subtotal:                  ${subtotal.toFixed(2).padStart(10)}
VAT (16%):                 ${tax.toFixed(2).padStart(10)}
========================================
TOTAL:                     ${total.toFixed(2).padStart(10)}
========================================

Payment Method: Cash
Change: 0.00

Thank you for your business!
Visit us again soon.

========================================
        Powered by Tabeza
========================================
  `.trim();
  
  return {
    driverId: config.driverId,
    barId: config.barId,
    timestamp: new Date().toISOString(),
    rawData: Buffer.from(testData).toString('base64'),
    printerName: 'Tabeza POS Connect',
    documentName: `Test Receipt ${receiptNumber}`,
    metadata: {
      jobId: `test-${Date.now()}`,
      source: 'test',
      receiptNumber,
      itemCount: items.length,
      totalAmount: total,
    },
  };
}

// Save config to file
// Save config to file
function saveConfig(cfg) {
  // Use the same path logic as loadConfig()
  const configPath = process.pkg 
    ? path.join(path.dirname(process.execPath), 'config.json')
    : path.join(__dirname, '..', '..', 'config.json');
  
  console.log('💾 Saving configuration to:', configPath);
  
  try {
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
    console.log('✅ Configuration saved successfully');
  } catch (error) {
    console.error('❌ Failed to save configuration:', error.message);
    throw error;
  }
}


// Check if port is available
function checkPort(port) {
  return new Promise((resolve) => {
    const net = require('net');
    const tester = net.createServer()
      .once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          resolve(true);
        }
      })
      .once('listening', () => {
        tester.once('close', () => {
          resolve(true);
        }).close();
      })
      .listen(port);
  });
}

// Start server
async function start() {
  const portAvailable = await checkPort(PORT);
  if (!portAvailable) {
    console.error(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ❌ ERROR: Port ${PORT} is already in use                   ║
║                                                           ║
║   Another instance of Tabeza Connect may be running.     ║
║                                                           ║
║   To fix this:                                           ║
║   1. Run: kill-port-8765.bat                             ║
║   2. Or restart your computer                            ║
║   3. Then start Tabeza Connect again                     ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
    process.exit(1);
  }
  
  config = loadConfig();
  
  try {
    saveConfig(config);
  } catch (error) {
    console.warn('⚠️ Could not save config file:', error.message);
  }
  
  await startWatcher();
  
  startCloudPolling();
  startHeartbeat();
  
  server = app.listen(PORT, async () => {
    console.clear();
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🔗 Tabeza Connect - Running                             ║
║                                                           ║
║   Bridge your POS to the cloud                           ║
║                                                           ║
║   ⚠️  KEEP THIS WINDOW OPEN - Service must stay running  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

📍 Service Status:
   • Port: ${PORT}
   • Driver ID: ${config.driverId.substring(0, 30)}...
   • Bar ID: ${config.barId || '⚠️  NOT CONFIGURED'}
   • API URL: ${config.apiUrl}
   • Printer Name: ${config.printerName || config.bridge?.printerName || '(default)'}
   • Watch Folder: ${config.watchFolder}
   • Capture Mode: ${config.captureMode || 'spooler'} 
   • Config Source: ${process.env.TABEZA_BAR_ID ? 'Environment Variables' : 'Config File'}

${config.barId ? `
✅ Configuration Complete!

Your printer service is monitoring for print jobs.

📋 POS Setup Instructions:
   • Your POS prints normally; we briefly pause the printer to capture receipts.
   • No special POS configuration needed – just print to your usual thermal printer.

🔗 Quick Links:
   • Service Status: http://localhost:${PORT}/api/status
   • Tabeza Settings: ${config.apiUrl}/settings

💡 IMPORTANT: Keep this window open - service must run continuously!
   Closing this window will stop the printer service.
` : `
⚠️  CONFIGURATION REQUIRED

To connect this service to your Tabeza account:

📋 Easy Setup (Recommended):
   1. Close this window
   2. Double-click: START-PRINTER-WITH-BARID.bat
   3. Enter your Bar ID when prompted
   4. Done! ✅

   OR use the web configuration page:
   1. Go to: http://localhost:${PORT}/configure.html
   2. Enter your Bar ID from Tabeza Settings
   3. Click "Configure"

🔗 Quick Links:
   • Configuration Page: http://localhost:${PORT}/configure.html
   • Tabeza Settings: ${config.apiUrl}/settings
   • Service Status: http://localhost:${PORT}/api/status

💡 IMPORTANT: Keep this window open - service must run continuously!
   After configuration, your POS will continue printing normally; we'll capture receipts automatically.
`}

═══════════════════════════════════════════════════════════

⚠️  DO NOT CLOSE THIS WINDOW - Service is running
Press Ctrl+C to stop the service
    `);
  });
}

// Server instance for shutdown
let server = null;

// Graceful shutdown function
async function shutdown() {
  console.log('\n👋 Shutting down Tabeza Connect...');
  
  const shutdownTimeout = setTimeout(() => {
    console.warn('⚠️  Shutdown timeout reached (5s), forcing exit...');
    process.exit(0);
  }, 5000);
  
  try {
    stopHeartbeat();
    console.log('✅ Heartbeat stopped');
    
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
      console.log('✅ Cloud polling stopped');
    }
    
    if (spoolMonitor) {
      await spoolMonitor.stop();
      spoolMonitor = null;
      console.log('✅ Active spool capture stopped');
    }
    
    if (simpleCapture) {
      await simpleCapture.stop();
      simpleCapture = null;
      console.log('✅ Pooling capture stopped');
    }
    
    if (printBridge) {
      await printBridge.stop();
      printBridge = null;
      console.log('✅ Print bridge stopped');
    }
    
    if (uploadWorker) {
      await uploadWorker.stop();
      uploadWorker = null;
      console.log('✅ Upload worker stopped (pending uploads flushed)');
    }
    
    if (localQueue) {
      await localQueue.close();
      localQueue = null;
      console.log('✅ Local queue closed');
    }
    
    if (watcher) {
      await watcher.stop();
      watcher = null;
      console.log('✅ Folder watcher stopped');
    }
    
    if (server) {
      await new Promise((resolve) => {
        server.close(() => {
          console.log('✅ Express server stopped');
          resolve();
        });
      });
      server = null;
    }
    
    clearTimeout(shutdownTimeout);
    console.log('✅ Graceful shutdown completed');
    
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    clearTimeout(shutdownTimeout);
  }
}

// Handle shutdown
process.on('SIGINT', async () => {
  await shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await shutdown();
  process.exit(0);
});

// Export shutdown function for tray app
module.exports = {
  shutdown,
  getConfig: () => config,
  getServer: () => server,
};

// Start the service
start();