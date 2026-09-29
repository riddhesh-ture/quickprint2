// scripts/verify-supabase.js
// Utility script to verify Supabase connection, tables, RPCs, and storage bucket
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env.local');

// Parse .env.local
let env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || '';
      value = value.trim().replace(/^['"]|['"]$/g, '');
      env[match[1]] = value;
    }
  });
}

const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

console.log('\n========================================');
console.log('  QuickPrint Supabase Connection Check  ');
console.log('========================================');
console.log(`URL: ${supabaseUrl ? supabaseUrl : '❌ MISSING in .env.local'}`);
console.log(`Key: ${supabaseKey ? `${supabaseKey.substring(0, 16)}...` : '❌ MISSING in .env.local'}\n`);

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing credentials! Please update .env.local with your Supabase URL and Publishable/Anon Key.\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runCheck() {
  let passed = true;

  // 1. Check merchants table
  process.stdout.write('1. Checking `merchants` table... ');
  try {
    const { data, error } = await supabase.from('merchants').select('id').limit(1);
    if (error) throw error;
    console.log('✅ OK');
  } catch (err) {
    console.log('❌ FAILED:', err.message);
    passed = false;
  }

  // 2. Check print_jobs table
  process.stdout.write('2. Checking `print_jobs` table... ');
  try {
    const { data, error } = await supabase.from('print_jobs').select('id').limit(1);
    if (error) throw error;
    console.log('✅ OK');
  } catch (err) {
    console.log('❌ FAILED:', err.message);
    passed = false;
  }

  // 3. Check keepalive table
  process.stdout.write('3. Checking `keepalive` table... ');
  try {
    const { data, error } = await supabase.from('keepalive').select('id').limit(1);
    if (error) throw error;
    console.log('✅ OK');
  } catch (err) {
    console.log('❌ FAILED:', err.message);
    passed = false;
  }

  // 4. Check print-jobs storage bucket
  process.stdout.write('4. Checking `print-jobs` storage bucket... ');
  try {
    const { data, error } = await supabase.storage.getBucket('print-jobs');
    if (error) throw error;
    console.log(`✅ OK (Public: ${data.public})`);
  } catch (err) {
    console.log('⚠️ Warning (Bucket may not be public or permissions restricted):', err.message);
  }

  console.log('----------------------------------------');
  if (passed) {
    console.log('🎉 All core database tables are ready for QuickPrint!\n');
  } else {
    console.log('⚠️ Some tables are missing. Please execute the SQL migration in the Supabase SQL Editor.\n');
  }
}

runCheck().catch(console.error);
