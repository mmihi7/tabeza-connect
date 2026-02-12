/**
 * Test Vercel Bypass Token - Correct URL
 * 
 * Tests the bypass token against the actual deployment URL
 */

const BYPASS_TOKEN = 'oqnWfZCoe2OecCUClCs1uEL4phmnVARb';
const API_URL = 'https://tabz-kikao.vercel.app'; // Correct URL

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
    
    if (response.ok) {
      console.log('╔═══════════════════════════════════════════════════════════╗');
      console.log('║                                                           ║');
      console.log('║   ✅ SUCCESS - Bypass token is working!                   ║');
      console.log('║                                                           ║');
      console.log('╚═══════════════════════════════════════════════════════════╝\n');
      
      const data = await response.json();
      console.log('Response body:');
      console.log(JSON.stringify(data, null, 2));
      
    } else {
      console.log('╔═══════════════════════════════════════════════════════════╗');
      console.log('║                                                           ║');
      console.log('║   ❌ FAILED - Bypass token not working                    ║');
      console.log('║                                                           ║');
      console.log('╚═══════════════════════════════════════════════════════════╝\n');
      
      const text = await response.text();
      console.log('Error response:');
      console.log(text);
      console.log('\n❌ Diagnosis:');
      console.log('   The bypass token is configured but Vercel is still blocking requests.');
      console.log('\n🔍 Possible causes:');
      console.log('   1. Token is for a different Vercel project');
      console.log('   2. Token needs to be regenerated');
      console.log('   3. Deployment Protection settings not saved properly');
      console.log('   4. Need to wait longer for settings to propagate');
      console.log('\n📋 Next steps:');
      console.log('   1. Go to: https://vercel.com/mwenes-projects/tabz-kikao/settings/deployment-protection');
      console.log('   2. Verify "Protection Bypass for Automation" is enabled');
      console.log('   3. Copy the bypass token again (regenerate if needed)');
      console.log('   4. Update VERCEL_AUTOMATION_BYPASS_SECRET in apps/staff/.env.local');
      console.log('   5. Wait 2-3 minutes and test again');
    }
    
  } catch (error) {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║   ❌ ERROR - Request failed                               ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    
    console.error('Error details:', error.message);
  }
}

// Run the test
testBypass().catch(console.error);
