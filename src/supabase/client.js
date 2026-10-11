import { createClient } from '@supabase/supabase-js';

const env = typeof import.meta !== 'undefined' && import.meta.env
  ? import.meta.env
  : (typeof globalThis !== 'undefined' ? globalThis.process?.env || {} : {});

const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase credentials missing. Check .env.local for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

let _supabaseInstance = null;

/**
 * Returns the singleton Supabase client with resilient fetch timeout and auto-injected headers.
 */
export const getSupabase = () => {
  if (!_supabaseInstance) {
    _supabaseInstance = createClient(supabaseUrl || '', supabaseKey || '', {
      auth: {
        persistSession: false,
      },
      global: {
        fetch: async (url, options = {}) => {
          const timeoutMs = 15000;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

          if (options.signal) {
            if (options.signal.aborted) {
              controller.abort();
            } else {
              options.signal.addEventListener('abort', () => controller.abort(), { once: true });
            }
          }

          const headers = new Headers(options.headers || {});
          // Always ensure valid public Supabase Authorization & apikey headers
          if (!headers.has('Authorization') && supabaseKey) {
            headers.set('Authorization', `Bearer ${supabaseKey}`);
          }
          if (!headers.has('apikey') && supabaseKey) {
            headers.set('apikey', supabaseKey);
          }

          try {
            return await fetch(url, {
              ...options,
              headers,
              signal: controller.signal,
            });
          } catch (err) {
            if (err.name === 'AbortError') {
              const timeoutError = new Error(`Supabase request timed out after ${timeoutMs / 1000}s`);
              timeoutError.isTimeout = true;
              throw timeoutError;
            }
            throw err;
          } finally {
            clearTimeout(timeoutId);
          }
        },
      },
    });
  }
  return _supabaseInstance;
};

/**
 * Convenience proxy to access Supabase client properties directly (e.g. supabase.from(...))
 */
export const supabase = new Proxy({}, {
  get(_target, prop) {
    const client = getSupabase();
    const value = client[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export const isSupabaseConfigured = () => !!(supabaseUrl && supabaseKey);

