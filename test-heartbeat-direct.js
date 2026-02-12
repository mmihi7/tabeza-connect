/**
 * Direct Heartbeat Test - No Bypass Token
 * 
 * Tests the heartbeat endpoint directly without any bypass token
 * to see what's actually causing the 401 error
 */

const API_URL = 'https://tabz-kikao.vercel.app';

async function testHeartbeat() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║   Testing Heartbeat Endpoint (No Auth)                   ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  console.log(`📍 Target: ${API_URL}/api/printer/heartbeat`);
  console.log(`🔓 No authentication headers\n`);
  
  try {
    console.log('📤 Sending heartbeat request...\n');
    
    const response = await fetch(`${API_URL}/api/printer/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        barId: '438c80c1-fe11-4ac5-8a48-2fc45104ba31',
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
    console.log(`   Content-Type: ${response.headers.get('content-type')}`);
    
    // Log all response headers
    console.log('\n   Response Headers:');
    response.headers.forEach((value, key) => {
      console.log(`     ${key}: ${value}`);
    });
    
    const text = await response.text();
    console.log('\n   Response Body:');
    console.log(`   ${text}\n`);
    
    if (response.ok) {
      console.log('╔═══════════════════════════════════════════════════════════╗');
      console.log('║                                                           ║');
      console.log('║   ✅ SUCCESS - Heartbeat endpoint is working!             ║');
      console.log('║                                                           ║');
      console.log('╚═══════════════════════════════════════════════════════════╝\n');
      
      try {
        const data = JSON.parse(text);
        console.log('Parsed response:');
        console.log(JSON.stringify(data, null, 2));
      } catch (e) {
        // Not JSON
      }
      
    } else if (response.status === 401) {
      console.log('╔═══════════════════════════════════════════════════════════╗');
      console.log('║                                                           ║');
      console.log('║   ❌ 401 UNAUTHORIZED - Still blocked!                    ║');
      console.log('║                                                           ║');
      console.log('╚═══════════════════════════════════════════════════════════╝\n');
      
      console.log('🔍 Diagnosis:');
      console.log('   The 401 error persists even after disabling Deployment Protection.');
      console.log('\n📋 Possible causes:');
      console.log('   1. Vercel settings not saved/propagated yet (wait 5 minutes)');
      console.log('   2. Cached deployment - need to redeploy');
      console.log('   3. Different authentication layer (middleware, edge config)');
      console.log('   4. Wrong deployment URL');
      console.log('\n🔧 Next steps:');
      console.log('   1. Wait 5 minutes for Vercel settings to propagate');
      console.log('   2. Try redeploying: git commit --allow-empty -m "redeploy" && git push');
      console.log('   3. Check if there\'s a custom domain with different settings');
      console.log('   4. Verify Deployment Protection is OFF in Vercel dashboard');
      
    } else {
      console.log('╔═══════════════════════════════════════════════════════════╗');
      console.log('║                                                           ║');
      console.log(`║   ❌ ERROR ${response.status} - ${response.statusText.padEnd(37)}║`);
      console.log('║                                                           ║');
      console.log('╚═══════════════════════════════════════════════════════════╝\n');
    }
    
  } catch (error) {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║   ❌ REQUEST FAILED                                       ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    
    console.error('Error:', error.message);
  }
}

// Run the test
testHeartbeat().catch(console.error);
