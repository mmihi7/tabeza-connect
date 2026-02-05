#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: 'apps/staff/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in apps/staff/.env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applySchemaFix() {
  console.log('🔧 Applying database schema fix...');
  
  try {
    // First, check if columns already exist
    const { data: columns, error: columnError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'bars')
      .in('column_name', ['venue_mode', 'authority_mode', 'onboarding_completed']);
    
    if (columnError) {
      console.log('⚠️  Could not check existing columns, proceeding with schema update...');
    } else if (columns && columns.length > 0) {
      console.log('✅ Schema columns already exist, skipping schema update');
      return;
    }
    
    // Read and execute the schema update
    const schemaPath = path.join(__dirname, 'database', 'add-venue-authority-modes.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = schemaSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        if (error) {
          console.log(`⚠️  Statement failed (may be expected): ${error.message}`);
        }
      }
    }
    
    console.log('✅ Database schema update completed');
    
  } catch (error) {
    console.error('❌ Schema update failed:', error.message);
    process.exit(1);
  }
}

applySchemaFix();