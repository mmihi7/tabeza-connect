/**
 * Simple regex test to debug the issue
 */

// Test the problematic pattern directly
try {
  const pattern = "(?i)^.*(?:receipt|inv|order)[\\s#:]*(\\d+)\\s*$";
  console.log('Testing pattern:', pattern);
  const regex = new RegExp(pattern);
  console.log('✅ Regex created successfully:', regex);
  
  // Test against sample text
  const testText = 'Receipt #12345';
  const match = testText.match(regex);
  console.log('Match result:', match);
  
} catch (error) {
  console.error('❌ Regex error:', error.message);
}

// Test with different pattern formats
const patterns = [
  "(?i)^.*(?:receipt|inv|order)[\\s#:]*(\\d+)\\s*$",
  /^(?:.*(?:receipt|inv|order)[\s#:]*(\d+)\s*)$/i,
  /receipt.*?(\d+)/i
];

patterns.forEach((pattern, i) => {
  try {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    console.log(`Pattern ${i + 1}: ✅ ${regex}`);
  } catch (error) {
    console.log(`Pattern ${i + 1}: ❌ ${error.message}`);
  }
});
