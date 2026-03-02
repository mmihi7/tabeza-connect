/**
 * File Watcher
 * 
 * Watches order.prn file for changes using chokidar with debouncing
 * and delay to ensure POS has finished writing.
 */

const chokidar = require('chokidar');
const fs = require('fs').promises;
const path = require('path');

class FileWatcher {
  constructor(config, onReceiptCaptured) {
    this.config = config;
    this.onReceiptCaptured = onReceiptCaptured;
    this.watcher = null;
    this.debounceTimer = null;
    this.lastProcessedTime = 0;
    this.isProcessing = false;
  }

  /**
   * Start watching the order.prn file
   */
  start() {
    const watchPath = path.join(this.config.watchFolder, 'order.prn');
    
    console.log(`[FileWatcher] Starting watcher for: ${watchPath}`);

    this.watcher = chokidar.watch(watchPath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 1500, // 1.5 second delay after last change
        pollInterval: 100
      }
    });

    this.watcher.on('change', (filePath) => {
      this._handleFileChange(filePath);
    });

    this.watcher.on('error', (error) => {
      console.error('[FileWatcher] Error:', error);
    });

    this.watcher.on('ready', () => {
      console.log('[FileWatcher] Ready and watching for changes');
    });
  }

  /**
   * Stop watching
   */
  async stop() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      console.log('[FileWatcher] Stopped');
    }
  }

  /**
   * Handle file change with debouncing
   * @private
   */
  _handleFileChange(filePath) {
    // Clear existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Debounce: wait 500ms after last change before processing
    this.debounceTimer = setTimeout(async () => {
      await this._processFile(filePath);
    }, 500);
  }

  /**
   * Process the file after debounce period
   * @private
   */
  async _processFile(filePath) {
    // Prevent concurrent processing
    if (this.isProcessing) {
      console.log('[FileWatcher] Already processing, skipping');
      return;
    }

    // Prevent processing same file too quickly (within 2 seconds)
    const now = Date.now();
    if (now - this.lastProcessedTime < 2000) {
      console.log('[FileWatcher] Processed recently, skipping');
      return;
    }

    this.isProcessing = true;
    this.lastProcessedTime = now;

    try {
      console.log(`[FileWatcher] Processing file: ${filePath}`);

      // Read file content
      const rawData = await fs.readFile(filePath);

      if (rawData.length === 0) {
        console.log('[FileWatcher] File is empty, skipping');
        return;
      }

      // Call the callback with raw data
      await this.onReceiptCaptured(rawData);

    } catch (error) {
      console.error('[FileWatcher] Error processing file:', error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }
}

module.exports = FileWatcher;
