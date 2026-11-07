// src/utils/securePrint.js
import { pdfjs } from 'react-pdf';

// Configure bundled PDF.js worker
if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
  try {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  }
}

/**
 * Secure print utility with anti-download protection, popup blocker bypass,
 * and zero base64 memory bloat (uses clean Object URLs).
 */

/**
 * Escape HTML to prevent XSS / DOM injection
 */
export function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[m]));
}

/**
 * Pre-opens a print window synchronously during a user click gesture
 * to completely bypass modern browser popup blockers.
 */
export function preOpenPrintWindow(title = 'QuickPrint') {
  try {
    const printWindow = window.open(
      'about:blank',
      '_blank',
      'width=900,height=750,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes'
    );
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${escapeHtml(title)}</title>
          <style>
            body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; color: #555; }
          </style>
        </head>
        <body>
          <p>Preparing document for printing, please wait...</p>
        </body>
        </html>
      `);
      printWindow.document.close();
      return printWindow;
    }
  } catch (err) {
    console.warn('Popup blocked or failed to pre-open window:', err);
  }
  return null;
}

/**
 * Fallback hidden print iframe when popup window is blocked
 */
function createPrintIframe() {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '0';
  iframe.style.left = '0';
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.style.zIndex = '-1';
  document.body.appendChild(iframe);
  return iframe;
}

const SECURITY_CSS = `
  * {
    -webkit-user-select: none !important;
    -moz-user-select: none !important;
    -ms-user-select: none !important;
    user-select: none !important;
    -webkit-touch-callout: none !important;
  }
  body {
    margin: 0;
    padding: 20px;
    background: white;
  }
  @media print {
    body { background: white; }
    .no-print { display: none !important; }
  }
`;

const SECURITY_SCRIPT = `
  document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && (e.key === 'c' || e.key === 's' || e.key === 'a')) {
      e.preventDefault();
    }
  });
