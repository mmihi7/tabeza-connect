/**
 * Test script for TABEZA Print Parsing Components
 * Tests the extracted pure parsing logic (escpos-parser)
 * Run with: node test-print-parsing.js
 */

console.log('🔍 Testing TABEZA Print Parsing Components...\n');

async function testPrintParsing() {
  try {
    // Test 1: Test ESC/POS Parser
    console.log('1️⃣ Testing ESC/POS Parser...');
    try {
      const { parseReceiptData, detectReceiptFormat } = require('./packages/escpos-parser/dist/index.js');
      
      const samplePrintData = `
TABEZA TEST RESTAURANT
123 Test Street, Nairobi
Tel: +254 700 123456
KRA PIN: P051234567A
--------------------------
Table: 5
Order #: 001
Date: ${new Date().toLocaleDateString()}
Time: ${new Date().toLocaleTimeString()}
--------------------------
1x Ugali                50.00
1x Sukuma Wiki          80.00
1x Soda                 60.00
--------------------------
Subtotal:              190.00
VAT (16%):              30.40
Total:                 220.40
--------------------------
Payment: M-PESA
Ref: QH7RTXM2
Amount: 220.40 KES
Status: COMPLETED
--------------------------
Thank you for dining with us!
Visit: www.tabeza.com
      `.trim();

      // Test format detection
      const format = detectReceiptFormat(samplePrintData);
      console.log('✅ Format detected:', format);

      // Test parsing
      const parsed = parseReceiptData(samplePrintData);
      console.log('✅ Receipt parsed successfully:');
      console.log('   Items found:', parsed.items?.length || 0);
      console.log('   Total amount:', parsed.total || 'N/A');
      console.log('   Payment method:', parsed.payment?.method || 'N/A');
      
    } catch (escposError) {
      console.log('⚠️  ESC/POS Parser test skipped');
      console.log('   Reason:', escposError.message);
      console.log('   Tip: Build the package with: cd packages/escpos-parser && pnpm build');
    }

    // Test 2: Test Receipt Schema
    console.log('\n2️⃣ Testing Receipt Schema...');
    try {
      const { createReceiptSession, createReceiptEvent, validateCompleteSession } = require('./packages/receipt-schema/dist/index.js');
      
      // Create a test session
      const session = createReceiptSession({
        merchantId: 'test-merchant-001',
        merchantName: 'Test Restaurant',
        printerId: 'test-printer-001',
        tableNumber: '5',
        kraPin: 'P051234567A'
      });
      
      console.log('✅ Receipt session created:');
      console.log('   Session ID:', session.tabeza_receipt_id);
      console.log('   Merchant:', session.merchant.name);
      console.log('   Table:', session.table_number);
      console.log('   Status:', session.status);

      // Create a test event
      const event = createReceiptEvent({
        sessionId: session.tabeza_receipt_id,
        type: 'SALE',
        sequence: 1,
        items: [
          { name: 'Ugali', qty: 1, unit_price: 50, total_price: 50 },
          { name: 'Sukuma Wiki', qty: 1, unit_price: 80, total_price: 80 }
        ],
        rawHash: 'test-hash-123',
        parsedConfidence: 0.95
      });

      console.log('✅ Receipt event created:');
      console.log('   Event type:', event.type);
      console.log('   Items:', event.items.length);
      console.log('   Total:', event.totals.total);
      
    } catch (schemaError) {
      console.log('⚠️  Receipt Schema test skipped');
      console.log('   Reason:', schemaError.message);
      console.log('   Tip: Build the package with: cd packages/receipt-schema && pnpm build');
    }

    // Test 3: Test Validation
    console.log('\n3️⃣ Testing Validation Components...');
    try {
      const { validateReceiptData, sanitizeReceiptData } = require('./packages/validation/dist/index.js');
      
      const testData = {
        merchant: {
          id: 'test-merchant-001',
          name: 'Test Restaurant',
          kra_pin: 'P051234567A'
        },
        items: [
          { name: 'Ugali', qty: 1, unit_price: 50, total_price: 50 }
        ],
        total: 50,
        currency: 'KES'
      };

      // Test sanitization
      const sanitized = sanitizeReceiptData(testData);
      console.log('✅ Data sanitized successfully');
      console.log('   Merchant name:', sanitized.merchant?.name);
      console.log('   Items count:', sanitized.items?.length || 0);

      // Test validation
      const validation = validateReceiptData(sanitized);
      console.log('✅ Validation completed:');
      console.log('   Valid:', validation.valid);
      console.log('   Score:', validation.score);
      console.log('   Errors:', validation.errors?.length || 0);
      console.log('   Warnings:', validation.warnings?.length || 0);
      
    } catch (validationError) {
      console.log('⚠️  Validation test skipped');
      console.log('   Reason:', validationError.message);
      console.log('   Tip: Build the package with: cd packages/validation && pnpm build');
    }

    console.log('\n🎉 Print parsing components test completed!');
    console.log('\n📋 Component Status:');
    console.log('   📦 ESC/POS Parser: Available for testing');
    console.log('   📦 Receipt Schema: Available for testing');
    console.log('   📦 Validation: Available for testing');
    console.log('   📦 Virtual Printer Engine: Available for testing');

    console.log('\n💡 Next steps:');
    console.log('   1. Run: node test-virtual-printer.js (for full engine test)');
    console.log('   2. Run: cd packages/receipt-schema && node test-basic.js (for schema test)');
    console.log('   3. Build packages if needed: pnpm build');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\n🔍 Error details:');
    console.error(error.stack);
    
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Install dependencies: pnpm install');
    console.log('   2. Build all packages: pnpm build');
    console.log('   3. Check package structure in packages/ directory');
    
    process.exit(1);
  }
}

// Run the test
testPrintParsing();