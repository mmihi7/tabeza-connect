#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

// Load environment variables from staff app
const fs = require('fs');
const path = require('path');

// Read .env.local file manually
const envPath = path.join(__dirname, 'apps', 'staff', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.log('URL:', supabaseUrl ? 'Found' : 'Missing');
  console.log('Key:', supabaseKey ? 'Found' : 'Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  console.log('🔍 Checking database structure...');
  
  try {
    // Check if bars table exists and get its columns
    const { data, error } = await supabase
      .from('bars')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Error querying bars table:', error.message);
      return;
    }
    
    if (data && data.length > 0) {
      console.log('✅ Bars table exists');
      console.log('📋 Available columns:', Object.keys(data[0]).join(', '));
      
      // Check specifically for the missing columns
      const requiredColumns = ['venue_mode', 'authority_mode', 'onboarding_completed', 'pos_integration_enabled', 'printer_required'];
      const existingColumns = Object.keys(data[0]);
      const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
      
      if (missingColumns.length > 0) {
        console.log('❌ Missing columns:', missingColumns.join(', '));
      } else {
        console.log('✅ All required columns exist');
      }
    } else {
      console.log('⚠️  Bars table is empty');
    }
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
  }
}

checkDatabase();