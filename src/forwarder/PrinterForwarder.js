/**
 * Physical Printer Forwarder
 * 
 * Forwards captured raw ESC/POS bytes to physical printers after capture.
 * Supports three communication methods: USB (via serialport), network (raw TCP), and serial ports.
 * 
 * CORE TRUTH: Manual service always exists. Digital authority is singular.
 * Tabeza adapts to the venue — never the reverse.
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Printer configuration interface
 * @typedef {Object} PrinterConfig
 * @property {'usb' | 'network' | 'serial'} type - Printer connection type
 * @property {string} [port] - COM port for USB/serial (e.g., 'COM3')
 * @property {string} [ip] - IP address for network printers
 * @property {number} [networkPort] - TCP port for network printers (default: 9100)
 * @property {number} timeout - Connection timeout in milliseconds
 * @property {number} [baudRate] - Baud rate for serial communication (default: 9600)
 */

/**
 * Printer status interface
 * @typedef {Object} PrinterStatus
 * @property {boolean} online - Whether printer is reachable
 * @property {string|null} lastError - Last error message if any
 * @property {Date|null} lastSuccess - Timestamp of last successful forward
 * @property {number} totalForwarded - Total number of jobs forwarded
 * @property {number} totalFailed - Total number of failed forwards
 */

class PrinterForwarder {
  /**
   * Create a new PrinterForwarder instance
   * @param {PrinterConfig} config - Printer configuration
   * @param {Object} logger - Winston logger instance
   */
  constructor(config, logger) {
    this.config = this.validateConfig(config);
    this.logger = logger || console;
    
    // Status tracking
    this.status = {
      online: false,
      lastError: null,
      lastSuccess: null,
      totalForwarded: 0,
      totalFailed: 0
    };
    
    // Connection instance (will be set by specific implementations)
    this.connection = null;
    
    // Retry configuration
    this.retryDelays = [0, 5000, 10000, 20000, 40000, 60000]; // ms
    this.maxRetries = this.retryDelays.length;
    
    // Failed prints directory
    this.failedPrintsDir = path.join(process.cwd(), 'C:\\TabezaPrints\\failed_prints');
    
    this.logger.info('PrinterForwarder initialized', {
      type: this.config.type,
      port: this.config.port,
      ip: this.config.ip,
      timeout: this.config.timeout
    });
  }
  
