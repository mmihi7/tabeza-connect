#!/usr/bin/env node

/**
 * Template Validation Script
 * 
 * This script validates custom parsing templates against sample receipts.
 * It helps users test their templates before deploying to production.
 * 
 * Usage:
 *   node validate-template.js [template-file] [receipt-file]
 *   node validate-template.js --config [config-file] [receipt-file]
 *   node validate-template.js --help
 * 
 * Examples:
 *   # Test template from config.json against all sample receipts
 *   node validate-template.js
 * 
 *   # Test custom template file against specific receipt
 *   node validate-template.js my-template.json test-receipts/tusker-test-receipt.txt
 * 
 *   # Test template from custom config against all samples
 *   node validate-template.js --config my-config.json
 * 
 * Requirements: 8.7
 */

const fs = require('fs');
const path = require('path');
const { 
  parseReceipt, 
  formatReceipt,
  validatePattern, 
  loadTemplateFromConfig,
  testRoundTrip: testRoundTripParser,
  DEFAULT_TEMPLATE 
} = require('./lib/receiptParser');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

/**
 * Display help message
 */
function showHelp() {
  console.log(`
${colors.bright}${colors.cyan}Template Validation Script${colors.reset}

${colors.bright}USAGE:${colors.reset}
  node validate-template.js [options] [template-file] [receipt-file]

${colors.bright}OPTIONS:${colors.reset}
  --config <file>    Load template from config file (default: config.json)
  --help, -h         Show this help message
  --verbose, -v      Show detailed parsing output
  --quiet, -q        Minimal output (only errors and summary)
  --round-trip       Test round-trip consistency (parse → format → parse)

${colors.bright}ARGUMENTS:${colors.reset}
  template-file      JSON file containing parsing template
  receipt-file       Receipt text file to test against

${colors.bright}EXAMPLES:${colors.reset}
  # Test template from config.json against all sample receipts
  node validate-template.js

  # Test custom template file against specific receipt
  node validate-template.js my-template.json test-receipts/tusker-test-receipt.txt

  # Test template from custom config
  node validate-template.js --config my-config.json

  # Test with round-trip validation
  node validate-template.js --round-trip

  # Quiet mode (only show summary)
  node validate-template.js --quiet

${colors.bright}TEMPLATE FILE FORMAT:${colors.reset}
  {
    "receiptNumber": "Receipt\\\\s*#?:?\\\\s*(\\\\S+)",
    "timestamp": "(\\\\d{1,2}/\\\\d{1,2}/\\\\d{4}\\\\s+\\\\d{1,2}:\\\\d{2})",
    "items": {
      "pattern": "^(\\\\d+)\\\\s+(.+?)\\\\s{2,}(\\\\d+\\\\.\\\\d{2})$",
      "multiline": true,
      "startMarker": "QTY\\\\s+ITEM\\\\s+AMOUNT",
      "endMarker": "^-{3,}|Subtotal|Total"
    },
    "subtotal": "Subtotal:?\\\\s*(\\\\d+\\\\.\\\\d{2})",
    "tax": "(?:VAT|Tax):?\\\\s*(\\\\d+\\\\.\\\\d{2})",
    "total": "^\\\\s*TOTAL:?\\\\s*(\\\\d+\\\\.\\\\d{2})"
  }

${colors.bright}EXIT CODES:${colors.reset}
  0 - Success (all validations passed)
  1 - Template validation failed
  2 - File not found or read error
  3 - Invalid arguments
`);
}

/**
 * Load template from file
 */
function loadTemplateFromFile(filePath) {
  try {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
      console.error(`${colors.red}✗ Template file not found: ${fullPath}${colors.reset}`);
      return null;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const template = JSON.parse(content);
    
    console.log(`${colors.green}✓ Template loaded from: ${filePath}${colors.reset}`);
    return template;
  } catch (error) {
    console.error(`${colors.red}✗ Error loading template file: ${error.message}${colors.reset}`);
    return null;
  }
}

/**
 * Load receipt from file
 */
function loadReceiptFile(filePath) {
  try {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
      console.error(`${colors.red}✗ Receipt file not found: ${fullPath}${colors.reset}`);
      return null;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    console.log(`${colors.green}✓ Receipt loaded from: ${filePath}${colors.reset}`);
    return content;
  } catch (error) {
    console.error(`${colors.red}✗ Error loading receipt file: ${error.message}${colors.reset}`);
    return null;
  }
}

