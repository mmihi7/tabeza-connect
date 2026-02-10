/**
 * Test script for Enhanced Regex Fallback System
 * Production-grade receipt parsing with confidence scoring
 */

const { ReceiptParser } = require('./dist/core/receipt-parser');

async function testEnhancedRegexFallback() {
  console.log('🧪 Testing Enhanced Regex Fallback System...\n');
  
  const parser = new ReceiptParser();
  
  // Test receipt with various challenging formats
  const testReceipts = [
    {
      name: 'Standard Format',
      text: `2026-02-09 19:43
2x Burger        500.00
Fries           200.00
Coke x3         450.00
TOTAL          1150.00`
    },
    {
      name: 'Messy POS Format',
      text: `   2026/02/09  19:43   
2   x   Burger   500.00
   Fries   200.00
Coke (3)   450.00
TOTAL: 1150.00`
    },
    {
      name: 'Embedded Quantity Format',
      text: `2026-02-09 19:43
Burger x2 500.00
Fries 200.00
Coke (3) 450.00
TOTAL 1150.00`
    },
    {
      name: 'Challenging Layout',
      text: `2026-02-09 19:43
Burger     2   500.00
Fries          200.00
Coke       3   450.00
TOTAL 1150.00`
    }
  ];
  
  for (const test of testReceipts) {
    console.log(`📄 Testing: ${test.name}`);
    console.log('Input:');
    console.log(test.text);
    console.log('\n---');
    
    try {
      const result = await parser.parsePlainText(test.text, {
        enableHeuristics: true,
        merchantId: 'test-merchant'
      });
      
      console.log(`Status: ${result.status}`);
      console.log(`Confidence: ${result.confidence.toFixed(2)}`);
      console.log(`Items found: ${result.metadata.itemsFound}`);
      
      if (result.receipt?.events?.[0]?.items) {
        console.log('Extracted items:');
        result.receipt.events[0].items.forEach((item, i) => {
          console.log(`  ${i + 1}. ${item.name} - Qty: ${item.qty}, Unit: ${item.unit_price}, Total: ${item.total_price}`);
        });
      }
      
      if (result.warnings.length > 0) {
        console.log('Warnings:');
        result.warnings.forEach(warning => console.log(`  ⚠️  ${warning}`));
      }
      
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
  }
  
  console.log('✅ Enhanced Regex Fallback Test Complete!');
}

// Run the test
testEnhancedRegexFallback().catch(console.error);
