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

// ─── Constants ────────────────────────────────────────────────────────────────

const DATA_DIR      = 'C:\\ProgramData\\Tabeza';
const CONFIG_PATH   = path.join(DATA_DIR, 'config.json');
const LOG_DIR       = path.join(DATA_DIR, 'logs');
const LOG_FILE      = path.join(LOG_DIR, 'service.log');

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

const info  = (m) => log('INFO',  m);
const warn  = (m) => log('WARN',  m);
const error = (m) => log('ERROR', m);

// ─── Config ───────────────────────────────────────────────────────────────────

function loadConfig() {
  const defaults = {
    barId:         process.env.TABEZA_BAR_ID        || '',
    apiUrl:        process.env.TABEZA_API_URL        || 'https://tabeza.co.ke',
    watchFolder:   process.env.TABEZA_WATCH_FOLDER  || path.join(DATA_DIR, 'TabezaPrints'),
  };

  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw    = fs.readFileSync(CONFIG_PATH, 'utf8').replace(/^\uFEFF/, '');
      const parsed = JSON.parse(raw);
      return {
        barId:       parsed.barId       || defaults.barId,
        apiUrl:      parsed.apiUrl      || defaults.apiUrl,
        watchFolder: parsed.watchFolder || defaults.watchFolder,
      };
    }
  } catch (err) {
    warn(`Config read failed, using env/defaults: ${err.message}`);
  }

  return defaults;
}

// ─── Cloud Upload ─────────────────────────────────────────────────────────────

function uploadToCloud(config, data, filename) {
  return new Promise((resolve, reject) => {
    if (!config.barId) {
      warn('No barId configured — skipping cloud upload');
      return resolve();
    }

    const payload = JSON.stringify({
      barId:     config.barId,
      timestamp: new Date().toISOString(),
      filename:  filename,
      rawData:   data.toString('base64'),
      source:    'pooling-capture',
    });

    const url     = new URL('/api/receipts', config.apiUrl);
    const options = {
      hostname: url.hostname,
      port:     url.port || 443,
      path:     url.pathname,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    info(`Uploading ${data.length} bytes to ${config.apiUrl}/api/receipts`);

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          info(`Upload OK (HTTP ${res.statusCode})`);
          resolve();
        } else {
          warn(`Upload failed: HTTP ${res.statusCode} — ${body.slice(0, 200)}`);
          resolve(); // non-fatal: log and continue
        }
      });
    });

    req.on('error', (err) => {
      warn(`Upload network error: ${err.message}`);
      resolve(); // non-fatal: log and continue
    });

    req.setTimeout(15000, () => {
      warn('Upload timed out after 15s');
      req.destroy();
      resolve();
    });

    req.write(payload);
    req.end();
  });
}

// ─── Capture Service ──────────────────────────────────────────────────────────

class PoolingCaptureService {
  constructor() {
    this.config          = loadConfig();
    this.watcher         = null;
    this.processingFiles = new Set();
    this.isRunning       = false;
    this.jobsProcessed   = 0;
  }

  start() {
    info('========================================');
    info('Tabeza POS Connect - Pooling Capture v1.7.0');
    info('========================================');
    info(`Bar ID      : ${this.config.barId || '(not set — check config.json or TABEZA_BAR_ID)'}`);
    info(`API URL     : ${this.config.apiUrl}`);
    info(`Watch Folder: ${this.config.watchFolder}`);
    info('Mode        : Windows Printer Pooling (no bridge, no forwarding)');
    info('========================================');

    if (!this.config.barId) {
      warn('WARNING: barId is not set. Receipts will be captured locally but upload will be skipped.');
      warn('Set TABEZA_BAR_ID environment variable or add barId to C:\\ProgramData\\Tabeza\\config.json');
    }

    // Ensure capture folder exists
    try {
      if (!fs.existsSync(this.config.watchFolder)) {
        fs.mkdirSync(this.config.watchFolder, { recursive: true });
        info(`Created watch folder: ${this.config.watchFolder}`);
      }
    } catch (err) {
      error(`Cannot create watch folder: ${err.message}`);
      process.exit(1);
    }

    // Signal ready to Windows SCM before starting watcher
    // (SCM requires startup signal within 30s — watcher init is fast but this is defensive)
    this.isRunning = true;
    info('Service signaled ready to Windows SCM');

    // Start watching immediately
    setImmediate(() => this._startWatcher());
  }

