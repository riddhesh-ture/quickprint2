// src/utils/pdfRenderer.js

/**
 * Ensures PDF.js library is loaded and configured in the browser.
 */
let pdfjsLoadingPromise = null;

export async function ensurePdfJs() {
  if (typeof window === 'undefined') {
    throw new Error('PDF.js is only supported in browser environments');
  }

  if (window.pdfjsLib) {
    return window.pdfjsLib;
  }

  if (!pdfjsLoadingPromise) {
    pdfjsLoadingPromise = new Promise((resolve, reject) => {
      const existingScript = document.getElementById('quickprint-pdfjs');
      if (existingScript && window.pdfjsLib) {
        resolve(window.pdfjsLib);
        return;
      }

      const script = existingScript || document.createElement('script');
      script.id = 'quickprint-pdfjs';
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';

      const handleLoad = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          resolve(window.pdfjsLib);
        } else {
          reject(new Error('PDF.js failed to initialize'));
        }
      };

      const handleError = (e) => {
        pdfjsLoadingPromise = null;
        reject(e || new Error('Failed to load PDF.js script from CDN'));
      };

      script.addEventListener('load', handleLoad, { once: true });
      script.addEventListener('error', handleError, { once: true });

      if (!existingScript) {
        document.head.appendChild(script);
      }
    });
  }

  return pdfjsLoadingPromise;
}

/**
 * Loads a PDF document from a Blob or ArrayBuffer.
 * @param {Blob|ArrayBuffer|Uint8Array} source
 * @returns {Promise<{ pdfDoc: any, numPages: number, rawBuffer: ArrayBuffer }>}
 */
export async function loadPdfDocument(source) {
  const pdfjsLib = await ensurePdfJs();
  let arrayBuffer;

  if (source instanceof Blob) {
    arrayBuffer = await source.arrayBuffer();
  } else if (source instanceof ArrayBuffer) {
    arrayBuffer = source;
  } else if (source?.buffer instanceof ArrayBuffer) {
    arrayBuffer = source.buffer;
  } else {
    throw new Error('Invalid PDF source: expected Blob or ArrayBuffer');
  }

  // Clone buffer slice because PDF.js may transfer ArrayBuffers to its web worker
  const bufferCopy = arrayBuffer.slice(0);
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(bufferCopy),
    stopAtErrors: false,
  });

  const pdfDoc = await loadingTask.promise;
  return {
    pdfDoc,
    numPages: pdfDoc.numPages,
    rawBuffer: arrayBuffer,
  };
}

/**
 * Render a single PDF page into an HTML canvas element.
 * Safely cancels any active render task on the target canvas to avoid PDF.js concurrency errors.
 * @param {any} page - PDF.js page proxy
 * @param {HTMLCanvasElement} canvas - Target canvas
 * @param {object} options - { scale, rotation }
 */
export async function renderPdfPageToCanvas(page, canvas, { scale = 1.0, rotation = 0 } = {}) {
  if (!page || !canvas) return;

  // Cancel any prior in-progress render task on this canvas
  if (canvas._activeRenderTask) {
    try {
      canvas._activeRenderTask.cancel();
    } catch (_) {
      // Ignore cancellation exceptions from aborting prior render task
    }
    canvas._activeRenderTask = null;
  }

  const totalRotation = ((page.rotate || 0) + (rotation || 0)) % 360;
  const viewport = page.getViewport({ scale, rotation: totalRotation });

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);

  const renderContext = {
    canvasContext: context,
    viewport,
  };

  const renderTask = page.render(renderContext);
  canvas._activeRenderTask = renderTask;

  try {
    await renderTask.promise;
  } catch (err) {
    // Expected exception when a rapid page switch cancels the previous task
    if (err?.name === 'RenderingCancelledException') {
      return;
    }
    throw err;
  } finally {
    if (canvas._activeRenderTask === renderTask) {
      canvas._activeRenderTask = null;
    }
  }
}

/**
 * Generate a small thumbnail data URL for a PDF page.
 * @param {any} page - PDF.js page proxy
 * @param {number} maxDimension - Max width or height of thumbnail
 * @param {number} rotation - User rotation delta in degrees
 * @returns {Promise<string>} Data URL
 */
export async function renderPageThumbnailDataUrl(page, maxDimension = 140, rotation = 0) {
  const totalRotation = ((page.rotate || 0) + (rotation || 0)) % 360;
  const unscaledViewport = page.getViewport({ scale: 1.0, rotation: totalRotation });
  const scale = maxDimension / Math.max(unscaledViewport.width, unscaledViewport.height);
  const viewport = page.getViewport({ scale, rotation: totalRotation });

  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = Math.floor(viewport.width);
  offscreenCanvas.height = Math.floor(viewport.height);

  const context = offscreenCanvas.getContext('2d');
  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  return offscreenCanvas.toDataURL('image/jpeg', 0.85);
}

/**
 * Parse page range string (e.g. "1, 3-5, 8") to an array of 1-based page numbers.
 * @param {string} rangeStr
 * @param {number} totalPages
 * @returns {number[]} Sorted unique list of page numbers
 */
export function parsePageRangeString(rangeStr, totalPages = 1) {
  if (typeof rangeStr === 'string' && rangeStr.trim().toLowerCase() === 'none') {
    return [];
  }
  if (!rangeStr || typeof rangeStr !== 'string' || rangeStr.trim() === '' || rangeStr.trim().toLowerCase() === 'all') {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const clean = rangeStr.replace(/\s+/g, '');
  const parts = clean.split(',');
  const selected = new Set();

  for (const part of parts) {
    if (!part) continue;
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        const minP = Math.max(1, start);
        const maxP = Math.min(totalPages, end);
        for (let p = minP; p <= maxP; p++) {
          selected.add(p);
        }
      }
    } else {
      const p = parseInt(part, 10);
      if (!isNaN(p) && p >= 1 && p <= totalPages) {
        selected.add(p);
      }
    }
  }

  return Array.from(selected).sort((a, b) => a - b);
}

/**
 * Convert an array of 1-based page numbers to a readable range string (e.g. "1, 3-5, 8").
 * @param {number[]} pageNumbers
 * @param {number} totalPages
 * @returns {string}
 */
export function formatPageRangeString(pageNumbers, totalPages = 1) {
  if (!pageNumbers || pageNumbers.length === 0) return '';
  const sorted = [...new Set(pageNumbers)].sort((a, b) => a - b);

  if (sorted.length === totalPages && sorted[0] === 1 && sorted[sorted.length - 1] === totalPages) {
    return 'all';
  }

  const ranges = [];
  let rangeStart = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    if (current === prev + 1) {
      prev = current;
    } else {
      ranges.push(rangeStart === prev ? `${rangeStart}` : `${rangeStart}-${prev}`);
      rangeStart = current;
      prev = current;
    }
  }
  ranges.push(rangeStart === prev ? `${rangeStart}` : `${rangeStart}-${prev}`);

  return ranges.join(', ');
}
