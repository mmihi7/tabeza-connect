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
