// src/utils/recentShops.js

const STORAGE_KEY = 'quickprint_saved_shops';

/**
 * Safely parse JSON from localStorage
 */
function readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[recentShops] Failed to read from localStorage:', err);
    return [];
  }
}

/**
 * Safely persist JSON to localStorage
 */
function writeStorage(shops) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shops));
  } catch (err) {
    console.warn('[recentShops] Failed to write to localStorage:', err);
  }
}

/**
 * Get all saved/recent shops sorted: starred first, then most recently visited.
 */
export function getSavedShops() {
  const shops = readStorage();
  return shops.sort((a, b) => {
    if (a.isStarred && !b.isStarred) return -1;
    if (!a.isStarred && b.isStarred) return 1;
    return (b.lastVisited || 0) - (a.lastVisited || 0);
  });
}

/**
 * Add or update a shop in recent shops
 */
export function recordShopVisit(shop) {
  if (!shop || !shop.id) return;

  const shops = readStorage();
  const existingIndex = shops.findIndex(s => s.id === shop.id);
  const now = Date.now();

  if (existingIndex >= 0) {
    const existing = shops[existingIndex];
    shops[existingIndex] = {
      ...existing,
      ...shop,
      shopCode: shop.shopCode || existing.shopCode || null,
      shopName: shop.shopName || existing.shopName || 'Print Shop',
      city: shop.city || existing.city || '',
      isStarred: existing.isStarred || false,
      lastVisited: now
    };
  } else {
    shops.unshift({
      id: shop.id,
      shopCode: shop.shopCode || null,
      shopName: shop.shopName || 'Print Shop',
      city: shop.city || '',
      isStarred: false,
      lastVisited: now
    });
  }

  // Keep up to 10 most recent shops
  const trimmed = shops.slice(0, 10);
  writeStorage(trimmed);
  return getSavedShops();
}

/**
 * Toggle starred status for a shop
 */
export function toggleStarShop(shopId) {
  const shops = readStorage();
  const index = shops.findIndex(s => s.id === shopId);
  if (index >= 0) {
    shops[index].isStarred = !shops[index].isStarred;
    writeStorage(shops);
  }
  return getSavedShops();
}

/**
 * Remove a shop from recent shops
 */
export function removeSavedShop(shopId) {
  const shops = readStorage();
  const filtered = shops.filter(s => s.id !== shopId);
  writeStorage(filtered);
  return getSavedShops();
}
