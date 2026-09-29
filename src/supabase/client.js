import { createClient } from '@supabase/supabase-js';

const globalObj = typeof globalThis !== 'undefined' ? globalThis : {};
const env = typeof import.meta !== 'undefined' && import.meta.env
  ? import.meta.env
  : (globalObj.process?.env || {});

const supabaseUrl = env.VITE_SUPABASE_URL || '';
// Supports both modern Supabase Publishable Keys (sb_publishable_...) and legacy anon keys (JWT)
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '';

// Debug: Log if credentials are missing
if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase credentials missing. Check .env.local file for VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY)');
}

let currentAuthToken = null;
let currentTokenProvider = null;

/**
 * Register an asynchronous token provider for auto-refreshing expired tokens
 * @param {() => Promise<string|null>} provider
 */
export const setSupabaseAuthTokenProvider = (provider) => {
  currentTokenProvider = provider;
};

/**
 * Decode JWT payload safely in browser or node environments
 * @param {string|null} token
 * @returns {Object|null}
 */
export const decodeJwt = (token) => {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const rawPayload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = rawPayload.padEnd(rawPayload.length + (4 - (rawPayload.length % 4)) % 4, '=');
    let decoded = '';

    if (typeof atob === 'function') {
      const binStr = atob(padded);
      try {
        const bytes = Uint8Array.from(binStr, (c) => c.charCodeAt(0));
        decoded = new TextDecoder().decode(bytes);
      } catch {
        decoded = binStr;
      }
    } else if (globalObj.Buffer) {
      decoded = globalObj.Buffer.from(rawPayload, 'base64').toString('utf8');
    } else {
      return null;
    }
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

/**
 * Checks whether a given JWT is expired (with 10-second clock skew leeway)
 * @param {string|null} token
 * @returns {boolean}
 */
export const isJwtExpired = (token) => {
  const payload = decodeJwt(token);
  if (!payload || !payload.exp) return false;
  return (payload.exp * 1000) <= (Date.now() - 10000);
};

/**
 * Safely validates whether a given token is a genuine, unexpired Supabase JWT.
 * Firebase ID tokens (which have issuer securetoken.google.com or a firebase claim) return false.
 * @param {string|null} token
 * @returns {boolean}
 */
export const isValidSupabaseToken = (token) => {
  const payload = decodeJwt(token);
  if (!payload) return false;

  // Reject Google/Firebase ID tokens
  if (payload.firebase || (payload.iss && (payload.iss.includes('securetoken.google.com') || payload.iss.includes('firebase')))) {
    return false;
  }

  // Check expiration with 10s clock-skew leeway
  if (payload.exp && (payload.exp * 1000) <= (Date.now() - 10000)) {
    return false;
  }

  // Supabase JWTs:
  // 1. iss is 'supabase' or contains project ref / host
  // 2. OR role is 'anon', 'authenticated', or 'service_role'
  // 3. OR aud matches authenticated/anon
  const isSupabaseIss = payload.iss === 'supabase' ||
    (typeof payload.iss === 'string' && (
      payload.iss.includes('supabase') ||
      (supabaseUrl && payload.iss.includes(new URL(supabaseUrl).hostname))
    ));
  const isSupabaseRole = payload.role === 'anon' || payload.role === 'authenticated' || payload.role === 'service_role';
  const isSupabaseAud = payload.aud === 'authenticated' || payload.aud === 'anon';

  return isSupabaseIss || isSupabaseRole || isSupabaseAud;
};

/**
 * Update the authorization token passed to Supabase (e.g. Firebase ID token)
 * @param {string|null} token
 */
export const setSupabaseAuthToken = (token) => {
  currentAuthToken = token || null;
};

export const getSupabaseAuthToken = () => currentAuthToken;

let _supabaseInstance = null;

export const getSupabase = () => {
  if (!_supabaseInstance) {
    _supabaseInstance = createClient(
      supabaseUrl || '',
      supabaseKey || '',
      {
        auth: {
          persistSession: false
        },
        global: {
          fetch: async (url, options = {}) => {
            // Storage uploads can be up to 50MB: allow 120s timeout; 15s for database queries
            const isStorageUpload = typeof url === 'string' && url.includes('/storage/v1/object');
            const timeoutMs = isStorageUpload ? 120000 : 15000;
            const controller = new AbortController();
            let isTimedOut = false;
            const timeoutId = setTimeout(() => {
              isTimedOut = true;
              controller.abort();
            }, timeoutMs);

            // Chain caller's signal if provided
            if (options.signal) {
              if (options.signal.aborted) {
                controller.abort();
              } else {
                options.signal.addEventListener('abort', () => controller.abort(), { once: true });
              }
            }
            
            const headers = new Headers(options.headers || {});

            // If an Authorization header is already present, verify it is not an invalid/Firebase JWT that would trigger PGRST301
            if (headers.has('Authorization')) {
              const authVal = headers.get('Authorization') || '';
              if (authVal.startsWith('Bearer ')) {
                const bearerToken = authVal.slice(7).trim();
                // If it is a 3-part JWT that is not a valid Supabase JWT, strip it
                if (bearerToken.includes('.') && !isValidSupabaseToken(bearerToken)) {
                  headers.delete('Authorization');
                }
              }
            }

            // If currentAuthToken is expired, attempt to refresh via token provider
            let tokenToUse = currentAuthToken;
            if (tokenToUse && isJwtExpired(tokenToUse) && currentTokenProvider) {
              try {
                const freshToken = await currentTokenProvider();
                if (freshToken) {
                  currentAuthToken = freshToken;
                  tokenToUse = freshToken;
                }
              } catch (refreshErr) {
                console.warn('Could not refresh Firebase token via provider:', refreshErr);
              }
            }

            // Only attach currentAuthToken to Authorization if it's a verified Supabase JWT.
            // If it is a Firebase token, pass it as a custom header only if it is not expired.
            if (tokenToUse && !isJwtExpired(tokenToUse)) {
              if (isValidSupabaseToken(tokenToUse)) {
                if (!headers.has('Authorization')) {
                  headers.set('Authorization', `Bearer ${tokenToUse}`);
                }
              } else {
                // Forward valid, unexpired Firebase token safely under custom header
                headers.set('X-Firebase-Auth-Token', tokenToUse);
              }
            }

            // Always ensure a valid Authorization header is present so PostgREST never fails with 401 Missing Authorization
            if (!headers.has('Authorization') && supabaseKey) {
              headers.set('Authorization', `Bearer ${supabaseKey}`);
            }

            // Ensure apikey is present
            if (!headers.has('apikey') && supabaseKey) {
              headers.set('apikey', supabaseKey);
            }

            try {
              return await fetch(url, {
                ...options,
                headers,
                signal: controller.signal
              });
            } catch (err) {
              if (isTimedOut || (err.name === 'AbortError' && isTimedOut)) {
                const timeoutError = new Error(`Supabase request timed out after ${timeoutMs / 1000}s`);
                timeoutError.name = 'TimeoutError';
                timeoutError.isTimeout = true;
                throw timeoutError;
              }
              throw err;
            } finally {
              clearTimeout(timeoutId);
            }
          }
        }
      }
    );
  }
  return _supabaseInstance;
};

export const supabase = new Proxy({}, {
  get(_target, prop) {
    const client = getSupabase();
    const value = client[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  }
});

// Helper to check if Supabase is configured
export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseKey);
};

