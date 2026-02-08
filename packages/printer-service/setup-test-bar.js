/**
 * Setup a test bar with POS authority for printer testing
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../apps/staff/.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

async function setupTestBar() {
  // Use the first bar and update it to POS authority
  const barId = '6c4a27d3-b6ce-4bc0-b7fb-725116ea7936'; // Kadida
  
  console.log('Setting up test bar for printer relay...');
  console.log('Bar ID:', barId);
  console.log('');
  
  const { data, error } = await supabase
    .from('bars')
    .update({
      authority_mode: 'pos',
      pos_integration_enabled: true,
      printer_required: true,
    })
    .eq('id', barId)
    .select();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('✅ Bar updated successfully!');
  console.log('');
  console.log('Bar configuration:');
  console.log('  Name:', data[0].name);
  console.log('  Authority:', data[0].authority_mode);
  console.log('  POS Integration:', data[0].pos_integration_enabled);
  console.log('  Printer Required:', data[0].printer_required);
  console.log('');
  console.log('To test TCP server, set:');
  console.log(`set TABEZA_BAR_ID=${barId}`);
  console.log('set TABEZA_API_URL=http://localhost:3003');
  console.log('');
  console.log('Then run:');
  console.log('node tabeza-tcp-server.js');
}

setupTestBar();