/**
 * Load all sample receipts from test-receipts directory
 */
function loadAllSampleReceipts() {
  const receiptsDir = path.join(__dirname, 'test-receipts');
  
  if (!fs.existsSync(receiptsDir)) {
    console.error(`${colors.red}✗ test-receipts directory not found${colors.reset}`);
    return [];
  }

  const files = fs.readdirSync(receiptsDir)
    .filter(f => f.endsWith('.txt'))
    .sort();
  
  const receipts = [];

  for (const file of files) {
    const filePath = path.join(receiptsDir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      receipts.push({
        name: file,
        path: filePath,
        content
      });
    } catch (error) {
      console.warn(`${colors.yellow}⚠ Could not load ${file}: ${error.message}${colors.reset}`);
    }
  }

  return receipts;
}

/**
 * Validate template structure
 */
function validateTemplateStructure(template) {
  const errors = [];
  const warnings = [];

  // Check if template is an object
  if (!template || typeof template !== 'object') {
    errors.push('Template must be an object');
    return { valid: false, errors, warnings };
  }

  // Check required field: total
  if (!template.total) {
    errors.push('Template must include "total" field (required)');
  } else if (typeof template.total !== 'string') {
    errors.push('"total" field must be a string (regex pattern)');
  } else if (!validatePattern(template.total)) {
    errors.push('"total" pattern is not a valid regex');
  }

  // Check optional fields
  const optionalFields = ['receiptNumber', 'timestamp', 'subtotal', 'tax'];
  for (const field of optionalFields) {
    if (template[field]) {
      if (typeof template[field] !== 'string') {
        warnings.push(`"${field}" should be a string (regex pattern)`);
      } else if (!validatePattern(template[field])) {
        warnings.push(`"${field}" pattern is not a valid regex`);
      }
    }
  }

  // Check items configuration
  if (template.items) {
    if (typeof template.items !== 'object') {
      errors.push('"items" must be an object');
    } else {
      if (!template.items.pattern) {
        errors.push('"items.pattern" is required when items config is present');
      } else if (typeof template.items.pattern !== 'string') {
        errors.push('"items.pattern" must be a string (regex pattern)');
      } else if (!validatePattern(template.items.pattern)) {
        errors.push('"items.pattern" is not a valid regex');
      }

      if (template.items.startMarker && !validatePattern(template.items.startMarker)) {
        warnings.push('"items.startMarker" is not a valid regex');
      }

      if (template.items.endMarker && !validatePattern(template.items.endMarker)) {
        warnings.push('"items.endMarker" is not a valid regex');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Display template validation results
 */
function displayTemplateValidation(validation) {
  console.log(`\n${colors.bright}${colors.cyan}Template Structure Validation${colors.reset}`);
  console.log('─'.repeat(60));

  if (validation.valid) {
    console.log(`${colors.green}✓ Template structure is valid${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ Template structure has errors${colors.reset}`);
  }

  if (validation.errors.length > 0) {
    console.log(`\n${colors.red}${colors.bright}Errors:${colors.reset}`);
    validation.errors.forEach(err => {
      console.log(`  ${colors.red}✗${colors.reset} ${err}`);
    });
  }

  if (validation.warnings.length > 0) {
    console.log(`\n${colors.yellow}${colors.bright}Warnings:${colors.reset}`);
    validation.warnings.forEach(warn => {
      console.log(`  ${colors.yellow}⚠${colors.reset} ${warn}`);
    });
  }

  console.log('');
}

/**
 * Display parsing results for a single receipt
 */
function displayParsingResults(receipt, parsed, index, total, verbose) {
  const confidenceColor = 
    parsed.confidence === 'high' ? colors.green :
    parsed.confidence === 'medium' ? colors.yellow :
    colors.red;

  console.log(`\n${colors.bright}Receipt ${index}/${total}: ${receipt.name}${colors.reset}`);
  console.log('─'.repeat(60));
  console.log(`Confidence: ${confidenceColor}${parsed.confidence.toUpperCase()}${colors.reset}`);

  if (verbose) {
    console.log(`\n${colors.bright}Fields Extracted:${colors.reset}`);
    console.log(`  Receipt Number: ${parsed.receiptNumber ? colors.green + '✓' : colors.red + '✗'} ${parsed.receiptNumber || '(not found)'}${colors.reset}`);
    console.log(`  Timestamp:      ${parsed.timestamp ? colors.green + '✓' : colors.red + '✗'} ${parsed.timestamp || '(not found)'}${colors.reset}`);
    console.log(`  Items:          ${parsed.items.length > 0 ? colors.green + '✓' : colors.red + '✗'} ${parsed.items.length} item(s)${colors.reset}`);
    console.log(`  Subtotal:       ${parsed.subtotal > 0 ? colors.green + '✓' : colors.red + '✗'} ${parsed.subtotal > 0 ? parsed.subtotal.toFixed(2) : '(not found)'}${colors.reset}`);
    console.log(`  Tax:            ${(parsed.tax !== null && parsed.tax !== undefined) ? colors.green + '✓' : colors.red + '✗'} ${(parsed.tax !== null && parsed.tax !== undefined) ? parsed.tax.toFixed(2) : '(not found)'}${colors.reset}`);
    console.log(`  Total:          ${parsed.total > 0 ? colors.green + '✓' : colors.red + '✗'} ${parsed.total > 0 ? parsed.total.toFixed(2) : '(not found)'}${colors.reset}`);

    if (parsed.items.length > 0) {
      console.log(`\n${colors.bright}Items:${colors.reset}`);
      parsed.items.forEach((item, i) => {
        console.log(`  ${i + 1}. ${item.name}`);
        console.log(`     Qty: ${item.quantity}, Price: ${item.price.toFixed(2)}`);
      });
    }

    if (parsed.error) {
      console.log(`\n${colors.red}Error: ${parsed.error}${colors.reset}`);
    }
  } else {
    // Compact output
    const fields = [];
    if (parsed.receiptNumber) fields.push('receipt#');
    if (parsed.timestamp) fields.push('timestamp');
    if (parsed.items.length > 0) fields.push(`${parsed.items.length} items`);
    if (parsed.subtotal > 0) fields.push('subtotal');
    if (parsed.tax !== null && parsed.tax !== undefined) fields.push('tax');
    if (parsed.total > 0) fields.push('total');

    console.log(`Fields: ${fields.length > 0 ? fields.join(', ') : '(none)'}`);
  }
}

/**
 * Display round-trip test results
 */
function displayRoundTripResults(receipt, roundTripResult, verbose) {
  console.log(`\n${colors.bright}Round-Trip Test: ${receipt.name}${colors.reset}`);
  console.log('─'.repeat(60));

  if (roundTripResult.error) {
    console.log(`${colors.yellow}⚠ ${roundTripResult.error}${colors.reset}`);
    return;
  }

  if (roundTripResult.success) {
    console.log(`${colors.green}✓ Round-trip test passed${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ Round-trip test failed${colors.reset}`);
    console.log(`\n${colors.red}${colors.bright}Discrepancies found:${colors.reset}`);
    
    roundTripResult.discrepancies.forEach(disc => {
      console.log(`\n  Field: ${colors.yellow}${disc.field}${colors.reset}`);
      console.log(`  Original: ${disc.original}`);
      console.log(`  Reparsed: ${disc.reparsed}`);
      if (disc.difference !== undefined) {
        console.log(`  Difference: ${disc.difference.toFixed(2)}`);
      }
    });
  }

  if (verbose && roundTripResult.formatted) {
    console.log(`\n${colors.bright}Formatted Output:${colors.reset}`);
    console.log(colors.dim + roundTripResult.formatted + colors.reset);
  }
}

/**
 * Display summary statistics
 */
function displaySummary(results, roundTripResults) {
  console.log(`\n${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}                    VALIDATION SUMMARY${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);

  const total = results.length;
  const high = results.filter(r => r.parsed.confidence === 'high').length;
  const medium = results.filter(r => r.parsed.confidence === 'medium').length;
  const low = results.filter(r => r.parsed.confidence === 'low').length;
  const successRate = ((high + medium) / total * 100).toFixed(1);

  console.log(`\n${colors.bright}Parsing Results:${colors.reset}`);
  console.log(`  Total Receipts:  ${total}`);
  console.log(`  ${colors.green}High Confidence: ${high} (${(high / total * 100).toFixed(1)}%)${colors.reset}`);
  console.log(`  ${colors.yellow}Medium Confidence: ${medium} (${(medium / total * 100).toFixed(1)}%)${colors.reset}`);
  console.log(`  ${colors.red}Low Confidence: ${low} (${(low / total * 100).toFixed(1)}%)${colors.reset}`);
  console.log(`  ${colors.bright}Success Rate: ${successRate}%${colors.reset}`);

  if (roundTripResults && roundTripResults.length > 0) {
    const roundTripPassed = roundTripResults.filter(r => r.success).length;
    const roundTripSkipped = roundTripResults.filter(r => r.error).length;
    const roundTripFailed = roundTripResults.length - roundTripPassed - roundTripSkipped;

    console.log(`\n${colors.bright}Round-Trip Tests:${colors.reset}`);
    console.log(`  ${colors.green}Passed: ${roundTripPassed}${colors.reset}`);
    console.log(`  ${colors.red}Failed: ${roundTripFailed}${colors.reset}`);
    console.log(`  ${colors.yellow}Skipped: ${roundTripSkipped}${colors.reset}`);
  }

  // Recommendations
  console.log(`\n${colors.bright}Recommendations:${colors.reset}`);
  
  if (successRate >= 80) {
    console.log(`  ${colors.green}✓ Excellent! Template works well for your receipts.${colors.reset}`);
    console.log(`    Ready for production deployment.`);
  } else if (successRate >= 50) {
    console.log(`  ${colors.yellow}⚠ Moderate success rate. Template may need adjustment.${colors.reset}`);
    console.log(`    Review failed receipts and adjust regex patterns.`);
  } else {
    console.log(`  ${colors.red}✗ Low success rate. Template needs significant adjustment.${colors.reset}`);
    console.log(`    Consider reviewing the template structure and patterns.`);
  }

  // Common issues
  const noItems = results.filter(r => r.parsed.items.length === 0).length;
  const noTotal = results.filter(r => r.parsed.total === 0).length;
  const noReceiptNum = results.filter(r => !r.parsed.receiptNumber).length;

  if (noItems > 0 || noTotal > 0 || noReceiptNum > 0) {
    console.log(`\n${colors.bright}Common Issues:${colors.reset}`);
    if (noItems > 0) {
      console.log(`  ${colors.yellow}⚠ ${noItems} receipt(s) had no items extracted${colors.reset}`);
      console.log(`    → Check items.pattern, startMarker, and endMarker`);
    }
    if (noTotal > 0) {
      console.log(`  ${colors.yellow}⚠ ${noTotal} receipt(s) had no total extracted${colors.reset}`);
      console.log(`    → Check total pattern and ensure it matches your format`);
    }
    if (noReceiptNum > total / 2) {
      console.log(`  ${colors.yellow}⚠ Most receipts missing receipt number${colors.reset}`);
      console.log(`    → Check receiptNumber pattern or verify field exists in receipts`);
    }
  }

  console.log(`\n${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}\n`);
}

/**
 * Save results to JSON file
 */
function saveResults(results, roundTripResults, outputPath) {
  try {
    const output = {
      timestamp: new Date().toISOString(),
      totalReceipts: results.length,
      receipts: results.map(r => ({
        name: r.receipt.name,
        confidence: r.parsed.confidence,
        fieldsExtracted: {
          receiptNumber: !!r.parsed.receiptNumber,
          timestamp: !!r.parsed.timestamp,
          items: r.parsed.items.length,
          subtotal: r.parsed.subtotal > 0,
          tax: r.parsed.tax !== null && r.parsed.tax !== undefined,
          total: r.parsed.total > 0
        },
        parsedData: {
          receiptNumber: r.parsed.receiptNumber || null,
          timestamp: r.parsed.timestamp || null,
          items: r.parsed.items,
          subtotal: r.parsed.subtotal,
          tax: r.parsed.tax,
          total: r.parsed.total
        }
      })),
      roundTripTests: roundTripResults ? roundTripResults.map(r => ({
        name: r.receipt.name,
        success: r.success,
        error: r.error || null,
        discrepancies: r.discrepancies || []
      })) : null,
      statistics: {
        high: results.filter(r => r.parsed.confidence === 'high').length,
        medium: results.filter(r => r.parsed.confidence === 'medium').length,
        low: results.filter(r => r.parsed.confidence === 'low').length,
        successRate: ((results.filter(r => r.parsed.confidence !== 'low').length / results.length) * 100).toFixed(1) + '%'
      }
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`${colors.green}✓ Results saved to: ${outputPath}${colors.reset}\n`);
  } catch (error) {
    console.error(`${colors.red}✗ Could not save results: ${error.message}${colors.reset}`);
  }
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let templateFile = null;
  let receiptFile = null;
  let configFile = 'config.json';
  let verbose = false;
  let quiet = false;
  let testRoundTrip = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    } else if (arg === '--config') {
      configFile = args[++i];
    } else if (arg === '--verbose' || arg === '-v') {
      verbose = true;
    } else if (arg === '--quiet' || arg === '-q') {
      quiet = true;
    } else if (arg === '--round-trip') {
      testRoundTrip = true;
    } else if (!templateFile) {
      templateFile = arg;
    } else if (!receiptFile) {
      receiptFile = arg;
    } else {
      console.error(`${colors.red}✗ Unknown argument: ${arg}${colors.reset}`);
      console.log('Use --help for usage information');
      process.exit(3);
    }
  }

  // Header
  if (!quiet) {
    console.log(`${colors.bright}${colors.cyan}`);
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║         Template Validation Script                       ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log(colors.reset);
  }

  // Load template
  let template = null;
  let templateSource = 'default';

  if (templateFile) {
    // Load from template file
    template = loadTemplateFromFile(templateFile);
    if (!template) process.exit(2);
    templateSource = templateFile;
  } else {
    // Load from config file
    const configPath = path.resolve(configFile);
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        template = loadTemplateFromConfig(config);
        templateSource = config.parsingTemplate ? configFile : 'default';
        if (!quiet) {
          console.log(`${colors.green}✓ Template loaded from: ${configFile}${colors.reset}`);
        }
      } catch (error) {
        console.error(`${colors.red}✗ Error loading config: ${error.message}${colors.reset}`);
        console.log(`${colors.yellow}Using default template${colors.reset}`);
        template = DEFAULT_TEMPLATE;
      }
    } else {
      if (!quiet) {
        console.log(`${colors.yellow}ℹ Config file not found, using default template${colors.reset}`);
      }
      template = DEFAULT_TEMPLATE;
    }
  }

  // Validate template structure
  const validation = validateTemplateStructure(template);
  if (!quiet) {
    displayTemplateValidation(validation);
  }

  if (!validation.valid) {
    console.error(`${colors.red}✗ Template validation failed. Fix errors before testing.${colors.reset}`);
    process.exit(1);
  }

  // Load receipts
  let receipts = [];
  
  if (receiptFile) {
    // Load single receipt
    const content = loadReceiptFile(receiptFile);
    if (!content) process.exit(2);
    receipts = [{
      name: path.basename(receiptFile),
      path: receiptFile,
      content
    }];
  } else {
    // Load all sample receipts
    receipts = loadAllSampleReceipts();
    if (receipts.length === 0) {
      console.error(`${colors.red}✗ No receipts found to test${colors.reset}`);
      process.exit(2);
    }
    if (!quiet) {
      console.log(`${colors.green}✓ Loaded ${receipts.length} sample receipt(s)${colors.reset}\n`);
    }
  }

  // Parse receipts
  const results = [];
  const roundTripResults = [];

  for (let i = 0; i < receipts.length; i++) {
    const receipt = receipts[i];
    const parsed = parseReceipt(receipt.content, template);
    
    results.push({ receipt, parsed });

    if (!quiet) {
      displayParsingResults(receipt, parsed, i + 1, receipts.length, verbose);
    }

    // Round-trip test if requested
    if (testRoundTrip) {
      const roundTrip = testRoundTripParser(receipt.content, template);
      roundTripResults.push({ receipt, ...roundTrip });
      
      if (!quiet && verbose) {
        displayRoundTripResults(receipt, roundTrip, verbose);
      }
    }
  }

  // Display summary
  if (!quiet) {
    displaySummary(results, testRoundTrip ? roundTripResults : null);
  }

  // Save results
  const outputPath = path.join(__dirname, 'template-validation-results.json');
  saveResults(results, testRoundTrip ? roundTripResults : null, outputPath);

  // Exit with appropriate code
  const successRate = parseFloat(
    ((results.filter(r => r.parsed.confidence !== 'low').length / results.length) * 100).toFixed(1)
  );

  if (validation.valid && successRate >= 50) {
    process.exit(0);
  } else if (!validation.valid) {
    process.exit(1);
  } else {
    process.exit(0); // Still exit 0 for low success rate to allow iteration
  }
}

// Run main function
if (require.main === module) {
  main();
}

module.exports = {
  loadTemplateFromFile,
  loadReceiptFile,
  loadAllSampleReceipts,
  validateTemplateStructure,
  displayTemplateValidation,
  displayParsingResults,
  displaySummary
};
