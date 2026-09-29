// src/utils/securePrint.js
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
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
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

/**
 * Securely print an Image file using ObjectURL (zero base64 overhead)
 */
export async function securePrintImage(fileBlob, fileName, specs, merchantName, existingWindow = null) {
  const blobUrl = URL.createObjectURL(fileBlob);
  const isColor = specs?.color === 'color';
  const safeFileName = escapeHtml(fileName);
  const safeMerchant = escapeHtml(merchantName);

  return new Promise((resolve) => {
    let targetDoc = null;
    let targetWin = null;
    let iframeElem = null;

    if (existingWindow && !existingWindow.closed) {
      targetWin = existingWindow;
      targetDoc = existingWindow.document;
    } else {
      // Use hidden iframe fallback to guarantee popup-blocker bypass
      iframeElem = createPrintIframe();
      targetWin = iframeElem.contentWindow;
      targetDoc = targetWin.document;
    }

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
          window.onafterprint = function() {
            try { URL.revokeObjectURL('${blobUrl}'); } catch(e) {}
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
            try { URL.revokeObjectURL('${blobUrl}'); } catch(e) {}
          });
        </script>
      </body>
      </html>
    `;

    targetDoc.open();
    targetDoc.write(html);
    targetDoc.close();

    // Event-driven cleanup: revoke ObjectURL and remove iframe when printing completes
    const cleanup = () => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch (e) {
        /* ignore revocation error if already revoked */
      }
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

    // Safety timeout fallback if browser does not fire afterprint (e.g. headless/sandboxed)
    setTimeout(finish, 45000);
  });
}

/**
 * Securely print a PDF file using PDF.js and clean Object URLs (no atob / memory bloat)
 */
export async function securePrintPDF(fileBlob, fileName, specs, merchantName, existingWindow = null) {
  const blobUrl = URL.createObjectURL(fileBlob);
  const isColor = specs?.color === 'color';
  const safeFileName = escapeHtml(fileName);
  const safeMerchant = escapeHtml(merchantName);

  return new Promise((resolve) => {
    let targetDoc = null;
    let targetWin = null;
    let iframeElem = null;

    if (existingWindow && !existingWindow.closed) {
      targetWin = existingWindow;
      targetDoc = existingWindow.document;
    } else {
      iframeElem = createPrintIframe();
      targetWin = iframeElem.contentWindow;
      targetDoc = targetWin.document;
    }

    const printId = 'ppdf_' + Math.random().toString(36).slice(2);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print - ${safeFileName}</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
        <style>
          ${SECURITY_CSS}
          canvas {
            ${!isColor ? 'filter: grayscale(100%);' : ''}
            display: block;
            margin: 10px auto;
            max-width: 100%;
          }
          @media print {
            canvas {
              page-break-after: always;
              page-break-inside: avoid;
            }
          }
          #pages { width: 100%; }
        </style>
      </head>
      <body>
        ${generateWatermarkHTML(safeMerchant)}
        <div id="pages"></div>
        <script>
          ${SECURITY_SCRIPT}
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          
          async function renderAndPrint() {
            try {
              const pdf = await pdfjsLib.getDocument('${blobUrl}').promise;
              const container = document.getElementById('pages');
              
              for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 1.5 });
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                container.appendChild(canvas);
                await page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
              }

              setTimeout(function() {
                window.focus();
                window.print();
              }, 400);
            } catch (err) {
              console.error('PDF print error:', err);
              document.body.innerHTML = '<p style="color:red;padding:20px;">Failed to render PDF for printing.</p>';
            }
          }

          renderAndPrint();

          window.onafterprint = function() {
            try { URL.revokeObjectURL('${blobUrl}'); } catch(e) {}
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
            try { URL.revokeObjectURL('${blobUrl}'); } catch(e) {}
          });
        </script>
      </body>
      </html>
    `;

    targetDoc.open();
    targetDoc.write(html);
    targetDoc.close();

    // Event-driven cleanup: revoke ObjectURL and remove iframe when printing completes
    const cleanup = () => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch (e) {
        /* ignore revocation error if already revoked */
      }
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

    // Safety timeout fallback if browser does not fire afterprint (e.g. headless/sandboxed)
    setTimeout(finish, 45000);
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
    let targetDoc = null;
    let targetWin = null;
    let iframeElem = null;

    if (existingWindow && !existingWindow.closed) {
      targetWin = existingWindow;
      targetDoc = existingWindow.document;
    } else {
      iframeElem = createPrintIframe();
      targetWin = iframeElem.contentWindow;
      targetDoc = targetWin.document;
    }

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

          window.onafterprint = function() {
            try { URL.revokeObjectURL('${blobUrl}'); } catch(e) {}
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
            try { URL.revokeObjectURL('${blobUrl}'); } catch(e) {}
          });
        </script>
      </body>
      </html>
    `;

    targetDoc.open();
    targetDoc.write(html);
    targetDoc.close();

    // Event-driven cleanup: revoke ObjectURL and remove iframe when printing completes
    const cleanup = () => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch (e) {
        /* ignore revocation error if already revoked */
      }
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

    // Safety timeout fallback if browser does not fire afterprint (e.g. headless/sandboxed)
    setTimeout(finish, 45000);
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