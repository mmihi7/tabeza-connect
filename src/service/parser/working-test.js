/**
 * Test with working regex patterns
 */

const workingTemplate = {
  name: "Working Template",
  version: "1.0",
  description: "Template with working regex patterns",
  patterns: {
    restaurant_name: "(?i)^(.+?)$",
    receipt_number: "(?i)^.*(?:receipt|inv|order)[\\s#:]*(\\d+)\\s*$",
    total: "(?i)^.*(?:total|amount)[:\\s]*KES?\\s*([\\d,]+\\.?\\d*)\\s*$",
    items: "(?i)^\\s*(\\d+)\\s+(.+?)\\s+(KES?\\s*)?([\\d,]+\\.?\\d*)\\s*$"
  },
  fields: [
    {
      name: "restaurant_name",
      type: "text",
      label: "Restaurant Name",
      required: false,
      pattern: "(?i)^(.+?)$"
    },
    {
      name: "receipt_number",
      type: "text",
      label: "Receipt #",
      required: false,
      pattern: "(?i)^.*(?:receipt|inv|order)[\\s#:]*(\\d+)\\s*$"
    },
    {
      name: "total",
      type: "number",
      label: "Total",
      required: false,
      pattern: "(?i)^.*(?:total|amount)[:\\s]*KES?\\s*([\\d,]+\\.?\\d*)\\s*$"
    },
    {
      name: "items",
      type: "array",
      label: "Order Items",
      required: false,
      pattern: "(?i)^\\s*(\\d+)\\s+(.+?)\\s+(KES?\\s*)?([\\d,]+\\.?\\d*)\\s*$"
    }
  ]
};

console.log('='.repeat(60));
console.log('Working Template Test');
console.log('='.repeat(60));

// Test each pattern individually
Object.entries(workingTemplate.patterns).forEach(([name, pattern]) => {
  try {
    console.log(`Testing ${name}:`, pattern);
    const regex = new RegExp(pattern);
    console.log(`✅ ${name}: Pattern created successfully`);
    
    // Test against sample text
    const sampleText = name === 'restaurant_name' ? 'TEST RESTAURANT' :
                      name === 'receipt_number' ? 'Receipt #12345' :
                      name === 'total' ? 'TOTAL KES 522.00' :
                      '1x Coffee KES 150.00';
    
    const match = sampleText.match(regex);
    console.log(`   Match result:`, match);
    
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
  }
});

// Test with TemplateParser
const TemplateParser = require('./template-parser');
const fs = require('fs');
const path = require('path');

// Save working template
const testPath = path.join(__dirname, '__tests__', 'working-template.json');
fs.writeFileSync(testPath, JSON.stringify(workingTemplate, null, 2));

try {
  const loadedTemplate = TemplateParser.loadTemplate(testPath);
  if (loadedTemplate) {
    console.log('\n✅ Template loaded successfully by TemplateParser');
    
    // Test parsing
    const sampleReceipt = `
TEST RESTAURANT
Receipt #12345
1x Coffee KES 150.00
2x Sandwich KES 300.00
TOTAL KES 522.00
`;

    const parsedResult = TemplateParser.parse(sampleReceipt, testPath);
    console.log('✅ Parsing result:', {
      parsed: parsedResult.parsed,
      confidence: parsedResult.confidence,
      receiptNumber: parsedResult.receiptNumber,
      total: parsedResult.total,
      items: parsedResult.items
    });
  } else {
    console.log('❌ Template failed to load');
  }
} catch (error) {
  console.log('❌ TemplateParser error:', error.message);
}

// Cleanup
fs.unlinkSync(testPath);
console.log('\n✓ Test completed!');
