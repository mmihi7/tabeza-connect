// Test the updated parser with test receipt format
const { parseReceipt } = require('./packages/shared/services/receiptParser.ts');

const testReceiptText = `========================================
         TABEZA TEST RECEIPT
========================================
Receipt #: RCP-292021
Date: 10/02/2026
Time: 21:31:32

Note: Tabeza Printer Test

========================================

QTY  ITEM                      AMOUNT
----------------------------------------
2   Tusker Lager 500ml       500.00
1   Smirnoff Vodka 250ml       450.00
1   Nyama Choma (Goat) 1kg       780.00
1   Kachumbari                100.00
----------------------------------------

Subtotal:                  1830.00
VAT (16%):                 292.80
========================================
TOTAL:                     2122.80
========================================

Payment Method: Cash
Change: 0.00`;

async function testTestReceiptParsing() {
  console.log('🧪 Testing TEST RECEIPT parsing...\n');
  
  try {
    const result = await parseReceipt(testReceiptText, 'test-bar', 'test-receipt');
    
    console.log('Parsing result:');
    console.log('Items found:', result.items.length);
    console.log('Total:', result.total);
    
    if (result.items.length > 0) {
      console.log('\nItems:');
      result.items.forEach((item, i) => {
        console.log(`${i + 1}. ${item.name} - ${item.price}`);
      });
    } else {
      console.log('\n🔍 Debugging - Let me check each line:');
      const lines = testReceiptText.split('\n');
      let inItemsSection = false;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.match(/QTY.*ITEM.*AMOUNT/i)) {
          inItemsSection = true;
          console.log(`Line ${i}: Found items header: "${line}"`);
          continue;
        }
        
        // Skip the separator line right after header
        if (inItemsSection && line.startsWith('---') && lines[i-1]?.trim().match(/QTY.*ITEM.*AMOUNT/i)) {
          console.log(`Line ${i}: Skipping separator after header: "${line}"`);
          continue;
        }
        
        if (inItemsSection && line.startsWith('---')) {
          inItemsSection = false;
          console.log(`Line ${i}: End of items section: "${line}"`);
          continue;
        }
        
        if (inItemsSection && line.length > 5) {
          console.log(`Line ${i}: Potential item: "${line}"`);
          
          // Test our patterns
          let match = line.match(/^(\d+)\s+(.+?)\s+([\d,]+\.?\d*)$/);
          if (match) {
            console.log(`  ✅ Matched Test Receipt Pattern: qty=${match[1]}, name="${match[2]}", price=${match[3]}`);
          } else {
            console.log(`  ❌ No pattern match`);
          }
        }
      }
    }
    
    const expectedTotal = 2122.80;
    const calculatedTotal = result.items.reduce((sum, item) => sum + item.price, 0);
    
    console.log('\n📊 Verification:');
    console.log(`Expected total: ${expectedTotal}`);
    console.log(`Calculated total: ${calculatedTotal}`);
    console.log(`Match: ${calculatedTotal === expectedTotal ? '✅ YES' : '❌ NO'}`);
    
  } catch (error) {
    console.error('Parsing failed:', error);
  }
}

testTestReceiptParsing();