/**
 * Extract relative file path from a Supabase storage URL (public or signed)
 * @param {string} fileUrl
 * @param {string} bucket
 * @returns {string|null}
 */
export const extractStoragePath = (fileUrl, bucket = 'print-jobs') => {
  if (!fileUrl || typeof fileUrl !== 'string') return null;

  try {
    // If it's already just a relative path (doesn't start with http/https)
    if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
      return fileUrl.replace(/^\/+/, '');
    }

    const urlObj = new URL(fileUrl);
    const pathname = decodeURIComponent(urlObj.pathname);

    // Standard Supabase storage URL pattern: /storage/v1/object/(public|sign|authenticated)/{bucket}/{filePath}
    const bucketMarker = `/${bucket}/`;
    const markerIndex = pathname.indexOf(bucketMarker);
    if (markerIndex !== -1) {
      return pathname.substring(markerIndex + bucketMarker.length);
    }

    // Fallback: simple string split
    if (fileUrl.includes(`/${bucket}/`)) {
      return decodeURIComponent(fileUrl.split(`/${bucket}/`)[1].split('?')[0]);
    }

    return null;
  } catch (e) {
    console.error('Error extracting storage path:', e);
    return null;
  }
};

/**
 * Safely delete a file from Supabase storage
 * @param {string} fileUrl - Signed or public Supabase URL, or file path
 * @param {string} bucket - Bucket name (default 'print-jobs')
 */
export const deleteFileFromStorage = async (fileUrl, bucket = 'print-jobs') => {
  try {
    const filePath = extractStoragePath(fileUrl, bucket);
    if (!filePath) {
      console.warn('Could not extract file path from URL:', fileUrl);
      return { success: false, error: 'Invalid URL or path' };
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (error) {
      console.error('Supabase file deletion error:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    console.error('deleteFileFromStorage error:', err);
    return { success: false, error: err };
  }
};

/**
 * Safely delete multiple files in a single batch API call from Supabase storage
 * @param {Array<string>} fileUrls - Array of URLs or paths
 * @param {string} bucket - Bucket name (default 'print-jobs')
 */
export const deleteMultipleFilesFromStorage = async (fileUrls, bucket = 'print-jobs') => {
  if (!Array.isArray(fileUrls) || fileUrls.length === 0) {
    return { success: true, count: 0 };
  }

  try {
    const filePaths = fileUrls
      .map(url => extractStoragePath(url, bucket))
      .filter(path => typeof path === 'string' && path.length > 0);

    if (filePaths.length === 0) {
      return { success: true, count: 0 };
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .remove(filePaths);

    if (error) {
      console.error('Batch Supabase storage deletion error:', error);
      return { success: false, error };
    }

    return { success: true, data, count: filePaths.length };
  } catch (err) {
    console.error('deleteMultipleFilesFromStorage error:', err);
    return { success: false, error: err };
  }
};
