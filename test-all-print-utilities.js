/**
 * Comprehensive test for all TABEZA Print Utilities
 * Run with: node test-all-print-utilities.js
 */

console.log('🖨️  TABEZA Print Utilities Test Suite');
console.log('=====================================\n');

async function runAllTests() {
  const results = {
    receiptSchema: false,
    virtualPrinter: false,
    validation: false,
    escposParser: false
  };

  // Test 1: Receipt Schema (Core functionality)
  console.log('📋 1. RECEIPT SCHEMA TEST');
  console.log('-------------------------');
  try {
    const {
      createReceiptSession,
      createReceiptEvent,
      validateCompleteSession
    } = require('./packages/receipt-schema/dist/index.js');

    // Create a test session
    const session = createReceiptSession({
      merchantId: 'test-merchant-001',
      merchantName: 'Test Restaurant',
      printerId: 'test-printer-001',
      tableNumber: '5',
      kraPin: 'P051234567A'
    });

    console.log('✅ Receipt session created successfully');
    console.log('   Session ID:', session.tabeza_receipt_id);
    console.log('   Merchant:', session.merchant.name);
    console.log('   Table:', session.table_number);

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

    console.log('✅ Receipt event created successfully');
    console.log('   Event type:', event.type);
    console.log('   Items:', event.items.length);
    console.log('   Total:', event.totals.total);

    results.receiptSchema = true;

  } catch (error) {
    console.log('❌ Receipt Schema test failed:', error.message);
  }

  // Test 2: ESC/POS Parser
  console.log('\n🔍 2. ESC/POS PARSER TEST');
  console.log('---------------------------');
  try {
    const { parseReceiptData, detectPrintFormat } = require('./packages/escpos-parser/dist/index.js');
    
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
    const format = detectPrintFormat(samplePrintData);
    console.log('✅ Format detected:', format);

    // Test parsing
    const parsed = parseReceiptData(samplePrintData);
    console.log('✅ Receipt parsed successfully');
    console.log('   Items found:', parsed.items?.length || 0);
    console.log('   Total amount:', parsed.total || 'N/A');
    console.log('   Payment method:', parsed.payment?.method || 'N/A');

    results.escposParser = true;

  } catch (error) {
    console.log('❌ ESC/POS Parser test failed:', error.message);
  }

  // Test 3: Validation
  console.log('\n✅ 3. VALIDATION TEST');
  console.log('----------------------');
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
    console.log('✅ Validation completed');
    console.log('   Valid:', validation.valid);
    console.log('   Score:', validation.score);
    console.log('   Errors:', validation.errors?.length || 0);
    console.log('   Warnings:', validation.warnings?.length || 0);

    results.validation = true;

  } catch (error) {
    console.log('❌ Validation test failed:', error.message);
  }

  // Test 4: Virtual Printer (if available)
  console.log('\n🖨️  4. VIRTUAL PRINTER TEST');
  console.log('-----------------------------');
  try {
    // Check if virtual printer package exists
    const fs = require('fs');
    const path = require('path');
    const virtualPrinterPath = path.join(__dirname, 'packages', 'virtual-printer', 'dist');
    
    if (fs.existsSync(virtualPrinterPath)) {
      console.log('✅ Virtual Printer package found');
      console.log('   Run: node test-virtual-printer.js for detailed test');
      results.virtualPrinter = true;
    } else {
      console.log('⚠️  Virtual Printer package not built');
      console.log('   Tip: Build with: cd packages/virtual-printer && pnpm build');
    }

  } catch (error) {
    console.log('❌ Virtual Printer test failed:', error.message);
  }

  // Summary
  console.log('\n🎉 TEST SUMMARY');
  console.log('================');
  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`✅ Passed: ${passedTests}/${totalTests} tests`);
  console.log('\n📋 Component Status:');
  console.log(`   📦 Receipt Schema: ${results.receiptSchema ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   📦 ESC/POS Parser: ${results.escposParser ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   📦 Validation: ${results.validation ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   📦 Virtual Printer: ${results.virtualPrinter ? '✅ AVAILABLE' : '⚠️  NOT BUILT'}`);

  console.log('\n💡 Next steps:');
  console.log('   1. Run individual tests: node test-print-parsing.js');
  console.log('   2. Run virtual printer test: node test-virtual-printer.js');
  console.log('   3. Build missing packages: pnpm build');

  return results;
}

// Run all tests
runAllTests().catch(console.error);