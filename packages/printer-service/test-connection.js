/**
 * Test Tabeza Connection
 * 
 * Verifies that the TCP server can connect to Tabeza cloud API
 */

const https = require('https');
const http = require('http');

const API_URL = process.env.TABEZA_API_URL || 'http://localhost:3003';
const BAR_ID = process.env.TABEZA_BAR_ID || '';

console.log('');
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║         TABEZA CONNECTION TEST                             ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');

// Check environment variables
console.log('📋 Configuration:');
console.log(`   API URL: ${API_URL}`);
console.log(`   Bar ID: ${BAR_ID || '❌ NOT SET'}`);
console.log('');

if (!BAR_ID) {
  console.error('❌ ERROR: TABEZA_BAR_ID is not set!');
  console.error('');
  console.error('Set it like this:');
  console.error('  Windows: set TABEZA_BAR_ID=your-bar-id-here');
  console.error('  Linux/Mac: export TABEZA_BAR_ID=your-bar-id-here');
  console.error('');
  process.exit(1);
}

// Test 1: Check API status
console.log('🧪 Test 1: Checking API status...');

const url = new URL('/api/printer/relay', API_URL);
const isHttps = url.protocol === 'https:';
const client = isHttps ? https : http;

const options = {
  hostname: url.hostname,
  port: url.port || (isHttps ? 443 : 80),
  path: url.pathname,
  method: 'GET',
};

const req = client.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ API is online!');
      console.log(`   Response: ${data}`);
      console.log('');
      
      // Test 2: Send test print job
      console.log('🧪 Test 2: Sending test print job...');
      sendTestPrint();
    } else {
      console.error(`❌ API returned status ${res.statusCode}`);
      console.error(`   Response: ${data}`);
      console.error('');
      process.exit(1);
    }
  });
});

req.on('error', (err) => {
  console.error('❌ Failed to connect to API!');
  console.error(`   Error: ${err.message}`);
  console.error('');
  console.error('💡 Troubleshooting:');
  console.error('   1. Check TABEZA_API_URL is correct');
  console.error('   2. Check API server is running');
  console.error('   3. Check network connection');
  console.error('');
  process.exit(1);
});

req.end();

// Send test print job
function sendTestPrint() {
  const testData = Buffer.from('Test Receipt\n1 x Test Item 100\nTotal 100\n');
  
  const payload = {
    driverId: 'test-connection',
    barId: BAR_ID,
    timestamp: new Date().toISOString(),
    rawData: testData.toString('base64'),
    printerName: 'Test Printer',
    documentName: 'Connection Test',
    metadata: {
      source: 'test-script',
      test: true,
    },
  };

  const postData = JSON.stringify(payload);

  const postOptions = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  const postReq = client.request(postOptions, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log('✅ Test print job sent successfully!');
        try {
          const response = JSON.parse(data);
          console.log(`   Job ID: ${response.jobId || 'N/A'}`);
          console.log(`   Message: ${response.message || 'N/A'}`);
        } catch (err) {
          console.log(`   Response: ${data}`);
        }
        console.log('');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('🎉 ALL TESTS PASSED!');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('');
        console.log('Next steps:');
        console.log('1. Start the TCP server: node tabeza-tcp-server.js');
        console.log('2. Print from Notepad to "TABEZA Test Printer"');
        console.log('3. Check Captain\'s Orders in staff dashboard');
        console.log('');
      } else {
        console.error(`❌ Failed to send test print job!`);
        console.error(`   Status: ${res.statusCode}`);
        console.error(`   Response: ${data}`);
        console.error('');
        process.exit(1);
      }
    });
  });

  postReq.on('error', (err) => {
    console.error('❌ Failed to send test print job!');
    console.error(`   Error: ${err.message}`);
    console.error('');
    process.exit(1);
  });

  postReq.write(postData);
  postReq.end();
}
