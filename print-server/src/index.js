// print-server/src/index.js
import express from 'express';
import cors from 'cors';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { getSystemPrinters, spoolToPrinter } from './spooler.js';

const app = express();
const PORT = process.env.PORT || 9123;

// Configure CORS for QuickPrint web client
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isAllowedLocal =
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        origin.endsWith('.quickprint.pages.dev') ||
        origin.endsWith('.pages.dev');

      if (isAllowedLocal || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(null, true); // Permissive for local hardware daemon
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Ingest large print buffers (support up to 50MB base64 JSON payload)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// In-memory job state tracking with auto-cleanup (TTL: 15 minutes)
const jobStatuses = new Map();

function recordJobStatus(jobId, status, details = {}) {
  jobStatuses.set(jobId, {
    status,
    timestamp: Date.now(),
    ...details,
  });
}

setInterval(() => {
  const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
  for (const [id, info] of jobStatuses.entries()) {
    if (info.timestamp < fifteenMinutesAgo) {
      jobStatuses.delete(id);
    }
  }
}, 5 * 60 * 1000).unref();

// Ensure temporary spool directory exists in OS temp
const SPOOL_DIR = path.join(os.tmpdir(), 'quickprint-spool');
try {
  if (!fs.existsSync(SPOOL_DIR)) {
    fs.mkdirSync(SPOOL_DIR, { recursive: true });
  }
} catch (err) {
  console.warn('Notice: Could not pre-create spool directory:', err.message);
}

/**
 * GET /health
 * Daemon health check and runtime discovery
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'quickprint-daemon',
    version: '1.0.0',
    platform: process.platform,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /printers
 * Returns list of installed OS printers, default printer, and capabilities
 */
app.get('/printers', async (req, res) => {
  try {
    const result = await getSystemPrinters();
    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('Failed to enumerate printers:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      printers: [],
      defaultPrinter: null,
    });
  }
});

/**
 * POST /print
 * Ingests a document buffer and print specs, silently spooling directly to hardware
 */
app.post('/print', async (req, res) => {
  const {
    jobId,
    token,
    printerName,
    copies = 1,
    duplex = 'simplex',
    color = 'bw',
    paperSize = 'A4',
    pages = 'all',
    fileBuffer,
    fileName = 'document.pdf',
  } = req.body || {};

  if (!jobId) {
    return res.status(400).json({ success: false, error: 'Missing required field: "jobId"' });
  }

  if (!fileBuffer) {
    return res.status(400).json({ success: false, error: 'Missing required field: "fileBuffer" (base64 string)' });
  }

  recordJobStatus(jobId, 'spooling', {
    token,
    fileName,
    printerName,
  });

  // Zero-retention ephemeral temp file path
  const sanitizedFileName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const tempFilePath = path.join(SPOOL_DIR, `spool_${Date.now()}_${jobId}_${sanitizedFileName}`);

  try {
    const binaryData = Buffer.from(fileBuffer, 'base64');
    await fs.promises.writeFile(tempFilePath, binaryData);

    const spoolResult = await spoolToPrinter({
      filePath: tempFilePath,
      printerName,
      copies,
      duplex,
      color,
      paperSize,
      pages,
    });

    recordJobStatus(jobId, 'completed', {
      spooledTo: spoolResult.spooledTo,
      copies: spoolResult.copies,
      completedAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      jobId,
      message: 'Print job spooled successfully',
      details: spoolResult,
    });
  } catch (err) {
    console.error(`Spool failure for job #${jobId}:`, err);

    recordJobStatus(jobId, 'error', {
      error: err.message,
    });

    res.status(500).json({
      success: false,
      jobId,
      error: err.message,
    });
  } finally {
    // Zero-retention: delete temp file immediately from disk
    try {
      if (fs.existsSync(tempFilePath)) {
        await fs.promises.unlink(tempFilePath);
      }
    } catch (_cleanupErr) {}
  }
});

/**
 * GET /status/:jobId
 * Real-time inquiry for spooler state
 */
app.get('/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const status = jobStatuses.get(jobId);

  if (!status) {
    return res.status(404).json({
      success: false,
      jobId,
      status: 'unknown',
      error: 'Job ID not found in spooler cache',
    });
  }

  res.json({
    success: true,
    jobId,
    ...status,
  });
});

export { app, SPOOL_DIR, jobStatuses };

// Start the daemon server if executed directly
if (process.env.NODE_ENV !== 'test' && !process.env.QUICKPRINT_DAEMON_NO_LISTEN) {
  const server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`\n======================================================`);
    console.log(`🖨️  QuickPrint Local Hardware Print Daemon`);
    console.log(`======================================================`);
    console.log(`Status:  Running (Keep this window open)`);
    console.log(`Address: http://127.0.0.1:${PORT}`);
    console.log(`Health:  http://127.0.0.1:${PORT}/health`);
    console.log(`Printers: http://127.0.0.1:${PORT}/printers`);
    console.log(`======================================================\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Error: Port ${PORT} is already in use by another instance.`);
      console.error(`Please close any existing QuickPrint daemon window.\n`);
    } else {
      console.error('❌ Server error:', err);
    }
  });
}
