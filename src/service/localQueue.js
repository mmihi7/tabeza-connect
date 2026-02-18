/**
 * Local Persistent Queue
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 * 
 * This module implements a persistent local queue for captured receipts.
 * The queue survives system reboots and service restarts, ensuring no
 * receipt data is lost during internet outages or service interruptions.
 * 
 * Queue Storage: C:\ProgramData\Tabeza\queue\
 * File Format: {uuid}.json
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.5
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');

// Generate UUID v4
function uuidv4() {
  return crypto.randomUUID();
}

// Default queue directory
const DEFAULT_QUEUE_PATH = 'C:\\ProgramData\\Tabeza\\queue';

// Queue subdirectories
const PENDING_DIR = 'pending';
const UPLOADED_DIR = 'uploaded';

// Queue size limits
const MAX_QUEUE_SIZE = 10000; // Maximum number of pending receipts
const MAX_UPLOADED_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

class LocalQueue {
  constructor(options = {}) {
    this.queuePath = options.queuePath || DEFAULT_QUEUE_PATH;
    this.pendingPath = path.join(this.queuePath, PENDING_DIR);
    this.uploadedPath = path.join(this.queuePath, UPLOADED_DIR);
    
    // Statistics
    this.stats = {
      enqueued: 0,
      dequeued: 0,
      uploaded: 0,
      cleanedUp: 0,
      errors: 0,
      lastEnqueue: null,
      lastDequeue: null,
      lastCleanup: null,
    };
  }
  
  /**
   * Initialize the queue
   * Creates queue directories with proper permissions
   */
  async initialize() {
    console.log('🗂️  Initializing local persistent queue...');
    console.log(`   Queue path: ${this.queuePath}`);
    
    try {
      // Create queue directories
      await this.ensureDirectories();
      
      // Check permissions
      await this.checkPermissions();
      
      // Get initial queue size
      const queueSize = await this.getQueueSize();
      console.log(`✅ Local queue initialized (${queueSize} pending receipts)`);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize local queue:', error.message);
      throw error;
    }
  }
  
  /**
   * Ensure queue directories exist
   */
  async ensureDirectories() {
    const directories = [
      this.queuePath,
      this.pendingPath,
      this.uploadedPath,
    ];
    
    for (const dir of directories) {
      try {
        await fs.access(dir);
      } catch (error) {
        if (error.code === 'ENOENT') {
          console.log(`📁 Creating directory: ${dir}`);
          await fs.mkdir(dir, { recursive: true });
        } else {
          throw error;
        }
      }
    }
  }
  
  /**
   * Check if we have proper permissions
   */
  async checkPermissions() {
    try {
      // Test write permission
      const testFile = path.join(this.pendingPath, '.permission-test');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      
      return true;
    } catch (error) {
      if (error.code === 'EACCES') {
        throw new Error('Permission denied: Cannot write to queue directory. Run as Administrator.');
      }
      throw error;
    }
  }
  
  /**
   * Enqueue a receipt
   * 
   * @param {Object} receipt - Receipt data
   * @param {string} receipt.barId - Bar ID
   * @param {string} receipt.deviceId - Device ID
   * @param {string} receipt.timestamp - ISO timestamp
   * @param {string} receipt.escposBytes - Base64 encoded ESC/POS data (optional)
   * @param {string} receipt.text - Converted text
   * @param {Object} receipt.metadata - Additional metadata
   * @returns {Promise<string>} - Receipt ID
   */
  async enqueue(receipt) {
    try {
      // Validate required fields
      this.validateReceipt(receipt);
      
      // Generate unique ID
      const receiptId = uuidv4();
      
      // Create queue item
      const queueItem = {
        id: receiptId,
        barId: receipt.barId,
        deviceId: receipt.deviceId,
        timestamp: receipt.timestamp,
        escposBytes: receipt.escposBytes || null,
        text: receipt.text,
        metadata: receipt.metadata || {},
        enqueuedAt: new Date().toISOString(),
        uploadAttempts: 0,
        lastUploadAttempt: null,
        lastUploadError: null,
      };
      
      // Check queue size limit
      const queueSize = await this.getQueueSize();
      if (queueSize >= MAX_QUEUE_SIZE) {
        throw new Error(`Queue size limit reached (${MAX_QUEUE_SIZE}). Cannot enqueue new receipts.`);
      }
      
      // Save to pending directory
      const filePath = path.join(this.pendingPath, `${receiptId}.json`);
      await fs.writeFile(filePath, JSON.stringify(queueItem, null, 2), 'utf8');
      
      // Update statistics
      this.stats.enqueued++;
      this.stats.lastEnqueue = new Date().toISOString();
      
      console.log(`✅ Receipt enqueued: ${receiptId}`);
      
      return receiptId;
    } catch (error) {
      this.stats.errors++;
      console.error('❌ Failed to enqueue receipt:', error.message);
      throw error;
    }
  }
  
  /**
   * Dequeue the next receipt
   * Returns the oldest pending receipt
   * 
   * @returns {Promise<Object|null>} - Receipt data or null if queue is empty
   */
  async dequeue() {
    try {
      // Get all pending files
      const files = await fs.readdir(this.pendingPath);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      if (jsonFiles.length === 0) {
        return null;
      }
      
      // Sort by filename (UUID v4 is time-based)
      jsonFiles.sort();
      
      // Read the oldest file
      const oldestFile = jsonFiles[0];
      const filePath = path.join(this.pendingPath, oldestFile);
      
      const data = await fs.readFile(filePath, 'utf8');
      const receipt = JSON.parse(data);
      
      // Update statistics
      this.stats.dequeued++;
      this.stats.lastDequeue = new Date().toISOString();
      
      return receipt;
    } catch (error) {
      this.stats.errors++;
      console.error('❌ Failed to dequeue receipt:', error.message);
      throw error;
    }
  }
  
  /**
   * Mark a receipt as uploaded
   * Moves the receipt from pending to uploaded directory
   * 
   * @param {string} receiptId - Receipt ID
   * @returns {Promise<void>}
   */
  async markUploaded(receiptId) {
    try {
      const pendingFile = path.join(this.pendingPath, `${receiptId}.json`);
      const uploadedFile = path.join(this.uploadedPath, `${receiptId}.json`);
      
      // Check if file exists
      try {
        await fs.access(pendingFile);
      } catch (error) {
        if (error.code === 'ENOENT') {
          console.warn(`⚠️  Receipt ${receiptId} not found in pending queue`);
          return;
        }
        throw error;
      }
      
      // Read receipt data
      const data = await fs.readFile(pendingFile, 'utf8');
      const receipt = JSON.parse(data);
      
      // Update upload status
      receipt.uploadedAt = new Date().toISOString();
      receipt.status = 'uploaded';
      
      // Move to uploaded directory
      await fs.writeFile(uploadedFile, JSON.stringify(receipt, null, 2), 'utf8');
      await fs.unlink(pendingFile);
      
      // Update statistics
      this.stats.uploaded++;
      
      console.log(`✅ Receipt marked as uploaded: ${receiptId}`);
    } catch (error) {
      this.stats.errors++;
      console.error(`❌ Failed to mark receipt as uploaded:`, error.message);
      throw error;
    }
  }
  
  /**
   * Update upload attempt for a receipt
   * 
   * @param {string} receiptId - Receipt ID
   * @param {string} error - Error message (optional)
   * @returns {Promise<void>}
   */
  async updateUploadAttempt(receiptId, error = null) {
    try {
      const filePath = path.join(this.pendingPath, `${receiptId}.json`);
      
      // Read receipt data
      const data = await fs.readFile(filePath, 'utf8');
      const receipt = JSON.parse(data);
      
      // Update attempt count
      receipt.uploadAttempts = (receipt.uploadAttempts || 0) + 1;
      receipt.lastUploadAttempt = new Date().toISOString();
      
      if (error) {
        receipt.lastUploadError = error;
      }
      
      // Save updated receipt
      await fs.writeFile(filePath, JSON.stringify(receipt, null, 2), 'utf8');
    } catch (error) {
      console.error(`⚠️  Failed to update upload attempt:`, error.message);
      // Don't throw - this is not critical
    }
  }
  
  /**
   * Get queue size (number of pending receipts)
   * 
   * @returns {Promise<number>}
   */
  async getQueueSize() {
    try {
      const files = await fs.readdir(this.pendingPath);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      return jsonFiles.length;
    } catch (error) {
      console.error('❌ Failed to get queue size:', error.message);
      return 0;
    }
  }
  
  /**
   * Get uploaded receipts count
   * 
   * @returns {Promise<number>}
   */
  async getUploadedCount() {
    try {
      const files = await fs.readdir(this.uploadedPath);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      return jsonFiles.length;
    } catch (error) {
      console.error('❌ Failed to get uploaded count:', error.message);
      return 0;
    }
  }
  
  /**
   * Cleanup old uploaded receipts
   * Removes uploaded receipts older than MAX_UPLOADED_AGE_MS
   * 
   * @returns {Promise<number>} - Number of receipts cleaned up
   */
  async cleanup() {
    try {
      console.log('🧹 Cleaning up old uploaded receipts...');
      
      const files = await fs.readdir(this.uploadedPath);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      let cleanedCount = 0;
      const now = Date.now();
      
      for (const file of jsonFiles) {
        const filePath = path.join(this.uploadedPath, file);
        
        try {
          // Read receipt data
          const data = await fs.readFile(filePath, 'utf8');
          const receipt = JSON.parse(data);
          
          // Check age
          const uploadedAt = new Date(receipt.uploadedAt).getTime();
          const age = now - uploadedAt;
          
          if (age > MAX_UPLOADED_AGE_MS) {
            // Delete old receipt
            await fs.unlink(filePath);
            cleanedCount++;
          }
        } catch (error) {
          console.warn(`⚠️  Failed to process ${file}:`, error.message);
        }
      }
      
      // Update statistics
      this.stats.cleanedUp += cleanedCount;
      this.stats.lastCleanup = new Date().toISOString();
      
      if (cleanedCount > 0) {
        console.log(`✅ Cleaned up ${cleanedCount} old uploaded receipts`);
      } else {
        console.log('✅ No old receipts to clean up');
      }
      
      return cleanedCount;
    } catch (error) {
      console.error('❌ Failed to cleanup old receipts:', error.message);
      return 0;
    }
  }
  
  /**
   * Get all pending receipts
   * Useful for debugging and monitoring
   * 
   * @returns {Promise<Array>}
   */
  async getAllPending() {
    try {
      const files = await fs.readdir(this.pendingPath);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      const receipts = [];
      
      for (const file of jsonFiles) {
        const filePath = path.join(this.pendingPath, file);
        const data = await fs.readFile(filePath, 'utf8');
        const receipt = JSON.parse(data);
        receipts.push(receipt);
      }
      
      // Sort by enqueued time
      receipts.sort((a, b) => 
        new Date(a.enqueuedAt).getTime() - new Date(b.enqueuedAt).getTime()
      );
      
      return receipts;
    } catch (error) {
      console.error('❌ Failed to get pending receipts:', error.message);
      return [];
    }
  }
  
  /**
   * Validate receipt data
   * 
   * @param {Object} receipt - Receipt data
   * @throws {Error} - If validation fails
   */
  validateReceipt(receipt) {
    const required = ['barId', 'deviceId', 'timestamp', 'text'];
    
    for (const field of required) {
      if (!receipt[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Validate timestamp format
    if (isNaN(Date.parse(receipt.timestamp))) {
      throw new Error('Invalid timestamp format (must be ISO 8601)');
    }
    
    // Validate text is not empty
    if (typeof receipt.text !== 'string' || receipt.text.trim().length === 0) {
      throw new Error('Receipt text cannot be empty');
    }
  }
  
  /**
   * Get queue statistics
   * 
   * @returns {Promise<Object>}
   */
  async getStats() {
    const queueSize = await this.getQueueSize();
    const uploadedCount = await this.getUploadedCount();
    
    return {
      ...this.stats,
      queueSize,
      uploadedCount,
      queuePath: this.queuePath,
    };
  }
}

module.exports = LocalQueue;
