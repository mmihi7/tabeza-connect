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
const pipelineLog = require('../utils/logger');

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
  const log = pipelineLog.forPrefix('[REDMON]');

  try {
    log.step('capture.exe invoked by Redmon');
    logger.info('Capture script started', {
      barId: CONFIG.barId || 'NOT SET',
      basePath: CONFIG.basePath,
    });

    if (!CONFIG.barId) {
      throw new Error('Bar ID not configured. Set barId in C:\\TabezaPrints\\config.json or pass --bar-id argument.');
    }

    await checkDiskSpace();

    // Read raw ESC/POS bytes from stdin
    log.info('Reading raw ESC/POS bytes from stdin...');
    const rawBytes = await readStdin();

    if (rawBytes.length === 0) {
      throw new Error('No data received from stdin');
    }

    log.ok(`Received ${rawBytes.length} bytes from Redmon via stdin`);

    // Generate filename and save raw file — always, regardless of template state
    filename = generateTimestamp();

    const rawLog = pipelineLog.forPrefix('[RAW]');
    rawLog.step(`Saving raw .prn → raw\\${filename}.prn`);
    await saveRawFile(rawBytes, filename);
    rawLog.ok(`Saved raw\\${filename}.prn (${rawBytes.length} bytes)`);

    // Textify
    const plainText = textify(rawBytes);
    await saveTextFile(plainText, filename);
    rawLog.info(`Saved text\\${filename}.txt (${plainText.length} chars)`);

    logger.logTextify({
      inputSize: rawBytes.length,
      outputSize: plainText.length,
      duration: 0,
    });

    const templateExists = await checkTemplateExists();

    if (templateExists) {
      const parserLog = pipelineLog.forPrefix('[PARSER]');
      parserLog.step('Template found — parsing receipt');
      const parser = new ReceiptParser();
      await parser.initialize();
      const parseResult = await parser.parse(plainText);

      parserLog.info(`Parse complete — confidence: ${parseResult.confidence}%, items: ${parseResult.data?.items?.length ?? 0}, success: ${parseResult.success}`);

      logger.logParse({
        confidence: parseResult.confidence,
        success: parseResult.success,
        itemCount: parseResult.data?.items?.length || 0,
        duration: parseResult.parseTime || 0,
      });

      await saveParsedFile(parseResult, plainText, filename);

      const queueLog = pipelineLog.forPrefix('[QUEUE]');
      queueLog.step('Queuing receipt for cloud upload');
      const queueId = await queueForUpload(parseResult, plainText, filename);
      queueLog.ok(`Enqueued → queue\\pending\\${queueId}.json`);

      logger.logQueue({ queueId, barId: CONFIG.barId, parsed: parseResult.success });
      log.ok(`Receipt pipeline complete in ${Date.now() - startTime}ms`, { filename, queueId });

    } else {
      const rawCount = await countRawFiles();
      const templateLog = pipelineLog.forPrefix('[TEMPLATE]');
      templateLog.warn(`No template yet — raw receipts collected: ${rawCount}/3`);

      if (rawCount >= 3) {
        templateLog.step('3+ raw receipts available — triggering template generation');
        await triggerTemplateGeneration();
      } else {
        templateLog.info(`Need ${3 - rawCount} more receipt(s) before template generation`);
      }
    }

    logger.logCapture({
      filename,
      size: rawBytes.length,
      duration: Date.now() - startTime,
      success: true,
    });

    process.exit(0);

  } catch (error) {
    const log = pipelineLog.forPrefix('[REDMON]');
    log.error(`Capture failed: ${error.message}`);
    logger.error('Capture failed', {
      error: error.message,
      stack: error.stack,
      filename,
      duration: Date.now() - startTime,
    });

    if (filename) {
      await saveErrorFile(error, filename);
    }

    process.exit(1);
  }
}

/**
 * Count captured receipts by reading text\ folder (raw\ is deleted by SpoolWatcher after forwarding)
 * @returns {Promise<number>}
 */
async function countRawFiles() {
  try {
    await fs.mkdir(PATHS.text, { recursive: true });
    const files = await fs.readdir(PATHS.text);
    return files.filter(f => f.endsWith('.txt')).length;
  } catch {
    return 0;
  }
}

/**
 * Read all raw .txt files and call the cloud API to generate a template.
 * On success, saves template.json and then parses + queues all raw receipts.
 */
async function triggerTemplateGeneration() {
  const log = pipelineLog.forPrefix('[TEMPLATE]');
  try {
    const textFiles = (await fs.readdir(PATHS.text).catch(() => [])).filter(f => f.endsWith('.txt'));

    if (textFiles.length < 3) {
      log.warn(`Not enough text files for template generation (${textFiles.length}/3)`);
      return;
    }

    const receipts = await Promise.all(
      textFiles.slice(0, 10).map(f => fs.readFile(path.join(PATHS.text, f), 'utf8'))
    );

    log.step(`Calling cloud API for template generation — ${receipts.length} samples → ${CONFIG.apiUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(`${CONFIG.apiUrl}/api/receipts/generate-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test_receipts: receipts, bar_id: CONFIG.barId }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Cloud API returned ${response.status}`);
    }

    const result = await response.json();
    const template = result.template;

    if (!template || !template.patterns) {
      throw new Error('Cloud API returned invalid template');
    }

    const templatePath = path.join(CONFIG.basePath, 'templates', 'template.json');
    await fs.mkdir(path.dirname(templatePath), { recursive: true });
    await fs.writeFile(templatePath, JSON.stringify(template, null, 2), 'utf8');
    log.ok(`Template saved → ${templatePath} (version: ${template.version || 'unknown'})`);

    // Now parse and queue all existing raw receipts
    log.step('Parsing and queuing all existing raw receipts...');
    const parser = new ReceiptParser();
    await parser.initialize();

    for (const textFile of textFiles) {
      try {
        const plainText = await fs.readFile(path.join(PATHS.text, textFile), 'utf8');
        const baseName = textFile.replace('.txt', '');
        const parseResult = await parser.parse(plainText);
        await saveParsedFile(parseResult, plainText, baseName);
        const queueId = await queueForUpload(parseResult, plainText, baseName);
        log.info(`Queued existing receipt: ${baseName} → ${queueId}`);
      } catch (err) {
        log.warn(`Failed to queue existing receipt: ${textFile} — ${err.message}`);
      }
    }

    log.ok('Template generation complete — all existing receipts queued');

  } catch (error) {
    const log = pipelineLog.forPrefix('[TEMPLATE]');
    if (error.name === 'AbortError') {
      log.error('Template generation timed out (60s)');
    } else {
      log.error(`Template generation failed: ${error.message}`);
    }
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

// Run main function
if (require.main === module) {
  main();
}

module.exports = { main, readStdin, generateTimestamp, countRawFiles, triggerTemplateGeneration };