  /**
   * Validate printer configuration
   * @param {PrinterConfig} config - Configuration to validate
   * @returns {PrinterConfig} Validated configuration
   * @throws {Error} If configuration is invalid
   */
  validateConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Printer configuration is required');
    }
    
    const validTypes = ['usb', 'network', 'serial'];
    if (!validTypes.includes(config.type)) {
      throw new Error(`Invalid printer type: ${config.type}. Must be one of: ${validTypes.join(', ')}`);
    }
    
    // Type-specific validation
    if (config.type === 'network') {
      if (!config.ip) {
        throw new Error('IP address is required for network printers');
      }
      // Validate IP format
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipRegex.test(config.ip)) {
        throw new Error(`Invalid IP address format: ${config.ip}`);
      }
    }
    
    if (config.type === 'usb' || config.type === 'serial') {
      if (!config.port) {
        throw new Error(`Port is required for ${config.type} printers`);
      }
    }
    
    // Set defaults
    return {
      ...config,
      networkPort: config.networkPort || 9100,
      timeout: config.timeout || 5000,
      baudRate: config.baudRate || 9600
    };
  }
  
  /**
   * Forward raw ESC/POS bytes to the physical printer
   * @param {Buffer} rawBytes - Raw ESC/POS data to forward
   * @param {Object} [metadata] - Optional metadata about the print job
   * @returns {Promise<void>}
   */
  async forward(rawBytes, metadata = {}) {
    const startTime = Date.now();
    const jobId = metadata.filename || `job-${Date.now()}`;
    
    this.logger.info('Starting print job forward', {
      jobId,
      size: rawBytes.length,
      type: this.config.type
    });
    
    // Validate input
    if (!Buffer.isBuffer(rawBytes)) {
      throw new Error('rawBytes must be a Buffer');
    }
    
    if (rawBytes.length === 0) {
      throw new Error('Cannot forward empty print job');
    }
    
    // Attempt forward with retry logic
    let lastError = null;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // Wait for retry delay if not first attempt
        if (attempt > 0) {
          const delay = this.retryDelays[attempt];
          this.logger.info(`Retrying print job forward (attempt ${attempt + 1}/${this.maxRetries})`, {
            jobId,
            delay
          });
          await this.sleep(delay);
        }
        
        // Attempt to forward
        await this.forwardToDevice(rawBytes);
        
        // Success!
        const duration = Date.now() - startTime;
        this.status.online = true;
        this.status.lastSuccess = new Date();
        this.status.lastError = null;
        this.status.totalForwarded++;
        
        this.logger.info('Print job forwarded successfully', {
          jobId,
          attempt: attempt + 1,
          duration,
          size: rawBytes.length
        });
        
        return;
        
      } catch (error) {
        lastError = error;
        this.logger.warn('Print job forward attempt failed', {
          jobId,
          attempt: attempt + 1,
          error: error.message
        });
      }
    }
    
    // All retries exhausted - save to failed prints
    this.status.online = false;
    this.status.lastError = lastError.message;
    this.status.totalFailed++;
    
    await this.saveFailedPrint(rawBytes, metadata, lastError);
    
    throw new Error(`Failed to forward print job after ${this.maxRetries} attempts: ${lastError.message}`);
  }
  
  /**
   * Forward data to the physical device (implemented by subclasses)
   * @param {Buffer} rawBytes - Raw data to send
   * @returns {Promise<void>}
   * @abstract
   */
  async forwardToDevice(rawBytes) {
    throw new Error('forwardToDevice must be implemented by subclass');
  }
  
  /**
   * Save failed print job to disk for manual recovery
   * @param {Buffer} rawBytes - Raw print data
   * @param {Object} metadata - Job metadata
   * @param {Error} error - Error that caused the failure
   * @returns {Promise<void>}
   */
  async saveFailedPrint(rawBytes, metadata, error) {
    try {
      // Ensure failed prints directory exists
      await fs.mkdir(this.failedPrintsDir, { recursive: true });
      
      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${timestamp}-failed.prn`;
      const filepath = path.join(this.failedPrintsDir, filename);
      
      // Save raw bytes
      await fs.writeFile(filepath, rawBytes);
      
      // Save metadata
      const metadataPath = filepath.replace('.prn', '.json');
      await fs.writeFile(metadataPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        error: error.message,
        size: rawBytes.length,
        printerConfig: {
          type: this.config.type,
          port: this.config.port,
          ip: this.config.ip
        },
        ...metadata
      }, null, 2));
      
      this.logger.error('Print job saved to failed_prints', {
        filepath,
        size: rawBytes.length,
        error: error.message
      });
      
    } catch (saveError) {
      this.logger.error('Failed to save failed print job', {
        error: saveError.message
      });
    }
  }
  
  /**
   * Get current printer status
   * @returns {PrinterStatus}
   */
  getStatus() {
    return { ...this.status };
  }
  
  /**
   * Close printer connection
   * @returns {Promise<void>}
   */
  async close() {
    if (this.connection) {
      try {
        await this.closeConnection();
        this.logger.info('Printer connection closed');
      } catch (error) {
        this.logger.error('Error closing printer connection', {
          error: error.message
        });
      }
    }
  }
  
  /**
   * Close the device connection (implemented by subclasses)
   * @returns {Promise<void>}
   * @abstract
   */
  async closeConnection() {
    // Override in subclasses
  }
  
  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = PrinterForwarder;
