/**
 * Receipt Parser Module
 * 
 * CORE TRUTH: Manual service always exists. Digital authority is singular.
 * Tabeza adapts to the venue — never the reverse.
 * 
 * This module extracts structured data from receipt text using configurable
 * regex templates. It implements a never-reject guarantee: all inputs return
 * valid result objects, even on parsing failure.
 * 
 * Error Handling Strategy:
 * - Never throw exceptions for any input
 * - Return low confidence data on parsing failure
 * - Log all parsing errors locally
 * - Always return a valid result object
 */

/**
 * Default parsing template for common POS formats
 * Based on Tusker Lager test receipt format
 * 
 * Pattern Explanations:
 * - receiptNumber: Matches "Receipt #: RCP-2024-001234" or "Receipt: 12345"
 * - timestamp: Matches dates like "12/15/2024 8:45:30 PM" or "1/5/2024 14:30"
 * - items.pattern: Matches lines like "2    Tusker Lager 500ml         500.00"
 *   - Group 1: Quantity (digits)
 *   - Group 2: Item name (everything before 2+ spaces and price)
 *   - Group 3: Price (decimal number with optional commas)
 *   Requires at least 2 spaces before price to distinguish from item names
 * - items.startMarker: Detects the header line "QTY  ITEM  AMOUNT"
 * - items.endMarker: Stops at separator lines (---) or totals section
 * - subtotal: Matches "Subtotal: 2,210.00" or "Subtotal 2210.00"
 * - tax: Matches "VAT (16%): 353.60" or "Tax: 353.60" or "VAT: 353.60"
 * - total: Matches "TOTAL: 2,563.60" at start of line (case insensitive)
 */
const DEFAULT_TEMPLATE = {
  receiptNumber: 'Receipt\\s*#?:?\\s*(\\S+)',
  timestamp: '(\\d{1,2}/\\d{1,2}/\\d{4}\\s+\\d{1,2}:\\d{2}(?::\\d{2})?(?:\\s*[AP]M)?)',
  items: {
    pattern: '^(\\d+)\\s+(.+?)\\s{2,}(\\d+(?:,\\d{3})*\\.\\d{2})\\s*$',
    multiline: true,
    startMarker: 'QTY\\s+ITEM\\s+AMOUNT',
    endMarker: '^-{3,}|Subtotal|Total'
  },
  subtotal: 'Subtotal:?\\s*(\\d+(?:,\\d{3})*\\.\\d{2})',
  tax: '(?:VAT|Tax)(?:\\s*\\(\\d+%\\))?:?\\s*(\\d+(?:,\\d{3})*\\.\\d{2})',
  total: '^\\s*TOTAL:?\\s*(\\d+(?:,\\d{3})*\\.\\d{2})'
};

/**
 * Validate a regex pattern before use
 * @param {string} pattern - Regex pattern to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validatePattern(pattern) {
  try {
    if (!pattern || typeof pattern !== 'string') {
      return false;
    }
    new RegExp(pattern);
    return true;
  } catch (error) {
    console.error('[Receipt Parser] Invalid regex pattern:', pattern, error.message);
    return false;
  }
}

/**
 * Extract a single field using a regex pattern
 * @param {string} text - Text to search
 * @param {string} pattern - Regex pattern with capture group
 * @param {string} fieldName - Field name for logging
 * @returns {string|null} Extracted value or null
 */
function extractField(text, pattern, fieldName) {
  try {
    if (!text || !pattern) {
      return null;
    }

    if (!validatePattern(pattern)) {
      console.error(`[Receipt Parser] Invalid pattern for ${fieldName}`);
      return null;
    }

    const regex = new RegExp(pattern, 'im');
    const match = text.match(regex);
    
    if (match && match[1]) {
      return match[1].trim();
    }
    
    return null;
  } catch (error) {
    console.error(`[Receipt Parser] Error extracting ${fieldName}:`, error.message);
    return null;
  }
}

