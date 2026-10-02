// src/supabase/db.js
import { supabase } from './client.js';

// Centralized list of JSONB columns whose internal keys must NOT have case conversion applied
export const PRESERVED_JSON_KEYS = new Set([
  'files',
  'specs',
  'stats',
  'failedFiles',
  'failed_files',
  'metadata'
]);

// Special case mappings between camelCase and snake_case
const CAMEL_TO_SNAKE_OVERRIDES = {
  pricePerPageBW: 'price_per_page_bw',
  pricePerPageBw: 'price_per_page_bw',
  bwPages: 'bw_pages',
  bWPages: 'bw_pages',
  colorPages: 'color_pages',
  paymentMethod: 'payment_method',
  customerPhone: 'customer_phone',
  customerUid: 'customer_uid',
  customerEmail: 'customer_email',
  customerName: 'customer_name',
  customerPhoto: 'customer_photo',
  customerPhotoUrl: 'customer_photo',
  customerPhotoURL: 'customer_photo',
  displayName: 'display_name',
  photoUrl: 'photo_url',
  photoURL: 'photo_url',
  pickupCode: 'pickup_code',
  fulfillmentPreference: 'fulfillment_preference',
  isPrintLater: 'is_print_later',
  lastSeenAt: 'last_seen_at',
};

const SNAKE_TO_CAMEL_OVERRIDES = {
  price_per_page_bw: 'pricePerPageBW',
  price_per_page_b_w: 'pricePerPageBW',
  bw_pages: 'bwPages',
  b_w_pages: 'bwPages',
  color_pages: 'colorPages',
  payment_method: 'paymentMethod',
  customer_phone: 'customerPhone',
  customer_uid: 'customerUid',
  customer_email: 'customerEmail',
  customer_name: 'customerName',
  customer_photo: 'customerPhoto',
  display_name: 'displayName',
  photo_url: 'photoUrl',
  pickup_code: 'pickupCode',
  fulfillment_preference: 'fulfillmentPreference',
  is_print_later: 'isPrintLater',
  last_seen_at: 'lastSeenAt',
};

/**
 * Convert camelCase string to snake_case column name
 */
export const toSnakeColumn = (str) => {
  if (!str || typeof str !== 'string') return str;
  if (CAMEL_TO_SNAKE_OVERRIDES[str]) return CAMEL_TO_SNAKE_OVERRIDES[str];
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .toLowerCase();
};

/**
 * Convert snake_case object keys to camelCase
 */
export const toCamelCase = (obj) => {
  if (!obj || typeof obj !== 'object' || obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);

  const newObj = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = SNAKE_TO_CAMEL_OVERRIDES[key] || key.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
    newObj[camelKey] = (value !== null && typeof value === 'object' && !(value instanceof Date) && !PRESERVED_JSON_KEYS.has(key))
      ? toCamelCase(value)
      : value;
  }
  return newObj;
};

/**
 * Convert camelCase object keys to snake_case for PostgreSQL
 */
export const toSnakeCase = (obj) => {
  if (!obj || typeof obj !== 'object' || obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(toSnakeCase);

  const newObj = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = CAMEL_TO_SNAKE_OVERRIDES[key] || toSnakeColumn(key);
    newObj[snakeKey] = (value !== null && typeof value === 'object' && !(value instanceof Date) && !PRESERVED_JSON_KEYS.has(key))
      ? toSnakeCase(value)
      : value;
  }
  return newObj;
};

/**
 * Generate a unique client-side ID for a print job
 */
export const generatePrintJobId = () => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 9);
  return `job_${timestamp}_${randomStr}`;
};

/**
 * Generate a 4-digit pickup code for customer print orders (e.g. 'P-8421')
 * @returns {string} Formatted pickup code
 */
export const generatePickupCode = () => {
  const code = Math.floor(1000 + Math.random() * 9000);
  return `P-${code}`;
};

// In-memory LRU cache (capped at 50 entries) to deduplicate merchant profile fetches
const MAX_PROFILE_CACHE_SIZE = 50;
const profileCache = new Map(); // merchantId -> { data, timestamp }

const setCachedProfile = (merchantId, data) => {
  if (profileCache.size >= MAX_PROFILE_CACHE_SIZE) {
    // Evict oldest entry (first key in Map iterator)
    const oldestKey = profileCache.keys().next().value;
    if (oldestKey) profileCache.delete(oldestKey);
  }
  profileCache.set(merchantId, { data, timestamp: Date.now() });
};

// In-memory LRU cache (capped at 50 entries) to deduplicate customer profile fetches
const MAX_CUSTOMER_CACHE_SIZE = 50;
const customerProfileCache = new Map(); // customerUid -> { data, timestamp }

