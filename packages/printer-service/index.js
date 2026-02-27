#!/usr/bin/env node
/**
 * Tabeza Printer Service
 * 
 * Monitors a folder for print jobs and relays them to Tabeza cloud
 * Works with "Print to File" or any printer that outputs to a folder
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

const app = express();
const PORT = 8765;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Generate unique driver ID (moved to top to avoid crash)
function generateDriverId() {
  const { hostname } = require('os');
  return `driver-${hostname()}-${Date.now()}`;
}

// Heartbeat configuration
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const HEARTBEAT_RETRY_ATTEMPTS = 3;
const HEARTBEAT_RETRY_DELAY = 5000; // 5 seconds

// Heartbeat state tracking
let heartbeatInterval = null;
let heartbeatFailures = 0;

// Load configuration - prioritize environment variables over config file
function loadConfig() {
  // Check environment variables first (highest priority)
  const envBarId = process.env.TABEZA_BAR_ID;
  const envApiUrl = process.env.TABEZA_API_URL;
  const envVercelBypassToken = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || process.env.VERCEL_BYPASS_TOKEN;
  
  if (envBarId && envApiUrl) {
    console.log('✅ Using configuration from environment variables');
    return {
      barId: envBarId,
      apiUrl: envApiUrl,
      vercelBypassToken: envVercelBypassToken || '',
      driverId: generateDriverId(),
      watchFolder: path.join(process.env.USERPROFILE || process.env.HOME, 'TabezaPrints'),
    };
  }
  
  // Try to load from config file as fallback
  try {
    const configPath = path.join(__dirname, 'config.json');
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configData);
      console.log('✅ Loaded configuration from config.json');
      return config;
    }
  } catch (error) {
    console.warn('⚠️ Could not load config.json:', error.message);
  }
  
  // No config found - return empty config
  console.log('⚠️ No configuration found - service needs to be configured');
  return {
    barId: '',
    apiUrl: 'http://localhost:3003',
    vercelBypassToken: envVercelBypassToken || '',
    driverId: generateDriverId(),
    watchFolder: path.join(process.env.USERPROFILE || process.env.HOME, 'TabezaPrints'),
  };
}

// Configuration
// ✅ FIX #1: Changed default to localhost for local development
let config = loadConfig();

// Ensure watch folder exists
if (!fs.existsSync(config.watchFolder)) {
  fs.mkdirSync(config.watchFolder, { recursive: true });
}

// File watcher
let watcher = null;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.raw({ type: 'application/octet-stream', limit: '10mb' }));

// Health check endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    version: '1.0.0',
    printerName: 'Tabeza Receipt Printer',
    timestamp: new Date().toISOString(),
    barId: config.barId,
    driverId: config.driverId,
    watchFolder: config.watchFolder,
    configured: !!config.barId,
  });
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
  const { barId, apiUrl, watchFolder } = req.body;
  
  if (barId) config.barId = barId;
  if (apiUrl) config.apiUrl = apiUrl;
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
  
  res.json({
    success: true,
    config: {
      barId: config.barId,
      apiUrl: config.apiUrl,
      driverId: config.driverId,
      watchFolder: config.watchFolder,
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

// REMOVED: Blocking print forwarding logic
// CORE TRUTH: Manual service always exists. Digital authority is singular.
// Tabeza adapts to the venue — never the reverse.
//
// The POS prints directly to the printer. TabezaConnect observes passively.
// No blocking intermediary. No cloud-to-printer relay.
// Architecture: POS → Printer (instant) + Windows Spooler → TabezaConnect watches

// Start watching folder for new print files
function startWatcher() {
  console.log(`👀 Watching folder: ${config.watchFolder}`);
  
  watcher = chokidar.watch(config.watchFolder, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100
    }
  });

  watcher
    .on('add', async (filePath) => {
      console.log(`📄 New print file detected: ${path.basename(filePath)}`);
      
      try {
        // Read file
        const fileData = fs.readFileSync(filePath);
        
        // Process and send to cloud
        await processPrintJob(fileData, path.basename(filePath));
        
        console.log(`✅ Print job relayed successfully`);
        
        // Archive the file (move to processed folder)
        const processedFolder = path.join(config.watchFolder, 'processed');
        if (!fs.existsSync(processedFolder)) {
          fs.mkdirSync(processedFolder, { recursive: true });
        }
        
        const archivePath = path.join(processedFolder, `${Date.now()}-${path.basename(filePath)}`);
        fs.renameSync(filePath, archivePath);
        
      } catch (error) {
        console.error(`❌ Error processing print file:`, error);
        
        // Move to error folder
        const errorFolder = path.join(config.watchFolder, 'errors');
        if (!fs.existsSync(errorFolder)) {
          fs.mkdirSync(errorFolder, { recursive: true });
        }
        
        const errorPath = path.join(errorFolder, `${Date.now()}-${path.basename(filePath)}`);
        fs.renameSync(filePath, errorPath);
      }
    })
    .on('error', error => console.error(`Watcher error: ${error}`));
}

// Process print job and send to cloud
// CORE TRUTH: Manual service always exists. Digital authority is singular.
// Tabeza adapts to the venue — never the reverse.
//
// This function now parses receipts locally before uploading to eliminate
// null byte errors and reduce bandwidth usage.
async function processPrintJob(printData, fileName = 'receipt.prn') {
  const jobId = `job-${Date.now()}`;
  
  if (!config.barId) {
    throw new Error('Service not configured - Bar ID missing');
  }
  
  // Convert bytes to text (simple UTF-8 conversion)
  // ESC/POS commands are filtered out by converting to string
  let receiptText = '';
  try {
    receiptText = Buffer.from(printData).toString('utf8')
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
      .trim();
  } catch (error) {
    console.error('[Capture] Error converting bytes to text:', error.message);
    receiptText = '';
  }
  
  // Parse receipt text using Receipt_Parser
  const { parseReceipt, loadTemplateFromConfig } = require('./lib/receiptParser');
  const template = loadTemplateFromConfig(config);
  const parsedData = parseReceipt(receiptText, template);
  
  console.log(`[Capture] Parsed receipt with confidence: ${parsedData.confidence}`);
  
  // Convert to base64 for optional debugging/fallback
  const base64Data = Buffer.from(printData).toString('base64');
  
  // Send parsed data to cloud as primary field
  await sendToCloud({
    driverId: config.driverId,
    barId: config.barId,
    timestamp: new Date().toISOString(),
    parsedData: {
      items: parsedData.items,
      total: parsedData.total,
      subtotal: parsedData.subtotal,
      tax: parsedData.tax,
      receiptNumber: parsedData.receiptNumber,
      timestamp: parsedData.timestamp,
      rawText: parsedData.rawText
    },
    rawData: base64Data, // Optional: for debugging/fallback
    printerName: 'Tabeza Receipt Printer',
    documentName: fileName,
    metadata: {
      jobId,
      source: 'file-watcher',
      fileSize: printData.length,
      confidence: parsedData.confidence,
      parsingMethod: 'local'
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
  return `driver-${hostname()}-${Date.now()}`;
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
  
  // Parse the test receipt using Receipt_Parser
  const { parseReceipt, loadTemplateFromConfig } = require('./lib/receiptParser');
  const template = loadTemplateFromConfig(config);
  const parsedData = parseReceipt(testData, template);
  
  console.log(`[Test Receipt] Parsed with confidence: ${parsedData.confidence}`);
  
  return {
    driverId: config.driverId,
    barId: config.barId,
    timestamp: new Date().toISOString(),
    parsedData: {
      items: parsedData.items,
      total: parsedData.total,
      subtotal: parsedData.subtotal,
      tax: parsedData.tax,
      receiptNumber: parsedData.receiptNumber,
      timestamp: parsedData.timestamp,
      rawText: parsedData.rawText
    },
    rawData: Buffer.from(testData).toString('base64'),
    printerName: 'Tabeza Receipt Printer',
    documentName: `Test Receipt ${receiptNumber}`,
    metadata: {
      jobId: `test-${Date.now()}`,
      source: 'test',
      receiptNumber,
      itemCount: items.length,
      totalAmount: total,
      confidence: parsedData.confidence,
      parsingMethod: 'local'
    },
  };
}

// Save config to file
function saveConfig(cfg) {
  const configPath = path.join(__dirname, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
}

// Load config from file
function loadConfig() {
  const configPath = path.join(__dirname, 'config.json');
  if (fs.existsSync(configPath)) {
    const data = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(data);
  }
  return null;
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
  
  // Try to load saved driver_id from config file if it exists
  try {
    const configPath = path.join(__dirname, 'config.json');
    if (fs.existsSync(configPath)) {
      const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (savedConfig.driverId) {
        config.driverId = savedConfig.driverId;
        console.log('✅ Reusing existing driver ID from config file');
      }
    }
  } catch (error) {
    // Ignore errors - will generate new driver_id
  }
  
  // Save config to persist driver_id
  try {
    saveConfig(config);
  } catch (error) {
    console.warn('⚠️ Could not save config file:', error.message);
  }
  
  // Start file watcher
  startWatcher();
  
  // REMOVED: Cloud polling for print jobs (blocking intermediary)
  // POS prints directly to printer. TabezaConnect observes passively.
  
  // Start heartbeat service
  startHeartbeat();
  
  app.listen(PORT, async () => {
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

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down Tabeza Connect...');
  if (watcher) {
    watcher.close();
  }
  // REMOVED: pollInterval cleanup (no longer needed)
  stopHeartbeat();
  process.exit(0);
});

// Start the service
start();
