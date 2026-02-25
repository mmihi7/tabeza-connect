#!/usr/bin/env node
/**
 * Tabeza Printer Service (TabezaConnect Capture Service)
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 * 
 * This service operates in spooler mode controlled by CAPTURE_MODE environment variable:
 * 
 * NEW MODE (captureMode='spooler'):
 *    - Monitors Windows print spooler (C:\Windows\System32\spool\PRINTERS)
 *    - Passive capture - POS prints directly to printer with zero latency
 *    - POS → Printer (instant) + TabezaConnect watches spooler (passive)
 *    - Printer never knows Tabeza exists. POS never knows Tabeza exists.
 *    - This is why it's called a "driver" - it integrates at the OS print layer
 * 
 * The new mode transforms TabezaConnect from a blocking intermediary to a 
 * passive receipt capture system. Printing never depends on Tabeza.
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// Add Windows registry reading
const winreg = require('winreg');

// Import spool monitor for passive receipt capture
const SpoolMonitor = require('./spoolMonitor');
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

// Generate unique driver ID (moved to top to avoid crash)
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
  const envVercelBypassToken = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || process.env.VERCEL_BYPASS_TOKEN;
  const envCaptureMode = process.env.CAPTURE_MODE || 'spooler'; // 'folder' (legacy) or 'spooler' (new)
  
  console.log('  TABEZA_BAR_ID:', envBarId || '(not set)');
  console.log('  TABEZA_API_URL:', envApiUrl || '(not set)');
  console.log('  TABEZA_WATCH_FOLDER:', envWatchFolder || '(not set)');
  console.log('  CAPTURE_MODE:', envCaptureMode);
  console.log('');
  
  if (envBarId && envApiUrl) {
    console.log('✅ Using configuration from environment variables');
    console.log('   Bar ID:', envBarId);
    console.log('   API URL:', envApiUrl);
    console.log('   Watch Folder:', envWatchFolder || 'C:\\ProgramData\\Tabeza\\TabezaPrints');
    console.log('   Capture Mode:', envCaptureMode);
    console.log('');
    return {
      barId: envBarId,
      apiUrl: envApiUrl,
      vercelBypassToken: envVercelBypassToken || '',
      driverId: generateDriverId(),
      watchFolder: envWatchFolder || 'C:\\ProgramData\\Tabeza\\TabezaPrints',
      captureMode: envCaptureMode,
    };
  }
  
  // Try to read from Windows Registry (second priority)
  console.log('🔍 Checking Windows Registry for configuration...');
  try {
    const { execSync } = require('child_process');
    
    // Read Bar ID from registry
    let registryBarId = null;
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
    
    // Read CaptureMode from registry
    let registryCaptureMode = 'spooler'; // Default to spooler
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
      console.log('  CaptureMode not found in registry, using default spooler');
    }
    
    // Read API URL from registry (default if not found)
    const defaultApiUrl = 'https://bkaigyrrzsqbfscyznzw.supabase.co';
    
    if (registryBarId && registryBarId !== 'YOUR_BAR_ID_HERE') {
      console.log('✅ Using configuration from Windows Registry');
      console.log('   Bar ID:', registryBarId);
      console.log('   API URL:', defaultApiUrl);
      console.log('   Watch Folder: C:\\ProgramData\\Tabeza\\TabezaPrints');
      console.log('   Capture Mode:', registryCaptureMode);
      console.log('');
      return {
        barId: registryBarId,
        apiUrl: defaultApiUrl,
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
      
      // Add captureMode if not present (default to legacy folder mode)
      if (!config.captureMode) {
        config.captureMode = 'folder';
      }
      
      console.log('✅ Loaded configuration from config.json');
      console.log('   Bar ID:', config.barId);
      console.log('   API URL:', config.apiUrl);
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
  if (!registryBarId && !config) {
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

// File watcher
let watcher = null;

// Spool monitor for passive receipt capture
let spoolMonitor = null;

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
  
  // Get bridge stats if bridge is running
  const bridgeStats = printBridge ? {
    enabled: true,
    printerName: config.bridge?.printerName || 'Not configured',
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
    printerName: 'Tabeza POS Connect',
    timestamp: new Date().toISOString(),
    barId: config.barId,
    apiUrl: config.apiUrl,  
    driverId: config.driverId,
    watchFolder: config.watchFolder,
    captureMode: config.captureMode || 'folder',
    configured: !!config.barId,
    spoolMonitor: spoolStats,
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
      captureMode: config.captureMode || 'folder',
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
  
  // ✅ FIX #3: Validate service is configured before test print
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
  const { barId, apiUrl, watchFolder, captureMode } = req.body;
  
  const wasConfigured = !!config.barId;
  
  if (barId) config.barId = barId;
  if (apiUrl) config.apiUrl = apiUrl;
  if (captureMode && ['folder', 'spooler'].includes(captureMode)) {
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
  
  // ✅ FIX: Restart heartbeat if Bar ID was just configured
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
      driverId: config.driverId,
      watchFolder: config.watchFolder,
      captureMode: config.captureMode || 'folder',
    },
  });
});

// Manual print job submission
app.post('/api/print-job', async (req, res) => {
  try {
    const printData = req.body;
    
    console.log(`🖨️ Print job received (${printData.length} bytes)`);
    
    // Parse and send to cloud
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

// NEW: List available printers
app.get('/api/printers/list', async (req, res) => {
  try {
    const { execSync } = require('child_process');
    
    // Get all printers via PowerShell
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

// NEW: Update physical printer
app.post('/api/printers/set-physical', async (req, res) => {
  try {
    const { printerName } = req.body;
    
    if (!printerName) {
      return res.status(400).json({
        success: false,
        error: 'printerName is required'
      });
    }
    
    // Verify printer exists
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
    
    // Update config
    if (!config.bridge) {
      config.bridge = {};
    }
    
    const oldPrinter = config.bridge.printerName;
    config.bridge.printerName = printerName;
    
    // Save to file
    saveConfig(config);
    
    console.log(`🔄 Printer changed: ${oldPrinter} → ${printerName}`);
    
    // Restart bridge if running
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

// NEW: Send test print
app.post('/api/printers/test', async (req, res) => {
  try {
    if (!config.bridge || !config.bridge.enabled) {
      return res.status(400).json({
        success: false,
        error: 'Bridge not enabled'
      });
    }
    
    // Create test receipt
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
    
    // Write to capture folder
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

// NEW: Send print job to physical printer
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
    
    // Decode base64 data
    const printBuffer = Buffer.from(rawData, 'base64');
    
    // Save to output folder for physical printer to pick up
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
  
  // Build headers with Vercel bypass token if configured
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (config.vercelBypassToken) {
    headers['x-vercel-protection-bypass'] = config.vercelBypassToken;
  }
  
  // Poll every 5 seconds
  pollInterval = setInterval(async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/printer/pending-prints?barId=${config.barId}&driverId=${config.driverId}`, { headers });
      
      if (!response.ok) {
        // Silently fail - don't spam logs
        return;
      }
      
      const { prints } = await response.json();
      
      if (prints && prints.length > 0) {
        console.log(`📥 Received ${prints.length} print job(s) from cloud`);
        
        for (const print of prints) {
          try {
            // Decode and save to output folder
            const printBuffer = Buffer.from(print.rawData, 'base64');
            const outputFolder = path.join(config.watchFolder, 'output');
            if (!fs.existsSync(outputFolder)) {
              fs.mkdirSync(outputFolder, { recursive: true });
            }
            
            const outputFile = path.join(outputFolder, `cloud-print-${Date.now()}.prn`);
            fs.writeFileSync(outputFile, printBuffer);
            
            console.log(`✅ Cloud print job saved: ${outputFile}`);
            
            // Acknowledge receipt
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
      // Silently fail - network issues are common
    }
  }, 5000); // Poll every 5 seconds
}

// Initialize local queue and upload worker
async function initializeQueue() {
  console.log('🗂️  Initializing local queue and upload worker...');
  
  // Create local queue
  localQueue = new LocalQueue({
    queuePath: 'C:\\ProgramData\\Tabeza\\queue',
  });
  
  // Initialize queue
  await localQueue.initialize();
  
  // Create upload worker
  uploadWorker = new UploadWorker({
    localQueue,
    apiEndpoint: config.apiUrl,
    barId: config.barId,
    deviceId: config.driverId,
  });
  
  // Start upload worker
  await uploadWorker.start();
  
  console.log('✅ Queue and upload worker initialized');
}

// Start spooler monitoring
function startSpoolerMonitoring() {
  console.log('🚀 Starting Windows spooler monitor...');
  
  // Create SpoolMonitor instance
  const monitor = new SpoolMonitor({
    spoolPath: 'C:\\Windows\\System32\\spool\\PRINTERS',
    fileTypes: ['.SPL', '.SHD'],
  });
  
  // Handle file detection events
  monitor.on('file-detected', async (filePath, receiptData) => {
    console.log('📄 Receipt detected from spooler');
    
    try {
      // Enqueue receipt for upload
      await localQueue.enqueue({
        barId: config.barId,
        deviceId: config.driverId,
        timestamp: new Date().toISOString(),
        escposBytes: receiptData.escposBytes,
        text: receiptData.text,
        metadata: {
          source: 'spooler',
          fileName: path.basename(filePath),
          fileSize: receiptData.metadata.fileSize,
          lineCount: receiptData.metadata.lineCount,
          isESCPOS: receiptData.isESCPOS,
        },
      });
      
      console.log('✅ Receipt enqueued for upload');
    } catch (error) {
      console.error('❌ Error queuing receipt:', error.message);
    }
  });
  
  monitor.on('error', (error) => {
    console.error('❌ Spooler monitor error:', error.message);
  });
  
  // Start monitoring
  monitor.start();
  
  return monitor;
}

// Start monitoring based on capture mode
async function startWatcher() {
  console.log(`👀 Starting capture service...`);
  console.log(`   Mode: ${config.captureMode === 'spooler' ? 'NEW (Passive Spooler Monitor)' : config.captureMode === 'bridge' ? 'SILENT BRIDGE (Parallel + Physical)' : 'UNKNOWN'}`);
  console.log('');
  
  if (config.captureMode === 'spooler') {
    // Initialize queue and upload worker first
    await initializeQueue();
    
    // NEW MODE: Monitor Windows spooler (non-blocking)
    spoolMonitor = startSpoolerMonitoring();
    
  } else if (config.captureMode === 'bridge') {
    // BRIDGE MODE: Silent Bridge for parallel + physical printing
    await initializeQueue();
    
    console.log('🌉 Starting Silent Bridge Mode... (FINAL VERSION)');
    console.log('   This enables digital capture + physical receipt printing');
    console.log('   Physical printing requires this service to stay running!');
    console.log('');
    
    printBridge = new PrintBridge();
    printBridge.start();
    
  } else {
    console.error('❌ Invalid capture mode. Please set "captureMode": "spooler" or "bridge" in config.json');
    process.exit(1);
  }
}

// Process print job and send to cloud
// Cloud will handle receipt parsing using DeepSeek API
async function processPrintJob(printData, fileName = 'receipt.prn') {
  const jobId = `job-${Date.now()}`;
  
  if (!config.barId) {
    throw new Error('Service not configured - Bar ID missing');
  }
  
  // Convert to base64
  const base64Data = Buffer.from(printData).toString('base64');
  
  // Send raw data to cloud - parsing will be done cloud-side
  await sendToCloud({
    driverId: config.driverId,
    barId: config.barId,
    timestamp: new Date().toISOString(),
    rawData: base64Data,
    printerName: 'Tabeza POS Connect',
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
  
  // Build headers with Vercel bypass token if configured
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

// Generate unique driver ID
function generateDriverId() {
  const { hostname } = require('os');
  return `driver-${hostname()}`;
}

// Send heartbeat to cloud
async function sendHeartbeat(attempt = 1) {
  try {
    // Build heartbeat payload
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
    
    // Build headers with Vercel bypass token if configured
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (config.vercelBypassToken) {
      headers['x-vercel-protection-bypass'] = config.vercelBypassToken;
    }
    
    // Send to production app (primary)
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
    
    // Also send to local staff app for development (if different from production)
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
    
    // Reset failure count on success
    if (heartbeatFailures > 0) {
      console.log('✅ Heartbeat connection restored');
      heartbeatFailures = 0;
    }
    
  } catch (error) {
    // Track failure count and log errors
    heartbeatFailures++;
    
    console.error(`❌ Heartbeat failed (attempt ${attempt}/${HEARTBEAT_RETRY_ATTEMPTS}):`, error.message);
    
    // Add retry logic with exponential backoff
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

// Create test receipt
function createTestReceipt(message) {
  const now = new Date();
  const receiptNumber = `RCP-${now.getTime().toString().slice(-6)}`;
  
  // Realistic test items with quantities and prices
  const items = [
    { qty: 2, name: 'Tusker Lager 500ml', price: 250.00 },
    { qty: 1, name: 'Nyama Choma (Half Kg)', price: 800.00 },
    { qty: 3, name: 'Pilsner 500ml', price: 200.00 },
    { qty: 1, name: 'Chips Masala', price: 150.00 },
    { qty: 2, name: 'Soda (Coke)', price: 80.00 },
  ];
  
  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + (item.qty * item.price), 0);
  const tax = subtotal * 0.16; // 16% VAT
  const total = subtotal + tax;
  
  // Format receipt with proper spacing and alignment
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
function saveConfig(cfg) {
  const configPath = path.join(__dirname, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
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
  // Check if port is available
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
  
  // Load configuration (environment variables take priority)
  config = loadConfig();
  
  // Save config to persist driver_id
  try {
    saveConfig(config);
  } catch (error) {
    console.warn('⚠️ Could not save config file:', error.message);
  }
  
  // Start file watcher
  await startWatcher();
  
  // Start cloud polling (for receiving print jobs from cloud)
  startCloudPolling();
  
  // Start heartbeat service
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
   • Watch Folder: ${config.watchFolder}
   • Capture Mode: ${config.captureMode || 'folder'} ${config.captureMode === 'spooler' ? '(NEW - Passive Capture)' : '(LEGACY - Folder Watch)'}
   • Config Source: ${process.env.TABEZA_BAR_ID ? 'Environment Variables' : 'Config File'}

${config.barId ? `
✅ Configuration Complete!

Your printer service is monitoring for print jobs.

📋 POS Setup Instructions:
   1. In your POS system, add a new printer
   2. Choose "Generic / Text Only" printer driver
   3. Set printer port to: FILE
   4. Set output folder to: ${config.watchFolder}
   5. Test print from your POS

   OR use Windows "Microsoft Print to PDF" printer:
   - Print to PDF
   - Save files to: ${config.watchFolder}

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
   After configuration, set up your POS to print to:
   ${config.watchFolder}
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
    // Stop heartbeat service
    stopHeartbeat();
    console.log('✅ Heartbeat stopped');
    
    // Stop cloud polling
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
      console.log('✅ Cloud polling stopped');
    }
    
    // Stop spooler monitor
    if (spoolMonitor) {
      await spoolMonitor.stop();
      spoolMonitor = null;
      console.log('✅ Spooler monitor stopped');
    }
    
    // Stop print bridge
    if (printBridge) {
      await printBridge.stop();
      printBridge = null;
      console.log('✅ Print bridge stopped');
    }
    
    // Stop upload worker (flushes pending uploads)
    if (uploadWorker) {
      await uploadWorker.stop();
      uploadWorker = null;
      console.log('✅ Upload worker stopped (pending uploads flushed)');
    }
    
    // Close local queue
    if (localQueue) {
      await localQueue.close();
      localQueue = null;
      console.log('✅ Local queue closed');
    }
    
    // Stop folder watcher (legacy mode)
    if (watcher) {
      await watcher.stop();
      watcher = null;
      console.log('✅ Folder watcher stopped');
    }
    
    // Close Express server
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