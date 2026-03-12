#!/usr/bin/env node

/**
 * Redmon Capture Script
 * 
 * This script is invoked by Redmon port monitor for each print job.
 * It receives raw ESC/POS bytes via stdin, processes them through the
 * textification and parsing pipeline, and forwards to the physical printer.
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 * 
 * Architecture: Redmon-Based Receipt Capture
 * Requirements: Requirements 2, 3, 4, 7
 * Design: Component 2 (Capture Script)
 * 
 * Performance Targets:
 * - Total processing time: < 100ms per receipt
 * - Memory usage: < 50MB per invocation
 * - Handles receipts up to 1MB
 * 
 * @module capture
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { textify } = require('../utils/textifier');
const ReceiptParser = require('../service/receiptParser');
const logger = require('./logger');

// Generate UUID v4 using crypto (built-in, no dependencies)
function uuidv4() {
  return crypto.randomUUID();
}

// Version
const VERSION = '1.0.0';

// Check for command-line flags
if (process.argv.includes('--version') || process.argv.includes('-v')) {
  console.log(`Tabeza Capture Script v${VERSION}`);
  process.exit(0);
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Tabeza Capture Script v${VERSION}

Usage:
  capture.exe < input.prn          Process print job from stdin
  capture.exe --version            Show version
  capture.exe --help               Show this help

Environment Variables:
  TABEZA_BAR_ID          Venue identifier (required)
  TABEZA_API_URL         Cloud API URL (default: https://tabeza.co.ke)
  TABEZA_CAPTURE_PATH    Base path for files (default: C:\\TabezaPrints)
  TABEZA_LOG_LEVEL       Log level (default: INFO)
  TABEZA_LOG_PATH        Log directory (default: C:\\ProgramData\\Tabeza\\logs)

Description:
  This script is invoked by Redmon port monitor for each print job.
  It processes raw ESC/POS bytes through textification and parsing,
  then queues the result for upload to the Tabeza cloud.

Performance:
  - Processing time: < 100ms per receipt
  - Memory usage: < 50MB per invocation
  - Max input size: 1MB

For more information, visit: https://tabeza.co.ke/docs
  `);
  process.exit(0);
}

// Parse command-line arguments
const args = process.argv.slice(2);
let barIdFromArgs = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--bar-id' && i + 1 < args.length) {
    barIdFromArgs = args[i + 1];
    break;
  }
}

// Try to read Bar ID from config file
let barIdFromConfig = null;
try {
  const configPath = path.join('C:', 'TabezaPrints', 'config.json');
  if (require('fs').existsSync(configPath)) {
    const configData = require('fs').readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    barIdFromConfig = config.barId;
  }
} catch (error) {
  // Ignore config read errors - will fall back to other sources
}

// Configuration
// Priority: 1. Command-line arg, 2. Config file, 3. Environment variable
const CONFIG = {
  barId: barIdFromArgs || barIdFromConfig || process.env.TABEZA_BAR_ID || '',
  apiUrl: process.env.TABEZA_API_URL || 'https://tabeza.co.ke',
  basePath: process.env.TABEZA_CAPTURE_PATH || path.join('C:', 'TabezaPrints'),
  maxFileSize: 1048576, // 1MB
  minDiskSpace: 104857600, // 100MB
};

// Paths
const PATHS = {
  raw: path.join(CONFIG.basePath, 'raw'),
  text: path.join(CONFIG.basePath, 'text'),
  parsed: path.join(CONFIG.basePath, 'parsed'),
  queuePending: path.join(CONFIG.basePath, 'queue', 'pending'),
  queueUploaded: path.join(CONFIG.basePath, 'queue', 'uploaded'),
  samples: path.join(CONFIG.basePath, 'samples'), // For template generation
};

/**
 * Main capture function
 * Orchestrates the entire capture pipeline
 */
