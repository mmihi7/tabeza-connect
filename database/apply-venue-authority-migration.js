// Quick script to apply venue authority migration
// Run with: node database/apply-venue-authority-migration.js

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../apps/staff/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in apps/staff/.env.local');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('🔄 Applying venue authority migration...\n');

  try {
    // Read the migration file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'add-venue-authority-modes.sql'),
      'utf8'
    );

    // Split into individual statements (basic split on semicolons)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments
      if (statement.startsWith('--') || statement.startsWith('/*')) {
        continue;
      }

      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      
      if (error) {
        // Some errors are expected (like "type already exists")
        if (error.message.includes('already exists')) {
          console.log(`⚠️  Skipped (already exists): ${error.message.substring(0, 80)}...`);
        } else {
          console.error(`❌ Error: ${error.message}`);
          throw error;
        }
      } else {
        console.log(`✅ Success`);
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Verifying columns...');

    // Verify the columns exist
    const { data, error } = await supabase
      .from('bars')
      .select('id, venue_mode, authority_mode, pos_integration_enabled, printer_required')
      .limit(1);

    if (error) {
      console.error('❌ Verification failed:', error.message);
      console.log('\n⚠️  The migration may have been applied, but verification failed.');
      console.log('Please check your Supabase dashboard to confirm the columns exist.');
    } else {
      console.log('✅ Columns verified successfully!');
      console.log('\nYou can now use the signup flow with venue and authority modes.');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.log('\n💡 Alternative: Apply the migration manually via Supabase Dashboard:');
    console.log('   1. Go to Supabase Dashboard → SQL Editor');
    console.log('   2. Copy contents of database/add-venue-authority-modes.sql');
    console.log('   3. Paste and run the SQL');
    process.exit(1);
  }
}

applyMigration();