  _startWatcher() {
    const folder = this.config.watchFolder;
    info(`Starting folder watcher: ${folder}`);

    // Watch for new files AND overwrites of existing files.
    // Pooling folder ports typically overwrite a single fixed file (e.g. order.prn)
    // on each print job. Chokidar 'add' won't fire for overwrites — we need 'change' too.
    this.watcher = chokidar.watch(folder, {
      persistent:    true,
      ignoreInitial: true,
      depth:         0,                     // only top-level files, not subfolders
      awaitWriteFinish: {
        stabilityThreshold: 1500,         // wait 1.5s after last write before processing
        pollInterval:       300,
      },
    });

    this.watcher.on('add',   (fp) => this._onFile(fp));
    this.watcher.on('change',(fp) => this._onFile(fp));
    this.watcher.on('error', (err) => error(`Watcher error: ${err.message}`));

    info(`Watching: ${folder}`);
    info('Ready. Waiting for print jobs from Tabeza POS Printer...');
  }

  async _onFile(filePath) {
    // Skip subfolders and non-print files
    try {
      if (fs.statSync(filePath).isDirectory()) return;
    } catch (_) { return; }

    const ext = path.extname(filePath).toLowerCase();
    if (['.txt', '.md', '.json', '.log'].includes(ext)) return;

    // Skip if already being processed (handles rapid double-fire)
    if (this.processingFiles.has(filePath)) {
      info(`Already processing: ${path.basename(filePath)}`);
      return;
    }

    this.processingFiles.add(filePath);

    try {
      info(`New print job: ${path.basename(filePath)}`);

      const data = fs.readFileSync(filePath);
      if (!data || data.length === 0) {
        info('Empty file — skipping');
        return;
      }

      info(`Job size: ${data.length} bytes`);
      this.jobsProcessed++;

      // Upload to cloud (non-blocking — errors are logged, not thrown)
      await uploadToCloud(this.config, data, path.basename(filePath));

      // Move to processed subfolder
      const processedDir = path.join(this.config.watchFolder, 'processed');
      try {
        if (!fs.existsSync(processedDir)) fs.mkdirSync(processedDir, { recursive: true });

        const dest = path.join(processedDir, `${Date.now()}_${path.basename(filePath)}`);

        // For the fixed-name port file (order.prn), copy then truncate rather than move
        // so the port file always exists for the next print job
        fs.copyFileSync(filePath, dest);
        fs.writeFileSync(filePath, Buffer.alloc(0)); // truncate to 0 bytes

        info(`Archived to: processed/${path.basename(dest)}`);
      } catch (archiveErr) {
        warn(`Could not archive file (non-fatal): ${archiveErr.message}`);
      }

      info(`Job complete. Total processed: ${this.jobsProcessed}`);

    } catch (err) {
      error(`Failed to process ${path.basename(filePath)}: ${err.message}`);

      // Move to failed subfolder
      const failedDir = path.join(this.config.watchFolder, 'failed');
      try {
        if (!fs.existsSync(failedDir)) fs.mkdirSync(failedDir, { recursive: true });
        const dest = path.join(failedDir, `${Date.now()}_${path.basename(filePath)}`);
        fs.copyFileSync(filePath, dest);
        fs.writeFileSync(filePath, Buffer.alloc(0));
      } catch (_) {}

    } finally {
      this.processingFiles.delete(filePath);
    }
  }

  stop() {
    info('Stopping Tabeza POS Connect...');
    this.isRunning = false;

    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    info(`Stopped. Total jobs processed this session: ${this.jobsProcessed}`);
  }
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

// Signal ready to Windows SCM BEFORE anything else (guards against slow startup)
if (process.send) {
  process.send({ type: 'started', message: 'Tabeza POS Connect starting' });
}

const service = new PoolingCaptureService();
service.start();

const shutdown = (sig) => {
  info(`${sig} received — shutting down`);
  service.stop();
  process.exit(0);
};

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
  error(`Uncaught exception: ${err.message}\n${err.stack}`);
  service.stop();
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  error(`Unhandled rejection: ${reason}`);
});