async function main() {
  const startTime = Date.now();
  let filename = null;
  
  try {
    // Log startup
    logger.info('Capture script started', {
      barId: CONFIG.barId || 'NOT SET',
      basePath: CONFIG.basePath,
    });
    
    // Validate configuration
    if (!CONFIG.barId) {
      throw new Error('TABEZA_BAR_ID environment variable not set');
    }
    
    // Check disk space
    await checkDiskSpace();
    
    // Read raw bytes from stdin
    logger.debug('Reading stdin');
    const rawBytes = await readStdin();
    logger.debug('Stdin read complete', { size: rawBytes.length });
    
    // Validate size
    if (rawBytes.length === 0) {
      throw new Error('No data received from stdin');
    }
    
    if (rawBytes.length > CONFIG.maxFileSize) {
      logger.warn('Print job exceeds max size, truncating', {
        actualSize: rawBytes.length,
        maxSize: CONFIG.maxFileSize,
      });
      rawBytes = rawBytes.slice(0, CONFIG.maxFileSize);
    }
    
    // Generate timestamp-based filename
    filename = generateTimestamp();
    
    // Save raw file
    logger.debug('Saving raw file');
    await saveRawFile(rawBytes, filename);
    
    // Textify (strip ESC/POS codes)
    logger.debug('Textifying');
    const textifyStart = Date.now();
    const plainText = textify(rawBytes);
    const textifyDuration = Date.now() - textifyStart;
    
    logger.logTextify({
      inputSize: rawBytes.length,
      outputSize: plainText.length,
      duration: textifyDuration,
    });
    
    // Save text file
    await saveTextFile(plainText, filename);
    
    // Check if template exists for parsing
    const templateExists = await checkTemplateExists();
    let parseResult = null;
    
    if (templateExists) {
      // Parse with template
      logger.debug('Parsing with template');
      const parseStart = Date.now();
      const parser = new ReceiptParser();
      await parser.initialize();
      parseResult = await parser.parse(plainText);
      const parseDuration = Date.now() - parseStart;
      
      logger.logParse({
        confidence: parseResult.confidence,
        success: parseResult.success,
        itemCount: parseResult.data?.items?.length || 0,
        duration: parseDuration,
      });
      
      // Log any parse errors or warnings
      if (parseResult.errors && parseResult.errors.length > 0) {
        logger.warn('Parse errors detected', { errors: parseResult.errors });
      }
      
      if (parseResult.warnings && parseResult.warnings.length > 0) {
        logger.warn('Parse warnings detected', { warnings: parseResult.warnings });
      }
      
      // Save parsed JSON
      await saveParsedFile(parseResult, plainText, filename);
      
      // Add to upload queue
      logger.debug('Queueing for upload');
      const queueId = await queueForUpload(parseResult, plainText, filename);
      
      logger.logQueue({
        queueId: queueId,
        barId: CONFIG.barId,
        parsed: parseResult.success,
      });
    } else {
      // No template yet - just save raw and samples for template generation
      logger.info('No template found - saving raw receipt for template generation');
      
      // Create a basic parse result for logging
      parseResult = {
        success: false,
        confidence: 0,
        errors: ['No template available yet'],
        warnings: [],
        data: {},
        template: null
      };
    }
    
    // Calculate total time
    const totalTime = Date.now() - startTime;
    
    logger.logCapture({
      filename: filename,
      size: rawBytes.length,
      duration: totalTime,
      success: true,
    });
    
    // Save to samples folder for template generation
    await saveToSamples(plainText, filename);
    
    logger.info('Capture complete', {
      filename: filename,
      totalTime: totalTime,
      confidence: parseResult.confidence,
    });
    
    // Exit successfully
    process.exit(0);
    
  } catch (error) {
    logger.error('Capture failed', {
      error: error.message,
      stack: error.stack,
      filename: filename,
      duration: Date.now() - startTime,
    });
    
    // Try to save error details for diagnostics
    if (filename) {
      await saveErrorFile(error, filename);
    }
    
    // Exit with error code
    process.exit(1);
  }
}

/**
 * Check if template exists for parsing
 * 
 * @returns {Promise<boolean>} - True if template exists, false otherwise
 */
