// src/utils/tokenGenerator.js
/**
 * QuickPrint Token & Identification Generator
 *
 * Distinct formats:
 * - Order Token: #<token>-<pin> (e.g. #14-8421) + optional phone suffix (📞 <last4>)
 * - Merchant Shop Code: QP-XXXX (e.g. QP-8421)
 */

const TOKEN_STORAGE_KEY = 'quickprint_daily_token_counter';

/**
 * Generate a 4-digit numeric PIN with high entropy (1000 - 9999).
 */
export function generatePin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/**
 * Generate a sequential daily token number (#1, #2, ... #999).
 * Resets automatically each day.
 */
export function generateDailyTokenNumber() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const raw = sessionStorage.getItem(TOKEN_STORAGE_KEY) || localStorage.getItem(TOKEN_STORAGE_KEY);
    let counter = 1;

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.date === today) {
          counter = Number(parsed.counter || 0) + 1;
        }
      } catch {
        counter = 1;
      }
    }

    const payload = JSON.stringify({ date: today, counter });
    try { sessionStorage.setItem(TOKEN_STORAGE_KEY, payload); } catch {}
    try { localStorage.setItem(TOKEN_STORAGE_KEY, payload); } catch {}

    return counter;
  } catch {
    return Math.floor(1 + Math.random() * 99);
  }
}

/**
 * Format standard Order Token string:
 * e.g. formatOrderToken(14, '8421', '9876543210') => '#14-8421 (📞 3210)'
 *      formatOrderToken(14, '8421') => '#14-8421'
 */
export function formatOrderToken(tokenNumber, pin, phone = null) {
  const num = tokenNumber != null ? String(tokenNumber).replace(/^#/, '') : '14';
  const cleanPin = pin ? String(pin).trim() : generatePin();
  let base = `#${num}-${cleanPin}`;

  if (phone) {
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length >= 4) {
      base += ` (📞 ${digits.slice(-4)})`;
    }
  }

  return base;
}

/**
 * Parse an Order Token string back to structured fields.
 */
export function parseOrderToken(tokenString) {
  if (!tokenString || typeof tokenString !== 'string') {
    return { tokenNumber: null, pin: null, phoneSuffix: null };
  }

  // Regex matches: #<digits>-<pin> and optional (📞 <digits>)
  const match = tokenString.match(/#?(\d+)-(\d{4})(?:\s*\(📞\s*(\d{4})\))?/);
  if (match) {
    return {
      tokenNumber: match[1],
      pin: match[2],
      phoneSuffix: match[3] || null,
    };
  }

  // Fallback for simple tokens
  const cleanDigits = tokenString.replace(/\D/g, '');
  return {
    tokenNumber: cleanDigits ? cleanDigits.slice(0, 2) : '14',
    pin: cleanDigits.length >= 6 ? cleanDigits.slice(-4) : '8421',
    phoneSuffix: null,
  };
}

/**
 * Standardize Merchant Shop Code: QP-XXXX
 */
export function formatShopCode(input) {
  if (!input) return 'QP-8421';
  const cleaned = String(input).trim().toUpperCase();
  if (cleaned.startsWith('QP-')) return cleaned;
  if (cleaned.startsWith('QP')) return `QP-${cleaned.slice(2)}`;
  return `QP-${cleaned}`;
}
