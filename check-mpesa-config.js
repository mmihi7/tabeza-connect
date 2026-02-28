const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://bkaigyrrzsqbfscyznzw.supabase.co',
  'sb_secret_wRBvATftWPqlT9hL660eYw_FbSXYpLG'
);

async function checkMpesaConfig() {
  try {
    console.log('🔍 Checking M-Pesa configuration in database...\n');
    
    // Check bars table for M-Pesa config
    const { data: bars, error } = await supabase
      .from('bars')
      .select('id, name, mpesa_enabled, mpesa_environment, mpesa_business_shortcode')
      .eq('mpesa_enabled', true);
    
    if (error) {
      console.error('❌ Error fetching bars:', error.message);
      return;
    }
    
    if (!bars || bars.length === 0) {
      console.log('ℹ️ No bars with M-Pesa enabled found');
      return;
    }
    
    console.log('📊 M-Pesa Enabled Bars:');
    bars.forEach(bar => {
      console.log(`\nBar: ${bar.name} (ID: ${bar.id})`);
      console.log(`Environment: ${bar.mpesa_environment || 'not set'}`);
      console.log(`Shortcode: ${bar.mpesa_business_shortcode || 'not set'}`);
      
      // Check if this looks like production
      if (bar.mpesa_business_shortcode && bar.mpesa_business_shortcode !== '174379') {
        console.log('⚠️ WARNING: This shortcode is NOT the sandbox shortcode (174379)');
        console.log('🚨 This might be a PRODUCTION shortcode!');
      }
      
      if (bar.mpesa_environment === 'production') {
        console.log('🚨 CRITICAL: This bar is configured for PRODUCTION environment!');
      }
    });
    
    // Also check recent payments to see what happened
    console.log('\n🔍 Checking recent M-Pesa payments...');
    const { data: payments, error: paymentError } = await supabase
      .from('tab_payments')
      .select('id, tab_id, amount, status, reference, metadata, created_at')
      .eq('method', 'mpesa')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (paymentError) {
      console.error('❌ Error fetching payments:', paymentError.message);
    } else if (payments && payments.length > 0) {
      console.log('\n📋 Recent M-Pesa Payments:');
      payments.forEach(payment => {
        console.log(`\nPayment ID: ${payment.id}`);
        console.log(`Amount: ${payment.amount} KES`);
        console.log(`Status: ${payment.status}`);
        console.log(`Reference: ${payment.reference || 'none'}`);
        console.log(`Created: ${payment.created_at}`);
        
        if (payment.metadata) {
          const env = payment.metadata.environment;
          if (env) {
            console.log(`Environment: ${env}`);
            if (env === 'production') {
              console.log('🚨 PRODUCTION PAYMENT DETECTED!');
            }
          }
        }
      });
    }
    
  } catch (err) {
    console.error('❌ Script error:', err.message);
  }
}

checkMpesaConfig();