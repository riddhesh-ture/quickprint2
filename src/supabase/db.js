// src/supabase/db.js
import { supabase } from './client.js';

// Centralized list of JSONB columns whose internal keys must NOT have case conversion applied
const PRESERVED_JSON_KEYS = new Set([
  'files',
  'specs',
  'stats',
  'metadata',
]);

// Special case mappings between camelCase and snake_case for PostgreSQL
// (All standard camelCase/snake_case pairs are automatically handled by regex below)
const CAMEL_TO_SNAKE_OVERRIDES = {
  pricePerPageBW: 'price_per_page_bw',
};

const SNAKE_TO_CAMEL_OVERRIDES = {
  price_per_page_bw: 'pricePerPageBW',
  price_per_page_b_w: 'pricePerPageBW',
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
    const snakeKey = toSnakeColumn(key);
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

// In-memory LRU cache (capped at 50 entries) to deduplicate merchant profile fetches
const MAX_PROFILE_CACHE_SIZE = 50;
const profileCache = new Map(); // merchantId -> { data, timestamp }

const setCachedProfile = (merchantId, data) => {
  if (!merchantId || !data) return;
  if (profileCache.size >= MAX_PROFILE_CACHE_SIZE) {
    const oldestKey = profileCache.keys().next().value;
    if (oldestKey) profileCache.delete(oldestKey);
  }
  profileCache.set(merchantId, { data, timestamp: Date.now() });
};

/**
 * Dynamic rollover check for UI display: ensure new day/month reflects 0 if no jobs placed yet
 */
const applyDynamicStatsRollover = (profile) => {
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
 * Look up a merchant profile by their 4-digit shop code (e.g. 'QP-8421', '8421') or Firebase UID.
 */
export const getMerchantByShopCodeOrId = async (codeOrId) => {
  if (!codeOrId) return null;

  const trimmed = String(codeOrId).trim();
  if (!trimmed || !/^[a-zA-Z0-9_-]{1,64}$/.test(trimmed)) {
    return null;
  }

  // Extract numeric digits if present (e.g. from 'QP-8421' or '8421' -> 8421)
  const digits = parseInt(trimmed.replace(/\D/g, ''), 10);
  const hasValidDigits = !isNaN(digits) && digits > 0;

  // 1. Check in-memory LRU cache first
  for (const [, entry] of profileCache.entries()) {
    if (Date.now() - entry.timestamp < 60000 && entry.data) {
      if (
        entry.data.id === trimmed ||
        (hasValidDigits && Number(entry.data.shopCode) === digits)
      ) {
        return entry.data;
      }
    }
  }

  const formatAndCache = (raw) => {
    if (!raw) return null;
    const result = applyDynamicStatsRollover(toCamelCase(raw));
    if (result?.id) setCachedProfile(result.id, result);
    return result;
  };

  // 2. Query Supabase (strictly send integers to shop_code to avoid Postgres syntax error)
  try {
    const orConditions = [`id.eq.${trimmed}`];
    if (hasValidDigits) {
      orConditions.push(`shop_code.eq.${digits}`);
    }

    const { data, error } = await supabase
      .from('merchants')
      .select('*')
      .or(orConditions.join(','))
      .limit(1)
      .maybeSingle();

    if (error) {
      // Fallback: Query by ID directly
      const fallback = await supabase
        .from('merchants')
        .select('*')
        .eq('id', trimmed)
        .maybeSingle();

      return formatAndCache(fallback?.data);
    }

    return formatAndCache(data);
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
  delete snakeData.id;

  // Helper to ensure clean integer persistence
  const parseOptionalInt = (val) => {
    if (val === undefined || val === null) return val;
    const parsed = typeof val === 'number'
      ? Math.floor(val)
      : parseInt(String(val).replace(/\D/g, ''), 10);
    return !isNaN(parsed) ? parsed : null;
  };

  if (snakeData.shop_code !== undefined) snakeData.shop_code = parseOptionalInt(snakeData.shop_code);
  if (snakeData.pincode !== undefined) snakeData.pincode = parseOptionalInt(snakeData.pincode);

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

  try {
    const { error } = await supabase.rpc('increment_merchant_stats', {
      p_merchant_id: merchantId,
      p_pages: Number(pages) || 0,
      p_earnings: Number(earnings) || 0,
    });
    if (!error) return;
  } catch {}

  // Fallback if RPC is not installed: fetch and update stats directly
  try {
    const profile = await getMerchantProfile(merchantId);
    if (!profile) return;
    const currentStats = profile.stats || {};
    const updatedStats = {
      ...currentStats,
      totalPrints: (currentStats.totalPrints || 0) + (Number(pages) || 0),
      totalEarnings: (currentStats.totalEarnings || 0) + (Number(earnings) || 0),
      todayPrints: (currentStats.todayPrints || 0) + (Number(pages) || 0),
      todayEarnings: (currentStats.todayEarnings || 0) + (Number(earnings) || 0),
      monthPrints: (currentStats.monthPrints || 0) + (Number(pages) || 0),
      monthEarnings: (currentStats.monthEarnings || 0) + (Number(earnings) || 0),
    };
    await upsertMerchantProfile(merchantId, { stats: updatedStats });
  } catch (err) {
    console.warn('Could not increment stats via fallback:', err);
  }
};

/**
 * Combined atomic payment confirmation + stats increment (with resilient fallback)
 */
export const confirmPaymentAndIncrementStats = async (jobId, merchantId, cost, totalPages) => {
  if (!jobId || !merchantId) throw new Error('Missing jobId or merchantId');

  try {
    const { error } = await supabase.rpc('confirm_payment_and_update_stats', {
      p_job_id: jobId,
      p_merchant_id: merchantId,
      p_cost: Number(cost) || 0,
      p_pages: Number(totalPages) || 1,
    });
    if (!error) return true;
  } catch (rpcErr) {
    console.warn('RPC confirm_payment_and_update_stats unavailable, using direct update:', rpcErr);
  }

  // Fallback: update print job status & increment merchant stats
  await updatePrintJob(jobId, { status: 'completed', paymentStatus: 'paid' });
  await incrementMerchantStats(merchantId, totalPages, cost);
  return true;
};

/**
 * Atomically complete a print job in Supabase (with fallback)
 */
export const completePrintJob = async (jobId, merchantId) => {
  if (!jobId || !merchantId) throw new Error('Missing jobId or merchantId');

  try {
    const { error } = await supabase.rpc('complete_print_job', {
      p_job_id: jobId,
      p_merchant_id: merchantId,
    });
    if (!error) return true;
  } catch {}

  return updatePrintJob(jobId, { status: 'completed', completedAt: new Date().toISOString() });
};

/**
 * Fetch PINs currently in use by active (pending/printing) jobs for a specific merchant.
 * Ensures the next walk-in user gets an active-collision-free 4-digit PIN.
 */
export const getActiveJobPins = async (merchantId) => {
  if (!merchantId) return [];
  try {
    const { data, error } = await supabase
      .from('print_jobs')
      .select('pin')
      .eq('merchant_id', merchantId)
      .in('status', ['pending', 'paymentClaimed', 'printing']);

    if (error || !data) return [];
    return data.map((j) => String(j.pin || '')).filter(Boolean);
  } catch {
    return [];
  }
};

/**
 * Create a print job in Supabase (accepts (jobId, jobData) or (jobData))
 */
export const createPrintJob = async (jobId, jobData) => {
  const actualId = (typeof jobId === 'string' && jobId) ? jobId : generatePrintJobId();
  const actualData = (typeof jobId === 'string' && jobId) ? (jobData || {}) : (jobId || {});

  const snakeData = toSnakeCase(actualData);
  delete snakeData.id;

  const payload = {
    id: actualId,
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

// Backwards-compatible alias
export const createPrintJobWithId = createPrintJob;

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


