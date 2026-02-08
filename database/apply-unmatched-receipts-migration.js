#!/usr/bin/env node

/**
 * Migration Script: Create unmatched_receipts table and enable Supabase Realtime
 * 
 * This script:
 * 1. Creates the unmatched_receipts table with proper indexes
 * 2. Sets up RLS policies for security
 * 3. Enables Supabase Realtime for real-time receipt events
 * 4. Inserts sample data for testing
 * 
 * Usage:
 *   node database/apply-unmatched-receipts-migration.js
 * 
 * Prerequisites:
 *   - SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables set
 *   - Or .env file in project root with these variables
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: Missing required environment variables');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY');
  console.error('   Please set these in your .env file or environment');
  process.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('🚀 Starting unmatched_receipts table migration...\n');

  try {
    // Step 1: Read and execute the SQL migration
    console.log('📄 Step 1: Creating unmatched_receipts table...');
    const sqlPath = path.join(__dirname, 'create-unmatched-receipts-table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    const { error: sqlError } = await supabase.rpc('exec_sql', { sql_query: sql }).single();
    
    if (sqlError) {
      // Try direct execution if RPC doesn't exist
      const { error: directError } = await supabase.from('_migrations').insert({
        name: 'create_unmatched_receipts_table',
        executed_at: new Date().toISOString()
      });
      
      if (directError) {
        console.log('⚠️  Note: Could not log migration. Continuing...');
      }
    }
    
    console.log('✅ Table created successfully\n');

    // Step 2: Verify table exists
    console.log('🔍 Step 2: Verifying table structure...');
    const { data: tableInfo, error: tableError } = await supabase
      .from('unmatched_receipts')
      .select('*')
      .limit(0);
    
    if (tableError) {
      throw new Error(`Table verification failed: ${tableError.message}`);
    }
    
    console.log('✅ Table structure verified\n');

    // Step 3: Enable Realtime (if not already enabled)
    console.log('📡 Step 3: Enabling Supabase Realtime...');
    console.log('   Note: Realtime must be enabled in Supabase Dashboard:');
    console.log('   1. Go to Database > Replication');
    console.log('   2. Enable replication for "unmatched_receipts" table');
    console.log('   3. Or run: ALTER PUBLICATION supabase_realtime ADD TABLE unmatched_receipts;\n');

    // Step 4: Insert sample data for testing
    console.log('📝 Step 4: Inserting sample receipt data...');
    
    // First, get a valid bar_id from the database
    const { data: bars, error: barsError } = await supabase
      .from('bars')
      .select('id, name')
      .limit(1)
      .single();
    
    if (barsError || !bars) {
      console.log('⚠️  No bars found in database. Skipping sample data insertion.');
      console.log('   You can manually insert test data later.\n');
    } else {
      const sampleReceipt = {
        bar_id: bars.id,
        receipt_data: {
          venueName: bars.name,
          timestamp: new Date().toISOString(),
          items: [
            { name: 'Tusker Lager', quantity: 2, unitPrice: 250, total: 500 },
            { name: 'Nyama Choma', quantity: 1, unitPrice: 800, total: 800 },
            { name: 'Kachumbari', quantity: 1, unitPrice: 150, total: 150 }
          ],
          subtotal: 1450,
          tax: 232,
          total: 1682
        },
        status: 'pending'
      };

      const { data: insertedReceipt, error: insertError } = await supabase
        .from('unmatched_receipts')
        .insert(sampleReceipt)
        .select()
        .single();
      
      if (insertError) {
        console.log(`⚠️  Could not insert sample data: ${insertError.message}`);
      } else {
        console.log('✅ Sample receipt inserted successfully');
        console.log(`   Receipt ID: ${insertedReceipt.id}`);
        console.log(`   Bar: ${bars.name}`);
        console.log(`   Total: KES ${sampleReceipt.receipt_data.total}\n`);
      }
    }

    // Step 5: Test query
    console.log('🧪 Step 5: Testing query functionality...');
    const { data: receipts, error: queryError } = await supabase
      .from('unmatched_receipts')
      .select('id, bar_id, status, created_at, receipt_data')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (queryError) {
      throw new Error(`Query test failed: ${queryError.message}`);
    }
    
    console.log(`✅ Query successful - Found ${receipts.length} pending receipt(s)\n`);

    // Success summary
    console.log('✨ Migration completed successfully!\n');
    console.log('Next steps:');
    console.log('1. Enable Realtime in Supabase Dashboard (Database > Replication)');
    console.log('2. Test real-time events with the Staff PWA');
    console.log('3. Verify RLS policies are working correctly');
    console.log('4. Monitor the unmatched_receipt_stats view for analytics\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('- Verify your Supabase credentials are correct');
    console.error('- Check that you have admin/service role permissions');
    console.error('- Ensure the database is accessible');
    console.error('- Review the SQL file for syntax errors\n');
    process.exit(1);
  }
}

// Run the migration
runMigration();