/**
 * Extract items from receipt text
 * @param {string} text - Receipt text
 * @param {object} itemsConfig - Items configuration from template
 * @returns {Array} Array of item objects
 */
function extractItems(text, itemsConfig) {
  try {
    if (!text || !itemsConfig || !itemsConfig.pattern) {
      return [];
    }

    if (!validatePattern(itemsConfig.pattern)) {
      console.error('[Receipt Parser] Invalid items pattern');
      return [];
    }

    const lines = text.split('\n');
    const items = [];
    let inItemsSection = !itemsConfig.startMarker;
    let foundFirstSeparator = false;

    for (const line of lines) {
      try {
        // Check for start marker
        if (itemsConfig.startMarker && !inItemsSection) {
          const startRegex = new RegExp(itemsConfig.startMarker, 'i');
          if (startRegex.test(line)) {
            inItemsSection = true;
            continue;
          }
        }

        // Skip the first separator line after the header
        if (inItemsSection && !foundFirstSeparator) {
          const endRegex = new RegExp(itemsConfig.endMarker, 'i');
          if (endRegex.test(line)) {
            foundFirstSeparator = true;
            continue;
          }
        }

        // Check for end marker (after we've found the first separator)
        if (itemsConfig.endMarker && inItemsSection && foundFirstSeparator) {
          const endRegex = new RegExp(itemsConfig.endMarker, 'i');
          if (endRegex.test(line)) {
            break;
          }
        }

        // Extract item if in section
        if (inItemsSection && foundFirstSeparator) {
          const itemRegex = new RegExp(itemsConfig.pattern);
          const match = line.match(itemRegex);
          
          if (match && match.length >= 4) {
            const quantity = parseInt(match[1], 10);
            const name = match[2].trim();
            // Remove commas from price string before parsing
            const priceStr = match[3].replace(/,/g, '');
            const price = parseFloat(priceStr);

            if (!isNaN(quantity) && !isNaN(price) && name) {
              items.push({ name, quantity, price });
            }
          }
        }
      } catch (lineError) {
        // Log but continue processing other lines
        console.error('[Receipt Parser] Error processing line:', lineError.message);
      }
    }

    return items;
  } catch (error) {
    console.error('[Receipt Parser] Error extracting items:', error.message);
    return [];
  }
}

/**
 * Determine confidence level based on extracted data
 * @param {object} data - Parsed receipt data
 * @returns {string} Confidence level: 'high', 'medium', or 'low'
 */
function determineConfidence(data) {
  try {
    const hasItems = data.items && data.items.length > 0;
    const hasTotal = data.total && data.total > 0;
    const hasSubtotal = data.subtotal && data.subtotal > 0;
    const hasTax = data.tax !== null && data.tax !== undefined;
    const hasReceiptNumber = data.receiptNumber && data.receiptNumber.length > 0;
    const hasTimestamp = data.timestamp && data.timestamp.length > 0;

    // High: All major fields extracted
    if (hasItems && hasTotal && hasSubtotal && hasTax && hasReceiptNumber && hasTimestamp) {
      return 'high';
    }

    // Medium: Partial extraction (items + total OR total only with other fields)
    if ((hasItems && hasTotal) || (hasTotal && (hasReceiptNumber || hasTimestamp))) {
      return 'medium';
    }

    // Low: Minimal or failed extraction
    return 'low';
  } catch (error) {
    console.error('[Receipt Parser] Error determining confidence:', error.message);
    return 'low';
  }
}

/**
 * Parse receipt text into structured data
 * 
 * NEVER-REJECT GUARANTEE: This function always returns a valid result object,
 * even on parsing failure. It never throws exceptions.
 * 
 * @param {string} receiptText - Raw receipt text from ESCPOSProcessor
 * @param {object} template - Parsing template with regex patterns (optional)
 * @returns {object} Parsed receipt data with confidence level
 */
