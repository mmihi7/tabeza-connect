/**
 * Upload Worker
 * 
 * Background process that uploads queued receipts to cloud with exponential backoff retry.
 * 
 * Features:
 * - 2-second polling loop
 * - Exponential backoff: 5s, 10s, 20s, 40s
 * - Max 4 attempts per receipt
 * - HTTP 2xx: Move to uploaded/
 * - HTTP 4xx: Move to failed/, no retry
 * - HTTP 5xx: Retry with backoff
 * - Network timeout: Retry with backoff
 * - 30s timeout per request
 */

// Using native fetch - no external dependencies

class UploadWorker {
  /**
   * @param {QueueManager} queueManager - Queue manager instance
   * @param {Object} config - Configuration object
   * @param {string} config.apiUrl - Cloud API base URL
   * @param {string} config.barId - Venue identifier
   */
  constructor(queueManager, config) {
    this.queueManager = queueManager;
    this.config = config;
    this.isRunning = false;
    this.pollInterval = null;
    this.backoffDelays = [5000, 10000, 20000, 40000]; // ms
    this.maxAttempts = 4;
    
    // Using native fetch - no external dependencies needed
  }

  /**
   * Start the upload worker loop
   */
  start() {
    if (this.isRunning) {
      console.warn('[UploadWorker] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[UploadWorker] Starting upload worker with 2-second polling');
    
    // Start polling loop
    this.pollInterval = setInterval(() => {
      this.processNext().catch(error => {
        console.error('[UploadWorker] Error in polling loop:', error.message);
      });
    }, 2000);
  }

  /**
   * Stop the upload worker
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    
    console.log('[UploadWorker] Stopped upload worker');
  }

  /**
   * Process next pending receipt
   * @returns {Promise<boolean>} True if upload succeeded
   */
  async processNext() {
    if (!this.isRunning) {
      return false;
    }

    // Get next pending receipt
    const item = this.queueManager.dequeue();
    
    if (!item) {
      // Queue is empty, nothing to do
      return false;
    }

    const { id, uploadAttempts } = item;
    
    // Check if max attempts reached
    if (uploadAttempts >= this.maxAttempts) {
      console.error(`[UploadWorker] Max attempts (${this.maxAttempts}) reached for receipt ${id}, skipping`);
      return false;
    }

    try {
      // Attempt upload
      await this.uploadReceipt(item);
      
      // Success - move to uploaded/
      this.queueManager.markUploaded(id);
      console.log(`[UploadWorker] Successfully uploaded receipt ${id}`);
      return true;
      
    } catch (error) {
      // Upload failed
      const attemptNumber = uploadAttempts + 1;
      console.error(`[UploadWorker] Upload failed for receipt ${id} (attempt ${attemptNumber}/${this.maxAttempts}):`, error.message);
      
      // Determine if we should retry
      const shouldRetry = this._shouldRetry(error, attemptNumber);
      
      if (shouldRetry) {
        // Mark as failed (increments attempt counter)
        this.queueManager.markFailed(id, error.message);
        
        // Calculate backoff delay
        const delay = this.getBackoffDelay(attemptNumber);
        console.log(`[UploadWorker] Will retry receipt ${id} after ${delay}ms`);
        
        // Wait before next attempt
        await this._sleep(delay);
      } else {
        // No retry - mark as permanently failed
        this.queueManager.markFailed(id, `Permanent failure: ${error.message}`);
        console.error(`[UploadWorker] Permanent failure for receipt ${id}, no retry`);
      }
      
      return false;
    }
  }

  /**
   * Upload receipt to cloud API
   * @param {Object} receipt - Receipt data
   * @returns {Promise<Object>} API response
   */
  async uploadReceipt(receipt) {
    const endpoint = `${this.config.apiUrl}/api/receipts/ingest`;
    
    // Prepare payload (exclude internal fields)
    const payload = {
      barId: receipt.barId,
      driverId: receipt.driverId,
      timestamp: receipt.timestamp,
      parsed: receipt.parsed,
      confidence: receipt.confidence,
      receipt: receipt.receipt,
      metadata: {
        source: 'pooling-capture',
        templateVersion: receipt.receipt.templateVersion || null,
        parseTimeMs: receipt.receipt.parseTimeMs || null
      }
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const result = await response.json();
      return result;
    } catch (error) {
      // Enhance error with status code if available
      if (error.response) {
        const statusError = new Error(`HTTP ${error.response.status}: ${error.response.statusText}`);
        statusError.statusCode = error.response.status;
        statusError.response = error.response;
        throw statusError;
      }
      
      // Network error or timeout
      throw error;
    }
  }

  /**
   * Calculate backoff delay for retry attempt
   * @param {number} attempt - Attempt number (1-4)
   * @returns {number} Delay in milliseconds
   */
  getBackoffDelay(attempt) {
    // Attempt is 1-indexed, array is 0-indexed
    const index = Math.min(attempt - 1, this.backoffDelays.length - 1);
    return this.backoffDelays[index];
  }

  /**
   * Determine if upload should be retried based on error
   * @private
   * @param {Error} error - Error from upload attempt
   * @param {number} attemptNumber - Current attempt number
   * @returns {boolean} True if should retry
   */
  _shouldRetry(error, attemptNumber) {
    // Don't retry if max attempts reached
    if (attemptNumber >= this.maxAttempts) {
      return false;
    }

    // Check for HTTP status code
    if (error.statusCode) {
      // 4xx errors: Client error, don't retry
      if (error.statusCode >= 400 && error.statusCode < 500) {
        return false;
      }
      
      // 5xx errors: Server error, retry
      if (error.statusCode >= 500 && error.statusCode < 600) {
        return true;
      }
      
      // 2xx: Success (shouldn't reach here)
      if (error.statusCode >= 200 && error.statusCode < 300) {
        return false;
      }
    }

    // Network errors (timeout, connection refused, etc.): Retry
    if (error.code === 'ECONNREFUSED' || 
        error.code === 'ETIMEDOUT' || 
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNRESET') {
      return true;
    }

    // Axios timeout error: Retry
    if (error.code === 'ECONNABORTED') {
      return true;
    }

    // Unknown error: Don't retry to be safe
    return false;
  }

  /**
   * Sleep for specified milliseconds
   * @private
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = UploadWorker;
