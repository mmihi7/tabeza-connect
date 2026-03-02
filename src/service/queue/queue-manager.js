/**
 * Queue Manager
 * 
 * Provides offline-resilient storage for parsed receipts with exactly-once upload semantics.
 * 
 * Queue folder structure:
 * - C:\ProgramData\Tabeza\queue\pending\ - Receipts waiting to be uploaded
 * - C:\ProgramData\Tabeza\queue\uploaded\ - Successfully uploaded receipts (audit trail)
 * 
 * Each queue file is a JSON file named {uuid}.json containing:
 * - id, barId, driverId, timestamp, parsed, confidence, receipt
 * - enqueuedAt, uploadAttempts, lastUploadError
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class QueueManager {
  /**
   * @param {string} queueBasePath - Base path for queue folders (e.g., C:\ProgramData\Tabeza\queue)
   */
  constructor(queueBasePath) {
    this.queueBasePath = queueBasePath;
    this.pendingPath = path.join(queueBasePath, 'pending');
    this.uploadedPath = path.join(queueBasePath, 'uploaded');
    
    // Ensure queue folders exist
    this._ensureFolders();
  }

  /**
   * Ensure queue folders exist
   * @private
   */
  _ensureFolders() {
    [this.queueBasePath, this.pendingPath, this.uploadedPath].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Enqueue a parsed receipt for upload
   * @param {Object} receipt - Parsed receipt data
   * @returns {string} UUID of queued item
   */
  enqueue(receipt) {
    const id = uuidv4();
    const queueItem = {
      id,
      barId: receipt.barId,
      driverId: receipt.driverId,
      timestamp: receipt.timestamp,
      parsed: receipt.parsed,
      confidence: receipt.confidence || 0,
      receipt: receipt.receipt,
      enqueuedAt: new Date().toISOString(),
      uploadAttempts: 0,
      lastUploadError: null
    };

    const filename = `${id}.json`;
    const filepath = path.join(this.pendingPath, filename);
    
    // Atomic write: write to temp file, then rename
    this._atomicWrite(filepath, queueItem);
    
    return id;
  }

  /**
   * Get next pending receipt for upload (oldest by enqueuedAt)
   * @returns {Object|null} Receipt data with filepath, or null if queue empty
   */
  dequeue() {
    try {
      const files = fs.readdirSync(this.pendingPath)
        .filter(f => f.endsWith('.json'));
      
      if (files.length === 0) {
        return null;
      }

      // Read all files and sort by enqueuedAt
      const items = files.map(filename => {
        const filepath = path.join(this.pendingPath, filename);
        try {
          const content = fs.readFileSync(filepath, 'utf8');
          const data = JSON.parse(content);
          return { ...data, _filepath: filepath };
        } catch (error) {
          // Corrupted file - log and skip
          console.error(`[QueueManager] Corrupted queue file: ${filename}`, error.message);
          return null;
        }
      }).filter(item => item !== null);

      if (items.length === 0) {
        return null;
      }

      // Sort by enqueuedAt (oldest first)
      items.sort((a, b) => new Date(a.enqueuedAt) - new Date(b.enqueuedAt));
      
      return items[0];
    } catch (error) {
      console.error('[QueueManager] Error reading pending queue:', error.message);
      return null;
    }
  }

  /**
   * Mark receipt as successfully uploaded
   * @param {string} id - Receipt UUID
   */
  markUploaded(id) {
    const filename = `${id}.json`;
    const sourcePath = path.join(this.pendingPath, filename);
    const destPath = path.join(this.uploadedPath, filename);

    try {
      if (fs.existsSync(sourcePath)) {
        // Move file from pending to uploaded
        fs.renameSync(sourcePath, destPath);
      }
    } catch (error) {
      console.error(`[QueueManager] Error marking ${id} as uploaded:`, error.message);
      throw error;
    }
  }

  /**
   * Mark receipt upload as failed and increment retry counter
   * @param {string} id - Receipt UUID
   * @param {string} error - Error message
   */
  markFailed(id, error) {
    const filename = `${id}.json`;
    const filepath = path.join(this.pendingPath, filename);

    try {
      if (!fs.existsSync(filepath)) {
        console.warn(`[QueueManager] Cannot mark failed - file not found: ${id}`);
        return;
      }

      const content = fs.readFileSync(filepath, 'utf8');
      const data = JSON.parse(content);
      
      data.uploadAttempts = (data.uploadAttempts || 0) + 1;
      data.lastUploadError = error;
      data.lastAttemptAt = new Date().toISOString();

      // Atomic write
      this._atomicWrite(filepath, data);
    } catch (err) {
      console.error(`[QueueManager] Error marking ${id} as failed:`, err.message);
      throw err;
    }
  }

  /**
   * Scan pending folder on startup to resume uploads
   * @returns {Array<Object>} Pending receipts sorted by enqueuedAt
   */
  scanPending() {
    try {
      const files = fs.readdirSync(this.pendingPath)
        .filter(f => f.endsWith('.json'));
      
      const items = files.map(filename => {
        const filepath = path.join(this.pendingPath, filename);
        try {
          const content = fs.readFileSync(filepath, 'utf8');
          const data = JSON.parse(content);
          return { ...data, _filepath: filepath };
        } catch (error) {
          console.error(`[QueueManager] Corrupted queue file during scan: ${filename}`, error.message);
          return null;
        }
      }).filter(item => item !== null);

      // Sort by enqueuedAt (oldest first)
      items.sort((a, b) => new Date(a.enqueuedAt) - new Date(b.enqueuedAt));
      
      return items;
    } catch (error) {
      console.error('[QueueManager] Error scanning pending queue:', error.message);
      return [];
    }
  }

  /**
   * Get queue statistics
   * @returns {Object} Stats object with pending, uploaded, failed counts
   */
  getStats() {
    try {
      const pendingFiles = fs.readdirSync(this.pendingPath)
        .filter(f => f.endsWith('.json'));
      
      const uploadedFiles = fs.readdirSync(this.uploadedPath)
        .filter(f => f.endsWith('.json'));
      
      // Count failed items (uploadAttempts >= 4)
      let failedCount = 0;
      pendingFiles.forEach(filename => {
        try {
          const filepath = path.join(this.pendingPath, filename);
          const content = fs.readFileSync(filepath, 'utf8');
          const data = JSON.parse(content);
          if (data.uploadAttempts >= 4) {
            failedCount++;
          }
        } catch (error) {
          // Skip corrupted files
        }
      });

      return {
        pending: pendingFiles.length,
        uploaded: uploadedFiles.length,
        failed: failedCount
      };
    } catch (error) {
      console.error('[QueueManager] Error getting stats:', error.message);
      return {
        pending: 0,
        uploaded: 0,
        failed: 0
      };
    }
  }

  /**
   * Atomic file write (write to temp, then rename)
   * @private
   * @param {string} filepath - Target file path
   * @param {Object} data - Data to write
   */
  _atomicWrite(filepath, data) {
    const tempPath = `${filepath}.tmp`;
    
    try {
      // Write to temp file
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
      
      // Rename to final path (atomic operation on Windows)
      fs.renameSync(tempPath, filepath);
    } catch (error) {
      // Clean up temp file if it exists
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }
      
      // Check for disk full error
      if (error.code === 'ENOSPC') {
        throw new Error('Disk full - cannot write queue file');
      }
      
      throw error;
    }
  }
}

module.exports = QueueManager;