function parseReceipt(receiptText, template = null) {
  // Initialize result with low confidence defaults
  const result = {
    items: [],
    total: 0,
    subtotal: 0,
    tax: 0,
    receiptNumber: '',
    timestamp: '',
    confidence: 'low',
    rawText: ''
  };

  try {
    // Validate input
    if (!receiptText || typeof receiptText !== 'string') {
      console.error('[Receipt Parser] Invalid input: receiptText must be a non-empty string');
      result.rawText = String(receiptText || '');
      result.error = 'Invalid input: receiptText must be a non-empty string';
      return result;
    }

    result.rawText = receiptText;

    // Use default template if none provided
    const activeTemplate = template || DEFAULT_TEMPLATE;

    // Validate template structure
    if (!activeTemplate || typeof activeTemplate !== 'object') {
      console.error('[Receipt Parser] Invalid template: using default');
      return parseReceipt(receiptText, DEFAULT_TEMPLATE);
    }

    // Extract fields with error handling for each
    try {
      if (activeTemplate.receiptNumber) {
        const receiptNum = extractField(receiptText, activeTemplate.receiptNumber, 'receiptNumber');
        if (receiptNum) result.receiptNumber = receiptNum;
      }
    } catch (error) {
      console.error('[Receipt Parser] Error extracting receiptNumber:', error.message);
    }

    try {
      if (activeTemplate.timestamp) {
        const ts = extractField(receiptText, activeTemplate.timestamp, 'timestamp');
        if (ts) result.timestamp = ts;
      }
    } catch (error) {
      console.error('[Receipt Parser] Error extracting timestamp:', error.message);
    }

    try {
      if (activeTemplate.items) {
        result.items = extractItems(receiptText, activeTemplate.items);
      }
    } catch (error) {
      console.error('[Receipt Parser] Error extracting items:', error.message);
      result.items = [];
    }

    try {
      if (activeTemplate.subtotal) {
        const subtotal = extractField(receiptText, activeTemplate.subtotal, 'subtotal');
        if (subtotal) {
          // Remove commas from numeric string before parsing
          const parsed = parseFloat(subtotal.replace(/,/g, ''));
          if (!isNaN(parsed)) result.subtotal = parsed;
        }
      }
    } catch (error) {
      console.error('[Receipt Parser] Error extracting subtotal:', error.message);
    }

    try {
      if (activeTemplate.tax) {
        const tax = extractField(receiptText, activeTemplate.tax, 'tax');
        if (tax) {
          // Remove commas from numeric string before parsing
          const parsed = parseFloat(tax.replace(/,/g, ''));
          if (!isNaN(parsed)) result.tax = parsed;
        }
      }
    } catch (error) {
      console.error('[Receipt Parser] Error extracting tax:', error.message);
    }

    try {
      if (activeTemplate.total) {
        const total = extractField(receiptText, activeTemplate.total, 'total');
        if (total) {
          // Remove commas from numeric string before parsing
          const parsed = parseFloat(total.replace(/,/g, ''));
          if (!isNaN(parsed)) result.total = parsed;
        }
      }
    } catch (error) {
      console.error('[Receipt Parser] Error extracting total:', error.message);
    }

    // Determine confidence level
    result.confidence = determineConfidence(result);

    return result;

  } catch (error) {
    // Catch-all error handler - should never reach here due to inner try-catches
    console.error('[Receipt Parser] Unexpected error in parseReceipt:', error.message);
    result.error = `Unexpected parsing error: ${error.message}`;
    return result;
  }
}

/**
 * Format parsed receipt data back into readable text
 * @param {object} parsedData - Structured receipt data
 * @returns {string} Formatted receipt text
 */
