// src/utils/fileValidation.js

// Allowed file types with their MIME types and extensions
export const ALLOWED_FILE_TYPES = {
  // PDFs
  'application/pdf': { ext: 'pdf', name: 'PDF Document' },
  
  // Images
  'image/jpeg': { ext: 'jpg', name: 'JPEG Image' },
  'image/jpg': { ext: 'jpg', name: 'JPEG Image' },
  'image/png': { ext: 'png', name: 'PNG Image' },
  'image/webp': { ext: 'webp', name: 'WebP Image' },
  
  // Word Documents
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: 'docx', name: 'Word Document' },
  'application/msword': { ext: 'doc', name: 'Word Document (Legacy)' },
};

export const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx'];

// Size thresholds
export const REALTIME_MAX_SIZE = 25 * 1024 * 1024; // 25MB threshold for Cloudflare DO real-time fast lane
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB hard maximum limit per file
export const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB hard maximum limit per job

/**
 * Validate a single file
 */
export function validateFile(file) {
  const errors = [];
  
  if (!file) {
    return { valid: false, errors: ['No file provided'] };
  }

  // Check file size (50MB hard limit)
  if (file.size > MAX_FILE_SIZE) {
    errors.push(`File "${file.name}" exceeds maximum allowed size of 50MB`);
  }

  // Check file type by MIME and extension
  const mimeType = (file.type || '').toLowerCase();
  const extension = file.name.split('.').pop()?.toLowerCase();

  // Validate MIME type or extension
  const isMimeAllowed = Boolean(ALLOWED_FILE_TYPES[mimeType]);
  const isExtAllowed = ALLOWED_EXTENSIONS.includes(extension);

  if (!isMimeAllowed && !isExtAllowed) {
    errors.push(`File "${file.name}" has unsupported format. Allowed: PDF, Images (JPG, PNG, WebP), Word (DOC, DOCX)`);
  }

  return {
    valid: errors.length === 0,
    errors,
    fileType: getFileCategory(file),
  };
}

/**
 * Validate multiple files
 */
export function validateFiles(files) {
  const results = {
    valid: true,
    errors: [],
    validFiles: [],
    totalSize: 0,
  };

  if (!files || files.length === 0) {
    return { valid: false, errors: ['No files selected'], validFiles: [], totalSize: 0 };
  }

  let totalSize = 0;

  for (const file of files) {
    const validation = validateFile(file);
    totalSize += file.size;

    if (validation.valid) {
      results.validFiles.push(file);
    } else {
      results.errors.push(...validation.errors);
      results.valid = false;
    }
  }

  // Check total size
  if (totalSize > MAX_TOTAL_SIZE) {
    results.errors.push(`Total files size (${formatFileSize(totalSize)}) exceeds maximum 50MB limit`);
    results.valid = false;
  }

  results.totalSize = totalSize;
  return results;
}

/**
 * Get file category (pdf, image, document)
 */
export function getFileCategory(file) {
  const mimeType = file.type?.toLowerCase() || '';
  const extension = file.name?.split('.').pop()?.toLowerCase() || '';

  if (mimeType === 'application/pdf' || extension === 'pdf') {
    return 'pdf';
  }
  
  if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
    return 'image';
  }
  
  if (mimeType.includes('wordprocessingml') || mimeType === 'application/msword' || ['doc', 'docx'].includes(extension)) {
    return 'document';
  }

  return 'unknown';
}

/**
 * Get human-readable file type name
 */
