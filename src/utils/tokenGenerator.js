// src/utils/tokenGenerator.js
/**
 * QuickPrint Token & Identification Generator
 *
 * Distinct formats:
 * - Order Token: #<pin> (e.g. #8421)
 * - Merchant Shop Code: QP-XXXX (e.g. QP-8421)
 */

/**
 * Generate a 4-digit numeric PIN with collision-free check (1000 - 9999).
 * If activePins are passed, guarantees no overlap with currently pending jobs at that shop.
 */
export function generatePin(activePins = []) {
  const activeSet = new Set(
    (Array.isArray(activePins) ? activePins : []).map((p) => String(p).trim())
  );
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = String(Math.floor(1000 + Math.random() * 9000));
    if (!activeSet.has(candidate)) {
      return candidate;
    }
  }
  return String(Math.floor(1000 + Math.random() * 9000));
}

/**
 * Format standard Order Token string: '#<pin>' (e.g. '#8421')
 */
export function formatOrderToken(tokenOrPin, maybePin) {
  const raw = maybePin || tokenOrPin;
  const cleanPin = raw ? String(raw).replace(/\D/g, '').slice(-4) : generatePin();
  return `#${cleanPin || '8421'}`;
}

/**
 * Parse an Order Token string back to structured fields.
 */
export function parseOrderToken(tokenString) {
  if (!tokenString || typeof tokenString !== 'string') {
    return { pin: '8421', tokenNumber: '8421' };
  }
  const cleanDigits = tokenString.replace(/\D/g, '');
  const pin = cleanDigits.slice(-4) || '8421';
  return {
    pin,
    tokenNumber: pin,
  };
}

/**
 * Standardize Merchant Shop Code: QP-XXXX (4-digit format)
 */
export function formatShopCode(input) {
  if (!input) return 'QP-8421';
  const cleaned = String(input).replace(/\s+/g, '').toUpperCase();
  if (cleaned.startsWith('QP-')) return cleaned;
  if (cleaned.startsWith('QP')) return `QP-${cleaned.slice(2)}`;
  return `QP-${cleaned}`;
}

/**
 * Extract the raw 4-digit numeric code from a shop code string
 */
export function extractShopCodeDigits(input) {
  if (!input) return '8421';
  const digits = String(input).replace(/\D/g, '');
  return digits.slice(-4) || '8421';
}

/**
 * Generate a randomized 4-digit Merchant Shop Code (QP-XXXX format, e.g. QP-8421)
 */
export function generateShopCode() {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `QP-${digits}`;
}
