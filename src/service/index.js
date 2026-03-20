/***
 * Tabeza POS Connect - RedMon Capture Service v1.7.0
 *
 * Architecture: RedMon Port Monitor Capture
 * ─────────────────────────────────────────────────
 * POS prints to "Tabeza POS Printer"
 *   → RedMon port monitor intercepts print job
 *   → RedMon pipes raw ESC/POS bytes to capture.exe via stdin
 *   → Capture script processes and forwards to physical printer
 *   → Parsed receipts queued for cloud upload
 *
 * This service handles upload queue, template management, and physical printer forwarding.
 * RedMon handles print job interception and capture script invocation.
 *
 * Exit Codes:
 *   0 - Clean shutdown
 *   1 - Fatal startup error
 */

'use strict';

const fs      = require('fs');
const path    = require('path');
const https   = require('https');
const os = require('os');
const express = require('express');

// Use crypto.randomUUID() instead of uuid package to avoid ES Module issues
const { randomUUID } = require('crypto');
const uuidv4 = randomUUID;

// Import service components
const RegistryReader = require('./config/registry-reader');
const ESCPOSProcessor = require('./escposProcessor');
const ReceiptParser = require('./receiptParser');
const LocalQueue = require('./localQueue');
const UploadWorker = require('./uploadWorker');
const HeartbeatService = require('./heartbeat/heartbeat-service');
const PhysicalPrinterAdapter = require('./printer-adapter');
const SpoolWatcher = require('./spool-watcher');
const { forPrefix } = require('../utils/logger');

const svcLog = forPrefix('[SERVICE]');

