/**
 * Local Receipt Parser
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to venue — never the reverse.
 * 
 * This module implements a local regex-based receipt parser that uses
 * stored templates to parse receipt text into structured JSON data.
 * 
 * Template: C:\ProgramData\Tabeza\template.json
 * 
 * Requirements: Design "Component 6: Template Generator", "Model 3: ParsingTemplate"
 */

const fs = require('fs').promises;
const path = require('path');
const { forPrefix } = require('../utils/logger');

const log = forPrefix('[PARSER]');

class ReceiptParser {
  constructor() {
    this.template = null;
    // Check multiple locations in order of preference
    this.templatePaths = [
      path.join('C:', 'TabezaPrints', 'templates', 'template.json'),
      path.join('C:', 'TabezaPrints', 'template.json'),
      path.join('C:', 'ProgramData', 'Tabeza', 'template.json'),
    ];
    this.templatePath = this.templatePaths[0]; // default for saving
    
    // Statistics
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
   * Initialize parser by loading template
   */
  async initialize() {
    log.step('Initializing local receipt parser...');
    
    try {
      await this.loadTemplate();
      log.ok('Receipt parser initialized successfully');
      return true;
    } catch (error) {
      log.error('Failed to initialize receipt parser', error.message);
      throw error;
    }
  }

  /**
   * Load parsing template from disk
   */
  async loadTemplate() {
    // Try each path in order of preference
    for (const templatePath of (this.templatePaths || [this.templatePath])) {
      try {
        const templateData = await fs.readFile(templatePath, 'utf8');
        const parsed = JSON.parse(templateData);
        this.validateTemplate(parsed);
        this.template = parsed;
        this.templatePath = templatePath; // remember which one worked
        this.stats.templateLoaded = true;
        log.ok(`Template loaded from: ${templatePath}`);
        log.info(`Fields: ${this.template.fields?.length || 0}, Version: ${this.template.version || 'Unknown'}`);
        return;
      } catch (error) {
        if (error.code !== 'ENOENT') {
          log.warn(`Template at ${templatePath} invalid: ${error.message}`);
        }
        // try next path
      }
    }
    // None found — use default
    log.warn('No template found in any location, using default parsing');
    this.template = this.getDefaultTemplate();
  }

  /**
   * Validate template structure
   * 
   * @param {Object} template - Template object
   * @throws {Error} - If template is invalid
   */
  validateTemplate(template) {
    if (!template || typeof template !== 'object') {
      throw new Error('Template must be an object');
    }

    if (!template.fields || !Array.isArray(template.fields)) {
      throw new Error('Template must have fields array');
    }

    if (template.fields.length === 0) {
      throw new Error('Template must have at least one field');
    }

    // Validate each field
    template.fields.forEach((field, index) => {
      if (!field.name || typeof field.name !== 'string') {
        throw new Error(`Field ${index} must have a name`);
      }

      // Accept both 'pattern' and 'regex' field names
      const regexPattern = field.pattern || field.regex;
      if (!regexPattern || typeof regexPattern !== 'string') {
        throw new Error(`Field ${field.name} must have a regex pattern`);
      }

      // Test regex validity
      try {
        new RegExp(regexPattern);
      } catch (regexError) {
        throw new Error(`Invalid regex for field ${field.name}: ${regexError.message}`);
      }

      if (!field.type || !['text', 'number', 'date', 'array'].includes(field.type)) {
        throw new Error(`Field ${field.name} has invalid type: ${field.type}`);
      }
    });
  }

  /**
   * Get default template for fallback
   * 
   * @returns {Object} - Default template
   */
  getDefaultTemplate() {
    return {
      name: 'Default Universal Template',
      version: '1.0',
      description: 'Basic template for simple receipt parsing',
      fields: [
        {
          name: 'items',
          regex: '(?:.*?(?:Beer|Soda|Water|Food|Drink).*?(\\d+)\\s*x\\s*(\\d+).*)',
          type: 'array',
          required: true,
          description: 'Extract items with quantity and price'
        },
        {
          name: 'total',
          regex: '.*?TOTAL.*?[\\$\\s]*(\\d+(?:\\.\\d+)?)',
          type: 'number',
          required: true,
          description: 'Extract total amount'
        },
        {
          name: 'timestamp',
          regex: '(\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}\\s+\\d{1,2}:\\d{2}(?:\\s*[AP]M)?)',
          type: 'date',
          required: false,
          description: 'Extract receipt timestamp'
        }
      ]
    };
  }

  /**
   * Parse receipt text using loaded template
   * 
   * @param {string} receiptText - Clean receipt text
   * @returns {Promise<Object>} - Parsed receipt data
   */
  async parse(receiptText) {
    const startTime = Date.now();
    
    try {
      if (!this.template) {
        throw new Error('No template loaded');
      }

      if (!receiptText || typeof receiptText !== 'string') {
        throw new Error('Invalid receipt text');
      }

      const result = {
        success: false,
        data: {},
        confidence: 0,
        errors: [],
        warnings: [],
        parseTime: 0,
        template: {
          name: this.template.name,
          version: this.template.version
        }
      };

      // Clean and normalize text
      const cleanText = this.cleanText(receiptText);
      
      // Parse each field
      let fieldMatches = 0;
      let requiredFields = 0;

      for (const field of this.template.fields) {
        if (field.required) {
          requiredFields++;
        }

        try {
          const fieldValue = this.parseField(cleanText, field);
          log.ok(`Field '${field.name}' parsed: ${JSON.stringify(fieldValue)}`);
          if (fieldValue !== null && fieldValue !== undefined) {
            result.data[field.name] = fieldValue;
            fieldMatches++;
            
            // Calculate field confidence
            const fieldConfidence = this.calculateFieldConfidence(cleanText, field, fieldValue);
            result.confidence += fieldConfidence;
          } else if (field.required) {
            result.errors.push(`Required field '${field.name}' not found`);
          }
        } catch (fieldError) {
          log.error(`Error parsing field '${field.name}': ${fieldError.message}`);
          result.errors.push(`Error parsing field '${field.name}': ${fieldError.message}`);
        }
      }

      // Calculate overall confidence
      result.confidence = Math.round(result.confidence / this.template.fields.length);
      result.success = result.errors.length === 0 && fieldMatches > 0;
      
      // Add metadata
      result.parseTime = Date.now() - startTime;
      result.textLength = cleanText.length;
      result.fieldMatches = fieldMatches;
      result.requiredFields = requiredFields;

      // Update statistics
      this.updateStats(result.success, result.parseTime);

      return result;

    } catch (error) {
      const parseTime = Date.now() - startTime;
      this.updateStats(false, parseTime);
      
      return {
        success: false,
        data: {},
        confidence: 0,
        errors: [error.message],
        warnings: [],
        parseTime,
        template: this.template ? {
          name: this.template.name,
          version: this.template.version
        } : null
      };
    }
  }

  /**
   * Parse a single field using regex
   * 
   * @param {string} text - Clean receipt text
   * @param {Object} field - Field configuration
   * @returns {*} - Parsed field value
   */
  parseField(text, field) {
    const regexPattern = field.pattern || field.regex;
    log.ok(`Parsing field '${field.name}' with pattern: ${regexPattern}`);
    const regex = new RegExp(regexPattern, 'gim'); // Global, case-insensitive, multiline
    const matches = [...text.matchAll(regex)];
    
    log.ok(`Found ${matches.length} matches for field '${field.name}'`);
    
    if (matches.length === 0) {
      return null;
    }

    switch (field.type) {
      case 'text':
        return matches[0][1] || matches[0][0];
        
      case 'number':
        const numStr = matches[matches.length - 1][1] || matches[matches.length - 1][0];
        return parseFloat(numStr.replace(/[^0-9.]/g, ''));
        
      case 'date':
        const dateStr = matches[0][1] || matches[0][0];
        return new Date(dateStr).toISOString();
        
      case 'array':
        log.ok(`Array processing: found ${matches.length} matches for field '${field.name}'`);
        return matches.map((match, index) => {
          const item = {};
          
          // Try to extract named groups from regex
          if (match.groups) {
            Object.keys(match.groups).forEach(key => {
              item[key] = this.convertValue(match.groups[key], field.itemType || 'text');
            });
          } else {
            // Use capture groups with meaningful names for receipt items
            if (match[1] !== undefined) item.qty = this.convertValue(match[1], 'number');
            if (match[2] !== undefined) item.name = this.convertValue(match[2], 'text');
            if (match[3] !== undefined) item.unit_price = this.convertValue(match[3], 'number');
            if (match[4] !== undefined) item.subtotal = this.convertValue(match[4], 'number');
            
            log.ok(`Item ${index + 1}: qty=${item.qty}, name=${item.name}, unit_price=${item.unit_price}, subtotal=${item.subtotal}`);
          }
          
          return item;
        });
        
      default:
        return matches[0][0];
    }
  }

  /**
   * Convert value based on type
   * 
   * @param {string} value - Raw value
   * @param {string} type - Target type
   * @returns {*} - Converted value
   */
  convertValue(value, type) {
    if (!value) return null;
    
    switch (type) {
      case 'number':
        return parseFloat(value.replace(/[^0-9.]/g, ''));
      case 'date':
        return new Date(value).toISOString();
      default:
        return value.toString().trim();
    }
  }

  /**
   * Clean and normalize receipt text
   * 
   * @param {string} text - Raw receipt text
   * @returns {string} - Cleaned text
   */
  cleanText(text) {
    return text
      // Remove printer control characters (keep newline \x0A and carriage return \x0D)
      .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Normalize line endings
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Collapse multiple spaces/tabs within lines (but keep newlines)
      .replace(/[ \t]+/g, ' ')
      // Remove empty lines
      .replace(/\n\s*\n/g, '\n')
      // Trim
      .trim();
  }

  /**
   * Calculate confidence score for a field match
   * 
   * @param {string} text - Receipt text
   * @param {Object} field - Field configuration
   * @param {*} value - Parsed value
   * @returns {number} - Confidence score (0-100)
   */
  calculateFieldConfidence(text, field, value) {
    let confidence = 50; // Base confidence
    
    // Boost confidence for required fields
    if (field.required) {
      confidence += 20;
    }
    
    // Boost confidence for exact matches
    if (typeof value === 'string' && text.includes(value)) {
      confidence += 15;
    }
    
    // Boost confidence for number patterns
    if (field.type === 'number' && !isNaN(value)) {
      confidence += 10;
    }
    
    // Boost confidence for date patterns
    if (field.type === 'date' && !isNaN(Date.parse(value))) {
      confidence += 10;
    }
    
    // Boost confidence for arrays with multiple matches
    if (field.type === 'array' && Array.isArray(value) && value.length > 0) {
      confidence += Math.min(value.length * 5, 20);
    }
    
    return Math.min(confidence, 100);
  }

  /**
   * Update parser statistics
   * 
   * @param {boolean} success - Parse success
   * @param {number} parseTime - Parse time in ms
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
   * Get parser statistics
   * 
   * @returns {Object} - Parser statistics
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.parses > 0 
        ? Math.round((this.stats.successful / this.stats.parses) * 100) 
        : 0,
      templatePath: this.templatePath,
      templateLoaded: this.stats.templateLoaded,
      hasTemplate: !!this.template,
    };
  }

  /**
   * Test template against sample receipts
   * 
   * @param {Array<string>} samples - Sample receipt texts
   * @returns {Promise<Object>} - Test results
   */
  async testTemplate(samples) {
    if (!this.template) {
      throw new Error('No template loaded for testing');
    }

    const results = {
      template: {
        name: this.template.name,
        version: this.template.version,
        fields: this.template.fields.length
      },
      samples: samples.length,
      tests: [],
      summary: {
        total: samples.length,
        successful: 0,
        failed: 0,
        avgConfidence: 0,
        avgParseTime: 0
      }
    };

    let totalConfidence = 0;
    let totalParseTime = 0;

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      const testResult = await this.parse(sample);
      
      results.tests.push({
        sampleIndex: i,
        success: testResult.success,
        confidence: testResult.confidence,
        errors: testResult.errors,
        warnings: testResult.warnings,
        parseTime: testResult.parseTime,
        fieldMatches: testResult.fieldMatches,
        requiredFields: testResult.requiredFields
      });

      if (testResult.success) {
        results.summary.successful++;
      } else {
        results.summary.failed++;
      }

      totalConfidence += testResult.confidence;
      totalParseTime += testResult.parseTime;
    }

    results.summary.avgConfidence = Math.round(totalConfidence / samples.length);
    results.summary.avgParseTime = Math.round(totalParseTime / samples.length);

    return results;
  }

  /**
   * Save template to disk
   * 
   * @param {Object} template - Template to save
   * @returns {Promise<void>}
   */
  async saveTemplate(template) {
    try {
      this.validateTemplate(template);
      
      const templateData = JSON.stringify(template, null, 2);
      await fs.writeFile(this.templatePath, templateData, 'utf8');
      
      this.template = template;
      this.stats.templateLoaded = true;
      
      log.ok(`Template saved: ${template.name || 'Unknown'}`);
    } catch (error) {
      throw new Error(`Failed to save template: ${error.message}`);
    }
  }
}

module.exports = ReceiptParser;
