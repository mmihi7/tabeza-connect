/**
 * Check if print job was stored in database
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../apps/staff/.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

async function checkPrintJob() {
  console.log('');
  console.log('🔍 Checking print jobs in database...');
  console.log('');

  // Get all print jobs for this bar
  const { data: printJobs, error } = await supabase
    .from('print_jobs')
    .select('*')
    .eq('bar_id', '438c80c1-fe11-4ac5-8a48-2fc45104ba31')
    .order('received_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (!printJobs || printJobs.length === 0) {
    console.log('⚠️  No print jobs found for this bar');
    return;
  }

  console.log(`✅ Found ${printJobs.length} print job(s):`);
  console.log('');

  printJobs.forEach((job, index) => {
    console.log(`📄 Print Job ${index + 1}:`);
    console.log(`   ID: ${job.id}`);
    console.log(`   Status: ${job.status}`);
    console.log(`   Driver: ${job.driver_id}`);
    console.log(`   Printer: ${job.printer_name}`);
    console.log(`   Document: ${job.document_name}`);
    console.log(`   Received: ${new Date(job.received_at).toLocaleString()}`);
    
    if (job.parsed_data) {
      console.log(`   Items: ${job.parsed_data.items?.length || 0}`);
      console.log(`   Total: ${job.parsed_data.total || 0}`);
      console.log(`   Raw Text Preview: ${job.parsed_data.rawText?.substring(0, 50) || 'N/A'}...`);
    }
    
    console.log('');
  });

  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ Print jobs are being stored correctly!');
  console.log('');
  console.log('Next: Check Captain\'s Orders in staff dashboard');
  console.log('URL: http://localhost:3003');
  console.log('');
}

checkPrintJob().catch(console.error);
