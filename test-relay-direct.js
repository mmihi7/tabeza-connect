/**
 * Test Relay Endpoint Directly
 */

async function testRelay() {
  console.log('🧪 Testing relay endpoint directly...\n');

  const testData = {
    driverId: 'test-driver-123',
    barId: '438c80c1-fe11-4ac5-8a48-2fc45104ba31', // Popos
    timestamp: new Date().toISOString(),
    rawData: Buffer.from('TEST RECEIPT\nItem 1: $10.00\nTotal: $10.00').toString('base64'),
    printerName: 'Test Printer',
    documentName: 'Test Receipt',
    metadata: {
      source: 'manual-test',
      jobId: `test-${Date.now()}`,
    },
  };

  console.log('Sending test data to relay endpoint...');
  console.log('Bar ID:', testData.barId);
  console.log('Document:', testData.documentName);

  try {
    const response = await fetch('http://localhost:3003/api/printer/relay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    const result = await response.json();

    if (response.ok) {
      console.log('\n✅ Success!');
      console.log('Job ID:', result.jobId);
      console.log('Message:', result.message);
      console.log('\nCheck Captain\'s Orders to see the receipt!');
    } else {
      console.log('\n❌ Failed!');
      console.log('Status:', response.status);
      console.log('Error:', result.error);
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\nMake sure the staff app is running on localhost:3003');
  }
}

testRelay();
