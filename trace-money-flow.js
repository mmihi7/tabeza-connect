const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://bkaigyrrzsqbfscyznzw.supabase.co',
  'sb_secret_wRBvATftWPqlT9hL660eYw_FbSXYpLG'
);

async function traceMoneyFlow() {
  try {
    console.log('🔍 Tracing the 100 KES payment flow...\n');
    
    // Find the specific payment with receipt UAV4J5QE4Y
    const { data: payment, error } = await supabase
      .from('tab_payments')
      .select('*')
      .eq('reference', 'UAV4J5QE4Y')
      .single();
    
    if (error || !payment) {
      console.log('❌ Payment with receipt UAV4J5QE4Y not found in database');
      
      // Let's check all recent successful payments
      const { data: recentPayments, error: recentError } = await supabase
        .from('tab_payments')
        .select('*')
        .eq('method', 'mpesa')
        .eq('status', 'success')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (!recentError && recentPayments) {
        console.log('\n📋 Recent successful M-Pesa payments:');
        recentPayments.forEach(p => {
          console.log(`- ${p.amount} KES, Receipt: ${p.reference || 'none'}, Date: ${p.created_at}`);
        });
      }
      return;
    }
    
    console.log('💰 PAYMENT FOUND:');
    console.log(`Amount: ${payment.amount} KES`);
    console.log(`Status: ${payment.status}`);
    console.log(`Receipt: ${payment.reference}`);
    console.log(`Tab ID: ${payment.tab_id}`);
    console.log(`Created: ${payment.created_at}`);
    console.log(`Updated: ${payment.updated_at}`);
    
    // Check metadata for clues
    if (payment.metadata) {
      console.log('\n📊 Payment Metadata:');
      console.log(JSON.stringify(payment.metadata, null, 2));
      
      // Look for phone number in metadata
      if (payment.metadata.phone_number) {
        console.log(`\n📱 Phone used: ${payment.metadata.phone_number}`);
        if (payment.metadata.phone_number === '254722527236') {
          console.log('✅ Confirmed: This was YOUR real phone number');
        }
      }
      
      // Look for callback data
      if (payment.metadata.Body) {
        console.log('\n📞 Callback Data Found:');
        const callback = payment.metadata.Body.stkCallback;
        if (callback) {
          console.log(`Merchant Request ID: ${callback.MerchantRequestID}`);
          console.log(`Checkout Request ID: ${callback.CheckoutRequestID}`);
          console.log(`Result Code: ${callback.ResultCode}`);
          console.log(`Result Description: ${callback.ResultDesc}`);
          
          if (callback.CallbackMetadata?.Item) {
            console.log('\n💳 Transaction Details:');
            callback.CallbackMetadata.Item.forEach(item => {
              console.log(`${item.Name}: ${item.Value}`);
            });
          }
        }
      }
    }
    
    // Get the tab details
    const { data: tab, error: tabError } = await supabase
      .from('tabs')
      .select('*, bars(name, mpesa_business_shortcode)')
      .eq('id', payment.tab_id)
      .single();
    
    if (!tabError && tab) {
      console.log('\n🏪 Tab Details:');
      console.log(`Bar: ${tab.bars?.name}`);
      console.log(`Tab Number: ${tab.tab_number}`);
      console.log(`Tab Status: ${tab.status}`);
      console.log(`Bar Shortcode: ${tab.bars?.mpesa_business_shortcode}`);
    }
    
    console.log('\n🚨 MONEY FLOW ANALYSIS:');
    console.log('1. You paid 100 KES from your phone (0722527236)');
    console.log('2. Payment was processed with receipt UAV4J5QE4Y');
    console.log('3. Your callback URL: https://pay.m-tip.app/api/mpesa/callback');
    console.log('4. This means the callback went to your FRIEND\'S system');
    console.log('5. The money likely went to the M-Pesa account associated with shortcode:', tab?.bars?.mpesa_business_shortcode || '174379');
    
    console.log('\n💡 TO FIND WHERE YOUR MONEY WENT:');
    console.log('1. Check your M-Pesa statement (SMS or app)');
    console.log('2. Look for transaction to shortcode 174379 or another business');
    console.log('3. Contact your friend who owns pay.m-tip.app');
    console.log('4. Ask them to check their M-Pesa business account for incoming 100 KES');
    console.log('5. The transaction should show your phone number as sender');
    
  } catch (err) {
    console.error('❌ Error tracing money flow:', err.message);
  }
}

traceMoneyFlow();