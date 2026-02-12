/**
 * Test Vercel Bypass Token
 * 
 * This script tests if the Vercel Protection Bypass token is working correctly
 * by sending a test heartbeat request to the production API.
 */

const BYPASS_TOKEN = 'oqnWfZCoe2OecCUClCs1uEL4phmnVARb';
const API_URL = 'https://staff.tabeza.co.ke';

async function testBypass() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║   Testing Vercel Protection Bypass Token                 ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  console.log(`📍 Target: ${API_URL}/api/printer/heartbeat`);
  console.log(`🔑 Token: ${BYPASS_TOKEN.substring(0, 10)}...${BYPASS_TOKEN.substring(BYPASS_TOKEN.length - 10)}\n`);
  
  try {
    console.log('📤 Sending test heartbeat request...\n');
    
    const response = await fetch(`${API_URL}/api/printer/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vercel-protection-bypass': BYPASS_TOKEN,
      },
      body: JSON.stringify({
        barId: 'test-bar-id',
        driverId: 'test-driver-id',
        version: '1.0.0',
        status: 'online',
        metadata: {
          hostname: 'test-machine',
          platform: 'win32',
          nodeVersion: process.version,
        },
      }),
    });
    
    console.log('📥 Response received:\n');
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)}\n`);
    
    if (response.ok) {
      console.log('╔═══════════════════════════════════════════════════════════╗');
      console.log('║                                                           ║');
      console.log('║   ✅ SUCCESS - Bypass token is working!                   ║');
      console.log('║                                                           ║');
      console.log('╚═══════════════════════════════════════════════════════════╝\n');
      
      const data = await response.json();
      console.log('Response body:');
      console.log(JSON.stringify(data, null, 2));
      console.log('\n✅ The printer service can now communicate with Vercel!');
      console.log('✅ Heartbeat requests will no longer be blocked.');
      console.log('\n📋 Next steps:');
      console.log('   1. Start the printer service: node packages/printer-service/index.js');
      console.log('   2. Monitor heartbeat logs for successful connections');
      console.log('   3. Test print relay functionality');
      
    } else {
      console.log('╔═══════════════════════════════════════════════════════════╗');
      console.log('║                                                           ║');
      console.log('║   ❌ FAILED - Bypass token not working                    ║');
      console.log('║                                                           ║');
      console.log('╚═══════════════════════════════════════════════════════════╝\n');
      
      const text = await response.text();
      console.log('Error response:');
      console.log(text);
      console.log('\n❌ Troubleshooting:');
      console.log('   1. Verify the bypass token is correct in Vercel settings');
      console.log('   2. Check if Protection Bypass for Automation is enabled');
      console.log('   3. Wait 1-2 minutes for Vercel settings to propagate');
      console.log('   4. Try regenerating the bypass token in Vercel');
    }
    
  } catch (error) {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║   ❌ ERROR - Request failed                               ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    
    console.error('Error details:', error.message);
    console.log('\n❌ Troubleshooting:');
    console.log('   1. Check your internet connection');
    console.log('   2. Verify the API URL is correct');
    console.log('   3. Check if the Vercel deployment is online');
  }
}

// Run the test
testBypass().catch(console.error);