const setCachedCustomerProfile = (customerUid, data) => {
  if (!customerUid || !data) return;
  if (customerProfileCache.size >= MAX_CUSTOMER_CACHE_SIZE) {
    const oldestKey = customerProfileCache.keys().next().value;
    if (oldestKey) customerProfileCache.delete(oldestKey);
  }
  customerProfileCache.set(customerUid, { data, timestamp: Date.now() });
};

/**
 * Dynamic rollover check for UI display: ensure new day/month reflects 0 if no jobs placed yet
 */
export const applyDynamicStatsRollover = (profile) => {
  if (profile?.stats && typeof profile.stats === 'object') {
    const todayStr = new Date().toISOString().split('T')[0];
    const monthStr = todayStr.substring(0, 7);
    if (profile.stats.lastResetDate && profile.stats.lastResetDate !== todayStr) {
      profile.stats.todayPrints = 0;
      profile.stats.todayEarnings = 0;
    }
    if (profile.stats.lastResetMonth && profile.stats.lastResetMonth !== monthStr) {
      profile.stats.monthPrints = 0;
      profile.stats.monthEarnings = 0;
    }
  }
  return profile;
};

/**
 * Fetch a merchant's profile by their Firebase Auth UID (Cached 60s)
 */
export const getMerchantProfile = async (merchantId) => {
  if (!merchantId) return null;

  const cached = profileCache.get(merchantId);
  if (cached && Date.now() - cached.timestamp < 60000) {
    return cached.data;
  }

  const { data, error } = await supabase
    .from('merchants')
    .select('*')
    .eq('id', merchantId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching merchant profile:', error);
    throw error;
  }

  const result = applyDynamicStatsRollover(toCamelCase(data));
  if (result) {
    setCachedProfile(merchantId, result);
  }
  return result;
};

/**
 * Look up a merchant profile by either their 6-character shop code (case-insensitive) or Firebase UID.
 * Checks the LRU cache first, then queries Supabase.
 * @param {string} codeOrId - 6-character shop code (e.g. 'QP7890') or merchant UID
 * @returns {Promise<Object|null>} Camel-cased merchant profile object or null
 */
export const getMerchantByShopCodeOrId = async (codeOrId) => {
  if (!codeOrId || typeof codeOrId !== 'string') return null;

  const trimmed = codeOrId.trim();
  if (!trimmed) return null;

  // Strict validation: only alphanumeric, hyphen, underscore up to 64 chars.
  // Rejects any characters that could alter PostgREST filter syntax (commas, parens, dots, quotes).
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(trimmed)) {
    return null;
  }

  // 1. Check in-memory LRU cache first (by ID or by shopCode)
  for (const [, entry] of profileCache.entries()) {
    if (Date.now() - entry.timestamp < 60000 && entry.data) {
      if (
        entry.data.id === trimmed ||
        (entry.data.shopCode && entry.data.shopCode.toUpperCase() === trimmed.toUpperCase())
      ) {
        return entry.data;
      }
    }
  }

  // 2. Query Supabase: Single-pass PostgREST .or() query combining shop_code and id
  const upperCode = trimmed.toUpperCase();
  try {
    const { data, error } = await supabase
      .from('merchants')
      .select('*')
      .or(`shop_code.eq.${upperCode},id.eq.${trimmed}`)
      .limit(1)
      .maybeSingle();

    if (error) {
      // Fallback: If shop_code column does not exist on legacy unmigrated schemas, fallback to ID query
      const fallback = await supabase
        .from('merchants')
        .select('*')
        .eq('id', trimmed)
        .maybeSingle();

      if (fallback.data) {
        const result = applyDynamicStatsRollover(toCamelCase(fallback.data));
        setCachedProfile(result.id, result);
        return result;
      }
      return null;
    }

    if (!data) return null;

    const result = applyDynamicStatsRollover(toCamelCase(data));
    setCachedProfile(result.id, result);
    return result;
  } catch (err) {
    console.error('Error fetching merchant by shop_code or id:', err);
    return null;
  }
};

/**
 * Create or update a merchant's profile in Supabase
 */
