// scripts/test-phase1.js
// Verification suite for Phase 1 changes
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env.local');

// Load .env.local into process.env before importing client
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || '';
      value = value.trim().replace(/^['"]|['"]$/g, '');
      process.env[match[1]] = value;
    }
  });
}

// Dynamically import client & db after env is populated
const { 
  toSnakeCase, 
  toCamelCase, 
  toSnakeColumn, 
  PRESERVED_JSON_KEYS,
  getMerchantByShopCodeOrId 
} = await import('../src/supabase/db.js');

const { 
  isValidSupabaseToken, 
  setSupabaseAuthToken, 
  getSupabaseAuthToken,
  supabase 
} = await import('../src/supabase/client.js');

console.log('--- Starting Phase 1 Verification Checks ---');

// 1. Verify pricePerPageBW case conversions
console.log('1. Testing pricePerPageBW <-> price_per_page_bw conversion...');
const camelInput = {
  shopName: 'Test Xerox',
  pricePerPageBW: 2.5,
  pricePerPageColor: 7.0,
  bwPages: 12,
  colorPages: 3,
  paymentMethod: 'cash',
  stats: { totalPrints: 10, totalEarnings: 25 },
  failedFiles: [{ name: 'doc1.pdf', reason: 'corrupt' }]
};

const snakeResult = toSnakeCase(camelInput);
assert.strictEqual(snakeResult.shop_name, 'Test Xerox', 'shopName -> shop_name');
assert.strictEqual(snakeResult.price_per_page_bw, 2.5, 'pricePerPageBW -> price_per_page_bw');
assert.strictEqual(snakeResult.price_per_page_b_w, undefined, 'Must NOT produce price_per_page_b_w');
assert.strictEqual(snakeResult.price_per_page_color, 7.0, 'pricePerPageColor -> price_per_page_color');
assert.strictEqual(snakeResult.bw_pages, 12, 'bwPages -> bw_pages');
assert.strictEqual(snakeResult.color_pages, 3, 'colorPages -> color_pages');
assert.strictEqual(snakeResult.payment_method, 'cash', 'paymentMethod -> payment_method');
assert.strictEqual(snakeResult.stats.totalPrints, 10, 'stats internal keys preserved');
assert.strictEqual(snakeResult.failed_files[0].name, 'doc1.pdf', 'failed_files preserved');
console.log('   ✅ toSnakeCase conversion passed (including bwPages & paymentMethod)');

const snakeInput = {
  id: 'merchant_123',
  shop_name: 'Test Xerox',
  shop_code: 'QP9999',
  price_per_page_bw: 3.0,
  price_per_page_color: 8.0,
  bw_pages: 7,
  color_pages: 2,
  payment_method: 'upi',
  stats: { totalPrints: 5 },
  failed_files: [{ name: 'doc2.pdf' }]
};

const camelResult = toCamelCase(snakeInput);
assert.strictEqual(camelResult.shopName, 'Test Xerox', 'shop_name -> shopName');
assert.strictEqual(camelResult.shopCode, 'QP9999', 'shop_code -> shopCode');
assert.strictEqual(camelResult.pricePerPageBW, 3.0, 'price_per_page_bw -> pricePerPageBW');
assert.strictEqual(camelResult.pricePerPageBw, undefined, 'Must NOT produce pricePerPageBw');
assert.strictEqual(camelResult.pricePerPageColor, 8.0, 'price_per_page_color -> pricePerPageColor');
assert.strictEqual(camelResult.bwPages, 7, 'bw_pages -> bwPages');
assert.strictEqual(camelResult.colorPages, 2, 'color_pages -> colorPages');
assert.strictEqual(camelResult.paymentMethod, 'upi', 'payment_method -> paymentMethod');
assert.strictEqual(camelResult.stats.totalPrints, 5, 'stats internal keys preserved');
console.log('   ✅ toCamelCase conversion passed');

assert.strictEqual(toSnakeColumn('pricePerPageBW'), 'price_per_page_bw');
assert.strictEqual(toSnakeColumn('shopCode'), 'shop_code');
assert.strictEqual(toSnakeColumn('bwPages'), 'bw_pages');
assert.strictEqual(toSnakeColumn('colorPages'), 'color_pages');
console.log('   ✅ toSnakeColumn conversion passed');

