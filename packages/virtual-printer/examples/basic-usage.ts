/**
 * Basic usage example for TABEZA Virtual Printer Interface
 */

import { 
  createVirtualPrinter, 
  createTestReceipt, 
  createTestPrintData,
  formatReceiptForDisplay,
  VirtualPrinterEngine
} from '../src/index';

async function basicExample() {
  console.log('🖨️  TABEZA Virtual Printer Interface - Basic Example\n');

  // 1. Create virtual printer instance
  console.log('1. Creating virtual printer...');
  const merchantId = 'demo-restaurant-001';
  
  const virtualPrinter = createVirtualPrinter(merchantId, {
    forwardToPhysicalPrinter: false, // Don't forward in demo
    generateQRCode: true
  });

  // 2. Set up event listeners
  virtualPrinter.on('job-completed', (result) => {
    console.log('✅ Receipt processed successfully!');
    console.log('   Receipt ID:', result.receipt.receipt_id);
    console.log('   QR Code URL:', result.output.qrCode?.url);
    console.log('   Processing time:', result.processingTime, 'ms');
  });

  virtualPrinter.on('job-error', (error) => {
    console.error('❌ Processing error:', error);
  });

  // 3. Process a receipt manually (simulating captured print job)
  console.log('\n2. Processing test receipt...');
  
  const testPrintData = createTestPrintData('PLAIN_TEXT');
  console.log('   Print data size:', testPrintData.length, 'bytes');

  try {
    const result = await virtualPrinter.processReceiptManually(
      testPrintData,
      merchantId
    );

    console.log('\n3. Processing results:');
    console.log('   ✅ Receipt parsed successfully');
    console.log('   📄 Receipt ID:', result.receipt.receipt_id);
    console.log('   🏪 Merchant:', result.receipt.merchant.name);
    console.log('   💰 Total:', `KES ${result.receipt.totals.total}`);
    console.log('   📱 QR Code:', result.qrCode?.url);

    // 4. Display formatted receipt
    console.log('\n4. Formatted receipt:');
    console.log('─'.repeat(50));
    console.log(formatReceiptForDisplay(result.receipt));
    console.log('─'.repeat(50));

    // 5. Show system status
    console.log('\n5. System status:');
    const status = virtualPrinter.getSystemStatus();
    const stats = virtualPrinter.getStats();
    
    console.log('   Running:', status.isRunning);
    console.log('   Total processed:', stats.totalJobsProcessed);
    console.log('   Success rate:', `${Math.round((stats.successfulParsing / stats.totalJobsProcessed) * 100)}%`);
    console.log('   Average processing time:', `${stats.averageProcessingTime}ms`);

  } catch (error) {
    console.error('❌ Failed to process receipt:', error);
  }
}

async function complianceHintsExample() {
  console.log('\n\n🏷️  Compliance Hints Example - Metadata Only\n');

  const merchantId = 'hints-restaurant-001';
  
  // Create printer (no compliance logic in printer)
  const virtualPrinter = createVirtualPrinter(merchantId);

  // Create test receipt with KRA PIN
  const testReceipt = createTestReceipt(merchantId, {
    merchantName: 'Compliance Restaurant Ltd',
    includeKraPin: true,
    paymentMethod: 'MPESA'
  });

  console.log('1. Test receipt created:');
  console.log('   Merchant:', testReceipt.merchant.name);
  console.log('   KRA PIN:', testReceipt.merchant.kra_pin);
  console.log('   Payment:', testReceipt.transaction.payment_method);

  // Process receipt (compliance hints attached automatically)
  const result = await virtualPrinter.processReceiptManually(
    createTestPrintData('PLAIN_TEXT'),
    merchantId
  );

  console.log('\n2. Compliance hints attached:');
  const compliance = result.receipt._compliance;
  console.log('   Jurisdiction:', compliance?.hints?.jurisdiction);
  console.log('   Business category:', compliance?.hints?.business_category);
  console.log('   Receipt type:', compliance?.hints?.receipt_type);
  console.log('   Requires tax submission:', compliance?.hints?.requires_tax_submission);
  console.log('   Captured at:', compliance?.captured_at);
  console.log('   Capture source:', compliance?.capture_source);

  console.log('\n3. Processing flags:');
  console.log('   Requires review:', compliance?.processing_flags?.requires_review);
  console.log('   High value:', compliance?.processing_flags?.high_value);
  console.log('   Cross border:', compliance?.processing_flags?.cross_border);

  console.log('\n✅ Compliance hints are metadata-only');
  console.log('   - No regulatory logic in printer');
  console.log('   - Server will handle actual compliance');
  console.log('   - Printer captures truth, server decides law');
}

async function offlineExample() {
  console.log('\n\n📡 Offline Queue Example\n');

  const merchantId = 'offline-restaurant-001';
  const virtualPrinter = createVirtualPrinter(merchantId);

  // Get sync queue stats
  const syncStats = virtualPrinter['syncQueue'].getStats();
  console.log('1. Sync queue status:');
  console.log('   Connection:', syncStats.connectionStatus);
  console.log('   Queue size:', syncStats.queueSize);
  console.log('   Pending items:', syncStats.pendingItems);

  // Simulate adding items to queue
  console.log('\n2. Adding items to sync queue...');
  const testReceipt = createTestReceipt(merchantId);
  
  await virtualPrinter['syncQueue'].enqueue('receipt', testReceipt, 'high');
  await virtualPrinter['syncQueue'].enqueue('delivery', { method: 'sms' }, 'medium');
  await virtualPrinter['syncQueue'].enqueue('compliance', { etims: true }, 'low');

  const updatedStats = virtualPrinter['syncQueue'].getStats();
  console.log('   ✅ Items queued:', updatedStats.queueSize);

  // Show queue items
  const queueItems = virtualPrinter['syncQueue'].getQueueItems();
  console.log('\n3. Queue contents:');
  queueItems.forEach((item, index) => {
    console.log(`   ${index + 1}. ${item.type} (${item.priority} priority) - ${item.attempts} attempts`);
  });
}

// Run examples
async function runExamples() {
  try {
    await basicExample();
    await complianceHintsExample();
    await offlineExample();
    
    console.log('\n🎉 All examples completed successfully!');
    console.log('\nNext steps:');
    console.log('- Integrate with your POS system');
    console.log('- Configure printer filters');
    console.log('- Set up delivery methods');
    console.log('- Implement server-side compliance logic');
    
  } catch (error) {
    console.error('❌ Example failed:', error);
  }
}

// Run if called directly
if (require.main === module) {
  runExamples();
}

export { runExamples };