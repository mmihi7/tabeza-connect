/**
 * File Handler
 * 
 * Handles post-processing of order.prn file:
 * - Truncates order.prn to 0 bytes (file must stay on disk)
 * - Archives timestamped copies to processed/ or failed/ folders
 */

const fs = require('fs').promises;
const path = require('path');

class FileHandler {
  constructor(config) {
    this.config = config;
    this.processedFolder = path.join(config.watchFolder, 'processed');
    this.failedFolder = path.join(config.watchFolder, 'failed');
  }

  /**
   * Initialize folders
   */
  async initialize() {
    try {
      await fs.mkdir(this.processedFolder, { recursive: true });
      await fs.mkdir(this.failedFolder, { recursive: true });
      console.log('[FileHandler] Folders initialized');
    } catch (error) {
      console.error('[FileHandler] Error creating folders:', error);
      throw error;
    }
  }

  /**
   * Truncate order.prn to 0 bytes (file must stay on disk)
   * @param {string} filePath - Path to order.prn
   */
  async truncateOrderFile(filePath) {
    try {
      await fs.truncate(filePath, 0);
      console.log('[FileHandler] Truncated order.prn to 0 bytes');
    } catch (error) {
      console.error('[FileHandler] Error truncating file:', error);
      throw error;
    }
  }

  /**
   * Archive timestamped copy to processed/ folder
   * @param {Buffer} rawData - Raw receipt data
   */
  async archiveSuccess(rawData) {
    const timestamp = this._getTimestamp();
    const archivePath = path.join(this.processedFolder, `${timestamp}.prn`);

    try {
      await fs.writeFile(archivePath, rawData);
      console.log(`[FileHandler] Archived to: ${archivePath}`);
    } catch (error) {
      // Log warning but don't throw - archiving is not critical
      console.warn('[FileHandler] Warning: Failed to archive to processed/', error.message);
    }
  }

  /**
   * Archive timestamped copy to failed/ folder
   * @param {Buffer} rawData - Raw receipt data
   * @param {Error} parseError - The error that occurred
   */
  async archiveFailure(rawData, parseError) {
    const timestamp = this._getTimestamp();
    const archivePath = path.join(this.failedFolder, `${timestamp}.prn`);

    try {
      // Write raw data
      await fs.writeFile(archivePath, rawData);
      
      // Write error details to companion .txt file
      const errorPath = path.join(this.failedFolder, `${timestamp}.txt`);
      const errorDetails = `Error: ${parseError.message}\nStack: ${parseError.stack}\nTime: ${new Date().toISOString()}`;
      await fs.writeFile(errorPath, errorDetails);

      console.log(`[FileHandler] Archived failure to: ${archivePath}`);
    } catch (error) {
      // Log warning but don't throw - archiving is not critical
      console.warn('[FileHandler] Warning: Failed to archive to failed/', error.message);
    }
  }

  /**
   * Get timestamp in YYYYMMDD-HHMMSS format
   * @private
   */
  _getTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}-${hours}${minutes}${seconds}`;
  }
}

module.exports = FileHandler;
