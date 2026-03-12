/**
 * Capture Script Logger
 * 
 * Provides structured logging for the capture script with
 * component-based filtering and log rotation support.
 * 
 * Requirements: Requirement 10 (Logging and Diagnostics)
 * Design: Component 19 (Logging and Diagnostics)
 * 
 * @module capture/logger
 */

const fs = require('fs');
const path = require('path');

// Log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

// Configuration
const CONFIG = {
  logLevel: process.env.TABEZA_LOG_LEVEL || 'INFO',
  logPath: process.env.TABEZA_LOG_PATH || path.join('C:', 'ProgramData', 'Tabeza', 'logs'),
  maxLogSize: 10485760, // 10MB
  component: 'capture',
};

/**
 * Logger class for capture script
 */
class CaptureLogger {
  constructor() {
    this.logLevel = LOG_LEVELS[CONFIG.logLevel] || LOG_LEVELS.INFO;
    this.logPath = CONFIG.logPath;
    this.component = CONFIG.component;
    
    // Ensure log directory exists
    this.ensureLogDirectory();
  }
  
  /**
   * Ensure log directory exists
   */
  ensureLogDirectory() {
    try {
      if (!fs.existsSync(this.logPath)) {
        fs.mkdirSync(this.logPath, { recursive: true });
      }
    } catch (error) {
      // If we can't create log directory, log to console only
      console.error(`Failed to create log directory: ${error.message}`);
    }
  }
  
  /**
   * Format log entry
   * 
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   * @returns {Object} Formatted log entry
   */
  formatEntry(level, message, data = {}) {
    return {
      timestamp: new Date().toISOString(),
      level: level,
      component: this.component,
      message: message,
      data: data,
      pid: process.pid,
    };
  }
  
  /**
   * Write log entry to file and console
   * 
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  write(level, message, data = {}) {
    // Check if this level should be logged
    if (LOG_LEVELS[level] > this.logLevel) {
      return;
    }
    
    const entry = this.formatEntry(level, message, data);
    const logLine = JSON.stringify(entry) + '\n';
    
    // Write to console
    const consoleMethod = level === 'ERROR' ? console.error : console.log;
    consoleMethod(`[${level}] ${message}`, data);
    
    // Write to file
    try {
      const logFile = path.join(this.logPath, 'capture.log');
      fs.appendFileSync(logFile, logLine, 'utf8');
      
      // Check file size and rotate if needed
      this.checkRotation(logFile);
    } catch (error) {
      // If we can't write to file, just continue (console output is still available)
      console.error(`Failed to write log: ${error.message}`);
    }
  }
  
  /**
   * Check if log file needs rotation
   * 
   * @param {string} logFile - Path to log file
   */
  checkRotation(logFile) {
    try {
      const stats = fs.statSync(logFile);
      
      if (stats.size > CONFIG.maxLogSize) {
        // Rotate log file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedFile = path.join(
          this.logPath,
          `capture-${timestamp}.log`
        );
        
        fs.renameSync(logFile, rotatedFile);
        console.log(`Log rotated: ${rotatedFile}`);
      }
    } catch (error) {
      // Ignore rotation errors
    }
  }
  
  /**
   * Log error message
   * 
   * @param {string} message - Error message
   * @param {Object} data - Additional data
   */
  error(message, data = {}) {
    this.write('ERROR', message, data);
  }
  
  /**
   * Log warning message
   * 
   * @param {string} message - Warning message
   * @param {Object} data - Additional data
   */
  warn(message, data = {}) {
    this.write('WARN', message, data);
  }
  
  /**
   * Log info message
   * 
   * @param {string} message - Info message
   * @param {Object} data - Additional data
   */
  info(message, data = {}) {
    this.write('INFO', message, data);
  }
  
  /**
   * Log debug message
   * 
   * @param {string} message - Debug message
   * @param {Object} data - Additional data
   */
  debug(message, data = {}) {
    this.write('DEBUG', message, data);
  }
  
  /**
   * Log capture operation with metrics
   * 
   * @param {Object} metrics - Capture metrics
   */
  logCapture(metrics) {
    this.info('Receipt captured', {
      event: 'receipt_captured',
      filename: metrics.filename,
      size: metrics.size,
      duration: metrics.duration,
      success: metrics.success,
    });
  }
  
  /**
   * Log textification operation
   * 
   * @param {Object} metrics - Textification metrics
   */
  logTextify(metrics) {
    this.info('Receipt textified', {
      event: 'receipt_textified',
      inputSize: metrics.inputSize,
      outputSize: metrics.outputSize,
      duration: metrics.duration,
    });
  }
  
  /**
   * Log parsing operation
   * 
   * @param {Object} metrics - Parsing metrics
   */
  logParse(metrics) {
    this.info('Receipt parsed', {
      event: 'receipt_parsed',
      confidence: metrics.confidence,
      success: metrics.success,
      itemCount: metrics.itemCount,
      duration: metrics.duration,
    });
  }
  
  /**
   * Log queue operation
   * 
   * @param {Object} metrics - Queue metrics
   */
  logQueue(metrics) {
    this.info('Receipt queued', {
      event: 'receipt_queued',
      queueId: metrics.queueId,
      barId: metrics.barId,
      parsed: metrics.parsed,
    });
  }
}

// Create singleton instance
const logger = new CaptureLogger();

module.exports = logger;
