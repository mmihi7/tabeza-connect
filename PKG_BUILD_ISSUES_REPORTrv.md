
1. 
{
  "name": "@tabeza/connect",
  "version": "1.0.0",
  "description": "Tabeza Connect - Bridges your POS system with Tabeza cloud for digital receipts",
  "main": "index.js",
  "bin": {
    "tabeza-connect": "./index.js"
  },
  "scripts": {
    "start": "node index.js",
    "start:electron": "electron electron-main.js",
    "install-service": "node install-service.js",
    "uninstall-service": "node uninstall-service.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "create-package": "node create-package.js",
    "build-exe": "pkg index.js --targets node18-win-x64 --output dist/tabeza-printer-service.exe",
    "build-installer": "node build-installer.js",
    "build:electron": "electron-builder",
    "build:all": "npm run build:electron",
    "build:installer:new": "node installer/build-installer.js",
    "download:nodejs": "node installer/download-nodejs.js"
  },
  "dependencies": {
    "better-sqlite3": "^9.2.2",
    "chokidar": "^3.5.3",
    "cors": "^2.8.5",
    "electron": "^28.0.0",
    "express": "^4.18.2",
    "node-windows": "^1.0.0-beta.8",
    "uuid": "^13.0.0"
  },
  "devDependencies": {
    "electron-builder": "^24.9.1",
    "fast-check": "^3.15.0",
    "jest": "^29.7.0",
    "pkg": "^5.8.1"
  },
  "jest": {
    "testEnvironment": "node",
    "testMatch": [
      "**/__tests__/**/*.test.js"
    ],
    "collectCoverageFrom": [
      "index.js",
      "queueManager.js"
    ]
  },
  "pkg": {
    "scripts": [
      "**/*.js",
      "../server/**/*.js"
    ],
    "assets": [
      "node_modules/**/*",
      "../public/**/*"
    ],
    "targets": [
      "node18-win-x64"
    ],
    "outputPath": "dist"
  },
  "build": {
    "appId": "com.tabeza.connect",
    "productName": "Tabeza Connect",
    "win": {
      "target": "nsis",
      "icon": "assets/icon-green.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "runAfterFinish": true,
      "installerIcon": "assets/icon-green.ico",
      "uninstallerIcon": "assets/icon-green.ico"
    },
    "files": [
      "**/*",
      "!**/*.md",
      "!__tests__",
      "!test-receipts",
      "!received-prints"
    ]
  },
  "keywords": [
    "tabeza",
    "connect",
    "printer",
    "pos",
    "receipt",
    "bridge"
  ],
  "author": "Tabeza",
  "license": "MIT"
}

2. 
/***
 * Tabeza POS Connect - Pooling Capture Service v1.7.0
 *
 * Architecture: Windows Printer Pooling (NO BRIDGE)
 * ─────────────────────────────────────────────────
 * POS prints to "Tabeza POS Printer"
 *   → Windows Printer Pooling sends job to TWO ports simultaneously:
 *       1. Physical printer port (USB001, etc.) → Receipt prints on paper  ✅
 *       2. TabezaCapturePort (file port → order.prn) → File written here   ✅
 *   → This service watches the capture folder for new/changed files
 *   → Uploads raw print data to Tabeza cloud
 *
 * The service does NOT forward to a physical printer.
 * Windows handles the physical print via pooling. We only do the cloud upload.
 *
 * Exit Codes:
 *   0 - Clean shutdown
 *   1 - Fatal startup error
 */

'use strict';

const fs      = require('fs');
const path    = require('path');
const https   = require('https');
const chokidar = require('chokidar');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

// Import service components
const RegistryReader = require('./config/registry-reader');
const ESCPOSProcessor = require('./escposProcessor');
const ReceiptParser = require('./receiptParser');
const LocalQueue = require('./localQueue');
const UploadWorker = require('./uploadWorker');
const HeartbeatService = require('./heartbeat/heartbeat-service');
const HTTPServer = require('../server/simple-http-server');

