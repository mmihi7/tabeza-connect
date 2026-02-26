/**
 * Async Upload Worker
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 * 
 * This module implements a background worker that continuously processes
 * the local queue and uploads receipts to the cloud API asynchronously.
 * 
 * The worker NEVER blocks the capture process. It runs independently and
 * handles network errors gracefully with exponential backoff retry.
 * 
 * Retry Strategy: 5s, 10s, 20s, 40s (exponential backoff)
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 2.6
 */

const { EventEmitter } = require('events');

// Retry configuration
const RETRY_DELAYS = [5000, 10000, 20000, 40000]; // 5s, 10s, 20s, 40s
const MAX_RETRIES = RETRY_DELAYS.length;

// Worker configuration
const POLL_INTERVAL_MS = 2000; // Check queue every 2 seconds
const UPLOAD_TIMEOUT_MS = 30000; // 30 second timeout for uploads

class UploadWorker extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.localQueue = options.localQueue;
    this.apiEndpoint = options.apiEndpoint;
    this.barId = options.barId;
    this.deviceId = options.deviceId;
    this.pollInterval = options.pollInterval || POLL_INTERVAL_MS;
    this.uploadTimeout = options.uploadTimeout || UPLOAD_TIMEOUT_MS;
    
    this.isRunning = false;
    this.workerInterval = null;
    this.currentUpload = null;
    
    // Statistics
    this.stats = {
      uploadsAttempted: 0,
      uploadsSucceeded: 0,
      uploadsFailed: 0,
      retriesAttempted: 0,
      lastUploadSuccess: null,
      lastUploadFailure: null,
      lastError: null,
      isOnline: true,
    };
    
    // Validate required options
    if (!this.localQueue) {
      throw new Error('localQueue is required');
    }
    if (!this.apiEndpoint) {
      throw new Error('apiEndpoint is required');
    }
    if (!this.barId) {
      throw new Error('barId is required');
    }
    if (!this.deviceId) {
      throw new Error('deviceId is required');
    }
  }
  
  /**
   * Start the upload worker
   * Begins continuous processing of the queue
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Upload worker already running');
      return;
    }
    
    console.log('🚀 Starting async upload worker...');
    console.log(`   API endpoint: ${this.apiEndpoint}`);
    console.log(`   Bar ID: ${this.barId}`);
    console.log(`   Device ID: ${this.deviceId}`);
    console.log(`   Poll interval: ${this.pollInterval}ms`);
    console.log('');
    
    this.isRunning = true;
    
    // Process queue on startup (resume any pending uploads)
    await this.processQueue();
    
    // Start continuous polling
    this.workerInterval = setInterval(async () => {
      await this.processQueue();
    }, this.pollInterval);
    
    console.log('✅ Upload worker started successfully');
    
    this.emit('started');
  }
  
  /**
   * Stop the upload worker
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }
    
    console.log('🛑 Stopping upload worker...');
    
    this.isRunning = false;
    
    if (this.workerInterval) {
      clearInterval(this.workerInterval);
      this.workerInterval = null;
    }
    
    // Wait for current upload to complete (if any)
    if (this.currentUpload) {
      console.log('⏳ Waiting for current upload to complete...');
      await this.currentUpload;
    }
    
    console.log('✅ Upload worker stopped');
    
    this.emit('stopped');
  }
  
  /**
   * Process the queue
   * Dequeues and uploads receipts until queue is empty
   */
  async processQueue() {
    if (!this.isRunning) {
      return;
    }
    
    try {
      // Get queue size
      const queueSize = await this.localQueue.getQueueSize();
      
      if (queueSize === 0) {
        // Queue is empty - nothing to do
        return;
      }
      
      console.log(`📤 Processing queue (${queueSize} pending receipts)...`);
      
      // Process receipts one at a time
      while (this.isRunning) {
        const receipt = await this.localQueue.dequeue();
        
        if (!receipt) {
          // Queue is empty
          break;
        }
        
        // Upload receipt with retry
        await this.uploadReceiptWithRetry(receipt);
      }
      
    } catch (error) {
      console.error('❌ Error processing queue:', error.message);
      this.stats.lastError = {
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }
  
  /**
   * Upload receipt with exponential backoff retry
   * 
   * @param {Object} receipt - Receipt data from queue
   */
  async uploadReceiptWithRetry(receipt) {
    const receiptId = receipt.id;
    let attempt = 0;
    
    while (attempt <= MAX_RETRIES && this.isRunning) {
      try {
        // Track current upload
        this.currentUpload = this.uploadReceipt(receipt);
        
        // Attempt upload
        await this.currentUpload;
        
        // Success! Mark as uploaded and remove from queue
        await this.localQueue.markUploaded(receiptId);
        
        this.stats.uploadsSucceeded++;
        this.stats.lastUploadSuccess = new Date().toISOString();
        this.stats.isOnline = true;
        
        console.log(`✅ Receipt uploaded successfully: ${receiptId}`);
        
        this.emit('upload-success', receiptId);
        
        // Clear current upload
        this.currentUpload = null;
        
        return; // Success - exit retry loop
        
      } catch (error) {
        attempt++;
        
        // Update upload attempt in queue
        await this.localQueue.updateUploadAttempt(receiptId, error.message);
        
        this.stats.uploadsFailed++;
        this.stats.lastUploadFailure = new Date().toISOString();
        this.stats.lastError = {
          timestamp: new Date().toISOString(),
          receiptId,
          attempt,
          error: error.message,
        };
        
        // Check if we should retry
        if (attempt <= MAX_RETRIES) {
          const delay = RETRY_DELAYS[attempt - 1];
          
          console.warn(`⚠️  Upload failed (attempt ${attempt}/${MAX_RETRIES}): ${error.message}`);
          console.log(`   Retrying in ${delay / 1000}s...`);
          
          this.stats.retriesAttempted++;
          this.stats.isOnline = false;
          
          this.emit('upload-retry', receiptId, attempt, delay);
          
          // Wait before retry (exponential backoff)
          await this.sleep(delay);
          
        } else {
          // Max retries exceeded
          console.error(`❌ Upload failed after ${MAX_RETRIES} retries: ${receiptId}`);
          console.error(`   Error: ${error.message}`);
          console.error(`   Receipt will remain in queue for next service restart`);
          
          this.emit('upload-failed', receiptId, error);
          
          // Don't remove from queue - will retry on next service restart
          break;
        }
      }
    }
    
    // Clear current upload
    this.currentUpload = null;
  }
  
  /**
   * Upload receipt to cloud API
   * 
   * @param {Object} receipt - Receipt data
   * @returns {Promise<void>}
   */
  async uploadReceipt(receipt) {
    this.stats.uploadsAttempted++;
    
    // Prepare request payload
    const payload = {
      driverId: this.deviceId,  // Rename deviceId → driverId
      barId: this.barId,
      timestamp: receipt.timestamp,
      rawData: receipt.escposBytes,  // Rename escposBytes → rawData
      printerName: receipt.metadata?.printerName || 'Tabeza POS Connect',
      documentName: receipt.metadata?.fileName || 'Receipt',
      metadata: {
        ...receipt.metadata,
        source: 'pooling-capture',
        enqueuedAt: receipt.enqueuedAt,
        uploadAttempts: receipt.uploadAttempts || 0,
      },
    };

    
    // Make HTTP request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.uploadTimeout);
    
    try {
      const response = await fetch(`${this.apiEndpoint}/api/printer/relay`, {        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error('Upload failed: API returned success=false');
      }
      
      return result;
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Handle specific error types
      if (error.name === 'AbortError') {
        throw new Error(`Upload timeout after ${this.uploadTimeout / 1000}s`);
      }
      
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new Error('Network error: Cannot reach API endpoint (offline?)');
      }
      
      throw error;
    }
  }
  
  /**
   * Sleep helper
   * 
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get worker statistics
   * 
   * @returns {Object}
   */
  async getStats() {
    const queueSize = await this.localQueue.getQueueSize();
    
    return {
      ...this.stats,
      isRunning: this.isRunning,
      queueSize,
      apiEndpoint: this.apiEndpoint,
      barId: this.barId,
      deviceId: this.deviceId,
    };
  }
  
  /**
   * Force process queue immediately
   * Useful for testing and manual triggers
   */
  async forceProcess() {
    console.log('🔄 Forcing queue processing...');
    await this.processQueue();
  }
}

module.exports = UploadWorker;