export const upsertMerchantProfile = async (merchantId, profileData) => {
  if (!merchantId) throw new Error('Missing merchant ID');

  const snakeData = toSnakeCase(profileData);
  delete snakeData.id; // Avoid mutating primary key

  const payload = {
    id: merchantId,
    ...snakeData,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('merchants')
    .upsert(payload)
    .select()
    .single();

  if (error) {
    console.error('Error upserting merchant profile:', error);
    throw error;
  }

  const result = toCamelCase(data);
  // Invalidate and update cache
  if (result) {
    setCachedProfile(merchantId, result);
  }
  return result;
};

/**
 * Atomically increment merchant print counts and earnings in Supabase
 */
export const incrementMerchantStats = async (merchantId, pages = 0, earnings = 0) => {
  if (!merchantId) return;

  const { error } = await supabase.rpc('increment_merchant_stats', {
    p_merchant_id: merchantId,
    p_pages: Number(pages) || 0,
    p_earnings: Number(earnings) || 0,
  });

  if (error) {
    console.error('RPC increment_merchant_stats failed:', error);
  }
};

/**
 * Combined atomic payment confirmation + stats increment (1 single network call)
 */
export const confirmPaymentAndIncrementStats = async (jobId, merchantId, cost, totalPages) => {
  if (!jobId || !merchantId) throw new Error('Missing jobId or merchantId');

  const { error } = await supabase.rpc('confirm_payment_and_update_stats', {
    p_job_id: jobId,
    p_merchant_id: merchantId,
    p_cost: Number(cost) || 0,
    p_pages: Number(totalPages) || 1,
  });

  if (error) {
    console.error('RPC confirm_payment_and_update_stats failed:', error);
    throw error;
  }
  return true;
};

/**
 * Atomically complete a print job in Supabase (1 single network call)
 */
export const completePrintJob = async (jobId, merchantId) => {
  if (!jobId || !merchantId) throw new Error('Missing jobId or merchantId');

  const { error } = await supabase.rpc('complete_print_job', {
    p_job_id: jobId,
    p_merchant_id: merchantId,
  });

  if (error) {
    console.warn('RPC complete_print_job failed, falling back to updatePrintJob:', error);
    return updatePrintJob(jobId, { status: 'completed', completedAt: new Date().toISOString() });
  }
  return true;
};

/**
 * Create a print job with an explicit client-side ID
 */
export const createPrintJobWithId = async (jobId, jobData) => {
  const snakeData = toSnakeCase(jobData);
  const payload = {
    id: jobId,
    ...snakeData,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('print_jobs')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('Error creating print job in Supabase:', error);
    throw error;
  }
  return toCamelCase(data);
};

/**
 * Create a print job with an auto-generated ID
 */
export const createPrintJob = async (jobData) => {
  const jobId = generatePrintJobId();
  return createPrintJobWithId(jobId, jobData);
};

/**
 * Update an existing print job
 */
export const updatePrintJob = async (jobId, updates) => {
  if (!jobId) throw new Error('Missing job ID');

  const snakeData = toSnakeCase(updates);
  delete snakeData.id;

  const { data, error } = await supabase
    .from('print_jobs')
    .update(snakeData)
    .eq('id', jobId)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error updating print job:', error);
    throw error;
  }
  return toCamelCase(data);
};

/**
 * Delete a print job from Supabase
 */
export const deletePrintJob = async (jobId) => {
  if (!jobId) return;

  const { error } = await supabase
    .from('print_jobs')
    .delete()
    .eq('id', jobId);

  if (error) {
    console.error('Error deleting print job:', error);
    throw error;
  }
  return true;
};

/**
 * Retrieve all print jobs submitted by a specific customer
 * @param {string} customerUid - Firebase Auth UID of the customer
 * @returns {Promise<Array>} List of print jobs in camelCase
 */
export const getCustomerPrintJobs = async (customerUid) => {
  if (!customerUid) return [];

  const { data, error } = await supabase
    .from('print_jobs')
    .select('*')
    .eq('customer_uid', customerUid)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching customer print jobs:', error);
    throw error;
  }

  return toCamelCase(data || []);
};

/**
 * Look up a print job by merchant ID and pickup code (case-insensitive).
 * Supports full code ('P-8421'), raw digits ('8421'), or space-separated ('P 8421').
 * @param {string} merchantId - Merchant UID or ID
 * @param {string} pickupCode - 4-digit pickup code or raw number
 * @param {Object} [options] - Optional query options ({ onlyActive: true })
 * @returns {Promise<Object|null>} Print job object in camelCase or null
 */
export const getPrintJobByPickupCode = async (merchantId, pickupCode, options = {}) => {
  if (!merchantId || !pickupCode || typeof pickupCode !== 'string') return null;

  const trimmed = pickupCode.trim().toUpperCase();
  if (!trimmed) return null;

  // Extract digits if pattern matches 4 digits (e.g., '8421', 'P-8421', 'P 8421', 'P8421')
  const digitsMatch = trimmed.match(/^(?:P[- ]?)?(\d{4})$/i);
  const searchCodes = digitsMatch
    ? [`P-${digitsMatch[1]}`, digitsMatch[1]]
    : [trimmed];

  let query = supabase
    .from('print_jobs')
    .select('*')
    .eq('merchant_id', merchantId)
    .in('pickup_code', searchCodes);

  if (options.onlyActive) {
    query = query.not('status', 'in', '("completed","cancelled")');
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching print job by pickup code:', error);
    throw error;
  }

  return toCamelCase(data);
};

