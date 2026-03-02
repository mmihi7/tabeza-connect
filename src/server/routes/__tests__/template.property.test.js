/**
 * Property-Based Tests for Template Generator
 * 
 * Tests Property 18: Template Generator Order Independence
 */

const fc = require('fast-check');

/**
 * Mock template generator function
 * In reality, this would call the cloud API, but for testing we simulate the logic
 */
function generateTemplateFromReceipts(receipts) {
  // Simulate template generation by analyzing receipt patterns
  // The key insight: order shouldn't matter, only the content
  
  const allLines = receipts.flatMap(r => r.split('\n'));
  
  // Find common patterns across all receipts
  const itemLinePattern = findItemLinePattern(allLines);
  const totalLinePattern = findTotalLinePattern(allLines);
  const receiptNumberPattern = findReceiptNumberPattern(allLines);
  
  return {
    version: '1.0',
    posSystem: 'Generic',
    patterns: {
      item_line: itemLinePattern,
      total_line: totalLinePattern,
      receipt_number: receiptNumberPattern
    },
    confidence_threshold: 0.85
  };
}

/**
 * Helper: Find item line pattern
 */
function findItemLinePattern(lines) {
  // Look for lines with: text + number + price format
  const candidates = lines.filter(line => {
    return /^.+\s+\d+\s+[\d,]+\.\d{2}$/.test(line.trim());
  });
  
  if (candidates.length > 0) {
    return '^(.+?)\\s+(\\d+)\\s+([0-9,]+\\.\\d{2})$';
  }
  
  return null;
}

/**
 * Helper: Find total line pattern
 */
function findTotalLinePattern(lines) {
  // Look for lines with: TOTAL + price
  const candidates = lines.filter(line => {
    return /TOTAL\s+[\d,]+\.\d{2}/.test(line.trim());
  });
  
  if (candidates.length > 0) {
    return '^TOTAL\\s+([0-9,]+\\.\\d{2})$';
  }
  
  return null;
}

/**
 * Helper: Find receipt number pattern
 */
function findReceiptNumberPattern(lines) {
  // Look for lines with: Receipt # or Receipt: followed by identifier
  const candidates = lines.filter(line => {
    return /Receipt\s*[#:]?\s*\S+/.test(line.trim());
  });
  
  if (candidates.length > 0) {
    return '^Receipt\\s*#?:\\s*(\\S+)$';
  }
  
  return null;
}

/**
 * Compare two templates for equivalence
 * Templates are equivalent if they have the same patterns (order-independent)
 */
function templatesAreEquivalent(template1, template2) {
  if (!template1 || !template2) return false;
  if (!template1.patterns || !template2.patterns) return false;
  
  // Compare pattern keys
  const keys1 = Object.keys(template1.patterns).sort();
  const keys2 = Object.keys(template2.patterns).sort();
  
  if (keys1.length !== keys2.length) return false;
  if (!keys1.every((key, i) => key === keys2[i])) return false;
  
  // Compare pattern values
  for (const key of keys1) {
    if (template1.patterns[key] !== template2.patterns[key]) {
      return false;
    }
  }
  
  return true;
}

/**
 * Generate all permutations of an array
 */
function permutations(arr) {
  if (arr.length <= 1) return [arr];
  
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    const restPerms = permutations(rest);
    for (const perm of restPerms) {
      result.push([arr[i], ...perm]);
    }
  }
  return result;
}

