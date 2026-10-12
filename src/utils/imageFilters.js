// src/utils/imageFilters.js

/**
 * High-Contrast Xerox Binarization Algorithm.
 * Whitens grey shadows/phone camera noise and sharpens text/signatures.
 * 
 * @param {Uint8ClampedArray|Array<number>} data - RGBA pixel array
 * @param {number} xeroxThreshold - Threshold between 10 and 245
 * @param {number} brightness - Optional brightness offset (-100 to 100)
 */
export function applyXeroxBinarization(data, xeroxThreshold = 145, brightness = 0) {
  const effectiveThreshold = Math.max(10, Math.min(245, xeroxThreshold - brightness * 0.5));
  const len = data.length;

  for (let i = 0; i < len; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    const a = data[i + 3];

    // Alpha blend over clean white if transparent
    if (a < 255) {
      const alpha = a / 255;
      r = Math.round(r * alpha + 255 * (1 - alpha));
      g = Math.round(g * alpha + 255 * (1 - alpha));
      b = Math.round(b * alpha + 255 * (1 - alpha));
    }

    // Standard human eye perceived luminance weights
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const val = lum >= effectiveThreshold ? 255 : 0;

    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
    data[i + 3] = 255;
  }
}

/**
 * Apply Grayscale, Brightness, and Contrast to RGBA pixel array.
 * 
 * @param {Uint8ClampedArray|Array<number>} data - RGBA pixel array
 * @param {object} options
 * @param {boolean} options.isGrayscale
 * @param {number} options.brightness - -100 to 100
 * @param {number} options.contrast - -100 to 100
 */
export function applyColorAdjustments(data, { isGrayscale = false, brightness = 0, contrast = 0 } = {}) {
  const len = data.length;
  const clampedContrast = Math.max(-100, Math.min(100, contrast));
  const contrastFactor =
    clampedContrast !== 0
      ? (259 * (clampedContrast + 255)) / (255 * (259 - clampedContrast))
      : 1;

  for (let i = 0; i < len; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    const a = data[i + 3];

    // Alpha blend over white if transparent
    if (a < 255) {
      const alpha = a / 255;
      r = Math.round(r * alpha + 255 * (1 - alpha));
      g = Math.round(g * alpha + 255 * (1 - alpha));
      b = Math.round(b * alpha + 255 * (1 - alpha));
    }

    if (isGrayscale) {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      r = lum;
      g = lum;
      b = lum;
    }

    if (brightness !== 0) {
      r = Math.min(255, Math.max(0, r + brightness));
      g = Math.min(255, Math.max(0, g + brightness));
      b = Math.min(255, Math.max(0, b + brightness));
    }

    if (clampedContrast !== 0) {
      r = Math.min(255, Math.max(0, contrastFactor * (r - 128) + 128));
      g = Math.min(255, Math.max(0, contrastFactor * (g - 128) + 128));
      b = Math.min(255, Math.max(0, contrastFactor * (b - 128) + 128));
    }

    data[i] = Math.round(r);
    data[i + 1] = Math.round(g);
    data[i + 2] = Math.round(b);
    data[i + 3] = 255;
  }
}

/**
 * Generate CSS filter preview string for real-time live preview.
 */
export function getCssFilterPreview(filterMode, brightness = 0, contrast = 0) {
  if (filterMode === 'xerox') {
    return `grayscale(100%) contrast(350%) brightness(${100 + brightness}%)`;
  }
  const parts = [];
  if (filterMode === 'grayscale') parts.push('grayscale(100%)');
  if (brightness !== 0) parts.push(`brightness(${100 + brightness}%)`);
  if (contrast !== 0) parts.push(`contrast(${100 + contrast}%)`);
  return parts.length > 0 ? parts.join(' ') : 'none';
}
