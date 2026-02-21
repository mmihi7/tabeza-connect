/**
 * Windows Print Spooler Monitor
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 * 
 * This module monitors the Windows print spooler directory and passively
 * captures receipt data AFTER it has been sent to the printer.
 * 
 * POS → Printer (instant, zero latency)
 *      └─> Windows Spooler → TabezaConnect watches here (passive)
 * 
 * The printer never knows Tabeza exists. The POS never knows Tabeza exists.
 * This is why it's called a "driver/capture service" - it integrates at the
 * OS print layer, not the application layer.
 * 
 * Requirements: 3.1, 3.2, 3.3
 */

const chokidar = require('chokidar');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const ESCPOSProcessor = require('./escposProcessor');

// Windows print spooler directory
const SPOOL_PATH = 'C:\\Windows\\System32\\spool\\PRINTERS';

// File detection latency requirement: 500ms
const DETECTION_LATENCY_MS = 500;

// Polling fallback interval if file watcher fails
const POLLING_INTERVAL_MS = 1000;

// File stability check parameters
const STABILITY_THRESHOLD_MS = 2000; // Wait 2s for file write completion
const STABILITY_POLL_INTERVAL_MS = 100; // Check every 100ms

class SpoolMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.spoolPath = options.spoolPath || SPOOL_PATH;
    this.fileTypes = options.fileTypes || ['.SPL', '.SHD'];
    this.pollInterval = options.pollInterval || POLLING_INTERVAL_MS;
    this.detectionLatency = options.detectionLatency || DETECTION_LATENCY_MS;
    
    this.watcher = null;
    this.pollingInterval = null;
    this.isRunning = false;
    this.usePollingFallback = false;
    this.processedFiles = new Set(); // Track processed files to avoid duplicates
    
    // ESC/POS processor
    this.escposProcessor = new ESCPOSProcessor();
    
    // Statistics
    this.stats = {
      filesDetected: 0,
      filesProcessed: 0,
      permissionErrors: 0,
      processingErrors: 0,
      lastDetection: null,
      lastError: null,
    };
  }
  
  /**
   * Start monitoring the print spooler directory
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Spool monitor already running');
      return;
    }
    
    console.log('🚀 Starting Windows print spooler monitor...');
    console.log(`   Monitoring: ${this.spoolPath}`);
    console.log(`   File types: ${this.fileTypes.join(', ')}`);
    console.log('');
    
    // Check if spooler directory exists and is accessible
    try {
      await this.checkSpoolerAccess();
    } catch (error) {
      console.error('❌ Cannot access print spooler directory:', error.message);
      
      if (error.code === 'EACCES') {
        console.error('');
        console.error('╔═══════════════════════════════════════════════════════════╗');
        console.error('║                                                           ║');
        console.error('║   ❌ PERMISSION DENIED                                    ║');
        console.error('║                                                           ║');
        console.error('║   TabezaConnect needs Administrator privileges to        ║');
        console.error('║   access the Windows print spooler directory.            ║');
        console.error('║                                                           ║');
        console.error('║   To fix this:                                           ║');
        console.error('║   1. Stop the service                                    ║');
        console.error('║   2. Run as Administrator                                ║');
        console.error('║   3. Or install as Windows Service (recommended)         ║');
        console.error('║                                                           ║');
        console.error('╚═══════════════════════════════════════════════════════════╝');
        console.error('');
        
        // Continue with polling fallback (will log errors but not crash)
        this.usePollingFallback = true;
      } else if (error.code === 'ENOENT') {
        console.error('');
        console.error('╔═══════════════════════════════════════════════════════════╗');
        console.error('║                                                           ║');
        console.error('║   ❌ PRINT SPOOLER DIRECTORY NOT FOUND                   ║');
        console.error('║                                                           ║');
        console.error('║   The Windows print spooler directory does not exist.    ║');
        console.error('║   This is a critical system error.                       ║');
        console.error('║                                                           ║');
        console.error('║   To fix this:                                           ║');
        console.error('║   1. Check Windows Print Spooler service is running     ║');
        console.error('║   2. Run: services.msc                                   ║');
        console.error('║   3. Find "Print Spooler" and start it                  ║');
        console.error('║                                                           ║');
        console.error('╚═══════════════════════════════════════════════════════════╝');
        console.error('');
        
        // Fatal error - cannot continue
        throw error;
      }
    }
    
    // Try to start file watcher
    try {
      await this.startFileWatcher();
      this.isRunning = true;
      console.log('✅ Spool monitor started successfully (file watcher mode)');
    } catch (error) {
      console.warn('⚠️  File watcher failed, falling back to polling mode');
      console.warn(`   Error: ${error.message}`);
      this.usePollingFallback = true;
      await this.startPolling();
      this.isRunning = true;
      console.log('✅ Spool monitor started successfully (polling mode)');
    }
  }
  
  /**
   * Stop monitoring
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }
    
    console.log('🛑 Stopping spool monitor...');
    
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    this.isRunning = false;
    console.log('✅ Spool monitor stopped');
  }
  
  /**
   * Check if we have access to the spooler directory
   */
  async checkSpoolerAccess() {
    try {
      await fs.access(this.spoolPath, fsSync.constants.R_OK);
      return true;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Start file watcher using chokidar
   */
  async startFileWatcher() {
    console.log('📡 Starting file watcher...');
    
    this.watcher = chokidar.watch(this.spoolPath, {
      ignored: (filePath) => {
        // Only ignore if it's not one of our target file types
        const ext = path.extname(filePath).toUpperCase();
        const shouldIgnore = !this.fileTypes.includes(ext) && filePath !== this.spoolPath;
        return shouldIgnore;
      },
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: false, // We'll handle write completion ourselves
      usePolling: true, // Use polling for Windows spooler directory compatibility
      interval: this.pollInterval,
      depth: 0, // Only watch the immediate directory, not subdirectories
    });
    
    this.watcher
      .on('add', async (filePath) => {
        await this.handleFileDetected(filePath);
      })
      .on('error', (error) => {
        console.error('❌ File watcher error:', error.message);
        this.stats.lastError = {
          timestamp: new Date().toISOString(),
          error: error.message,
          code: error.code,
        };
        
        // If watcher fails, switch to polling
        if (!this.usePollingFallback) {
          console.warn('⚠️  Switching to polling fallback...');
          this.usePollingFallback = true;
          this.watcher.close();
          this.startPolling();
        }
      });
    
    console.log('✅ File watcher started');
  }
  
  /**
   * Start polling fallback (if file watcher fails)
   */
  async startPolling() {
    console.log('📡 Starting polling fallback...');
    console.log(`   Polling interval: ${this.pollInterval}ms`);
    
    const knownFiles = new Set();
    
    this.pollingInterval = setInterval(async () => {
      try {
        const files = await fs.readdir(this.spoolPath);
        
        for (const file of files) {
          const ext = path.extname(file).toUpperCase();
          
          if (this.fileTypes.includes(ext)) {
            const filePath = path.join(this.spoolPath, file);
            
            // Only process new files
            if (!knownFiles.has(filePath) && !this.processedFiles.has(filePath)) {
              knownFiles.add(filePath);
              await this.handleFileDetected(filePath);
            }
          }
        }
        
        // Clean up known files set periodically (keep last 1000 files)
        if (knownFiles.size > 1000) {
          const filesArray = Array.from(knownFiles);
          knownFiles.clear();
          filesArray.slice(-500).forEach(f => knownFiles.add(f));
        }
        
      } catch (error) {
        if (error.code === 'EACCES') {
          this.stats.permissionErrors++;
          // Log permission errors but don't crash
          if (this.stats.permissionErrors % 10 === 1) {
            console.error('⚠️  Permission denied accessing spooler (will retry)');
          }
        } else {
          console.error('❌ Polling error:', error.message);
        }
      }
    }, this.pollInterval);
    
    console.log('✅ Polling started');
  }
  
  /**
   * Handle file detected event
   */
  async handleFileDetected(filePath) {
    const fileName = path.basename(filePath);
    const detectionTime = Date.now();
    
    // Skip if already processed
    if (this.processedFiles.has(filePath)) {
      return;
    }
    
    console.log(`📄 New print file detected: ${fileName}`);
    
    this.stats.filesDetected++;
    this.stats.lastDetection = new Date().toISOString();
    
    try {
      // Wait for file write completion
      await this.waitForWriteComplete(filePath);
      
      // Check detection latency
      const latency = Date.now() - detectionTime;
      if (latency > this.detectionLatency) {
        console.warn(`⚠️  Detection latency: ${latency}ms (target: ${this.detectionLatency}ms)`);
      }
      
      // Mark as processed
      this.processedFiles.add(filePath);
      
      // Process ESC/POS data
      console.log(`🔄 Processing ESC/POS data from ${fileName}...`);
      const receiptData = await this.escposProcessor.processFile(filePath);
      
      console.log(`✅ Processed ${fileName}:`);
      console.log(`   Format: ${receiptData.isESCPOS ? 'ESC/POS' : 'Plain Text'}`);
      console.log(`   Size: ${receiptData.metadata.fileSize} bytes`);
      console.log(`   Lines: ${receiptData.metadata.lineCount}`);
      console.log(`   Text preview: ${receiptData.text.substring(0, 50)}...`);
      
      // Emit event with processed data
      this.emit('file-detected', filePath, receiptData);
      
      this.stats.filesProcessed++;
      
      // Clean up processed files set periodically (keep last 1000 files)
      if (this.processedFiles.size > 1000) {
        const filesArray = Array.from(this.processedFiles);
        this.processedFiles.clear();
        filesArray.slice(-500).forEach(f => this.processedFiles.add(f));
      }
      
    } catch (error) {
      console.error(`❌ Error processing ${fileName}:`, error.message);
      this.stats.processingErrors++;
      this.stats.lastError = {
        timestamp: new Date().toISOString(),
        file: fileName,
        error: error.message,
        code: error.code,
      };
      
      // Handle permission errors gracefully (log and continue)
      if (error.code === 'EACCES') {
        this.stats.permissionErrors++;
        console.error('   Permission denied - file may be locked by print spooler');
        console.error('   This is normal - will continue monitoring');
      }
    }
  }
  
  /**
   * Wait for file write completion
   * Checks file size stability to ensure file is fully written
   */
  async waitForWriteComplete(filePath) {
    let lastSize = -1;
    let stableCount = 0;
    const requiredStableChecks = Math.ceil(STABILITY_THRESHOLD_MS / STABILITY_POLL_INTERVAL_MS);
    
    while (stableCount < requiredStableChecks) {
      try {
        const stats = await fs.stat(filePath);
        const currentSize = stats.size;
        
        if (currentSize === lastSize) {
          stableCount++;
        } else {
          stableCount = 0;
          lastSize = currentSize;
        }
        
        await this.sleep(STABILITY_POLL_INTERVAL_MS);
        
      } catch (error) {
        if (error.code === 'ENOENT') {
          // File was deleted (print job cancelled)
          throw new Error('File deleted before processing');
        }
        throw error;
      }
    }
  }
  
  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get monitor statistics
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      mode: this.usePollingFallback ? 'polling' : 'file-watcher',
      spoolPath: this.spoolPath,
    };
  }
}

module.exports = SpoolMonitor;