// ─── Constants ────────────────────────────────────────────────────────────────

const DATA_DIR      = 'C:\\ProgramData\\Tabeza';
const CONFIG_PATH   = path.join(DATA_DIR, 'config.json');
const LOG_DIR       = path.join(DATA_DIR, 'logs');
const LOG_FILE      = path.join(LOG_DIR, 'service.log');
const QUEUE_DIR     = path.join(DATA_DIR, 'queue');
const TEMPLATES_DIR = path.join(DATA_DIR, 'templates');
const ORDER_PRN_FILE = 'order.prn';

// ─── Logging ──────────────────────────────────────────────────────────────────

function ensureLogDir() {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch (_) {}
}

function log(level, message) {
  const ts   = new Date().toISOString();
  const line = `[${ts}][${level}] ${message}`;
  console.log(line);
  try {
    ensureLogDir();
    fs.appendFileSync(LOG_FILE, line + '\n', 'utf8');
  } catch (_) {}
}

log('INFO', '--- INDEX.JS WAS LOADED ---');

const info  = (m) => log('INFO',  m);
const warn  = (m) => log('WARN',  m);
const error = (m) => log('ERROR', m);

// ─── Config ───────────────────────────────────────────────────────────────────

function loadConfig() {
  // Use RegistryReader for priority cascade loading
  const config = RegistryReader.loadConfig();
  
  // Add driver ID if not present
  if (!config.driverId) {
    config.driverId = HeartbeatService.generateDriverId();
  }
  
  return config;
}

function generateDriverId() {
  const hostname = os.hostname();
  return `driver-${hostname}`;
}

// ─── Integrated Capture Service ─────────────────────────────────────────────────

class IntegratedCaptureService {
  constructor() {
    this.config = loadConfig();
    this.watcher = null;
    this.processingFiles = new Set();
    this.isRunning = false;
    this.jobsProcessed = 0;
    
    // Initialize components
    this.escposProcessor = new ESCPOSProcessor();
    this.receiptParser = new ReceiptParser();
    this.localQueue = new LocalQueue();
    this.uploadWorker = null;
    this.heartbeatService = null;
    this.httpServer = null;
  }

  async start() {
    info('========================================');
    info('Tabeza POS Connect - Integrated Service v1.7.0');
    info('========================================');
    
    // Log configuration with source
    info(`Configuration source: ${this.config.source || 'unknown'}`);
    info(`Bar ID      : ${this.config.barId || '(not set)'}`);
    info(`API URL     : ${this.config.apiUrl}`);
    info(`Watch Folder: ${this.config.watchFolder}`);
    info(`Driver ID   : ${this.config.driverId}`);
    info(`HTTP Port   : ${this.config.httpPort}`);
    info('========================================');

    if (!this.config.barId) {
      warn('WARNING: barId is not set. Receipts will be captured locally but upload will be skipped.');
    }

    // Create required directories
    await this.createDirectories();

    // Initialize components
    await this.initializeComponents();

    // Signal ready to Windows SCM
    this.isRunning = true;
    info('Service signaled ready to Windows SCM');

    // Start file watcher
    this.startFileWatcher();
    
    info('All components started. Service ready.');
  }