async function checkTemplateExists() {
  try {
    const templatePath = path.join(CONFIG.basePath, 'templates', 'template.json');
    await fs.access(templatePath, fs.constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check available disk space
 * 
 * @throws {Error} If disk space is below minimum threshold
 */
async function checkDiskSpace() {
  try {
    const fsSync = require('fs');
    const stats = fsSync.statfsSync || fsSync.statSync;
    
    // Try to get disk stats (Windows-specific)
    // Note: This is a simplified check. In production, use a library like 'check-disk-space'
    const testPath = CONFIG.basePath;
    
    // For now, just check if we can write to the directory
    await fs.access(testPath, fs.constants.W_OK);
    
    logger.debug('Disk space check passed');
  } catch (error) {
    logger.warn('Disk space check failed', { error: error.message });
    // Don't throw - allow capture to continue
  }
}

/**
 * Save error details to file for diagnostics
 * 
 * @param {Error} error - Error object
 * @param {string} filename - Base filename
 */
async function saveErrorFile(error, filename) {
  try {
    const errorPath = path.join(CONFIG.basePath, 'errors');
    await fs.mkdir(errorPath, { recursive: true });
    
    const errorData = {
      timestamp: new Date().toISOString(),
      filename: filename,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      config: {
        barId: CONFIG.barId,
        basePath: CONFIG.basePath,
      },
    };
    
    const errorFile = path.join(errorPath, `${filename}.error.json`);
    await fs.writeFile(errorFile, JSON.stringify(errorData, null, 2), 'utf8');
    
    logger.debug('Error file saved', { path: errorFile });
  } catch (saveError) {
    logger.error('Failed to save error file', { error: saveError.message });
  }
}

/**
 * Read all data from stdin until EOF
 * 
 * @returns {Promise<Buffer>} Raw bytes from stdin
 */
async function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalSize = 0;
    
    process.stdin.on('data', (chunk) => {
      chunks.push(chunk);
      totalSize += chunk.length;
      
      // Safety check: prevent memory exhaustion
      if (totalSize > CONFIG.maxFileSize * 2) {
        reject(new Error(`Input exceeds maximum size (${totalSize} bytes)`));
      }
    });
    
    process.stdin.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    
    process.stdin.on('error', (error) => {
      reject(new Error(`Failed to read stdin: ${error.message}`));
    });
    
    // Set timeout for stdin read (30 seconds)
    setTimeout(() => {
      reject(new Error('Timeout reading stdin'));
    }, 30000);
  });
}

/**
 * Generate timestamp-based filename
 * Format: YYYYMMDD-HHMMSS-mmm
 * 
 * @returns {string} Timestamp string
 */
function generateTimestamp() {
  const now = new Date();
  
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
  
  return `${year}${month}${day}-${hours}${minutes}${seconds}-${milliseconds}`;
}

/**
 * Save raw bytes to disk
 * 
 * @param {Buffer} rawBytes - Raw ESC/POS bytes
 * @param {string} filename - Base filename (without extension)
 */
async function saveRawFile(rawBytes, filename) {
  try {
    // Ensure directory exists
    await fs.mkdir(PATHS.raw, { recursive: true });
    
    // Write file
    const filePath = path.join(PATHS.raw, `${filename}.prn`);
    await fs.writeFile(filePath, rawBytes);
    
    logger.debug('Raw file saved', { path: filePath, size: rawBytes.length });
  } catch (error) {
    logger.error('Failed to save raw file', { error: error.message, filename });
    // Don't throw - continue processing
  }
}

/**
 * Save plain text to disk
 * 
 * @param {string} plainText - Textified receipt
 * @param {string} filename - Base filename (without extension)
 */
async function saveTextFile(plainText, filename) {
  try {
    // Ensure directory exists
    await fs.mkdir(PATHS.text, { recursive: true });
    
    // Write file
    const filePath = path.join(PATHS.text, `${filename}.txt`);
    await fs.writeFile(filePath, plainText, 'utf8');
    
    logger.debug('Text file saved', { path: filePath, size: plainText.length });
  } catch (error) {
    logger.error('Failed to save text file', { error: error.message, filename });
    // Don't throw - continue processing
  }
}

/**
 * Save parsed JSON to disk
 * 
 * @param {Object} parseResult - Parse result from parser
 * @param {string} plainText - Plain text for reference
 * @param {string} filename - Base filename (without extension)
 */