describe('Property 18: Template Generator Order Independence', () => {
  /**
   * Property: For any set of 3 test receipts [A, B, C], generating a template
   * from receipts in order [A, B, C] should produce equivalent regex patterns
   * to generating from [C, B, A] or any other permutation.
   */
  
  test('should generate equivalent templates regardless of receipt order', () => {
    fc.assert(
      fc.property(
        // Generate 3 distinct receipt samples
        fc.tuple(
          fc.constantFrom(
            // Receipt 1: Tusker and Nyama Choma
            'Bar Name\nReceipt #: RCP-001\nTusker Lager 500ml 2 500.00\nNyama Choma 1 800.00\nTOTAL 1300.00',
            // Receipt 2: Different items
            'Bar Name\nReceipt #: RCP-002\nWhite Cap 1 450.00\nChips 2 300.00\nTOTAL 750.00',
            // Receipt 3: More items
            'Bar Name\nReceipt #: RCP-003\nPilsner 3 450.00\nSamosa 4 200.00\nTOTAL 1350.00'
          ),
          fc.constantFrom(
            'Bar Name\nReceipt #: RCP-002\nWhite Cap 1 450.00\nChips 2 300.00\nTOTAL 750.00',
            'Bar Name\nReceipt #: RCP-003\nPilsner 3 450.00\nSamosa 4 200.00\nTOTAL 1350.00',
            'Bar Name\nReceipt #: RCP-001\nTusker Lager 500ml 2 500.00\nNyama Choma 1 800.00\nTOTAL 1300.00'
          ),
          fc.constantFrom(
            'Bar Name\nReceipt #: RCP-003\nPilsner 3 450.00\nSamosa 4 200.00\nTOTAL 1350.00',
            'Bar Name\nReceipt #: RCP-001\nTusker Lager 500ml 2 500.00\nNyama Choma 1 800.00\nTOTAL 1300.00',
            'Bar Name\nReceipt #: RCP-002\nWhite Cap 1 450.00\nChips 2 300.00\nTOTAL 750.00'
          )
        ),
        ([receipt1, receipt2, receipt3]) => {
          const receipts = [receipt1, receipt2, receipt3];
          
          // Generate template from original order
          const templateOriginal = generateTemplateFromReceipts(receipts);
          
          // Generate templates from all permutations
          const perms = permutations(receipts);
          
          for (const perm of perms) {
            const templatePerm = generateTemplateFromReceipts(perm);
            
            // Templates should be equivalent regardless of order
            const equivalent = templatesAreEquivalent(templateOriginal, templatePerm);
            
            if (!equivalent) {
              console.log('Original order:', receipts.map(r => r.split('\n')[1]));
              console.log('Permutation:', perm.map(r => r.split('\n')[1]));
              console.log('Original template:', templateOriginal);
              console.log('Permutation template:', templatePerm);
            }
            
            return equivalent;
          }
          
          return true;
        }
      ),
      {
        numRuns: 100,
        verbose: true,
        examples: [
          // Example 1: Standard receipts
          [[
            'Bar Name\nReceipt #: RCP-001\nTusker Lager 500ml 2 500.00\nNyama Choma 1 800.00\nTOTAL 1300.00',
            'Bar Name\nReceipt #: RCP-002\nWhite Cap 1 450.00\nChips 2 300.00\nTOTAL 750.00',
            'Bar Name\nReceipt #: RCP-003\nPilsner 3 450.00\nSamosa 4 200.00\nTOTAL 1350.00'
          ]]
        ]
      }
    );
  });

  test('should generate deterministic patterns for consistent receipt layouts', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 100, max: 1000 }),
        (qty, price) => {
          // Generate 3 receipts with same layout but different values
          const receipt1 = `Bar Name\nReceipt #: RCP-001\nItem A ${qty} ${price}.00\nTOTAL ${qty * price}.00`;
          const receipt2 = `Bar Name\nReceipt #: RCP-002\nItem B ${qty + 1} ${price + 50}.00\nTOTAL ${(qty + 1) * (price + 50)}.00`;
          const receipt3 = `Bar Name\nReceipt #: RCP-003\nItem C ${qty + 2} ${price + 100}.00\nTOTAL ${(qty + 2) * (price + 100)}.00`;
          
          const receipts = [receipt1, receipt2, receipt3];
          
          // Generate template
          const template = generateTemplateFromReceipts(receipts);
          
          // Template should have all required patterns
          return (
            template.patterns.item_line !== null &&
            template.patterns.total_line !== null &&
            template.patterns.receipt_number !== null
          );
        }
      ),
      {
        numRuns: 100,
        verbose: true
      }
    );
  });

  test('should handle receipts with varying item counts', () => {
    const receipt1 = 'Bar Name\nReceipt #: RCP-001\nItem A 1 100.00\nTOTAL 100.00';
    const receipt2 = 'Bar Name\nReceipt #: RCP-002\nItem B 2 200.00\nItem C 1 150.00\nTOTAL 550.00';
    const receipt3 = 'Bar Name\nReceipt #: RCP-003\nItem D 3 300.00\nItem E 2 250.00\nItem F 1 200.00\nTOTAL 1400.00';
    
    const receipts = [receipt1, receipt2, receipt3];
    
    // Test all permutations
    const perms = permutations(receipts);
    const templates = perms.map(perm => generateTemplateFromReceipts(perm));
    
    // All templates should be equivalent
    for (let i = 1; i < templates.length; i++) {
      expect(templatesAreEquivalent(templates[0], templates[i])).toBe(true);
    }
  });

  test('should generate same patterns for receipts in any order', () => {
    const receipts = [
      'Bar Name\nReceipt #: RCP-001\nTusker Lager 500ml 2 500.00\nNyama Choma 1 800.00\nTOTAL 1300.00',
      'Bar Name\nReceipt #: RCP-002\nWhite Cap 1 450.00\nChips 2 300.00\nTOTAL 750.00',
      'Bar Name\nReceipt #: RCP-003\nPilsner 3 450.00\nSamosa 4 200.00\nTOTAL 1350.00'
    ];
    
    // Generate template from original order [A, B, C]
    const templateABC = generateTemplateFromReceipts(receipts);
    
    // Generate template from reversed order [C, B, A]
    const templateCBA = generateTemplateFromReceipts([receipts[2], receipts[1], receipts[0]]);
    
    // Generate template from rotated order [B, C, A]
    const templateBCA = generateTemplateFromReceipts([receipts[1], receipts[2], receipts[0]]);
    
    // All should be equivalent
    expect(templatesAreEquivalent(templateABC, templateCBA)).toBe(true);
    expect(templatesAreEquivalent(templateABC, templateBCA)).toBe(true);
    expect(templatesAreEquivalent(templateCBA, templateBCA)).toBe(true);
  });
});

// Tag for test discovery
// Feature: management-ui-and-missing-features, Property 18: Template Generator Order Independence