  async createDirectories() {
    const directories = [
      this.config.watchFolder,
      path.join(this.config.watchFolder, 'processed'),
      path.join(this.config.watchFolder, 'failed'),
      QUEUE_DIR,
      path.join(QUEUE_DIR, 'pending'),
      path.join(QUEUE_DIR, 'uploaded'),
      LOG_DIR,
      TEMPLATES_DIR
    ];

    for (const dir of directories) {
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          info(`Created directory: ${dir}`);
        }
      } catch (err) {
        error(`Failed to create directory ${dir}: ${err.message}`);
        throw err;
      }
    }
  }

  async initializeComponents() {
    try {
      // Initialize receipt parser
      await this.receiptParser.initialize();
      info('✅ Receipt parser initialized');

      // Initialize local queue
      await this.localQueue.initialize();
      info('✅ Local queue initialized');

      // Start upload worker
      this.uploadWorker = new UploadWorker({
        localQueue: this.localQueue,
        apiEndpoint: this.config.apiUrl,
        barId: this.config.barId,
        deviceId: this.config.driverId
      });
      await this.uploadWorker.start();
      info('✅ Upload worker started');

      // Start heartbeat service
      this.heartbeatService = new HeartbeatService(this.config);
      this.heartbeatService.start();
      info('✅ Heartbeat service started');

      // Start HTTP server with fault isolation
      this.httpServer = new HTTPServer(this.config, this);
      try {
        await this.httpServer.start();
        info('✅ HTTP server started');
      } catch (serverErr) {
        warn(`HTTP server failed to start (non-fatal): ${serverErr.message}`);
        warn('Management UI will not be available, but receipt capture continues');
        // Continue without HTTP server - fault isolation
      }

    } catch (err) {
      error(`Failed to initialize components: ${err.message}`);
      throw err;
    }
  }

  startFileWatcher() {
    const orderPrnPath = path.join(this.config.watchFolder, ORDER_PRN_FILE);
    
    // Ensure order.prn exists
    if (!fs.existsSync(orderPrnPath)) {
      fs.writeFileSync(orderPrnPath, '');
      info(`Created ${ORDER_PRN_FILE}`);
    }

    info(`Starting file watcher: ${orderPrnPath}`);

    this.watcher = chokidar.watch(orderPrnPath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 1500, // 1.5 second delay
        pollInterval: 300,
      },
    });

    this.watcher.on('change', () => this.processOrderPrn());
    this.watcher.on('error', (err) => error(`Watcher error: ${err.message}`));

    info(`Watching: ${orderPrnPath}`);
    info('Ready. Waiting for print jobs from Tabeza POS Printer...');
  }

  async processOrderPrn() {
    const orderPrnPath = path.join(this.config.watchFolder, ORDER_PRN_FILE);
    
    // Skip if already being processed
    if (this.processingFiles.has(orderPrnPath)) {
      info('Already processing order.prn - skipping');
      return;
    }

    this.processingFiles.add(orderPrnPath);

    try {
      info('New print job detected');

      const data = fs.readFileSync(orderPrnPath);
      if (!data || data.length === 0) {
        info('Empty order.prn — skipping');
        return;
      }

      info(`Job size: ${data.length} bytes`);
      this.jobsProcessed++;

      // Process with ESC/POS stripper
      const escposResult = await this.escposProcessor.processFile(orderPrnPath);
      info(`ESC/POS processing complete: ${escposResult.isESCPOS ? 'ESC/POS detected' : 'Plain text'}`);

      // Parse with template parser
      let parsedReceipt = null;
      let parseSuccess = false;
      
      if (escposResult.text) {
        try {
          const parseResult = await this.receiptParser.parse(escposResult.text);
          parsedReceipt = parseResult.data;
          parseSuccess = parseResult.success;
          info(`Template parsing: ${parseSuccess ? 'SUCCESS' : 'FAILED'} (confidence: ${parseResult.confidence}%)`);
        } catch (parseErr) {
          warn(`Template parsing failed: ${parseErr.message}`);
        }
      }

      // Create receipt object for queue
      const receipt = {
        barId: this.config.barId,
        deviceId: this.config.driverId,
        timestamp: new Date().toISOString(),
        escposBytes: escposResult.escposBytes,
        text: escposResult.text,
        parsed: parseSuccess,
        confidence: parsedReceipt?.confidence || 0,
        receipt: parsedReceipt,
        metadata: {
          fileSize: data.length,
          isESCPOS: escposResult.isESCPOS,
          parseTime: parsedReceipt?.parseTime || 0,
          templateVersion: this.receiptParser.template?.version || 'none'
        }
      };

      // Enqueue for upload
      if (this.config.barId) {
        const receiptId = await this.localQueue.enqueue(receipt);
        info(`Receipt enqueued: ${receiptId}`);
      } else {
        warn('Bar ID not configured - receipt not enqueued');
      }

      // Archive and truncate order.prn
      await this.archiveOrderPrn(data, parseSuccess);

      info(`Job complete. Total processed: ${this.jobsProcessed}`);

    } catch (err) {
      error(`Failed to process order.prn: ${err.message}`);
      
      // Archive to failed folder
      try {
        const failedData = fs.readFileSync(orderPrnPath);
        await this.archiveOrderPrn(failedData, false);
      } catch (archiveErr) {
        warn(`Failed to archive to failed folder: ${archiveErr.message}`);
      }
      
    } finally {
      this.processingFiles.delete(orderPrnPath);
    }
  }

  async archiveOrderPrn(data, success) {
    const orderPrnPath = path.join(this.config.watchFolder, ORDER_PRN_FILE);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const archiveDir = path.join(this.config.watchFolder, success ? 'processed' : 'failed');
    const archiveFile = path.join(archiveDir, `${timestamp}_${ORDER_PRN_FILE}`);

    try {
      // Copy to archive
      fs.copyFileSync(orderPrnPath, archiveFile);
      info(`Archived to: ${success ? 'processed' : 'failed'}/${timestamp}_${ORDER_PRN_FILE}`);

      // Truncate order.prn to 0 bytes (never delete)
      fs.writeFileSync(orderPrnPath, Buffer.alloc(0));
      info('Truncated order.prn to 0 bytes');
      
    } catch (err) {
      error(`Failed to archive order.prn: ${err.message}`);
    }
  }

  async stop() {
    info('Stopping Tabeza POS Connect Integrated Service...');
    this.isRunning = false;

    // Stop file watcher
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    // Stop components in reverse order
    if (this.httpServer) {
      try {
        await this.httpServer.stop();
        info('HTTP server stopped');
      } catch (err) {
        warn(`Error stopping HTTP server: ${err.message}`);
      }
    }

    if (this.heartbeatService) {
      try {
        this.heartbeatService.stop();
        info('Heartbeat service stopped');
      } catch (err) {
        warn(`Error stopping heartbeat service: ${err.message}`);
      }
    }

    if (this.uploadWorker) {
      try {
        await this.uploadWorker.stop();
        info('Upload worker stopped');
      } catch (err) {
        warn(`Error stopping upload worker: ${err.message}`);
      }
    }

    info(`Integrated service stopped. Total jobs processed: ${this.jobsProcessed}`);
  }

  // Get service statistics
  async getStats() {
    const queueStats = await this.localQueue.getStats();
    const uploadStats = await this.uploadWorker?.getStats();
    const parserStats = this.receiptParser.getStats();
    const escposStats = this.escposProcessor.getStats();

    return {
      service: {
        isRunning: this.isRunning,
        jobsProcessed: this.jobsProcessed,
        uptime: process.uptime(),
        version: '1.7.0'
      },
      queue: queueStats,
      upload: uploadStats,
      parser: parserStats,
      escpos: escposStats
    };
  }
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

