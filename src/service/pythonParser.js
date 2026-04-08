/**
 * Python Receipt Parser Wrapper
 * 
 * Replaces JavaScript parser with pure Python parser.
 * Spawns Python subprocess and passes receipt text.
 * Returns parsed data in same format as ReceiptParser.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const { forPrefix } = require('../utils/logger');

const log = forPrefix('[PYTHON-PARSER]');

class PythonReceiptParser {
  constructor() {
    this.templateLoaded = false;
    this.templatePath = null;
    this.pythonScriptPath = null;
    this.stats = {
      parses: 0,
      successful: 0,
      failed: 0,
      avgParseTime: 0,
      lastParseTime: null,
      templateLoaded: false,
      templateErrors: 0,
    };
  }

  /**
   * Initialize parser by locating Python script and checking template.
   */
  async initialize() {
    log.step('Initializing Python receipt parser...');
    try {
      await this.locatePythonScript();
      await this.checkTemplate();
      this.stats.templateLoaded = this.templateLoaded;
      log.ok('Python parser initialized successfully');
      return true;
    } catch (error) {
      log.error('Failed to initialize Python parser', error.message);
      throw error;
    }
  }

  /**
   * Locate receipt_parser.py script in known locations.
   */
  async locatePythonScript() {
    const possiblePaths = [
      'C:/TabezaPrints/receipt_parser.py',               // Production (first priority)
      path.join('C:/TabezaPrints', 'receipt_parser.py'), // Alternative
      path.join(__dirname, '../../capture/receipt_parser.py'), // Development
      path.join(__dirname, '../capture/receipt_parser.py'),
    ];

    for (const scriptPath of possiblePaths) {
      try {
        await fs.access(scriptPath);
        this.pythonScriptPath = scriptPath;
        log.ok(`Python script found at: ${scriptPath}`);
        return;
      } catch (err) {
        // continue
      }
    }

    throw new Error('Python parser script (receipt_parser.py) not found in any known location');
  }

  /**
   * Check if template exists.
   */
  async checkTemplate() {
    const possibleTemplatePaths = [
      'C:/TabezaPrints/templates/template.json',
      'C:/TabezaPrints/template.json',
      'C:/ProgramData/Tabeza/template.json',
    ];

    for (const templatePath of possibleTemplatePaths) {
      try {
        await fs.access(templatePath);
        this.templatePath = templatePath;
        this.templateLoaded = true;
        this.stats.templateLoaded = true;
        log.ok(`Template found at: ${templatePath}`);
        return;
      } catch (err) {
        // continue
      }
    }

    log.warn('No template found in any location; parsing will use fallback');
    this.templateLoaded = false;
    this.stats.templateLoaded = false;
  }

  /**
   * Load template (same as checkTemplate but updates stats).
   */
  async loadTemplate() {
    await this.checkTemplate();
    this.stats.templateLoaded = this.templateLoaded;
  }

  /**
   * Parse receipt text using Python parser.
   * @param {string} receiptText - Clean receipt text
   * @returns {Promise<Object>} - Parse result matching ReceiptParser format
   */
  async parse(receiptText) {
    const startTime = Date.now();
    
    if (!this.pythonScriptPath) {
      throw new Error('Python script path not set; call initialize() first');
    }

    if (!receiptText || typeof receiptText !== 'string') {
      throw new Error('Invalid receipt text');
    }

    try {
      const pythonResult = await this.runPythonParser(receiptText);
      const parseTime = Date.now() - startTime;

      // Transform Python result to match ReceiptParser format
      const result = this.transformResult(pythonResult, parseTime);
      
      // Update stats
      this.updateStats(result.success, parseTime);
      
      return result;
    } catch (error) {
      const parseTime = Date.now() - startTime;
      this.updateStats(false, parseTime);
      throw error;
    }
  }

  /**
   * Spawn Python process and parse receipt text.
   * @param {string} receiptText - Receipt text to parse
   * @returns {Promise<Object>} - Raw Python parser result
   */
  runPythonParser(receiptText) {
    return new Promise((resolve, reject) => {
      log.step(`Spawning Python parser: ${this.pythonScriptPath}`);
      
      const python = spawn('python', [this.pythonScriptPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python parser exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (parseError) {
          reject(new Error(`Failed to parse Python output: ${parseError.message}\nOutput: ${stdout}`));
        }
      });

      python.on('error', (error) => {
        reject(new Error(`Failed to start Python parser: ${error.message}`));
      });

      // Send receipt text to Python
      python.stdin.write(receiptText);
      python.stdin.end();
    });
  }

  /**
   * Transform Python parser result to match ReceiptParser format.
   * Python result shape: { success, items, total, date, time, table_number, item_count, confidence, receiptNumber }
   * ReceiptParser shape: { success, data, confidence, errors, warnings, parseTime, template: { name, version } }
   */
  transformResult(pythonResult, parseTime) {
    const { success, items, total, date, time, table_number, item_count, confidence, receiptNumber, error } = pythonResult;
    
    const result = {
      success: success === true,
      data: {},
      confidence: confidence || 0,
      errors: success ? [] : [error || 'Unknown error'],
      warnings: [],
      parseTime,
      template: {
        name: 'python-parser',
        version: '1.0'
      },
      textLength: 0, // not provided
      fieldMatches: item_count || 0,
      requiredFields: 0
    };

    if (success) {
      // Map fields
      if (items) result.data.items = items;
      if (total !== undefined) result.data.total = total;
      if (date) result.data.date = date;
      if (time) result.data.time = time;
      if (table_number) result.data.table_number = table_number;
      if (receiptNumber) result.data.receiptNumber = receiptNumber;
    }

    return result;
  }

  /**
   * Update parser statistics.
   */
  updateStats(success, parseTime) {
    this.stats.parses++;
    this.stats.lastParseTime = new Date().toISOString();

    if (success) {
      this.stats.successful++;
    } else {
      this.stats.failed++;
    }

    // Update average parse time
    const totalTime = this.stats.avgParseTime * (this.stats.parses - 1) + parseTime;
    this.stats.avgParseTime = Math.round(totalTime / this.stats.parses);
  }

  /**
   * Get parser statistics.
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.parses > 0 
        ? Math.round((this.stats.successful / this.stats.parses) * 100) 
        : 0,
      templatePath: this.templatePath,
      templateLoaded: this.templateLoaded,
      hasTemplate: this.templateLoaded,
    };
  }
}

module.exports = PythonReceiptParser;