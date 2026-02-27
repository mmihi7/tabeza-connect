/**
 * Example usage of the testRoundTrip utility
 * 
 * This demonstrates how to use the round-trip validation utility
 * to verify that parsing and formatting are consistent.
 */

const { testRoundTrip, DEFAULT_TEMPLATE } = require('../receiptParser');

// Example 1: Test a complete receipt
const completeReceipt = `
Receipt #: RCP-2024-001234
Date: 12/15/2024 8:45:30 PM
----------------------------------------

QTY  ITEM                           AMOUNT
----------------------------------------
2    Tusker Lager 500ml              500.00
3    Pilsner 330ml                   450.00
----------------------------------------
Subtotal:                            950.00
Tax:                                 152.00

TOTAL:                              1102.00
`.trim();

console.log('=== Example 1: Complete Receipt ===');
const result1 = testRoundTrip(completeReceipt, DEFAULT_TEMPLATE);
console.log('Success:', result1.success);
console.log('Discrepancies:', result1.discrepancies.length);
if (result1.error) {
  console.log('Error:', result1.error);
}
console.log();

// Example 2: Test a receipt with items only
const itemsOnlyReceipt = `
QTY  ITEM                           AMOUNT
----------------------------------------
1    Coffee                           50.00
2    Tea                              40.00
----------------------------------------
TOTAL:                               130.00
`.trim();

console.log('=== Example 2: Items Only Receipt ===');
const result2 = testRoundTrip(itemsOnlyReceipt, DEFAULT_TEMPLATE);
console.log('Success:', result2.success);
console.log('Discrepancies:', result2.discrepancies.length);
console.log();

// Example 3: Test a low confidence receipt (will be skipped)
const lowConfidenceReceipt = 'Invalid receipt with no parseable data';

console.log('=== Example 3: Low Confidence Receipt ===');
const result3 = testRoundTrip(lowConfidenceReceipt, DEFAULT_TEMPLATE);
console.log('Success:', result3.success);
console.log('Error:', result3.error);
console.log();

// Example 4: Inspect discrepancies
const receiptWithPotentialIssues = `
QTY  ITEM                           AMOUNT
----------------------------------------
1    Item With  Extra  Spaces        100.00
----------------------------------------
TOTAL:                               100.00
`.trim();

console.log('=== Example 4: Receipt with Potential Issues ===');
const result4 = testRoundTrip(receiptWithPotentialIssues, DEFAULT_TEMPLATE);
console.log('Success:', result4.success);
console.log('Discrepancies:', result4.discrepancies.length);
if (result4.discrepancies.length > 0) {
  console.log('Discrepancy details:');
  result4.discrepancies.forEach((disc, i) => {
    console.log(`  ${i + 1}. ${disc.message}`);
    console.log(`     Field: ${disc.field}`);
    console.log(`     Original: ${disc.original}`);
    console.log(`     Reparsed: ${disc.reparsed}`);
  });
}
console.log();

// Example 5: Access intermediate results
console.log('=== Example 5: Accessing Intermediate Results ===');
const result5 = testRoundTrip(completeReceipt, DEFAULT_TEMPLATE);
console.log('Original parsed items count:', result5.originalParsed?.items?.length || 0);
console.log('Reparsed items count:', result5.reparsed?.items?.length || 0);
console.log('Original total:', result5.originalParsed?.total || 0);
console.log('Reparsed total:', result5.reparsed?.total || 0);
console.log('Formatted text length:', result5.formatted?.length || 0);