// Signal ready to Windows SCM BEFORE anything else (guards against slow startup)
if (process.send) {
  process.send({ type: 'started', message: 'Tabeza POS Connect starting' });
}

const service = new IntegratedCaptureService();
service.start().catch(err => {
  error(`Failed to start service: ${err.message}`);
  process.exit(1);
});

const shutdown = (sig) => {
  info(`${sig} received — shutting down`);
  service.stop().then(() => {
    process.exit(0);
  }).catch(err => {
    error(`Error during shutdown: ${err.message}`);
    process.exit(1);
  });
};

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
  error(`Uncaught exception: ${err.message}\n${err.stack}`);
  service.stop().then(() => {
    process.exit(1);
  });
});

process.on('unhandledRejection', (reason) => {
  error(`Unhandled rejection: ${reason}`);
});

3.

const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Simple HTTP server without axios dependency
class SimpleHTTPServer {
  constructor(config, service) {
    this.config = config;
    this.service = service;
    this.app = express();
    this.server = null;
    this.port = config.httpPort || 8765;
  }

  async start() {
    // Basic middleware
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../public')));

    // CORS headers
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // API Routes
    this.setupRoutes();

    // Start server
    return new Promise((resolve, reject) => {
      console.log(`=== PKG TEST: Attempting to bind to port: ${this.port} ===`);
      this.server = this.app.listen(this.port, '127.0.0.1', () => {
        console.log(`=== PKG TEST: Simple HTTP server started on http://127.0.0.1:${this.port} ===`);
        resolve();
      });
      
      this.server.on('error', (err) => {
        console.error(`Failed to start HTTP server: ${err.message}`);
        console.error(`Error code: ${err.code}`);
        reject(err);
      });
    });
  }