// 2. Verify PRESERVED_JSON_KEYS
console.log('2. Checking PRESERVED_JSON_KEYS...');
assert(PRESERVED_JSON_KEYS.has('failedFiles'), 'PRESERVED_JSON_KEYS must contain failedFiles');
assert(PRESERVED_JSON_KEYS.has('failed_files'), 'PRESERVED_JSON_KEYS must contain failed_files');
assert(PRESERVED_JSON_KEYS.has('stats'), 'PRESERVED_JSON_KEYS must contain stats');
console.log('   ✅ PRESERVED_JSON_KEYS verified');

// 3. Verify getMerchantByShopCodeOrId helper exists
console.log('3. Checking getMerchantByShopCodeOrId helper...');
assert.strictEqual(typeof getMerchantByShopCodeOrId, 'function', 'getMerchantByShopCodeOrId must be a function');
console.log('   ✅ getMerchantByShopCodeOrId function is exported');

// 4. Verify Supabase client token validation (Firebase vs Supabase tokens)
console.log('4. Testing JWT validation in Supabase client...');

// Mock Firebase token (iss: securetoken.google.com)
const firebasePayload = Buffer.from(JSON.stringify({
  iss: 'https://securetoken.google.com/official-quickprint',
  sub: 'firebase_user_uid_123',
  exp: Math.floor(Date.now() / 1000) + 3600
})).toString('base64');
const mockFirebaseToken = `eyJhbGciOiJSUzI1NiJ9.${firebasePayload}.mock_sig`;

assert.strictEqual(isValidSupabaseToken(mockFirebaseToken), false, 'Firebase token must NOT be identified as a valid Supabase token');
console.log('   ✅ Firebase ID token correctly identified as non-Supabase token');

// Mock Expired Supabase token
const expiredSupabasePayload = Buffer.from(JSON.stringify({
  iss: 'supabase',
  role: 'authenticated',
  exp: Math.floor(Date.now() / 1000) - 3600
})).toString('base64');
const mockExpiredToken = `eyJhbGciOiJIUzI1NiJ9.${expiredSupabasePayload}.mock_sig`;
assert.strictEqual(isValidSupabaseToken(mockExpiredToken), false, 'Expired Supabase token must return false');
console.log('   ✅ Expired Supabase token rejected');

// Mock Valid Supabase token
const validSupabasePayload = Buffer.from(JSON.stringify({
  iss: 'supabase',
  role: 'authenticated',
  exp: Math.floor(Date.now() / 1000) + 3600
})).toString('base64');
const mockValidSupabaseToken = `eyJhbGciOiJIUzI1NiJ9.${validSupabasePayload}.mock_sig`;
assert.strictEqual(isValidSupabaseToken(mockValidSupabaseToken), true, 'Valid Supabase token must return true');
console.log('   ✅ Genuine Supabase token accepted');

// Mock Valid Supabase token with UNPADDED base64 payload (simulates browser JWT)
const unpaddedValidPayload = Buffer.from(JSON.stringify({
  iss: 'supabase',
  role: 'anon',
  exp: Math.floor(Date.now() / 1000) + 3600
})).toString('base64').replace(/=/g, ''); // Explicitly strip padding '='
const mockUnpaddedToken = `eyJhbGciOiJIUzI1NiJ9.${unpaddedValidPayload}.mock_sig`;
assert.strictEqual(isValidSupabaseToken(mockUnpaddedToken), true, 'Unpadded Supabase JWT must be valid');
console.log('   ✅ Unpadded base64url Supabase token accepted (browser padding-safe)');

// Null / invalid strings
assert.strictEqual(isValidSupabaseToken(null), false);
assert.strictEqual(isValidSupabaseToken('not-a-jwt'), false);
console.log('   ✅ Malformed / null tokens safely handled');

// Test setSupabaseAuthToken / getSupabaseAuthToken
setSupabaseAuthToken('test-token');
assert.strictEqual(getSupabaseAuthToken(), 'test-token');
setSupabaseAuthToken(null);
assert.strictEqual(getSupabaseAuthToken(), null);
console.log('   ✅ Auth token state getter/setter verified');

// 5. Live Supabase connection test with credentials from .env.local
console.log('5. Testing Supabase client connectivity with credentials...');
try {
  const { error } = await supabase.from('merchants').select('id').limit(1);
  if (error) {
    console.log('   ⚠️ Supabase query response:', error.message);
  } else {
    console.log('   ✅ Supabase connected successfully without PGRST301!');
  }
} catch (e) {
  console.log('   ⚠️ Supabase connectivity check exception:', e.message);
}

console.log('\n🎉 ALL Phase 1 verification assertions PASSED successfully!');
