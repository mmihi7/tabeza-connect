const fs = require('fs');
const path = require('path');

/**
 * Template Parser
 * 
 * Extracts structured data from plain text receipts using regex patterns
 * defined in template.json. This is the local parser that runs on every
 * receipt capture (1-5ms target).
 * 
 * Template generation happens via cloud AI (DeepSeek) during initial setup.
 * This module only applies the pre-generated template.
 */
class TemplateParser {
  /**
   * Parse receipt text using template patterns
   * @param {string} plainText - Stripped receipt text (ESC/POS codes removed)
   * @param {string} templatePath - Path to template.json
   * @returns {Object} Parsed receipt data
   */
  static parse(plainText, templatePath = 'C:\\ProgramData\\Tabeza\\template.json') {
    const startTime = Date.now();

    // Load template from disk
    const template = this.loadTemplate(templatePath);

    // If no template exists, return unparsed receipt
    if (!template) {
      return {
        parsed: false,
        confidence: 0,
        items: [],
        total: null,
        receiptNumber: null,
        rawText: plainText,
        parseTimeMs: Date.now() - startTime
      };
    }

    // Apply regex patterns to extract data
    const lines = plainText.split('\n');
    const items = [];
    let total = null;
    let receiptNumber = null;
    let matchedPatterns = 0;
    let totalPatterns = 0;

    // Extract receipt number
    if (template.patterns.receipt_number) {
      totalPatterns++;
      const receiptRegex = new RegExp(template.patterns.receipt_number, 'i');
      for (const line of lines) {
        const match = line.match(receiptRegex);
        if (match) {
          receiptNumber = match[1].trim();
          matchedPatterns++;
          break;
        }
      }
    }

    // Extract items
    if (template.patterns.item_line) {
      totalPatterns++;
      const itemRegex = new RegExp(template.patterns.item_line);
      let foundItems = false;
      
      for (const line of lines) {
        const match = line.match(itemRegex);
        if (match) {
          foundItems = true;
          const name = match[1].trim();
          const qty = parseInt(match[2], 10);
          const price = parseFloat(match[3].replace(/,/g, ''));
          
          items.push({ name, qty, price });
        }
      }
      
      if (foundItems) {
        matchedPatterns++;
      }
    }

    // Extract total
    if (template.patterns.total_line) {
      totalPatterns++;
      const totalRegex = new RegExp(template.patterns.total_line, 'i');
      for (const line of lines) {
        const match = line.match(totalRegex);
        if (match) {
          total = parseFloat(match[1].replace(/,/g, ''));
          matchedPatterns++;
          break;
        }
      }
    }

    // Calculate confidence score
    const confidence = this.calculateConfidence(matchedPatterns, totalPatterns);

    // Validate parsed data
    const isValid = this.validate({ items, total, confidence }, template.confidence_threshold || 0.85);

    const parseTimeMs = Date.now() - startTime;

    return {
      parsed: isValid,
      confidence,
      items,
      total,
      receiptNumber,
      rawText: plainText,
      parseTimeMs,
      templateVersion: template.version
    };
  }

  /**
   * Load template from disk
   * @param {string} templatePath - Path to template.json
   * @returns {Object|null} Template object or null if not found
   */
  static loadTemplate(templatePath) {
    try {
      if (!fs.existsSync(templatePath)) {
        return null;
      }

      const templateContent = fs.readFileSync(templatePath, 'utf8');
      const template = JSON.parse(templateContent);

      // Validate template structure
      if (!template.patterns || typeof template.patterns !== 'object') {
        console.warn('[TemplateParser] Invalid template structure: missing patterns');
        return null;
      }

      return template;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist - this is expected before setup
        return null;
      }
      
      if (error instanceof SyntaxError) {
        console.error('[TemplateParser] Malformed template JSON:', error.message);
        return null;
      }

      console.error('[TemplateParser] Error loading template:', error);
      return null;
    }
  }

  /**
   * Calculate confidence score based on match success rate
   * @param {number} matchedPatterns - Number of patterns that matched
   * @param {number} totalPatterns - Total number of patterns in template
   * @returns {number} Confidence score 0.0-1.0
   */
  static calculateConfidence(matchedPatterns, totalPatterns) {
    if (totalPatterns === 0) {
      return 0;
    }
    return matchedPatterns / totalPatterns;
  }

  /**
   * Validate parsed data integrity
   * @param {Object} parsed - Parsed receipt data
   * @param {number} threshold - Minimum confidence threshold
   * @returns {boolean} True if valid
   */
  static validate(parsed, threshold = 0.85) {
    const { items, total, confidence } = parsed;

    // Check confidence threshold
    if (confidence < threshold) {
      return false;
    }

    // If we have items and a total, verify they match
    if (items.length > 0 && total !== null) {
      // Validate all items have required fields
      for (const item of items) {
        if (!item.name || item.name.trim() === '') {
          return false;
        }
        if (!Number.isInteger(item.qty) || item.qty <= 0) {
          return false;
        }
        if (typeof item.price !== 'number' || item.price <= 0) {
          return false;
        }
      }

      // Calculate sum of items
      const calculatedTotal = items.reduce((sum, item) => {
        return sum + (item.qty * item.price);
      }, 0);

      // Verify total matches sum of items (within 0.01 tolerance)
      const difference = Math.abs(calculatedTotal - total);
      if (difference > 0.01) {
        console.warn('[TemplateParser] Total validation failed:', {
          calculatedTotal,
          receiptTotal: total,
          difference
        });
        return false;
      }
    }

    return true;
  }
}

module.exports = TemplateParser;
