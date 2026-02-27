/**
 * Debug script to understand why items aren't being extracted
 */

const fs = require('fs');
const path = require('path');

// Load the receipt
const receiptPath = path.join(__dirname, 'test-receipts', 'tusker-test-receipt.txt');
const receiptText = fs.readFileSync(receiptPath, 'utf8');

console.log('RECEIPT TEXT:');
console.log('='.repeat(60));
console.log(receiptText);
console.log('='.repeat(60));
console.log();

// Test the patterns
const patterns = {
  startMarker: /QTY\s+ITEM\s+AMOUNT/i,
  endMarker: /^-{3,}|Subtotal|Total/,
  itemPattern: /^(\d+)\s+(.+?)\s+(\d+(?:,\d{3})*\.?\d{2})$/,
  tax: /(?:VAT|Tax):?\s*\(?\d+%?\)?\s*(\d+(?:,\d{3})*\.?\d{2})/i,
  total: /TOTAL:?\s*(\d+(?:,\d{3})*\.?\d{2})/i
};

console.log('TESTING LINE BY LINE:');
console.log('='.repeat(60));

const lines = receiptText.split('\n');
let inItemsSection = false;
let foundFirstSeparator = false;

lines.forEach((line, index) => {
  const lineNum = (index + 1).toString().padStart(3, ' ');
  
  // Check for start marker
  if (!inItemsSection && patterns.startMarker.test(line)) {
    console.log(`${lineNum}: [START MARKER] "${line}"`);
    inItemsSection = true;
    return;
  }
  
  // Skip first separator
  if (inItemsSection && !foundFirstSeparator && patterns.endMarker.test(line)) {
    console.log(`${lineNum}: [SKIP FIRST SEPARATOR] "${line}"`);
    foundFirstSeparator = true;
    return;
  }
  
  // Check for end marker
  if (inItemsSection && foundFirstSeparator && patterns.endMarker.test(line)) {
    console.log(`${lineNum}: [END MARKER] "${line}"`);
    inItemsSection = false;
    return;
  }
  
  // Try to match item pattern
  if (inItemsSection && foundFirstSeparator) {
    // Show the line with visible whitespace
    const visibleLine = line.replace(/ /g, '·');
    console.log(`${lineNum}: Testing: "${visibleLine}"`);
    
    const match = line.match(patterns.itemPattern);
    if (match) {
      console.log(`       [ITEM MATCH] qty=${match[1]}, name="${match[2]}", price=${match[3]}`);
    } else {
      console.log(`       [NO MATCH]`);
      // Try simpler patterns to debug
      const simpleMatch = line.match(/^(\d+)\s+(.+?)\s+(\d+\.?\d*)/);
      if (simpleMatch) {
        console.log(`       [SIMPLE MATCH] qty=${simpleMatch[1]}, name="${simpleMatch[2]}", price=${simpleMatch[3]}`);
      }
    }
  }
  
  // Check tax pattern
  const taxMatch = line.match(patterns.tax);
  if (taxMatch) {
    console.log(`${lineNum}: [TAX MATCH] ${taxMatch[1]} from "${line}"`);
  }
  
  // Check total pattern
  const totalMatch = line.match(patterns.total);
  if (totalMatch) {
    console.log(`${lineNum}: [TOTAL MATCH] ${totalMatch[1]} from "${line}"`);
  }
});

console.log();
console.log('='.repeat(60));
