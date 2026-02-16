/**
 * Test Print Job Generator
 * 
 * Creates a realistic receipt file and saves it to the printer service watch folder
 * This simulates a POS system printing a receipt
 */

const fs = require('fs');
const path = require('path');

// Watch folder path (same as printer service)
const WATCH_FOLDER = path.join(process.env.USERPROFILE || process.env.HOME, 'TabezaPrints');

// Generate realistic receipt content
function generateTestReceipt() {
  const now = new Date();
  const receiptNumber = `RCP-${now.getTime().toString().slice(-6)}`;
  
  // Realistic test items
  const items = [
    { qty: 2, name: 'Tusker Lager 500ml', price: 250.00 },
    { qty: 1, name: 'Nyama Choma (Half Kg)', price: 800.00 },
    { qty: 3, name: 'Pilsner 500ml', price: 200.00 },
    { qty: 1, name: 'Chips Masala', price: 150.00 },
    { qty: 2, name: 'Soda (Coke)', price: 80.00 },
  ];
  
  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + (item.qty * item.price), 0);
  const tax = subtotal * 0.16; // 16% VAT
  const total = subtotal + tax;
  
  // Format receipt with proper spacing
  const receipt = `
========================================
         TEST RECEIPT
         Naivas Supermarket
========================================
Receipt #: ${receiptNumber}
Date: ${now.toLocaleDateString()}
Time: ${now.toLocaleTimeString()}
Cashier: John Doe
Till: 003

========================================

QTY  ITEM                      AMOUNT
----------------------------------------
${items.map(item => {
  const qtyStr = item.qty.toString().padEnd(4);
  const itemStr = item.name.padEnd(20);
  const amountStr = (item.qty * item.price).toFixed(2).padStart(10);
  return `${qtyStr} ${itemStr} ${amountStr}`;
}).join('\n')}
----------------------------------------

Subtotal:                  ${subtotal.toFixed(2).padStart(10)}
VAT (16%):                 ${tax.toFixed(2).padStart(10)}
========================================
TOTAL:                     ${total.toFixed(2).padStart(10)}
========================================

Payment Method: Cash
Amount Paid:               ${(total + 100).toFixed(2).padStart(10)}
Change:                    ${(100).toFixed(2).padStart(10)}

Thank you for shopping with us!
Visit us again soon.

Customer Care: 0800 123 456
www.naivas.co.ke

========================================
        Powered by Tabeza
========================================
  `.trim();
  
  return {
    content: receipt,
    receiptNumber,
    total,
    itemCount: items.length,
  };
}

// Main function
async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║   Test Print Job Generator                                ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  
  // Check if watch folder exists
  if (!fs.existsSync(WATCH_FOLDER)) {
    console.error(`❌ Watch folder does not exist: ${WATCH_FOLDER}`);
    console.error('   Make sure the printer service is running first.');
    process.exit(1);
  }
  
  console.log(`📁 Watch folder: ${WATCH_FOLDER}`);
  console.log('');
  
  // Generate receipt
  console.log('📄 Generating test receipt...');
  const receipt = generateTestReceipt();
  
  console.log(`   Receipt #: ${receipt.receiptNumber}`);
  console.log(`   Items: ${receipt.itemCount}`);
  console.log(`   Total: KES ${receipt.total.toFixed(2)}`);
  console.log('');
  
  // Save to watch folder
  const filename = `test-receipt-${Date.now()}.txt`;
  const filepath = path.join(WATCH_FOLDER, filename);
  
  console.log(`💾 Saving receipt to: ${filename}`);
  fs.writeFileSync(filepath, receipt.content);
  
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║   ✅ Test receipt created successfully!                   ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('📋 What happens next:');
  console.log('   1. Printer service detects the new file');
  console.log('   2. Reads and processes the receipt');
  console.log('   3. Sends it to the cloud for parsing');
  console.log('   4. Moves file to "processed" folder');
  console.log('');
  console.log('🔍 Check your printer service terminal for activity!');
  console.log('');
  console.log(`📂 File location: ${filepath}`);
}

// Run
main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