// ═══════════════════════════════════════════════════════════════════════════════
// INLINED HTTP SERVER - Fixes PKG bundling issue
// This was previously in ../server/simple-http-server.js but PKG couldn't bundle it
// ═══════════════════════════════════════════════════════════════════════════════

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
    
    // Serve static files from public directory
    // In development: src/public
    // In production: process.resourcesPath/public
    const isDev = process.env.NODE_ENV === 'development' || !process.pkg;
    const publicPath = isDev 
      ? path.join(__dirname, '../public')
      : path.join(process.resourcesPath, 'public');
    
    console.log(`[SimpleHTTPServer] Public path: ${publicPath}`);
    console.log(`[SimpleHTTPServer] Public path exists: ${fs.existsSync(publicPath)}`);
    
    if (fs.existsSync(publicPath)) {
      this.app.use(express.static(publicPath));
      console.log(`[SimpleHTTPServer] Serving static files from: ${publicPath}`);
    } else {
      console.warn(`[SimpleHTTPServer] Public directory not found at: ${publicPath}`);
    }

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

    // Start server - EXPLICIT IPv4 binding
    return new Promise((resolve, reject) => {
      console.log(`=== HTTP SERVER: Attempting to bind to 127.0.0.1:${this.port} ===`);
      
      // CRITICAL: Bind to 127.0.0.1 (IPv4 only) instead of localhost (which may resolve to IPv6)
      this.server = this.app.listen(this.port, '127.0.0.1', () => {
        console.log(`=== HTTP SERVER: Successfully started on http://127.0.0.1:${this.port} ===`);
        console.log(`=== HTTP SERVER: All endpoints accessible via IPv4 ===`);
        resolve();
      });
      
      this.server.on('error', (err) => {
        console.error(`=== HTTP SERVER ERROR: ${err.message} ===`);
        console.error(`=== HTTP SERVER ERROR CODE: ${err.code} ===`);
        reject(err);
      });
    });
  }

  setupRoutes() {
    // Status endpoint
    this.app.get('/api/status', async (req, res) => {
      try {
        const stats = await this.service.getStats();
        // Resolve active printer name from adapter
        let printerName = null;
        if (this.service.printerAdapter) {
          const def = this.service.printerAdapter.getDefaultPrinter();
          printerName = def ? def.name : null;
        }
        if (!printerName && this.service.config.printers && this.service.config.printers.length > 0) {
          printerName = this.service.config.printers[0].name;
        }
        res.json({
          success: true,
          barId: this.config.barId,
          apiUrl: this.config.apiUrl,
          printerName,
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
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });

    // Recent logs endpoint — serves from in-memory event ring buffer
    // (always available, contains only key warn/error/ok events)
    this.app.get('/api/logs/recent', async (req, res) => {
      const lines = parseInt(req.query.lines) || 100;
      try {
        // Serve from ring buffer first (always fresh, no file dependency)
        if (EVENT_LOG.length > 0) {
          const recent = EVENT_LOG.slice(-lines);
          return res.json(recent);
        }
        // Fallback: read from log file if ring buffer is empty (e.g. fresh start)
        const logFile = LOG_FILE;
        if (fs.existsSync(logFile)) {
          const content = fs.readFileSync(logFile, 'utf8');
          const allLines = content.split('\n').filter(l => l.trim());
          const recent = allLines.slice(-lines).map(line => {
            const match = line.match(/\[([^\]]+)\]\[(\w+)\]\s*(.*)/);
            if (match) {
              const time = match[1].split('T')[1]?.split('.')[0] || match[1];
              const lvl  = match[2].toLowerCase();
              // Only surface warn/error from file fallback
              if (lvl !== 'warn' && lvl !== 'error') return null;
              return { time, level: lvl, msg: match[3] };
            }
            return null;
          }).filter(Boolean);
          return res.json(recent);
        }
        res.json([]);
      } catch (e) {
        res.json([]);
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

    // Update configuration endpoint
    this.app.post('/api/configure', async (req, res) => {
      try {
        const { barId, apiUrl } = req.body;
        
        if (!barId) {
          return res.status(400).json({
            success: false,
            error: 'Bar ID is required'
          });
        }

        // Update config file under the consolidated TabezaPrints root
        const configPath = 'C:\\TabezaPrints\\config.json';
        let config = {};
        
        if (fs.existsSync(configPath)) {
          config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
        
        config.barId = barId;
        if (apiUrl) {
          config.apiUrl = apiUrl;
        }
        
        // Ensure directory exists
        const configDir = require('path').dirname(configPath);
        if (!fs.existsSync(configDir)) {
          fs.mkdirSync(configDir, { recursive: true });
        }
        
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        
        // Update in-memory config
        this.config.barId = barId;
        if (apiUrl) {
          this.config.apiUrl = apiUrl;
        }
        
        res.json({
          success: true,
          message: 'Configuration updated successfully'
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });

    // Template endpoints
    this.app.get('/api/templates', (req, res) => {
      try {
        const templatePath = path.join('C:\\TabezaPrints\\templates', 'template.json');
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
        const templatesDir = 'C:\\TabezaPrints\\templates';
        
        if (!fs.existsSync(templatesDir)) {
          fs.mkdirSync(templatesDir, { recursive: true });
        }
        
        const templatePath = path.join(templatesDir, 'template.json');
        fs.writeFileSync(templatePath, JSON.stringify(template, null, 2));
        
        // Update service template status
        this.service.templateMissing = false;
        
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
    // Get template capture status - how many samples collected, template exists?
    this.app.get('/api/template/status', (req, res) => {
      try {
        // Count text\ files — raw\ is emptied by SpoolWatcher after forwarding
        const textDir = path.join(DATA_DIR, 'text');
        const capturedReceipts = fs.existsSync(textDir)
          ? fs.readdirSync(textDir).filter(f => f.endsWith('.txt')).length
          : 0;

        const templatePath = path.join(DATA_DIR, 'templates', 'template.json');
        const templateGenerated = fs.existsSync(templatePath);

        res.json({
          success: true,
          capturedReceipts,
          templateGenerated,
          templateMissing: this.service.templateMissing
        });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Return actual sample receipt texts for the tray template wizard
    this.app.get('/api/template/samples', (req, res) => {
      try {
        const textDir = path.join(DATA_DIR, 'text');
        const samples = [];
        if (fs.existsSync(textDir)) {
          const files = fs.readdirSync(textDir).filter(f => f.endsWith('.txt'));
          for (const f of files) {
            try {
              const content = fs.readFileSync(path.join(textDir, f), 'utf8').trim();
              if (content) samples.push({ filename: f, content, text: content });
            } catch { /* skip unreadable files */ }
          }
        }
        res.json({ success: true, samples });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message, samples: [] });
      }
    });

    this.app.post('/api/template/generate', async (req, res) => {
      try {
        let { receipts } = req.body;

        // If no receipts passed, load from text\ folder
        if (!receipts || receipts.length < 3) {
          const textDir = path.join(DATA_DIR, 'text');
          if (fs.existsSync(textDir)) {
            const files = fs.readdirSync(textDir).filter(f => f.endsWith('.txt'));
            receipts = files.map(f => {
              const content = fs.readFileSync(path.join(textDir, f), 'utf8');
              return content.trim();
            });
          }
        }
        
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
        
        // Cloud API expects { test_receipts, bar_id } — match the staff app contract
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            test_receipts: receipts,
            bar_id: this.config.barId
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

        // Save template to the correct path that the local parser reads from
        const TEMPLATE_SAVE_PATH = 'C:\\TabezaPrints\\templates\\template.json';
        const templateDir = path.dirname(TEMPLATE_SAVE_PATH);
        if (!fs.existsSync(templateDir)) {
          fs.mkdirSync(templateDir, { recursive: true });
        }

        fs.writeFileSync(TEMPLATE_SAVE_PATH, JSON.stringify(template, null, 2), 'utf8');

        // Update service template status
        this.service.templateMissing = false;

        // Backfill the 3 sample receipts that were held back during setup
        // Now that we have a template, parse and enqueue them
        try {
          await this.service.backfillTextFiles();
        } catch (backfillErr) {
          console.warn('[SimpleHTTPServer] Backfill after template generation failed:', backfillErr.message);
        }

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

    // Printer status endpoint
    this.app.get('/api/printer/status', async (req, res) => {
      try {
        // Check if Tabeza POS Printer exists using PowerShell
        const { exec } = require('child_process');
        const util = require('util');
        const execPromise = util.promisify(exec);
        
        try {
          const { stdout } = await execPromise('powershell -Command "Get-Printer -Name \'Tabeza POS Printer\' -ErrorAction SilentlyContinue | Select-Object Name, DriverName, PortName | ConvertTo-Json"');
          
          if (stdout && stdout.trim()) {
            const printerInfo = JSON.parse(stdout);
            res.json({
              success: true,
              status: 'configured',
              printer: {
                name: printerInfo.Name,
                driver: printerInfo.DriverName,
                port: printerInfo.PortName
              }
            });
          } else {
            res.json({
              success: true,
              status: 'not_configured',
              message: 'Tabeza POS Printer not found'
            });
          }
        } catch (psError) {
          res.json({
            success: true,
            status: 'not_configured',
            message: 'Printer check failed or printer not found'
          });
        }
      } catch (err) {
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });

    // Template HTML page
    this.app.get('/template.html', (req, res) => {
      try {
        const htmlContent = `<!DOCTYPE html>
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

    // Queue stats alias — used by tray _buildStatusPayload and pipeline node
    this.app.get('/api/queue-stats', async (req, res) => {
      try {
        const stats = await this.service.localQueue.getStats();
        const uploadStats = this.service.uploadWorker
          ? await this.service.uploadWorker.getStats()
          : null;

        // Count text\ files waiting (captured but not yet enqueued)
        const textDir = path.join(DATA_DIR, 'text');
        const textFiles = fs.existsSync(textDir)
          ? fs.readdirSync(textDir).filter(f => f.endsWith('.txt')).length
          : 0;

        res.json({
          success: true,
          pending:   stats.pending  || 0,
          uploaded:  stats.uploaded || 0,
          failed:    stats.failed   || 0,
          total:     stats.total    || 0,
          textFiles,
          upload: uploadStats ? {
            isOnline:         uploadStats.isOnline,
            uploadsSucceeded: uploadStats.uploadsSucceeded,
            uploadsFailed:    uploadStats.uploadsFailed,
            lastSuccess:      uploadStats.lastUploadSuccess,
            lastError:        uploadStats.lastError,
          } : null,
        });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message, pending: 0, uploaded: 0, failed: 0 });
      }
    });

    // List all installed Windows printers
    this.app.get('/api/printers/windows', async (req, res) => {
      try {
        const { exec } = require('child_process');
        const util = require('util');
        const execPromise = util.promisify(exec);
        const { stdout } = await execPromise(
          'powershell -Command "Get-Printer | Select-Object Name | ConvertTo-Json -Compress"',
          { timeout: 8000 }
        );
        let names = [];
        if (stdout && stdout.trim()) {
          const parsed = JSON.parse(stdout.trim());
          const arr = Array.isArray(parsed) ? parsed : [parsed];
          names = arr.map(p => p.Name).filter(Boolean);
        }
        res.json({ success: true, printers: names });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message, printers: [] });
      }
    });

    // Select / save a printer as the default
    this.app.post('/api/printers/select', async (req, res) => {
      try {
        const { printerName } = req.body;
        if (!printerName) {
          return res.status(400).json({ success: false, error: 'printerName is required' });
        }

        // Paths to update — project-root config.json (dev) and TabezaPrints (prod)
        const configPaths = [
          path.join(process.cwd(), 'config.json'),
          'C:\\TabezaPrints\\config.json'
        ];

        for (const configPath of configPaths) {
          try {
            let cfg = {};
            if (fs.existsSync(configPath)) {
              cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            }
            cfg.printers = [{
              name: printerName,
              type: 'windows',
              enabled: true,
              isDefault: true,
              timeout: 5000
            }];
            const dir = path.dirname(configPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8');
          } catch (_) { /* skip paths we can't write */ }
        }

        // Hot-reload the printer adapter
        if (this.service.printerAdapter) {
          this.service.config.printers = [{
            name: printerName, type: 'windows', enabled: true, isDefault: true, timeout: 5000
          }];
          await this.service.printerAdapter.stop();
          this.service.printerAdapter = new PhysicalPrinterAdapter(this.service.config);
          await this.service.printerAdapter.start();
        }

        res.json({ success: true, message: `Printer set to: ${printerName}` });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    });

    // Printer detection endpoint
    this.app.get('/api/printers/detect', async (req, res) => {
      try {
        if (!this.service.printerAdapter) {
          return res.status(503).json({
            success: false,
            error: 'Printer adapter not initialized'
          });
        }
        
        const printers = await this.service.printerAdapter.detectPrinters();
        res.json({
          success: true,
          data: printers
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });

    // Get configured printers
    this.app.get('/api/printers', async (req, res) => {
      try {
        if (!this.service.printerAdapter) {
          return res.status(503).json({
            success: false,
            error: 'Printer adapter not initialized'
          });
        }
        
        const stats = this.service.printerAdapter.getStats();
        const queue = this.service.printerAdapter.getQueue();
        
        res.json({
          success: true,
          data: {
            stats,
            queueDepth: queue.length,
            printers: Array.from(this.service.printerAdapter.printers.entries()).map(([name, printer]) => ({
              name,
              type: printer.config.type,
              enabled: printer.enabled,
              isDefault: printer.isDefault
            }))
          }
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
        
        // Create test receipt data
        const testReceipt = `TEST RECEIPT
================
Date: ${new Date().toLocaleString()}
Bar ID: ${this.config.barId}
Test Data: ${JSON.stringify(testData)}
================`;

        // For RedMon mode, just return success (capture.exe handles test prints)
        res.json({
          success: true,
          message: 'RedMon capture ready - test prints will be processed by capture.exe'
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });

    // Test printer endpoint
    this.app.post('/api/printers/test', async (req, res) => {
      try {
        if (!this.service.printerAdapter) {
          return res.status(503).json({
            success: false,
            error: 'Printer adapter not initialized'
          });
        }
        
        const { printerName } = req.body;
        
        if (!printerName) {
          return res.status(400).json({
            success: false,
            error: 'Printer name is required'
          });
        }
        
        // Create test print job
        const testData = Buffer.from(`
TEST PRINT
==========
Date: ${new Date().toLocaleString()}
Printer: ${printerName}
Bar ID: ${this.config.barId}
==========
`);
        
        const testJob = {
          jobId: `test-${Date.now()}`,
          rawData: testData,
          timestamp: new Date().toISOString()
        };
        
        this.service.printerAdapter.enqueueJob(testJob);
        
        res.json({
          success: true,
          message: `Test print queued for ${printerName}`
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });

    // Configure printer endpoint
    this.app.post('/api/printers/configure', async (req, res) => {
      try {
        const { printers } = req.body;
        
        if (!printers || !Array.isArray(printers)) {
          return res.status(400).json({
            success: false,
            error: 'Printers array is required'
          });
        }
        
        // Update config file
        const configPath = 'C:\\ProgramData\\Tabeza\\config.json';
        let config = {};
        
        if (fs.existsSync(configPath)) {
          config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
        
        config.printers = printers;
        
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        
        // Restart printer adapter to reload config
        if (this.service.printerAdapter) {
          await this.service.printerAdapter.stop();
          await this.service.printerAdapter.start();
        }
        
        res.json({
          success: true,
          message: 'Printer configuration updated successfully'
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });

    // Get forwarding queue
    this.app.get('/api/queue/forward', async (req, res) => {
      try {
        if (!this.service.printerAdapter) {
          return res.status(503).json({
            success: false,
            error: 'Printer adapter not initialized'
          });
        }
        
        const queue = this.service.printerAdapter.getQueue();
        
        res.json({
          success: true,
          data: {
            queueDepth: queue.length,
            jobs: queue.map(job => ({
              jobId: job.jobId,
              timestamp: job.timestamp,
              forwardAttempts: job.forwardAttempts || 0,
              lastForwardError: job.lastForwardError || null
            }))
          }
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });

    // Retry failed jobs
    this.app.post('/api/queue/retry', async (req, res) => {
      try {
        if (!this.service.printerAdapter) {
          return res.status(503).json({
            success: false,
            error: 'Printer adapter not initialized'
          });
        }
        
        // Clear queue and reload from failed folder
        const failedDir = path.join('C:\\TabezaPrints', 'failed_prints');
        
        if (!fs.existsSync(failedDir)) {
          return res.json({
            success: true,
            message: 'No failed jobs to retry',
            retriedCount: 0
          });
        }
        
        const files = fs.readdirSync(failedDir);
        let retriedCount = 0;
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            try {
              const filePath = path.join(failedDir, file);
              const jobData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
              
              // Reset retry count
              jobData.forwardAttempts = 0;
              jobData.lastForwardError = null;
              
              // Re-enqueue
              this.service.printerAdapter.enqueueJob(jobData);
              
              // Delete from failed folder
              fs.unlinkSync(filePath);
              
              retriedCount++;
            } catch (err) {
              console.error(`Failed to retry job ${file}:`, err.message);
            }
          }
        }
        
        res.json({
          success: true,
          message: `Retried ${retriedCount} failed job(s)`,
          retriedCount
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });

    // Root endpoint
    this.app.get('/', (req, res) => {
      const publicIndex = path.join(__dirname, 'public', 'index.html');
      if (fs.existsSync(publicIndex)) {
        res.sendFile(publicIndex);
      } else {
        res.json({
          success: true,
          message: 'Tabeza Connect API Server',
          version: '1.7.0',
          endpoints: [
            'GET  /api/status',
            'GET  /api/config',
            'GET  /api/templates',
            'POST /api/templates',
            'POST /api/template/generate',
            'GET  /template.html',
            'GET  /api/queue',
            'POST /api/test-print'
          ]
        });
      }
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

// ═══════════════════════════════════════════════════════════════════════════════
// END INLINED HTTP SERVER
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Constants ────────────────────────────────────────────────────────────────

const DATA_DIR      = 'C:\\TabezaPrints';
const CONFIG_PATH   = path.join(DATA_DIR, 'config.json');
const LOG_DIR       = path.join(DATA_DIR, 'logs');
const LOG_FILE      = path.join(LOG_DIR, 'service.log');
const QUEUE_DIR     = path.join(DATA_DIR, 'queue');
const TEMPLATES_DIR = path.join(DATA_DIR, 'templates');

// ─── Logging ──────────────────────────────────────────────────────────────────

function ensureLogDir() {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch (_) {}
}

// ─── In-memory event ring buffer (tray log tab reads this) ───────────────────
// Holds the last 200 key events. Only warn/error/ok/step go here — not noisy
// INFO lines — so the tray log shows only what matters.
const EVENT_LOG = [];
const EVENT_LOG_MAX = 200;

function pushEvent(level, message) {
  const ts = new Date().toISOString();
  const time = ts.split('T')[1].split('.')[0]; // HH:MM:SS
  EVENT_LOG.push({ time, level: level.toLowerCase(), msg: message });
  if (EVENT_LOG.length > EVENT_LOG_MAX) EVENT_LOG.shift();
}

function log(level, message) {
  const ts   = new Date().toISOString();
  const line = `[${ts}][${level}] ${message}`;
  console.log(line);
  try {
    ensureLogDir();
    fs.appendFileSync(LOG_FILE, line + '\n', 'utf8');
  } catch (_) {}
  // Push warn/error to the event ring buffer so the tray log tab sees them
  if (level === 'WARN' || level === 'ERROR') {
    pushEvent(level, message);
  }
}

log('INFO', '--- INDEX.JS WAS LOADED (INLINE HTTP SERVER VERSION) ---');

const info  = (m) => { log('INFO',  m); svcLog.info(m); };
const warn  = (m) => { log('WARN',  m); svcLog.warn(m); };
const error = (m) => { log('ERROR', m); svcLog.error(m); };

// ok() — key success events (receipt parsed, uploaded, template generated, etc.)
// These go to the event ring buffer AND the log file so the tray log tab shows them.
const ok = (m) => {
  log('INFO', `✅ ${m}`);
  pushEvent('ok', m);
  svcLog.ok(m);
};

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
    this.isRunning = false;
    this.jobsProcessed = 0;
    this.templateMissing = false; // Track template status (Requirement 15A)
    
    // Initialize components
    this.escposProcessor = new ESCPOSProcessor();
    this.receiptParser = new ReceiptParser();
    this.localQueue = new LocalQueue();
    this.uploadWorker = null;
    this.heartbeatService = null;
    this.httpServer = null;
    this.printerAdapter = null;
    this.spoolWatcher = null;
  }

  async start() {
    info('========================================');
    info('Tabeza POS Connect - RedMon Capture Service v1.7.0');
    info('*** REDMON PORT MONITOR VERSION ***');
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

    info('All components started. Service ready.');
  }

  async createDirectories() {
    const directories = [
      this.config.watchFolder,
      QUEUE_DIR,
      path.join(QUEUE_DIR, 'pending'),
      path.join(QUEUE_DIR, 'uploaded'),
      LOG_DIR,
      TEMPLATES_DIR,
      path.join(DATA_DIR, 'raw'),
      path.join(DATA_DIR, 'processed'),
      path.join(DATA_DIR, 'text'),
      path.join(DATA_DIR, 'failed'),
      path.join(DATA_DIR, 'failed_prints'),
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
      // Check for template existence (Requirement 15A.1)
      const templatePath = path.join('C:\\TabezaPrints', 'templates', 'template.json');
      const templateExists = fs.existsSync(templatePath);
      
      if (!templateExists) {
        warn('⚠️  WARNING: No receipt template found - receipts will be captured but not parsed');
        warn('⚠️  Setup Required: Generate receipt template to enable cloud integration');
        this.templateMissing = true;
      } else {
        info('✅ Receipt template found');
        this.templateMissing = false;
      }

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

      // Initialize PhysicalPrinterAdapter
      try {
        this.printerAdapter = new PhysicalPrinterAdapter(this.config);
        await this.printerAdapter.start();
        info('✅ PhysicalPrinterAdapter started');
          } catch (printerError) {
        error(`Failed to initialize PhysicalPrinterAdapter: ${printerError.message}`);
        error(`PhysicalPrinterAdapter stack: ${printerError.stack}`);
        // Log the full error object
        console.error('[PhysicalPrinterAdapter] Full error:', printerError);
        // Continue without PhysicalPrinterAdapter - service will still work for file monitoring
        this.printerAdapter = null;
      }
      
      // Backfill: enqueue any text\ files that were captured but never uploaded
      // (e.g. from a previous run before the upload pipeline was wired up)
      await this.backfillTextFiles();

      // Initialize SpoolWatcher — watches raw\ for .prn files written by capture.exe
      // On forwardJob event, enqueues job to PhysicalPrinterAdapter for EPSON L3210 printing
      try {
        this.spoolWatcher = new SpoolWatcher({
          spoolFolder: path.join(DATA_DIR, 'raw'),
          stabilizationDelay: 500,
          filePattern: /\.prn$/i
        });

        this.spoolWatcher.on('forwardJob', async (job) => {
          info(`🔄 forwardJob received: jobId=${job.jobId}, spoolFile=${job.spoolFile}, size=${job.size} bytes`);
          
          // 1. Forward raw bytes to physical printer
          if (this.printerAdapter) {
            info(`Receipt captured → forwarding to printer (jobId=${job.jobId})`);
            this.printerAdapter.enqueueJob(job);
          } else {
            warn(`Printer not configured — receipt captured but not printed (jobId=${job.jobId})`);
          }

          // 2. Strip ESC/POS bytes → plain text → save to text\
          //    FLOW:
          //    - Receipts 1-3: saved to text\ as template samples (no upload yet)
          //    - Receipt 4+:   parsed locally with template, then enqueued for cloud upload
          try {
            const plainText = this.escposProcessor.convertToText(job.rawData);
            if (!plainText || !plainText.trim()) {
              warn(`Empty receipt data for job ${job.jobId} — skipped`);
              return;
            }

            // Save a copy to text\ (used as template generation samples)
            const textDir = path.join(DATA_DIR, 'text');
            if (!fs.existsSync(textDir)) fs.mkdirSync(textDir, { recursive: true });
            const textFile = path.join(textDir, `${job.jobId}.txt`);
            fs.writeFileSync(textFile, plainText, 'utf8');

            // Count how many text samples we have so far
            const sampleCount = fs.readdirSync(textDir).filter(f => f.endsWith('.txt')).length;
            const templatePath = path.join(TEMPLATES_DIR, 'template.json');
            const templateExists = fs.existsSync(templatePath);

            if (!templateExists && sampleCount <= 3) {
              // Still collecting samples — do NOT upload yet
              ok(`Sample ${sampleCount}/3 captured — print 3 different receipts to generate template`);
              this.templateMissing = true;
              return;
            }

            // Template exists (or we have >3 samples somehow) — parse locally then upload
            let parsedData = null;
            if (templateExists) {
              try {
                // Reload template if needed
                if (!this.receiptParser.stats.templateLoaded) {
                  await this.receiptParser.loadTemplate();
                }
                const parseResult = await this.receiptParser.parse(plainText);
                if (parseResult.success) {
                  parsedData = parseResult.data;
                  ok(`Receipt parsed (confidence: ${parseResult.confidence}%) — queued for upload`);
                } else {
                  warn(`Receipt parse failed: ${parseResult.errors.join(', ')} — uploading raw text`);
                }
              } catch (parseErr) {
                warn(`Receipt parse error: ${parseErr.message} — uploading raw text`);
              }
            }

            // Enqueue for cloud upload
            await this.localQueue.enqueue({
              barId:     this.config.barId,
              deviceId:  this.config.driverId,
              timestamp: job.capturedAt || new Date().toISOString(),
              text:      plainText,
              parsedData,
              metadata: {
                source:      'spool-watcher',
                jobId:       job.jobId,
                spoolFile:   job.spoolFileName,
                archiveFile: job.archiveFile,
                sizeBytes:   job.size,
                parsed:      !!parsedData,
              }
            });
            ok(`Receipt queued for upload (parsed=${!!parsedData})`);
          } catch (enqueueErr) {
            error(`Failed to process receipt (jobId=${job.jobId}): ${enqueueErr.message}`);
          }
        });

        this.spoolWatcher.on('error', (err) => {
          const msg = err && err.error ? err.error : (err.message || String(err));
          warn(`SpoolWatcher error: ${msg}`);
        });

        await this.spoolWatcher.start();
        info('✅ SpoolWatcher started (watching raw\\ for .prn files)');
      } catch (spoolErr) {
        error(`Failed to initialize SpoolWatcher: ${spoolErr.message}`);
        this.spoolWatcher = null;
      }

      // Start HTTP server (NOW INLINED - PKG WILL BUNDLE THIS)
      this.httpServer = new SimpleHTTPServer(this.config, this);
      try {
        await this.httpServer.start();
        info('✅ HTTP server started (INLINE VERSION)');
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

  async stop() {
    info('Stopping Tabeza POS Connect RedMon Service...');
    this.isRunning = false;

    // Stop SpoolWatcher
    if (this.spoolWatcher) {
      try {
        await this.spoolWatcher.stop();
        info('SpoolWatcher stopped');
      } catch (err) {
        warn(`Error stopping SpoolWatcher: ${err.message}`);
      }
    }

    // Stop PhysicalPrinterAdapter
    if (this.printerAdapter) {
      try {
        await this.printerAdapter.stop();
        info('PhysicalPrinterAdapter stopped');
      } catch (err) {
        warn(`Error stopping PhysicalPrinterAdapter: ${err.message}`);
      }
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

  /**
   * Backfill: enqueue any text\ files that have no corresponding pending queue entry.
   * Only runs if a template already exists — text\ files before template generation
   * are samples, not receipts to upload.
   */
  async backfillTextFiles() {
    const textDir = path.join(DATA_DIR, 'text');
    if (!fs.existsSync(textDir)) return;

    const templatePath = path.join(TEMPLATES_DIR, 'template.json');
    if (!fs.existsSync(templatePath)) {
      // No template yet — text\ files are setup samples, not upload candidates
      const sampleCount = fs.readdirSync(textDir).filter(f => f.endsWith('.txt')).length;
      if (sampleCount > 0) {
        info(`Backfill skipped: ${sampleCount} sample(s) in text\\ waiting for template generation`);
      }
      return;
    }

    const textFiles = fs.readdirSync(textDir).filter(f => f.endsWith('.txt'));
    if (textFiles.length === 0) return;

    // Get IDs already in the pending queue to avoid duplicates
    const pendingDir = path.join(DATA_DIR, 'queue', 'pending');
    const pendingContents = fs.existsSync(pendingDir) ? fs.readdirSync(pendingDir) : [];

    const alreadyQueued = new Set();
    for (const qf of pendingContents) {
      try {
        const item = JSON.parse(fs.readFileSync(path.join(pendingDir, qf), 'utf8'));
        if (item.metadata && item.metadata.textFile) alreadyQueued.add(item.metadata.textFile);
      } catch (_) {}
    }

    let backfilled = 0;
    for (const file of textFiles) {
      if (alreadyQueued.has(file)) continue;

      try {
        const text = fs.readFileSync(path.join(textDir, file), 'utf8').trim();
        if (!text) continue;

        // Parse locally before backfilling
        let parsedData = null;
        try {
          const parseResult = await this.receiptParser.parse(text);
          if (parseResult.success) parsedData = parseResult.data;
        } catch (_) {}

        await this.localQueue.enqueue({
          barId:    this.config.barId,
          deviceId: this.config.driverId,
          timestamp: new Date().toISOString(),
          text,
          parsedData,
          metadata: { source: 'backfill', textFile: file, parsed: !!parsedData }
        });
        backfilled++;
        info(`Backfilled text file into queue: ${file}`);
      } catch (err) {
        warn(`Backfill failed for ${file}: ${err.message}`);
      }
    }

    if (backfilled > 0) {
      info(`Backfill complete: ${backfilled} receipt(s) enqueued for upload`);
    }
  }

  // Get service statistics
  async getStats() {
    const queueStats = await this.localQueue.getStats();
    const uploadStats = await this.uploadWorker?.getStats();
    const parserStats = this.receiptParser.getStats();
    const escposStats = this.escposProcessor.getStats();
    const spoolStats = this.spoolWatcher ? this.spoolWatcher.getStats() : null;

    return {
      service: {
        isRunning: this.isRunning,
        jobsProcessed: this.jobsProcessed,
        uptime: process.uptime(),
        version: '1.7.0-inline-http'
      },
      queue: queueStats,
      upload: uploadStats,
      parser: parserStats,
      escpos: escposStats,
      spool: spoolStats
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


