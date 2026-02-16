const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const BAR_ID = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
  );

  console.log('Step 1: Identifying stale drivers...\n');
  
  const { data: allDrivers, error } = await supabase
    .from('printer_drivers')
    .select('*')
    .eq('bar_id', BAR_ID)
    .order('last_heartbeat', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${allDrivers?.length || 0} drivers:\n`);
  allDrivers?.forEach(d => {
    console.log(`- ${d.driver_id} (${d.last_heartbeat})`);
  });

  const staleDrivers = allDrivers?.filter(d => 
    /-\d{13}$/.test(d.driver_id) || d.driver_id === 'test-driver-id'
  ) || [];

  console.log(`\nStale drivers to delete: ${staleDrivers.length}\n`);
  staleDrivers.forEach(d => console.log(`- ${d.driver_id}`));

  if (staleDrivers.length > 0 && !process.argv.includes('--dry-run')) {
    console.log('\nStep 2: Deleting stale drivers...\n');
    
    const { data: deleted, error: delError } = await supabase
      .from('printer_drivers')
      .delete()
      .eq('bar_id', BAR_ID)
      .in('driver_id', staleDrivers.map(d => d.driver_id))
      .select();

    if (delError) {
      console.error('Delete error:', delError);
      return;
    }

    console.log(`Deleted ${deleted?.length || 0} drivers\n`);
  }

  console.log('Step 3: Verifying...\n');
  
  const { data: remaining } = await supabase
    .from('printer_drivers')
    .select('*')
    .eq('bar_id', BAR_ID);

  console.log(`Remaining drivers: ${remaining?.length || 0}\n`);
  remaining?.forEach(d => {
    console.log(`- ${d.driver_id} (${d.last_heartbeat})`);
  });

  console.log('\nDone!');
}

main();