  setupRoutes() {
    // Status endpoint
    this.app.get('/api/status', async (req, res) => {
      try {
        const stats = await this.service.getStats();
        res.json({
          success: true,
          data: {
            service: stats.service,
            queue: stats.queue,
            upload: stats.upload,
            parser: stats.parser,
            escpos: stats.escpos,
            system: {
              hostname: os.hostname(),
              platform: os.platform(),
              uptime: os.uptime(),
              memory: process.memoryUsage()
            }
          }
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });

    // Configuration endpoint
    this.app.get('/api/config', (req, res) => {
      res.json({
        success: true,
        data: {
          barId: this.config.barId,
          apiUrl: this.config.apiUrl,
          watchFolder: this.config.watchFolder,
          driverId: this.config.driverId,
          httpPort: this.config.httpPort
        }
      });
    });

    // Template endpoints
    this.app.get('/api/templates', (req, res) => {
      try {
        const templatePath = path.join('C:\\ProgramData\\Tabeza\\templates', 'template.json');
        if (fs.existsSync(templatePath)) {
          const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
          res.json({
            success: true,
            data: template
          });
        } else {
          res.json({
            success: true,
            data: null,
            message: 'No template found'
          });
        }
      } catch (err) {
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });

    this.app.post('/api/templates', (req, res) => {
      try {
        const template = req.body;
        const templatesDir = 'C:\\ProgramData\\Tabeza\\templates';
        
        if (!fs.existsSync(templatesDir)) {
          fs.mkdirSync(templatesDir, { recursive: true });
        }
        
        const templatePath = path.join(templatesDir, 'template.json');
        fs.writeFileSync(templatePath, JSON.stringify(template, null, 2));
        
        res.json({
          success: true,
          message: 'Template saved successfully'
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });

    // Template generation endpoint
    this.app.post('/api/template/generate', async (req, res) => {
      try {
        const { receipts } = req.body;
        
        if (!receipts || !Array.isArray(receipts) || receipts.length < 3) {
          return res.status(400).json({
            success: false,
            error: 'At least 3 sample receipts are required for template generation'
          });
        }

        // Call cloud API to generate template
        const apiUrl = `${this.config.apiUrl}/api/receipts/generate-template`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            receipts,
            barId: this.config.barId
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        const result = await response.json();
        const template = result.template;

        if (!template || !template.patterns) {
          return res.status(500).json({
            success: false,
            error: 'Cloud API returned invalid template'
          });
        }

        // Save template to disk
        const templateDir = path.dirname('C:\\ProgramData\\Tabeza\\template.json');
        if (!fs.existsSync(templateDir)) {
          fs.mkdirSync(templateDir, { recursive: true });
        }

        fs.writeFileSync('C:\\ProgramData\\Tabeza\\template.json', JSON.stringify(template, null, 2), 'utf8');

        res.json({
          success: true,
          message: 'Template generated and saved successfully',
          template: {
            version: template.version,
            posSystem: template.posSystem,
            patterns: Object.keys(template.patterns)
          }
        });
      } catch (error) {
        console.error('[SimpleHTTPServer] Template generation error:', error);
        
        if (error.name === 'AbortError') {
          return res.status(504).json({
            success: false,
            error: 'Template generation timeout (60 seconds)'
          });
        }

        if (error.response) {
          return res.status(error.response.status || 500).json({
            success: false,
            error: `Cloud API error: ${error.response.status} ${error.response.statusText}`
          });
        }

        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Template HTML page
    this.app.get('/template.html', (req, res) => {
      try {
        // Serve a basic template generator inline
        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tabeza Connect - Template Generator</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; text-align: center; margin-bottom: 30px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; color: #555; }
        textarea { width: 100%; height: 200px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
        .btn { background: #007bff; color: white; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; font-size: 16px; }
        .btn:hover { background: #0056b3; }
        .status { padding: 10px; border-radius: 4px; margin: 10px 0; }
        .status.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .status.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧾 Template Generator</h1>
        <p>Create custom receipt parsing templates with AI</p>
        
        <div id="status" class="status" style="display: none;"></div>
        
        <form id="templateForm">
            <div class="form-group">
                <label for="templateName">Template Name:</label>
                <input type="text" id="templateName" value="Default Receipt Template" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            
            <div class="form-group">
                <label for="sampleReceipts">Sample Receipts (at least 3):</label>
                <textarea id="sampleReceipts" placeholder="Paste sample receipts here, one per line..."></textarea>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
                <button type="button" class="btn" onclick="generateTemplate()">🤖 Generate Template</button>
                <button type="button" class="btn" onclick="saveTemplate()" style="margin-left: 10px;">💾 Save Template</button>
            </div>
        </form>
    </div>
    
    <script>
        function showStatus(message, type) {
            const statusDiv = document.getElementById('status');
            statusDiv.textContent = message;
            statusDiv.className = 'status ' + type;
            statusDiv.style.display = 'block';
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 5000);
        }
        
        async function generateTemplate() {
            const receipts = document.getElementById('sampleReceipts').value.trim().split('\\n').filter(r => r.trim());
            
            if (receipts.length < 3) {
                showStatus('Please provide at least 3 sample receipts', 'error');
                return;
            }
            
            try {
                const response = await fetch('/api/template/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ receipts })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showStatus('Template generated successfully!', 'success');
                } else {
                    showStatus('Template generation failed: ' + result.error, 'error');
                }
            } catch (error) {
                showStatus('Error: ' + error.message, 'error');
            }
        }
        
        async function saveTemplate() {
            const templateName = document.getElementById('templateName').value;
            
            if (!templateName.trim()) {
                showStatus('Please enter a template name', 'error');
                return;
            }
            
            try {
                const response = await fetch('/api/templates', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: templateName })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showStatus('Template saved successfully!', 'success');
                } else {
                    showStatus('Failed to save template: ' + result.error, 'error');
                }
            } catch (error) {
                showStatus('Error: ' + error.message, 'error');
            }
        }
    </script>
</body>
</html>`;
        
        res.setHeader('Content-Type', 'text/html');
        res.send(htmlContent);
      } catch (err) {
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });

    // Queue management
    this.app.get('/api/queue', async (req, res) => {
      try {
        const stats = await this.service.localQueue.getStats();
        res.json({
          success: true,
          data: stats
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });

    // Test print endpoint
    this.app.post('/api/test-print', (req, res) => {
      try {
        const testData = req.body;
        const orderPrnPath = path.join(this.config.watchFolder, 'order.prn');
        
        // Create test receipt data
        const testReceipt = `TEST RECEIPT
================
Date: ${new Date().toLocaleString()}
Bar ID: ${this.config.barId}
Test Data: ${JSON.stringify(testData)}
================`;

        fs.writeFileSync(orderPrnPath, testReceipt);
        
        res.json({
          success: true,
          message: 'Test print sent to order.prn'
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });

    // Serve static files for Management UI
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../server/public/index.html'));
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    });
  }

  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(resolve);
      });
    }
  }
}

module.exports = SimpleHTTPServer;

4. 