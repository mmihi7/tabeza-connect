/**
 * Test POST to /api/printer/relay
 */

const http = require('http');

// Get bar ID from environment or use test value
const BAR_ID = process.env.TABEZA_BAR_ID || '6c4a27d3-b6ce-4bc0-b7fb-725116ea7936';

console.log('Testing POST to /api/printer/relay...');
console.log('Bar ID:', BAR_ID);
console.log('');

// Create test receipt data
const testReceipt = `
1 x Tusker 250
1 x White Cap 250
Total 500
`;

const payload = {
  driverId: 'test-driver',
  barId: BAR_ID,
  timestamp: new Date().toISOString(),
  rawData: Buffer.from(testReceipt).toString('base64'),
  printerName: 'Test Printer',
  documentName: 'Test Receipt',
  metadata: {
    source: 'test-script',
    test: true,
  },
};

const postData = JSON.stringify(payload);

const options = {
  hostname: 'localhost',
  port: 3003,
  path: '/api/printer/relay',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
  },
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
    console.log('');
    
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('✅ SUCCESS!');
    } else {
      console.log('❌ FAILED!');
    }
  });
});

req.on('error', (err) => {
  console.error('❌ Request error:', err.message);
});

req.write(postData);
req.end();