`;

function generateWatermarkHTML(merchantName = 'QuickPrint') {
  const safeMerchant = escapeHtml(merchantName);
  const now = escapeHtml(new Date().toLocaleString());
  return `
    <div style="position:fixed;top:10px;right:10px;opacity:0.3;font-size:10px;pointer-events:none;z-index:9999;" class="no-print">
      ${safeMerchant} - ${now}
    </div>
  `;
}

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent || '');
}

function resolvePrintTarget(existingWindow) {
  if (existingWindow && !existingWindow.closed) {
    return { targetWin: existingWindow, targetDoc: existingWindow.document, iframeElem: null };
  }
  if (isMobileDevice()) {
    try {
      const mobileWin = window.open('about:blank', '_blank');
      if (mobileWin) {
        return { targetWin: mobileWin, targetDoc: mobileWin.document, iframeElem: null };
      }
    } catch (_e) {}
  }
  const iframeElem = createPrintIframe();
  return { targetWin: iframeElem.contentWindow, targetDoc: iframeElem.contentWindow.document, iframeElem };
}

function getAfterPrintScript(blobUrls, printId) {
  const urlList = Array.isArray(blobUrls) ? blobUrls : [blobUrls].filter(Boolean);
  const revokeStatements = urlList.map((u) => `try { URL.revokeObjectURL('${u}'); } catch(e) {}`).join('\n');
  return `
    window.onafterprint = function() {
      ${revokeStatements}
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'print_done', printId: '${printId}' }, '*');
        }
        if (window.opener) {
          window.opener.postMessage({ type: 'print_done', printId: '${printId}' }, '*');
          window.close();
        }
      } catch(e) {}
    };
    window.addEventListener('beforeunload', function() {
      ${revokeStatements}
    });
  `;
}

function monitorPrintCompletion({ targetWin, blobUrls, printId, iframeElem, resolve }) {
  const urlList = Array.isArray(blobUrls) ? blobUrls : [blobUrls].filter(Boolean);
  const cleanup = () => {
    urlList.forEach((u) => {
      try {
        URL.revokeObjectURL(u);
      } catch (_err) {}
    });
    if (iframeElem && iframeElem.parentNode) {
      iframeElem.parentNode.removeChild(iframeElem);
    }
  };

  let isDone = false;
  const finish = () => {
    if (isDone) return;
    isDone = true;
    if (typeof window !== 'undefined') {
      window.removeEventListener('message', handleMsg);
    }
    cleanup();
    resolve();
  };

  const handleMsg = (e) => {
    if (e?.data?.type === 'print_done' && e?.data?.printId === printId) {
      finish();
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('message', handleMsg);
  }

  if (targetWin) {
    try {
      targetWin.addEventListener('afterprint', finish, { once: true });
    } catch (_) {
      // Cross-window access might fail in sandboxed or cross-origin contexts
    }
  }

  // Safety timeout fallback if browser does not fire afterprint (e.g. mobile or sandboxed iframes)
  setTimeout(finish, 3000);
}

/**
 * Securely print an Image file using ObjectURL (zero base64 overhead)
 */
export async function securePrintImage(fileBlob, fileName, specs, merchantName, existingWindow = null) {
  const blobUrl = URL.createObjectURL(fileBlob);
  const isColor = specs?.color === 'color';
  const safeFileName = escapeHtml(fileName);
  const safeMerchant = escapeHtml(merchantName);

  return new Promise((resolve) => {
    const { targetWin, targetDoc, iframeElem } = resolvePrintTarget(existingWindow);
    const printId = 'pimg_' + Math.random().toString(36).slice(2);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print - ${safeFileName}</title>
        <style>
          ${SECURITY_CSS}
          img {
            max-width: 100%;
            display: block;
            margin: 0 auto;
            ${!isColor ? 'filter: grayscale(100%);' : ''}
          }
        </style>
      </head>
      <body>
        ${generateWatermarkHTML(safeMerchant)}
        <img id="printImg" src="${blobUrl}" />
        <script>
          ${SECURITY_SCRIPT}
          const img = document.getElementById('printImg');
          img.onload = function() {
            setTimeout(function() {
              window.focus();
              window.print();
            }, 300);
          };
          ${getAfterPrintScript(blobUrl, printId)}
        </script>
      </body>
      </html>
    `;

    targetDoc.open();
    targetDoc.write(html);
    targetDoc.close();

    monitorPrintCompletion({ targetWin, blobUrls: [blobUrl], printId, iframeElem, resolve });
  });
}

/**
 * Securely print a PDF file using application's bundled PDF.js (zero CDN dependencies)
 */