export function getFileTypeName(file) {
  const mimeType = file.type?.toLowerCase();
  if (ALLOWED_FILE_TYPES[mimeType]) {
    return ALLOWED_FILE_TYPES[mimeType].name;
  }
  
  const category = getFileCategory(file);
  switch (category) {
    case 'pdf': return 'PDF Document';
    case 'image': return 'Image';
    case 'document': return 'Word Document';
    default: return 'Unknown';
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get accept string for file input
 */
export function getAcceptString() {
  return 'application/pdf,image/jpeg,image/png,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx';
}

/**
 * Parse page range string (e.g., "1-5", "1,3,5", "all", or "") against total document pages
 * @param {number} totalDocumentPages
 * @param {string} pagesSpec
 * @returns {number} Number of billable pages selected
 */
export function calculateBillablePages(totalDocumentPages = 1, pagesSpec = '') {
  if (!pagesSpec || typeof pagesSpec !== 'string' || pagesSpec.trim() === '' || pagesSpec.trim().toLowerCase() === 'all') {
    return Math.max(1, totalDocumentPages || 1);
  }

  const clean = pagesSpec.replace(/\s+/g, '');
  const parts = clean.split(',');
  const selectedPages = new Set();

  for (const part of parts) {
    if (!part) continue;
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        const minP = Math.max(1, start);
        const maxP = totalDocumentPages ? Math.min(totalDocumentPages, end) : end;
        for (let p = minP; p <= maxP; p++) {
          selectedPages.add(p);
        }
      }
    } else {
      const p = parseInt(part, 10);
      if (!isNaN(p) && p >= 1 && (!totalDocumentPages || p <= totalDocumentPages)) {
        selectedPages.add(p);
      }
    }
  }

  return selectedPages.size > 0 ? selectedPages.size : Math.max(1, totalDocumentPages || 1);
}

/**
 * Accurately detect the page count of a PDF file using binary inspection and fallback
 * @param {File|Blob} file
 * @returns {Promise<number>}
 */
export async function getPdfPageCount(file) {
  if (!file) return 1;

  try {
    const decoder = new TextDecoder('latin1');
    const fileSize = file.size || 0;

    // Fast-path 1: Check header and trailer chunks (first 64KB & last 64KB)
    // Avoids loading 50MB into memory strings
    const checkChunk = async (blobSlice) => {
      const buf = await blobSlice.arrayBuffer();
      const text = decoder.decode(new Uint8Array(buf));
      const countMatches = [...text.matchAll(/\/Type\s*\/Pages[\s\S]{0,1000}?\/Count\s+(\d+)/g)];
      if (countMatches.length > 0) {
        const counts = countMatches
          .map(m => parseInt(m[1], 10))
          .filter(n => !isNaN(n) && n > 0);
        if (counts.length > 0) return Math.max(...counts);
      }
      return null;
    };

    // Check first 64KB
    const startSlice = file.slice(0, Math.min(fileSize, 65536));
    let detected = await checkChunk(startSlice);
    if (detected && detected > 0) return detected;

    // Check last 64KB if file is larger than 64KB
    if (fileSize > 65536) {
      const endSlice = file.slice(Math.max(0, fileSize - 65536), fileSize);
      detected = await checkChunk(endSlice);
      if (detected && detected > 0) return detected;
    }

    // Fast-path 2: If small file (<= 512KB), inspect full text
    if (fileSize <= 524288) {
      const fullBuf = await file.arrayBuffer();
      const fullText = decoder.decode(new Uint8Array(fullBuf));
      const pageMatches = fullText.match(/\/Type\s*\/Page\b/g);
      if (pageMatches && pageMatches.length > 0) {
        return pageMatches.length;
      }
    }

    // High-accuracy fallback: PDF.js streaming via Object URL (zero full-string allocations)
    if (typeof window !== 'undefined') {
      try {
        if (!window.pdfjsLib) {
          if (!window._pdfjsLoadPromise) {
            window._pdfjsLoadPromise = new Promise((resolve, reject) => {
              if (document.getElementById('quickprint-pdfjs')) {
                resolve();
                return;
              }
              const script = document.createElement('script');
              script.id = 'quickprint-pdfjs';
              script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
              script.onload = () => resolve();
              script.onerror = (e) => {
                window._pdfjsLoadPromise = null;
                reject(e);
              };
              document.head.appendChild(script);
            });
          }
          await window._pdfjsLoadPromise;
        }

        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          const fileUrl = URL.createObjectURL(file);
          try {
            const loadingTask = window.pdfjsLib.getDocument(fileUrl);
            const pdfDoc = await loadingTask.promise;
            const numPages = pdfDoc.numPages || 1;
            loadingTask.destroy();
            return numPages;
          } finally {
            URL.revokeObjectURL(fileUrl);
          }
        }
      } catch (pdfErr) {
        console.warn('PDF.js streaming fallback error:', pdfErr);
      }
    }
  } catch (err) {
    console.warn('Error detecting PDF page count:', err);
  }

  return 1;
}