// src/utils/pdfSlicer.js
import { PDFDocument } from 'pdf-lib';

/**
 * Slices a PDF Blob to extract only a specific subset of pages
 * (e.g. 'odd' for pages 1, 3, 5... or 'even' for pages 2, 4, 6...).
 * Used for universal mobile duplex printing on single-sided counter printers.
 *
 * @param {Blob} pdfBlob - Source PDF Blob
 * @param {'odd' | 'even' | number[]} filter - Subset mode or array of 1-based page numbers
 * @returns {Promise<Blob>} - Sliced PDF Blob
 */
export async function slicePdfPages(pdfBlob, filter = 'odd') {
  if (!pdfBlob) return null;

  try {
    const arrayBuffer = await pdfBlob.arrayBuffer();
    const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    const totalPages = srcDoc.getPageCount();

    if (totalPages <= 1) {
      return pdfBlob; // Single-page documents don't need slicing
    }

    let targetIndices = [];

    if (filter === 'odd') {
      // 0-indexed: 0 = Page 1, 2 = Page 3, 4 = Page 5...
      for (let i = 0; i < totalPages; i += 2) {
        targetIndices.push(i);
      }
    } else if (filter === 'even') {
      // 0-indexed: 1 = Page 2, 3 = Page 4, 5 = Page 6...
      for (let i = 1; i < totalPages; i += 2) {
        targetIndices.push(i);
      }
    } else if (Array.isArray(filter)) {
      targetIndices = filter
        .map((p) => p - 1)
        .filter((idx) => idx >= 0 && idx < totalPages);
    } else {
      return pdfBlob;
    }

    if (targetIndices.length === 0) {
      return pdfBlob;
    }

    const outDoc = await PDFDocument.create();
    const copiedPages = await outDoc.copyPages(srcDoc, targetIndices);
    copiedPages.forEach((page) => outDoc.addPage(page));

    const savedBytes = await outDoc.save();
    return new Blob([savedBytes], { type: 'application/pdf' });
  } catch (err) {
    console.warn('[pdfSlicer] Slicing fallback to original:', err);
    return pdfBlob;
  }
}

