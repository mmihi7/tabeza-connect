/**
 * Get a bar ID from the database
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../apps/staff/.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

async function getBarId() {
  const { data, error } = await supabase
    .from('bars')
    .select('id, name, authority_mode')
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Available bars:');
  console.log('');
  data.forEach(bar => {
    console.log(`ID: ${bar.id}`);
    console.log(`Name: ${bar.name}`);
    console.log(`Authority: ${bar.authority_mode}`);
    console.log('');
  });

  if (data.length > 0) {
    console.log('To test, set:');
    console.log(`set TABEZA_BAR_ID=${data[0].id}`);
  }
}

getBarId();
