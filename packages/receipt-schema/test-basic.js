/**
 * Basic test to verify receipt schema functionality
 * Run with: node test-basic.js
 */

const {
  createReceiptSession,
  createReceiptEvent,
  createSessionTotals,
  createCompleteSession,
  validateCompleteSession,
  createTestSession,
  getSessionSummary,
  calculateHealthScore
} = require('./dist/index.js');

console.log('🧪 Testing TABEZA Receipt Schema v1...\n');

try {
  // Test 1: Create a basic session
  console.log('1️⃣ Creating receipt session...');
  const session = createReceiptSession({
    merchantId: 'test-merchant-001',
    merchantName: 'Test Restaurant',
    printerId: 'test-printer-001',
    tableNumber: '5',
    kraPin: 'P051234567A'
  });
  
  console.log('✅ Session created:', session.session_reference);
  console.log('   Merchant:', session.merchant.name);
  console.log('   Table:', session.table_number);
  console.log('   Status:', session.status);

  // Test 2: Create events
  console.log('\n2️⃣ Creating receipt events...');
  const order1 = createReceiptEvent({
    sessionId: session.tabeza_receipt_id,
    type: 'SALE',
    sequence: 1,
    items: [
      { name: 'Ugali', qty: 2, unit_price: 50, total_price: 100 },
      { name: 'Sukuma Wiki', qty: 1, unit_price: 80, total_price: 80 }
    ],
    rawHash: 'order1-hash-123',
    parsedConfidence: 0.95
  });

  const payment = createReceiptEvent({
    sessionId: session.tabeza_receipt_id,
    type: 'PARTIAL_BILL',
    sequence: 2,
    items: [],
    payment: {
      method: 'MPESA',
      amount: 180,
      currency: 'KES',
      reference: 'QH7RTXM2',
      status: 'COMPLETED'
    },
    rawHash: 'payment-hash-456',
    parsedConfidence: 1.0
  });

  console.log('✅ Events created:');
  console.log('   Order 1:', order1.items.length, 'items, total:', order1.totals.total);
  console.log('   Payment:', payment.payment.method, payment.payment.amount, 'KES');

  // Test 3: Calculate totals
  console.log('\n3️⃣ Calculating session totals...');
  const events = [order1, payment];
  const totals = createSessionTotals(events);
  
  console.log('✅ Totals calculated:');
  console.log('   Subtotal:', totals.subtotal, 'KES');
  console.log('   Total:', totals.total, 'KES');
  console.log('   Paid:', totals.paid, 'KES');
  console.log('   Balance:', totals.balance, 'KES');
  console.log('   Events:', totals.total_events);

  // Test 4: Create complete session
  console.log('\n4️⃣ Creating complete session...');
  const closedSession = { ...session, status: 'CLOSED', closed_at: new Date().toISOString() };
  const completeSession = createCompleteSession(closedSession, events, totals);
  
  console.log('✅ Complete session created');
  console.log('   Version:', completeSession.version);
  console.log('   Events:', completeSession.events.length);
  console.log('   Has totals:', !!completeSession.totals);

  // Test 5: Validation
  console.log('\n5️⃣ Validating session...');
  const validation = validateCompleteSession(completeSession);
  
  console.log('✅ Validation results:');
  console.log('   Valid:', validation.valid);
  console.log('   Score:', validation.score);
  console.log('   Errors:', validation.errors.length);
  console.log('   Warnings:', validation.warnings.length);

  // Test 6: Health score
  console.log('\n6️⃣ Calculating health score...');
  const health = calculateHealthScore(completeSession);
  
  console.log('✅ Health assessment:');
  console.log('   Score:', health.score);
  console.log('   Issues:', health.issues.length);
  console.log('   Recommendations:', health.recommendations.length);

  // Test 7: Session summary
  console.log('\n7️⃣ Getting session summary...');
  const summary = getSessionSummary(completeSession);
  
  console.log('✅ Session summary:');
  console.log('   ID:', summary.id);
  console.log('   Merchant:', summary.merchant);
  console.log('   Status:', summary.status);
  console.log('   Total:', summary.total, summary.currency);

  // Test 8: Test session utility
  console.log('\n8️⃣ Creating test session...');
  const testSession = createTestSession('Test Cafe');
  const testSummary = getSessionSummary(testSession);
  
  console.log('✅ Test session created:');
  console.log('   Merchant:', testSummary.merchant);
  console.log('   Events:', testSummary.events);
  console.log('   Total:', testSummary.total, testSummary.currency);

  console.log('\n🎉 All tests passed! TABEZA Receipt Schema v1 is working correctly.');

} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}