function formatReceipt(parsedData) {
  try {
    if (!parsedData || typeof parsedData !== 'object') {
      console.error('[Receipt Parser] Invalid parsedData for formatting');
      return '';
    }

    const lines = [];

    // Add receipt number if present
    if (parsedData.receiptNumber) {
      lines.push(`Receipt #: ${parsedData.receiptNumber}`);
    }

    // Add timestamp if present
    if (parsedData.timestamp) {
      lines.push(`Date: ${parsedData.timestamp}`);
    }

    // Add separator
    if (lines.length > 0) {
      lines.push('');
      lines.push('-'.repeat(40));
    }

    // Add items header if items exist
    if (parsedData.items && parsedData.items.length > 0) {
      lines.push('');
      lines.push('QTY  ITEM                           AMOUNT');
      lines.push('-'.repeat(40));

      // Add each item
      for (const item of parsedData.items) {
        try {
          const qty = String(item.quantity || 0).padEnd(4);
          const name = String(item.name || '').substring(0, 25).padEnd(25);
          const price = (item.price || 0).toFixed(2).padStart(8);
          lines.push(`${qty} ${name} ${price}`);
        } catch (itemError) {
          console.error('[Receipt Parser] Error formatting item:', itemError.message);
        }
      }

      lines.push('-'.repeat(40));
    }

    // Add financial totals
    if (parsedData.subtotal && parsedData.subtotal > 0) {
      lines.push(`Subtotal:                       ${parsedData.subtotal.toFixed(2).padStart(8)}`);
    }

    if (parsedData.tax !== null && parsedData.tax !== undefined) {
      lines.push(`Tax:                            ${parsedData.tax.toFixed(2).padStart(8)}`);
    }

    if (parsedData.total && parsedData.total > 0) {
      lines.push('');
      lines.push(`TOTAL:                          ${parsedData.total.toFixed(2).padStart(8)}`);
    }

    return lines.join('\n');

  } catch (error) {
    console.error('[Receipt Parser] Error formatting receipt:', error.message);
    return parsedData.rawText || '';
  }
}

/**
 * Load parsing template from config object
 * Falls back to default template if not configured or invalid
 * 
 * @param {object} config - Configuration object (from config.json)
 * @returns {object} Parsing template to use
 */
function loadTemplateFromConfig(config) {
  try {
    // Validate config input
    if (!config || typeof config !== 'object') {
      console.log('[Receipt Parser] No config provided, using default template');
      return DEFAULT_TEMPLATE;
    }

    // Check if parsingTemplate exists in config
    if (!config.parsingTemplate || typeof config.parsingTemplate !== 'object') {
      console.log('[Receipt Parser] No parsingTemplate in config, using default template');
      return DEFAULT_TEMPLATE;
    }

    const customTemplate = config.parsingTemplate;

    // Validate that at least the total pattern exists (required field)
    if (!customTemplate.total || typeof customTemplate.total !== 'string') {
      console.warn('[Receipt Parser] Custom template missing required "total" field, using default template');
      return DEFAULT_TEMPLATE;
    }

    // Validate the total pattern
    if (!validatePattern(customTemplate.total)) {
      console.warn('[Receipt Parser] Custom template has invalid "total" pattern, using default template');
      return DEFAULT_TEMPLATE;
    }

    // Validate items configuration if present
    if (customTemplate.items) {
      if (typeof customTemplate.items !== 'object' || !customTemplate.items.pattern) {
        console.warn('[Receipt Parser] Custom template has invalid "items" configuration, using default items');
        customTemplate.items = DEFAULT_TEMPLATE.items;
      } else if (!validatePattern(customTemplate.items.pattern)) {
        console.warn('[Receipt Parser] Custom template has invalid "items.pattern", using default items');
        customTemplate.items = DEFAULT_TEMPLATE.items;
      }
    }

    // Validate optional patterns
    const optionalFields = ['receiptNumber', 'timestamp', 'subtotal', 'tax'];
    for (const field of optionalFields) {
      if (customTemplate[field] && !validatePattern(customTemplate[field])) {
        console.warn(`[Receipt Parser] Custom template has invalid "${field}" pattern, using default`);
        customTemplate[field] = DEFAULT_TEMPLATE[field];
      }
    }

    console.log('[Receipt Parser] Successfully loaded custom parsing template from config');
    return customTemplate;

  } catch (error) {
    console.error('[Receipt Parser] Error loading template from config:', error.message);
    console.log('[Receipt Parser] Falling back to default template');
    return DEFAULT_TEMPLATE;
  }
}

