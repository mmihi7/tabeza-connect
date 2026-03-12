#!/usr/bin/env node
/**
 * Standalone verification script for textifier module
 * This script can be run directly with: node verify-textifier.js
 */

const path = require('path');
const { textify, textifyWithTiming, DEFAULT_OPTIONS } = require('./src/utils/textifier');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passCount++;
  } catch (error) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${error.message}`);
    failCount++;
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected "${expected}", got "${actual}"`);
  }
}

function assertTrue(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed: expected true');
  }
}

console.log('Verifying Textifier Module\n');
console.log('='.repeat(50));

// Test 1: Simple ASCII text
test('Simple ASCII text decoding', () => {
  const input = Buffer.from('Hello World', 'ascii');
  const result = textify(input);
  assertEqual(result, 'Hello World');
});

// Test 2: Preserve line breaks
test('Preserve \\r\\n line breaks', () => {
  const input = Buffer.from('Line 1\r\nLine 2', 'ascii');
  const result = textify(input);
  assertEqual(result, 'Line 1\r\nLine 2');
});

// Test 3: Preserve tabs
test('Preserve \\t tabs', () => {
  const input = Buffer.from('Item\tQty\tPrice', 'ascii');
  const result = textify(input);
  assertEqual(result, 'Item\tQty\tPrice');
});

// Test 4: Replace non-printable characters
test('Replace non-printable characters with spaces', () => {
  const input = Buffer.from([0x1B, 0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x07]);
  const result = textify(input);
  assertTrue(result.includes('Hello'), 'Should contain "Hello"');
});

// Test 5: Collapse multiple spaces
test('Collapse multiple consecutive spaces', () => {
  const input = Buffer.from('Hello    World', 'ascii');
  const result = textify(input);
  assertEqual(result, 'Hello World');
});

// Test 6: Don't collapse spaces when disabled
test('Preserve multiple spaces when collapseSpaces=false', () => {
  const input = Buffer.from('Hello    World', 'ascii');
  const result = textify(input, { collapseSpaces: false });
  assertEqual(result, 'Hello    World');
});

// Test 7: Empty buffer
test('Handle empty buffer', () => {
  const input = Buffer.from([]);
  const result = textify(input);
  assertEqual(result, '');
});

// Test 8: TypeError for non-Buffer input
test('Throw TypeError for non-Buffer input', () => {
  try {
    textify('not a buffer');
    throw new Error('Should have thrown TypeError');
  } catch (error) {
    assertTrue(error instanceof TypeError, 'Should throw TypeError');
  }
});

// Test 9: Typical receipt format
test('Handle typical receipt format', () => {
  const receipt = Buffer.from(
    'RECEIPT #123\r\n' +
    'Item 1       2    500.00\r\n' +
    'Item 2       1    300.00\r\n' +
    'TOTAL           800.00\r\n',
    'ascii'
  );
  const result = textify(receipt);
  assertTrue(result.includes('RECEIPT #123'), 'Should contain receipt number');
  assertTrue(result.includes('TOTAL'), 'Should contain TOTAL');
  assertTrue(result.includes('800.00'), 'Should contain total amount');
});

// Test 10: Performance test
test('Complete within 10ms for typical receipt', () => {
  const largeText = 'Item Name       Qty    Price\r\n'.repeat(100);
  const input = Buffer.from(largeText, 'ascii');
  const { text, timeMs } = textifyWithTiming(input);
  assertTrue(text.length > 0, 'Should produce output');
  assertTrue(timeMs < 10, `Should complete in < 10ms (took ${timeMs.toFixed(3)}ms)`);
});

// Test 11: ESC/POS control sequences
test('Handle ESC/POS control sequences', () => {
  const input = Buffer.from([
    0x1B, 0x40,           // ESC @ (initialize)
    0x48, 0x65, 0x6C, 0x6C, 0x6F,  // "Hello"
    0x20,                 // Space
    0x57, 0x6F, 0x72, 0x6C, 0x64   // "World"
  ]);
  const result = textify(input);
  assertTrue(result.includes('Hello'), 'Should contain "Hello"');
  assertTrue(result.includes('World'), 'Should contain "World"');
});

// Test 12: DEFAULT_OPTIONS
test('DEFAULT_OPTIONS has correct values', () => {
  assertEqual(DEFAULT_OPTIONS.encoding, 'windows-1252');
  assertTrue(Array.isArray(DEFAULT_OPTIONS.preserveChars), 'preserveChars should be array');
  assertEqual(DEFAULT_OPTIONS.preserveChars.length, 3);
  assertEqual(DEFAULT_OPTIONS.collapseSpaces, true);
});

// Test 13: textifyWithTiming returns correct structure
test('textifyWithTiming returns text and timeMs', () => {
  const input = Buffer.from('Hello', 'ascii');
  const result = textifyWithTiming(input);
  assertTrue(typeof result === 'object', 'Should return object');
  assertTrue('text' in result, 'Should have text property');
  assertTrue('timeMs' in result, 'Should have timeMs property');
  assertEqual(result.text, 'Hello');
  assertTrue(typeof result.timeMs === 'number', 'timeMs should be number');
  assertTrue(result.timeMs >= 0, 'timeMs should be non-negative');
});

// Test 14: Custom encoding option
test('Handle custom encoding option', () => {
  const input = Buffer.from('Hello', 'utf8');
  const result = textify(input, { encoding: 'utf8' });
  assertEqual(result, 'Hello');
});

// Test 15: Custom preserveChars option
test('Handle custom preserveChars option', () => {
  const input = Buffer.from('Line1\r\nLine2\tTab', 'ascii');
  const result = textify(input, { preserveChars: ['\n'] });
  assertTrue(result.includes('\n'), 'Should preserve \\n');
  assertTrue(!result.includes('\r') || result.includes(' '), 'Should replace \\r');
  assertTrue(!result.includes('\t') || result.includes(' '), 'Should replace \\t');
});

console.log('='.repeat(50));
console.log(`\nResults: ${passCount} passed, ${failCount} failed`);

if (failCount > 0) {
  console.log('\n❌ Some tests failed');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!');
  process.exit(0);
}