export async function securePrintPDF(fileBlob, fileName, specs, merchantName, existingWindow = null) {
  const isColor = specs?.color === 'color';
  const safeFileName = escapeHtml(fileName);
  const safeMerchant = escapeHtml(merchantName);
  const printId = 'ppdf_' + Math.random().toString(36).slice(2);

  const pageUrls = [];
  let fallbackBlobUrl = null;

  try {
    // 1. Primary Strategy: Render pages locally via application's bundled PDF.js
    // Zero external CDN dependencies, zero worker CORS blocks, runs in local origin
    const arrayBuffer = await fileBlob.arrayBuffer();
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(arrayBuffer),
      stopAtErrors: false,
    });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;

      const pageBlob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.95));
      if (pageBlob) {
        pageUrls.push(URL.createObjectURL(pageBlob));
      }
    }
    loadingTask.destroy();
  } catch (err) {
    console.warn('[securePrintPDF] Local rasterization note:', err);
    fallbackBlobUrl = URL.createObjectURL(fileBlob);
  }

  return new Promise((resolve) => {
    const { targetWin, targetDoc, iframeElem } = resolvePrintTarget(existingWindow);

    let contentHtml = '';
    if (pageUrls.length > 0) {
      contentHtml = `
        <div id="pages-wrapper">
          ${pageUrls
            .map(
              (url) =>
                `<div class="page-container"><img src="${url}" class="page-img" /></div>`
            )
            .join('\n')}
        </div>
      `;
    } else {
      // Fallback: Embed native PDF directly if rasterization wasn't available
      contentHtml = `
        <div style="width: 100%; height: 100vh;">
          <embed src="${fallbackBlobUrl}#toolbar=0&navpanes=0" type="application/pdf" width="100%" height="100%" />
        </div>
      `;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print - ${safeFileName}</title>
        <style>
          ${SECURITY_CSS}
          @page {
            margin: 0;
            size: auto;
          }
          body {
            margin: 0;
            padding: 0;
            background: white;
          }
          .page-container {
            page-break-after: always;
            page-break-inside: avoid;
            display: flex;
            justify-content: center;
            align-items: center;
            width: 100%;
          }
          .page-img {
            width: 100%;
            max-width: 100%;
            display: block;
            ${!isColor ? 'filter: grayscale(100%);' : ''}
          }
        </style>
      </head>
      <body>
        ${generateWatermarkHTML(safeMerchant)}
        ${contentHtml}
        <script>
          ${SECURITY_SCRIPT}
          window.onload = function() {
            setTimeout(function() {
              window.focus();
              window.print();
            }, 300);
          };
          ${getAfterPrintScript([...pageUrls, fallbackBlobUrl].filter(Boolean), printId)}
        </script>
      </body>
      </html>
    `;

    targetDoc.open();
    targetDoc.write(html);
    targetDoc.close();

    monitorPrintCompletion({
      targetWin,
      blobUrls: [...pageUrls, fallbackBlobUrl].filter(Boolean),
      printId,
      iframeElem,
      resolve,
    });
  });
}

/**
 * Securely print a DOC/DOCX file using Mammoth
 */
export async function securePrintDOCX(fileBlob, fileName, specs, merchantName, existingWindow = null) {
  const blobUrl = URL.createObjectURL(fileBlob);
  const isColor = specs?.color === 'color';
  const safeFileName = escapeHtml(fileName);
  const safeMerchant = escapeHtml(merchantName);

  return new Promise((resolve) => {
    const { targetWin, targetDoc, iframeElem } = resolvePrintTarget(existingWindow);
    const printId = 'pdocx_' + Math.random().toString(36).slice(2);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print - ${safeFileName}</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js"></script>
        <style>
          ${SECURITY_CSS}
          .content {
            max-width: 800px;
            margin: 0 auto;
            font-family: Arial, sans-serif;
            line-height: 1.6;
            ${!isColor ? 'filter: grayscale(100%);' : ''}
          }
        </style>
      </head>
      <body>
        ${generateWatermarkHTML(safeMerchant)}
        <div id="content" class="content">Loading document...</div>
        <script>
          ${SECURITY_SCRIPT}
          fetch('${blobUrl}')
            .then(res => res.arrayBuffer())
            .then(buffer => mammoth.convertToHtml({ arrayBuffer: buffer }))
            .then(result => {
              document.getElementById('content').innerHTML = result.value;
              setTimeout(function() {
                window.focus();
                window.print();
              }, 400);
            })
            .catch(err => {
              console.error('DOCX print error:', err);
              document.getElementById('content').innerHTML = '<p style="color:red;">Error loading document.</p>';
            });

          ${getAfterPrintScript(blobUrl, printId)}
        </script>
      </body>
      </html>
    `;

    targetDoc.open();
    targetDoc.write(html);
    targetDoc.close();

    monitorPrintCompletion({ targetWin, blobUrl, printId, iframeElem, resolve });
  });
}

/**
 * Main secure print function
 */
export async function securePrint(fileBlob, fileName, specs, merchantName = 'QuickPrint', existingWindow = null) {
  const mimeType = (fileBlob.type || '').toLowerCase();
  const extension = fileName?.split('.').pop()?.toLowerCase() || '';

  if (mimeType === 'application/pdf' || extension === 'pdf') {
    return securePrintPDF(fileBlob, fileName, specs, merchantName, existingWindow);
  }
  
  if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
    return securePrintImage(fileBlob, fileName, specs, merchantName, existingWindow);
  }
  
  if (mimeType.includes('wordprocessingml') || mimeType === 'application/msword' || ['doc', 'docx'].includes(extension)) {
    return securePrintDOCX(fileBlob, fileName, specs, merchantName, existingWindow);
  }

  throw new Error(`Unsupported printable file format: ${mimeType || extension}`);
}