/**
 * Test round-trip consistency: Parse → Format → Parse
 * 
 * This utility validates that parsing and formatting are consistent by:
 * 1. Parsing receipt text
 * 2. Formatting the parsed data back to text
 * 3. Parsing the formatted text again
 * 4. Comparing the two parsed results
 * 
 * Allows minor differences in:
 * - Whitespace and formatting
 * - Decimal precision (within 0.01)
 * 
 * @param {string} receiptText - Original receipt text
 * @param {object} template - Parsing template (optional)
 * @returns {object} Round-trip test result
 */
function testRoundTrip(receiptText, template = null) {
  const result = {
    success: false,
    originalParsed: null,
    formatted: null,
    reparsed: null,
    discrepancies: [],
    error: null
  };

  try {
    // Step 1: Parse original receipt
    result.originalParsed = parseReceipt(receiptText, template);
    
    // Skip round-trip test for low confidence results
    if (result.originalParsed.confidence === 'low') {
      result.error = 'Original parsing returned low confidence, skipping round-trip test';
      return result;
    }

    // Step 2: Format parsed data back to text
    result.formatted = formatReceipt(result.originalParsed);
    
    if (!result.formatted || result.formatted.length === 0) {
      result.error = 'Formatting produced empty output';
      return result;
    }

    // Step 3: Parse formatted text
    result.reparsed = parseReceipt(result.formatted, template);

    // Step 4: Compare parsed results
    const discrepancies = [];

    // Compare items count
    const originalItemsCount = result.originalParsed.items?.length || 0;
    const reparsedItemsCount = result.reparsed.items?.length || 0;
    
    if (originalItemsCount !== reparsedItemsCount) {
      discrepancies.push({
        field: 'items.length',
        original: originalItemsCount,
        reparsed: reparsedItemsCount,
        message: `Item count mismatch: ${originalItemsCount} vs ${reparsedItemsCount}`
      });
    }

    // Compare each item (if counts match)
    if (originalItemsCount === reparsedItemsCount && originalItemsCount > 0) {
      for (let i = 0; i < originalItemsCount; i++) {
        const origItem = result.originalParsed.items[i];
        const repItem = result.reparsed.items[i];

        // Compare item name (allow whitespace differences)
        const origName = (origItem.name || '').trim();
        const repName = (repItem.name || '').trim();
        if (origName !== repName) {
          discrepancies.push({
            field: `items[${i}].name`,
            original: origName,
            reparsed: repName,
            message: `Item name mismatch at index ${i}`
          });
        }

        // Compare quantity
        if (origItem.quantity !== repItem.quantity) {
          discrepancies.push({
            field: `items[${i}].quantity`,
            original: origItem.quantity,
            reparsed: repItem.quantity,
            message: `Item quantity mismatch at index ${i}`
          });
        }

        // Compare price (allow 0.01 difference for decimal precision)
        const priceDiff = Math.abs((origItem.price || 0) - (repItem.price || 0));
        if (priceDiff > 0.01) {
          discrepancies.push({
            field: `items[${i}].price`,
            original: origItem.price,
            reparsed: repItem.price,
            difference: priceDiff,
            message: `Item price mismatch at index ${i}: difference of ${priceDiff.toFixed(2)}`
          });
        }
      }
    }

    // Compare financial fields (allow 0.01 difference)
    const financialFields = ['total', 'subtotal', 'tax'];
    for (const field of financialFields) {
      const origValue = result.originalParsed[field] || 0;
      const repValue = result.reparsed[field] || 0;
      const diff = Math.abs(origValue - repValue);
      
      if (diff > 0.01) {
        discrepancies.push({
          field,
          original: origValue,
          reparsed: repValue,
          difference: diff,
          message: `${field} mismatch: ${origValue} vs ${repValue} (diff: ${diff.toFixed(2)})`
        });
      }
    }

    // Compare receipt number (allow whitespace differences)
    const origReceiptNum = (result.originalParsed.receiptNumber || '').trim();
    const repReceiptNum = (result.reparsed.receiptNumber || '').trim();
    if (origReceiptNum && repReceiptNum && origReceiptNum !== repReceiptNum) {
      discrepancies.push({
        field: 'receiptNumber',
        original: origReceiptNum,
        reparsed: repReceiptNum,
        message: 'Receipt number mismatch'
      });
    }

    // Compare timestamp (allow whitespace differences)
    const origTimestamp = (result.originalParsed.timestamp || '').trim();
    const repTimestamp = (result.reparsed.timestamp || '').trim();
    if (origTimestamp && repTimestamp && origTimestamp !== repTimestamp) {
      discrepancies.push({
        field: 'timestamp',
        original: origTimestamp,
        reparsed: repTimestamp,
        message: 'Timestamp mismatch'
      });
    }

    result.discrepancies = discrepancies;
    result.success = discrepancies.length === 0;

    // Log discrepancies if any
    if (discrepancies.length > 0) {
      console.warn('[Receipt Parser] Round-trip test found discrepancies:');
      for (const disc of discrepancies) {
        console.warn(`  - ${disc.message}`);
      }
    }

    return result;

  } catch (error) {
    result.error = `Round-trip test error: ${error.message}`;
    console.error('[Receipt Parser] Round-trip test error:', error.message);
    return result;
  }
}

