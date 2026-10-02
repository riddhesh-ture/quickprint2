// src/utils/iconHelper.js
/**
 * Unwraps CommonJS module default exports for Vite 8 / Rolldown ESM interop.
 * In Vite 8, CommonJS modules like @mui/icons-material may be wrapped in { default: Component }.
 */
export const unwrapIcon = (icon) => {
  if (!icon) return () => null;
  const unwrapped = icon.default ? (icon.default.default || icon.default) : icon;
  return unwrapped || (() => null);
};