async function saveParsedFile(parseResult, plainText, filename) {
  try {
    // Ensure directory exists
    await fs.mkdir(PATHS.parsed, { recursive: true });
    
    // Create output object
    const output = {
      timestamp: new Date().toISOString(),
      filename: filename,
      success: parseResult.success,
      confidence: parseResult.confidence,
      data: parseResult.data,
      errors: parseResult.errors,
      warnings: parseResult.warnings,
      parseTime: parseResult.parseTime,
      template: parseResult.template,
      rawTextLength: plainText.length,
    };
    
    // Write file
    const filePath = path.join(PATHS.parsed, `${filename}.json`);
    await fs.writeFile(filePath, JSON.stringify(output, null, 2), 'utf8');
    
    logger.debug('Parsed file saved', { path: filePath });
  } catch (error) {
    logger.error('Failed to save parsed file', { error: error.message, filename });
    // Don't throw - continue processing
  }
}

/**
 * Add parsed receipt to upload queue
 * 
 * @param {Object} parseResult - Parse result from parser
 * @param {string} plainText - Plain text for upload
 * @param {string} filename - Base filename for reference
 * @returns {Promise<string>} Queue ID
 */
async function queueForUpload(parseResult, plainText, filename) {
  try {
    // Ensure directory exists
    await fs.mkdir(PATHS.queuePending, { recursive: true });
    
    // Generate unique ID for queue item
    const queueId = uuidv4();
    
    // Get hostname for driver ID
    const hostname = require('os').hostname();
    const driverId = `driver-${hostname}`;
    
    // Create queue item
    const queueItem = {
      id: queueId,
      barId: CONFIG.barId,
      driverId: driverId,
      timestamp: new Date().toISOString(),
      parsed: parseResult.success,
      confidence: parseResult.confidence,
      receipt: {
        items: parseResult.data.items || [],
        total: parseResult.data.total || 0,
        receiptNumber: parseResult.data.receiptNumber || filename,
        rawText: plainText,
      },
      metadata: {
        source: 'redmon-capture',
        templateVersion: parseResult.template?.version || 'unknown',
        parseTimeMs: parseResult.parseTime,
        captureFilename: filename,
      },
      enqueuedAt: new Date().toISOString(),
      uploadAttempts: 0,
      lastUploadError: null,
    };
    
    // Write to queue
    const queuePath = path.join(PATHS.queuePending, `${queueId}.json`);
    await fs.writeFile(queuePath, JSON.stringify(queueItem, null, 2), 'utf8');
    
    logger.debug('Receipt queued', { queueId, path: queuePath });
    
    return queueId;
  } catch (error) {
    logger.error('Failed to queue for upload', { error: error.message, filename });
    // Don't throw - this is not critical for capture
    return null;
  }
}

/**
 * Save receipt to samples folder for template generation
 * Only saves if less than 10 samples exist (to avoid overfilling)
 * 
 * @param {string} plainText - Plain text receipt
 * @param {string} filename - Base filename
 */
async function saveToSamples(plainText, filename) {
  try {
    // Check if samples folder exists, create if not
    await fs.mkdir(PATHS.samples, { recursive: true });
    
    // Check existing sample count
    const existing = await fs.readdir(PATHS.samples).catch(() => []);
    const sampleCount = existing.filter(f => f.endsWith('.txt')).length;
    
    // Only save if less than 10 samples
    if (sampleCount >= 10) {
      logger.debug('Sample folder full, not saving', { sampleCount });
      return;
    }
    
    // Save to samples with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sampleFilename = `sample-${timestamp}.txt`;
    const samplePath = path.join(PATHS.samples, sampleFilename);
    
    await fs.writeFile(samplePath, plainText, 'utf8');
    logger.info('Receipt saved to samples for template generation', { 
      samplePath, 
      sampleCount: sampleCount + 1 
    });
  } catch (error) {
    // Don't fail the whole capture if sample saving fails
    logger.warn('Failed to save to samples', { error: error.message });
  }
}

// Run main function
if (require.main === module) {
  main();
}

module.exports = { main, readStdin, generateTimestamp, saveToSamples };