/**
 * Test mode for Receipt_Parser
 * 
 * Accepts sample receipt text and provides detailed parsing analysis including:
 * - Field extraction details
 * - Confidence level
 * - Parsing statistics
 * 
 * @param {string|string[]} receiptText - Single receipt or array of receipts
 * @param {object} template - Parsing template (optional, uses default if not provided)
 * @param {object} options - Test options
 * @param {boolean} options.verbose - Enable verbose logging (default: true)
 * @param {boolean} options.showRawText - Include raw text in output (default: false)
 * @returns {object} Test results with parsing details and statistics
 */
function testMode(receiptText, template = null, options = {}) {
  const { verbose = true, showRawText = false } = options;
  
  // Handle single receipt or array of receipts
  const receipts = Array.isArray(receiptText) ? receiptText : [receiptText];
  
  // Determine if template is custom or default
  const isDefaultTemplate = !template || template === DEFAULT_TEMPLATE;
  
  const results = {
    totalReceipts: receipts.length,
    parsedReceipts: [],
    statistics: {
      high: 0,
      medium: 0,
      low: 0,
      successRate: 0,
      confidenceDistribution: {}
    },
    templateUsed: isDefaultTemplate ? 'default' : 'custom'
  };

  // Parse each receipt
  for (let i = 0; i < receipts.length; i++) {
    const receipt = receipts[i];
    
    if (verbose) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Testing Receipt ${i + 1} of ${receipts.length}`);
      console.log('='.repeat(60));
    }

    try {
      // Parse the receipt
      const parsed = parseReceipt(receipt, template);
      
      // Create detailed result
      const receiptResult = {
        index: i + 1,
        confidence: parsed.confidence,
        fieldsExtracted: {
          receiptNumber: !!parsed.receiptNumber,
          timestamp: !!parsed.timestamp,
          items: parsed.items.length,
          subtotal: parsed.subtotal > 0,
          tax: (parsed.tax !== null && parsed.tax !== undefined && parsed.tax > 0) || parsed.tax === 0,
          total: parsed.total > 0
        },
        parsedData: {
          receiptNumber: parsed.receiptNumber || '(not found)',
          timestamp: parsed.timestamp || '(not found)',
          items: parsed.items,
          subtotal: parsed.subtotal,
          tax: parsed.tax,
          total: parsed.total
        }
      };

      // Optionally include raw text
      if (showRawText) {
        receiptResult.rawText = parsed.rawText;
      }

      // Include error if present
      if (parsed.error) {
        receiptResult.error = parsed.error;
      }

      results.parsedReceipts.push(receiptResult);

      // Update statistics
      results.statistics[parsed.confidence]++;

      // Log detailed results if verbose
      if (verbose) {
        console.log('\n📊 Parsing Results:');
        console.log(`   Confidence Level: ${parsed.confidence.toUpperCase()}`);
        console.log('\n📝 Fields Extracted:');
        console.log(`   Receipt Number: ${receiptResult.fieldsExtracted.receiptNumber ? '✓' : '✗'} ${parsed.receiptNumber || '(not found)'}`);
        console.log(`   Timestamp:      ${receiptResult.fieldsExtracted.timestamp ? '✓' : '✗'} ${parsed.timestamp || '(not found)'}`);
        console.log(`   Items:          ${receiptResult.fieldsExtracted.items ? '✓' : '✗'} ${parsed.items.length} item(s) found`);
        console.log(`   Subtotal:       ${receiptResult.fieldsExtracted.subtotal ? '✓' : '✗'} ${parsed.subtotal > 0 ? parsed.subtotal.toFixed(2) : '(not found)'}`);
        console.log(`   Tax:            ${receiptResult.fieldsExtracted.tax ? '✓' : '✗'} ${(parsed.tax !== null && parsed.tax !== undefined && parsed.tax >= 0) ? parsed.tax.toFixed(2) : '(not found)'}`);
        console.log(`   Total:          ${receiptResult.fieldsExtracted.total ? '✓' : '✗'} ${parsed.total > 0 ? parsed.total.toFixed(2) : '(not found)'}`);

        if (parsed.items.length > 0) {
          console.log('\n🛒 Items Details:');
          parsed.items.forEach((item, idx) => {
            console.log(`   ${idx + 1}. ${item.name}`);
            console.log(`      Quantity: ${item.quantity}, Price: ${item.price.toFixed(2)}`);
          });
        }

        if (parsed.error) {
          console.log(`\n⚠️  Error: ${parsed.error}`);
        }
      }

    } catch (error) {
      // Should never happen due to never-reject guarantee, but handle just in case
      console.error(`[Test Mode] Unexpected error testing receipt ${i + 1}:`, error.message);
      results.parsedReceipts.push({
        index: i + 1,
        confidence: 'low',
        error: error.message,
        fieldsExtracted: {
          receiptNumber: false,
          timestamp: false,
          items: 0,
          subtotal: false,
          tax: false,
          total: false
        }
      });
      results.statistics.low++;
    }
  }

  // Calculate statistics
  results.statistics.confidenceDistribution = {
    high: ((results.statistics.high / results.totalReceipts) * 100).toFixed(1) + '%',
    medium: ((results.statistics.medium / results.totalReceipts) * 100).toFixed(1) + '%',
    low: ((results.statistics.low / results.totalReceipts) * 100).toFixed(1) + '%'
  };

  // Success rate = high + medium confidence
  const successCount = results.statistics.high + results.statistics.medium;
  results.statistics.successRate = ((successCount / results.totalReceipts) * 100).toFixed(1) + '%';

  // Log summary if verbose
  if (verbose) {
    console.log(`\n${'='.repeat(60)}`);
    console.log('📈 PARSING STATISTICS');
    console.log('='.repeat(60));
    console.log(`Total Receipts Tested: ${results.totalReceipts}`);
    console.log(`\nConfidence Distribution:`);
    console.log(`   High:   ${results.statistics.high} (${results.statistics.confidenceDistribution.high})`);
    console.log(`   Medium: ${results.statistics.medium} (${results.statistics.confidenceDistribution.medium})`);
    console.log(`   Low:    ${results.statistics.low} (${results.statistics.confidenceDistribution.low})`);
    console.log(`\nSuccess Rate: ${results.statistics.successRate}`);
    console.log(`Template Used: ${results.templateUsed}`);
    console.log('='.repeat(60) + '\n');
  }

  return results;
}

// Export functions
module.exports = {
  parseReceipt,
  formatReceipt,
  validatePattern,
  loadTemplateFromConfig,
  testRoundTrip,
  testMode,
  DEFAULT_TEMPLATE
};
