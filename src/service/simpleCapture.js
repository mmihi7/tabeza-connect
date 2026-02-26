/**
 * Simple Capture - Printer Pooling Mode
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 * 
 * This module implements a simplified printer pooling capture mode that
 * monitors a single capture file (order.prn) written by a Windows printer pool.
 * It passively observes POS receipts without interfering with print operations.
 * 
 * The POS system remains the authoritative source for all financial orders.
 * SimpleCapture only captures, queues, and forwards receipt data to the cloud.
 * 
 * Architecture:
 * - Watches single capture file using chokidar (efficient file system events)
 * - Implements 3-check stability algorithm to ensure complete file writes
 * - Copies stable files to temp folder with unique timestamps
 * - Enqueues receipts to LocalQueue for persistent storage
 * - Never modifies or deletes the original capture file
 * 
 * Requirements: 1.1, 1.2, 1.3, 2.1-2.6, 3.1-3.7, 7.1-7.7, 8.1-8.7, 9.1-9.6, 14.1-14.7
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const chokidar = require('chokidar');

class SimpleCapture extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Validate required options
    if (!options.captureFile) {
      throw new Error('captureFile is required');
    }
    if (!options.localQueue) {
      throw new Error('localQueue is required');
    }
    if (!options.barId) {
      throw new Error('barId is required');
    }
    if (!options.deviceId) {
      throw new Error('deviceId is required');
    }
    
    // Configuration
    this.captureFile = options.captureFile;
    this.tempFolder = options.tempFolder || path.join(path.dirname(options.captureFile), 'captures');
    this.localQueue = options.localQueue;
    this.barId = options.barId;
    this.deviceId = options.deviceId;
    this.stabilityChecks = options.stabilityChecks || 3;
    this.stabilityDelay = options.stabilityDelay || 100;
    
    // State
    this.watcher = null;
    this.isRunning = false;
    this.stabilityStates = {}; // Track stability checks per file
    
    // Statistics tracking
    this.stats = {
      filesDetected: 0,
      filesCaptured: 0,
      filesSkipped: 0,
      errors: 0,
      lastCapture: null,
      lastError: null,
    };
    
    console.log('📋 SimpleCapture initialized');
    console.log(`   Capture file: ${this.captureFile}`);
    console.log(`   Temp folder: ${this.tempFolder}`);
    console.log(`   Bar ID: ${this.barId}`);
    console.log(`   Device ID: ${this.deviceId}`);
  }
  
  /**
   * Start watching the capture file
   * Creates temp folder and initializes file watcher
   * 
   * Requirements: 1.1, 1.2, 1.3, 1.4, 7.7
   */
  async start() {
    if (this.isRunning) {
      console.warn('⚠️  SimpleCapture is already running');
      return;
    }
    
    try {
      console.log('🚀 Starting SimpleCapture...');
      
      // Ensure temp folder exists
      await this.ensureTempFolder();
      
      // Create empty capture file if it doesn't exist
      await this.ensureCaptureFile();
      
      // Initialize chokidar watcher
      this.watcher = chokidar.watch(this.captureFile, {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: false, // We handle stability ourselves
        usePolling: false, // Use native file system events
      });
      
      // Register event handlers
      this.watcher.on('change', (filePath) => this.handleFileChange(filePath));
      this.watcher.on('error', (error) => this.handleError(error));
      
      // Mark as running
      this.isRunning = true;
      
      console.log('✅ SimpleCapture started - watching for file changes');
      
      // Emit started event
      this.emit('started');
      
    } catch (error) {
      console.error('❌ Failed to start SimpleCapture:', error.message);
      this.handleError(error);
      throw error;
    }
  }
  
  /**
   * Stop watching and cleanup
   * Gracefully shuts down the watcher and clears pending operations
   * 
   * Requirements: 8.1, 8.2, 8.3, 8.7
   */
  async stop() {
    if (!this.isRunning) {
      console.warn('⚠️  SimpleCapture is not running');
      return;
    }
    
    try {
      console.log('🛑 Stopping SimpleCapture...');
      
      // Clear all pending stability timeouts
      for (const filePath in this.stabilityStates) {
        const state = this.stabilityStates[filePath];
        if (state.timeoutId) {
          clearTimeout(state.timeoutId);
        }
      }
      
      // Clear stability states
      this.stabilityStates = {};
      
      // Close watcher
      if (this.watcher) {
        await this.watcher.close();
        this.watcher = null;
      }
      
      // Mark as stopped
      this.isRunning = false;
      
      console.log('✅ SimpleCapture stopped');
      
      // Emit stopped event
      this.emit('stopped');
      
    } catch (error) {
      console.error('❌ Failed to stop SimpleCapture:', error.message);
      this.handleError(error);
      throw error;
    }
  }
  
  /**
   * Handle file change event
   * Initiates or updates stability check for the changed file
   * 
   * Requirements: 2.1, 2.2, 2.4
   */
  async handleFileChange(filePath) {
    try {
      console.log(`📝 File change detected: ${path.basename(filePath)}`);
      
      // Increment detection counter
      this.stats.filesDetected++;
      
      // Clear previous stability timeout if exists
      if (this.stabilityStates[filePath]) {
        const state = this.stabilityStates[filePath];
        if (state.timeoutId) {
          clearTimeout(state.timeoutId);
        }
      }
      
      // Get current file stats
      let stats;
      try {
        stats = fsSync.statSync(filePath);
      } catch (error) {
        if (error.code === 'ENOENT') {
          console.warn('⚠️  File disappeared before stability check');
          delete this.stabilityStates[filePath];
          return;
        }
        throw error;
      }
      
      // Initialize or reset stability state
      this.stabilityStates[filePath] = {
        path: filePath,
        size: stats.size,
        lastModified: stats.mtimeMs,
        checksRemaining: this.stabilityChecks,
        timeoutId: null,
      };
      
      // Schedule first stability check
      this.scheduleStabilityCheck(filePath);
      
    } catch (error) {
      console.error('❌ Error handling file change:', error.message);
      this.handleError(error);
    }
  }
  
  /**
   * Schedule next stability check
   * 
   * Requirements: 2.2, 2.4
   */
  scheduleStabilityCheck(filePath) {
    const state = this.stabilityStates[filePath];
    if (!state) return;
    
    state.timeoutId = setTimeout(() => {
      this.checkFileStability(filePath);
    }, this.stabilityDelay);
  }
  
  /**
   * Check file stability
   * Implements 3-check algorithm to verify file is completely written
   * 
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
   */
  async checkFileStability(filePath) {
    const state = this.stabilityStates[filePath];
    if (!state) return;
    
    try {
      // Read current file stats
      let stats;
      try {
        stats = fsSync.statSync(filePath);
      } catch (error) {
        if (error.code === 'ENOENT') {
          console.warn('⚠️  File disappeared during stability check');
          delete this.stabilityStates[filePath];
          return;
        }
        throw error;
      }
      
      const currentSize = stats.size;
      const currentMtime = stats.mtimeMs;
      
      // Compare with previous state
      if (currentSize === state.size && currentMtime === state.lastModified) {
        // File is stable for this check
        state.checksRemaining--;
        
        console.log(`🔍 Stability check ${this.stabilityChecks - state.checksRemaining}/${this.stabilityChecks} - file stable`);
        
        if (state.checksRemaining === 0) {
          // File is fully stable - process it
          console.log('✅ File is stable - processing...');
          delete this.stabilityStates[filePath];
          await this.processStableFile(filePath);
          return;
        }
      } else {
        // File changed - reset stability counter
        console.log('⏳ File changed during stability check - resetting counter');
        state.size = currentSize;
        state.lastModified = currentMtime;
        state.checksRemaining = this.stabilityChecks;
      }
      
      // Schedule next stability check
      this.scheduleStabilityCheck(filePath);
      
    } catch (error) {
      console.error('❌ Error during stability check:', error.message);
      delete this.stabilityStates[filePath];
      this.handleError(error);
    }
  }
  
  /**
   * Process stable file
   * Copies file to temp folder and enqueues receipt
   * 
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 10.1-10.9
   */
  async processStableFile(filePath) {
    try {
      console.log(`📦 Processing stable file: ${path.basename(filePath)}`);
      
      // Generate unique temp filename with timestamp
      const timestamp = Date.now();
      const tempFileName = `capture_${timestamp}.prn`;
      const tempPath = path.join(this.tempFolder, tempFileName);
      
      // Read file data (preserve binary content)
      const fileData = await fs.readFile(filePath);
      
      console.log(`   File size: ${fileData.length} bytes`);
      
      // Copy to temp folder
      await fs.writeFile(tempPath, fileData);
      
      console.log(`   Copied to: ${tempFileName}`);
      
      // Create receipt object
      const receipt = {
        barId: this.barId,
        deviceId: this.deviceId,
        timestamp: new Date().toISOString(),
        escposBytes: fileData.toString('base64'),
        text: null, // Cloud will parse ESC/POS bytes
        metadata: {
          source: 'pooling',
          captureFile: path.basename(filePath),
          tempFile: tempFileName,
          fileSize: fileData.length,
        },
      };
      
      // Enqueue to LocalQueue
      let receiptId;
      try {
        receiptId = await this.localQueue.enqueue(receipt);
        console.log(`   Enqueued with ID: ${receiptId}`);
      } catch (error) {
        // Handle queue errors with retry logic
        if (error.message.includes('Queue size limit')) {
          console.warn('⚠️  Queue is full - waiting before retry...');
          await this.sleep(5000);
          receiptId = await this.localQueue.enqueue(receipt);
          console.log(`   Enqueued with ID (retry): ${receiptId}`);
        } else {
          throw error;
        }
      }
      
      // Update statistics
      this.stats.filesCaptured++;
      this.stats.lastCapture = new Date().toISOString();
      
      console.log(`✅ File captured successfully: ${receiptId}`);
      
      // Emit file-captured event
      this.emit('file-captured', receiptId);
      
    } catch (error) {
      console.error('❌ Error processing stable file:', error.message);
      this.stats.errors++;
      this.stats.lastError = error.message;
      this.handleError(error);
      // Continue monitoring after error
    }
  }
  
  /**
   * Get current statistics
   * 
   * Requirements: 7.1, 7.2, 7.3
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      captureFile: this.captureFile,
      tempFolder: this.tempFolder,
    };
  }
  
  /**
   * Handle errors
   * Logs errors and emits error event
   * 
   * Requirements: 7.6, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
   */
  handleError(error) {
    this.stats.errors++;
    this.stats.lastError = error.message;
    
    // Emit error event
    this.emit('error', error);
    
    // Log error but don't crash
    console.error('❌ SimpleCapture error:', error.message);
  }
  
  /**
   * Ensure temp folder exists
   * 
   * Requirements: 1.2, 9.2
   */
  async ensureTempFolder() {
    try {
      await fs.access(this.tempFolder);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`📁 Creating temp folder: ${this.tempFolder}`);
        await fs.mkdir(this.tempFolder, { recursive: true });
      } else if (error.code === 'EACCES') {
        throw new Error(`Temp folder is not writable: ${this.tempFolder}. Check permissions.`);
      } else {
        throw error;
      }
    }
    
    // Verify write permissions
    try {
      const testFile = path.join(this.tempFolder, '.write-test');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
    } catch (error) {
      throw new Error(`Cannot write to temp folder: ${this.tempFolder}. Check permissions.`);
    }
  }
  
  /**
   * Ensure capture file exists
   * Creates empty file if it doesn't exist
   * 
   * Requirements: 1.4
   */
  async ensureCaptureFile() {
    try {
      await fs.access(this.captureFile);
      console.log(`✅ Capture file exists: ${this.captureFile}`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`📄 Creating capture file: ${this.captureFile}`);
        
        // Ensure parent directory exists
        const parentDir = path.dirname(this.captureFile);
        await fs.mkdir(parentDir, { recursive: true });
        
        // Create empty file
        await fs.writeFile(this.captureFile, '');
        console.log(`✅ Capture file created`);
      } else if (error.code === 'EACCES') {
        throw new Error(`Capture file path is not accessible: ${this.captureFile}. Check permissions.`);
      } else {
        throw error;
      }
    }
  }
  
  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = SimpleCapture;
