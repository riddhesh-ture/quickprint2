// src/utils/printDaemonClient.js
/**
 * QuickPrint Local Print Daemon Client
 * Connects the React browser dashboard directly to the local Node.js print daemon on port 9123.
 */

const DAEMON_PORT = 9123;
export const DAEMON_BASE_URL =
  import.meta.env?.VITE_PRINT_DAEMON_URL || `http://127.0.0.1:${DAEMON_PORT}`;

const STORAGE_KEY_PREFERRED_PRINTER = 'quickprint_preferred_printer';

/**
 * Convert a browser Blob or File into a pure base64 string
 * (without the 'data:...;base64,' header prefix)
 */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Url = reader.result;
      if (typeof base64Url !== 'string') {
        reject(new Error('Failed to encode file to base64'));
        return;
      }
      const commaIndex = base64Url.indexOf(',');
      resolve(commaIndex >= 0 ? base64Url.slice(commaIndex + 1) : base64Url);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(blob);
  });
}

/**
 * Probe the local print daemon with a quick timeout.
 * Returns { online: boolean, info?: object, error?: string }
 */
export async function checkDaemonHealth(timeoutMs = 1800) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${DAEMON_BASE_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const info = await res.json();
      return { online: true, info };
    }
    return { online: false, error: `HTTP ${res.status}` };
  } catch (err) {
    clearTimeout(timeoutId);
    return { online: false, error: err.name === 'AbortError' ? 'Probe timeout' : err.message };
  }
}

/**
 * Fetch installed OS printers and the system default printer.
 */
export async function fetchInstalledPrinters(timeoutMs = 3500) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${DAEMON_BASE_URL}/printers`, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Failed to fetch printers: HTTP ${res.status}`);
    }

    const data = await res.json();
    return {
      printers: data.printers || [],
      defaultPrinter: data.defaultPrinter || null,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Send a document payload to the local daemon for silent OS driver printing.
 */
export async function sendSilentPrintJob({
  jobId,
  token,
  fileBlob,
  fileName = 'document.pdf',
  specs = {},
  printerName = null,
}) {
  if (!fileBlob) {
    throw new Error('Cannot print: Document blob is empty or missing');
  }

  const base64Data = await blobToBase64(fileBlob);
  const copies = parseInt(specs.copies, 10) || 1;
  const isDuplex = Boolean(specs.duplex || specs.sides === 'double');
  const duplexMode = isDuplex ? 'long' : 'simplex';
  const colorMode = specs.color === 'color' ? 'color' : 'bw';

  const payload = {
    jobId: String(jobId),
    token: String(token || ''),
    printerName: printerName || getStoredPrinter() || undefined,
    copies,
    duplex: duplexMode,
    color: colorMode,
    paperSize: specs.paperSize || 'A4',
    pages: specs.pages || 'all',
    fileBuffer: base64Data,
    fileName,
  };

  const res = await fetch(`${DAEMON_BASE_URL}/print`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `Local print daemon error (HTTP ${res.status})`);
  }

  return await res.json();
}

/**
 * Check the status of a specific job on the local spooler.
 */
export async function getJobSpoolStatus(jobId) {
  try {
    const res = await fetch(`${DAEMON_BASE_URL}/status/${jobId}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_e) {
    return null;
  }
}

/**
 * Persistent preferences for counter printer
 */
export function getStoredPrinter() {
  try {
    return localStorage.getItem(STORAGE_KEY_PREFERRED_PRINTER) || null;
  } catch (_e) {
    return null;
  }
}

export function setStoredPrinter(printerName) {
  try {
    if (printerName) {
      localStorage.setItem(STORAGE_KEY_PREFERRED_PRINTER, printerName);
    } else {
      localStorage.removeItem(STORAGE_KEY_PREFERRED_PRINTER);
    }
  } catch (_e) {
    // LocalStorage access might be restricted in some browser security contexts
  }
}