/**
 * Generate a collision-free pickup code for a given merchant.
 * Checks active jobs at the merchant shop to avoid code collisions.
 * @param {string} merchantId
 * @returns {Promise<string>}
 */
export const generateUniquePickupCode = async (merchantId) => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generatePickupCode();
    if (!merchantId) return code;
    try {
      const existing = await getPrintJobByPickupCode(merchantId, code, { onlyActive: true });
      if (!existing) return code;
    } catch {
      return code;
    }
  }
  return generatePickupCode();
};

/**
 * Update merchant fulfillment preference for a print job ('hold' vs 'preprint')
 * @param {string} jobId - Print job ID
 * @param {'hold'|'preprint'} preference - Fulfillment choice
 * @returns {Promise<Object>} Updated print job
 */
export const updateFulfillmentPreference = async (jobId, preference) => {
  if (!jobId) throw new Error('Missing job ID');

  const validPreferences = ['hold', 'preprint'];
  const pref = validPreferences.includes(preference) ? preference : 'hold';

  return updatePrintJob(jobId, { fulfillmentPreference: pref });
};

/**
 * Cancel a print job by updating status to 'cancelled'
 * @param {string} jobId - Print job ID
 * @param {string} [customerUid] - Optional customer UID for ownership verification
 * @returns {Promise<Object>} Updated print job
 */
export const cancelPrintJob = async (jobId, customerUid = null) => {
  if (!jobId) throw new Error('Missing job ID');

  let query = supabase
    .from('print_jobs')
    .update({ status: 'cancelled' })
    .eq('id', jobId);

  if (customerUid) {
    query = query.eq('customer_uid', customerUid);
  }

  const { data, error } = await query.select().maybeSingle();
  if (error) {
    console.error('Error cancelling print job:', error);
    throw error;
  }
  return toCamelCase(data);
};

/**
 * Create or update a customer profile in Supabase
 * @param {Object} customerData - Customer details ({ uid/id, email, displayName/name, photoURL/photoUrl })
 * @returns {Promise<Object>} Upserted customer profile
 */
export const upsertCustomerProfile = async (customerData) => {
  if (!customerData) throw new Error('Missing customer data');
  const uid = customerData.uid || customerData.id;
  if (!uid) throw new Error('Missing customer UID');

  const email = customerData.email || '';
  const displayName = customerData.displayName || customerData.name || null;
  const photoUrl = customerData.photoURL || customerData.photoUrl || customerData.customerPhoto || customerData.photo || null;

  const normalizedProfile = {
    id: uid,
    uid,
    email,
    displayName,
    photoUrl,
    photoURL: photoUrl,
    lastSeenAt: new Date().toISOString(),
  };

  // Attempt RPC first (upsert_customer_profile)
  try {
    const { error: rpcError } = await supabase.rpc('upsert_customer_profile', {
      p_uid: uid,
      p_email: email,
      p_display_name: displayName,
      p_photo_url: photoUrl,
    });

    if (!rpcError) {
      setCachedCustomerProfile(uid, normalizedProfile);
      return normalizedProfile;
    }
  } catch (rpcErr) {
    console.warn('RPC upsert_customer_profile unavailable, falling back to direct table upsert:', rpcErr);
  }

  // Fallback to direct table upsert
  const payload = {
    id: uid,
    email,
    display_name: displayName,
    photo_url: photoUrl,
    last_seen_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('customers')
    .upsert(payload)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error upserting customer profile:', error);
    // Return optimistic profile object if table does not exist yet to prevent blocking customer flow
    setCachedCustomerProfile(uid, normalizedProfile);
    return normalizedProfile;
  }

  const result = toCamelCase(data);
  if (result) {
    result.uid = result.id || uid;
    result.photoURL = result.photoUrl || photoUrl;
    setCachedCustomerProfile(uid, result);
    return result;
  }

  setCachedCustomerProfile(uid, normalizedProfile);
  return normalizedProfile;
};

/**
 * Fetch customer profile from Supabase by customer UID (Cached 60s)
 * @param {string} customerUid - Firebase Auth UID
 * @returns {Promise<Object|null>} Customer profile or null
 */
export const getCustomerProfile = async (customerUid) => {
  if (!customerUid) return null;

  const cached = customerProfileCache.get(customerUid);
  if (cached && Date.now() - cached.timestamp < 60000) {
    return cached.data;
  }

  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerUid)
      .maybeSingle();

    if (error) {
      console.warn('Error fetching customer profile:', error);
      return null;
    }

    if (!data) return null;

    const result = toCamelCase(data);
    result.uid = result.id || customerUid;
    result.photoURL = result.photoUrl || null;
    setCachedCustomerProfile(customerUid, result);
    return result;
  } catch (err) {
    console.warn('Error in getCustomerProfile:', err);
    return null;
  }
};

