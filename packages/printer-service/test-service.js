#!/usr/bin/env node
/**
 * Test Tabeza Printer Service
 * Sends a test print job to verify the service is working
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function testService() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Tabeza Printer Service Test          ║');
  console.log('╚════════════════════════════════════════╝\n');

  try {
    // Check if service is running
    console.log('1. Checking service status...');
    const statusResponse = await fetch('http://localhost:8765/api/status');
    
    if (!statusResponse.ok) {
      throw new Error('Service is not responding. Make sure it is running.');
    }
    
    const status = await statusResponse.json();
    console.log('✅ Service is running');
    console.log(`   Version: ${status.version}`);
    console.log(`   Driver ID: ${status.driverId}`);
    console.log(`   Bar ID: ${status.barId || 'Not configured'}\n`);

    // Get bar ID for test
    let barId = status.barId;
    if (!barId) {
      barId = await question('Enter your Bar ID for testing: ');
    }

    // Send test print
    console.log('2. Sending test print job...');
    const testResponse = await fetch('http://localhost:8765/api/test-print', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        barId: barId,
        testMessage: 'Test print from Tabeza Printer Service'
      })
    });

    if (!testResponse.ok) {
      throw new Error(`Test print failed: ${testResponse.status}`);
    }

    const testResult = await testResponse.json();
    console.log('✅ Test print sent successfully');
    console.log(`   Job ID: ${testResult.jobId}\n`);

    console.log('╔════════════════════════════════════════╗');
    console.log('║  Test Complete!                        ║');
    console.log('╠════════════════════════════════════════╣');
    console.log('║  The service is working correctly.     ║');
    console.log('║  Check your Tabeza dashboard to see    ║');
    console.log('║  the test receipt.                     ║');
    console.log('╚════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Make sure the service is running: npm start');
    console.log('2. Check if port 8765 is available');
    console.log('3. Verify your Bar ID is correct');
    console.log('4. Check your internet connection\n');
  } finally {
    rl.close();
  }
}

testService();
