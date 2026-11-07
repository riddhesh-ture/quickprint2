// print-server/src/spooler.js
import { exec, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';

const execPromise = promisify(exec);
const execFilePromise = promisify(execFile);

/**
 * Fallback virtual printer returned when no physical printers are detected
 * (e.g. CI environments, headless containers, or developer machines without printers).
 */
const FALLBACK_VIRTUAL_PRINTER = {
  name: 'QuickPrint Virtual Spooler',
  isDefault: true,
  status: 'Ready',
  driverName: 'QuickPrint Virtual Driver',
  portName: 'VIRTUAL001',
};

/**
 * Queries the host OS for all installed printers and the default destination.
 * Supports Windows (PowerShell / CIM / WMIC) and Unix (CUPS lpstat).
 */
export async function getSystemPrinters() {
  const isWindows = process.platform === 'win32';

  if (isWindows) {
    try {
      // 1. Primary Windows attempt: PowerShell Get-Printer
      const psScript = `Get-Printer | Select-Object Name, Type, DriverName, PortName, PrinterStatus, Default | ConvertTo-Json -Compress`;
      const { stdout } = await execPromise(`powershell -NoProfile -NonInteractive -Command "${psScript}"`, {
        timeout: 4000,
      });

      if (stdout && stdout.trim()) {
        let parsed = JSON.parse(stdout.trim());
        if (!Array.isArray(parsed)) {
          parsed = [parsed];
        }

        const printers = parsed.map((p) => ({
          name: p.Name || 'Unknown Printer',
          isDefault: Boolean(p.Default),
          status: p.PrinterStatus === 0 ? 'Ready' : `Code ${p.PrinterStatus || 'Unknown'}`,
          driverName: p.DriverName || '',
          portName: p.PortName || '',
        }));

        const defaultPrinter = printers.find((p) => p.isDefault)?.name || printers[0]?.name || null;
        return { printers, defaultPrinter };
      }
    } catch (psErr) {
      // PowerShell Get-Printer could fail if CIM is restricted or older Windows
      try {
        const { stdout: wmicOut } = await execPromise('wmic printer get name,default /format:csv', {
          timeout: 3000,
        });
        const lines = wmicOut.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('Node'));
        const printers = [];
        let defaultPrinter = null;

        for (const line of lines) {
          const parts = line.split(',');
          if (parts.length >= 3) {
            const isDef = parts[1]?.toUpperCase() === 'TRUE';
            const name = parts[2]?.trim();
            if (name) {
              printers.push({ name, isDefault: isDef, status: 'Ready' });
              if (isDef) defaultPrinter = name;
            }
          }
        }

        if (printers.length > 0) {
          return { printers, defaultPrinter: defaultPrinter || printers[0].name };
        }
      } catch (_wmicErr) {
        // Fall through to virtual fallback
      }
    }
  } else {
    // Linux / macOS CUPS detection
    try {
      const { stdout: destOut } = await execFilePromise('lpstat', ['-d'], { timeout: 3000 });
      let defaultPrinter = null;
      const defMatch = destOut.match(/system default destination:\s*(.+)/i);
      if (defMatch) {
        defaultPrinter = defMatch[1].trim();
      }

      const { stdout: listOut } = await execFilePromise('lpstat', ['-p'], { timeout: 3000 });
      const printers = [];
      const lines = listOut.split('\n');

      for (const line of lines) {
        const pMatch = line.match(/^printer\s+([^\s]+)\s+(.+)$/);
        if (pMatch) {
          const name = pMatch[1];
          const isDefault = name === defaultPrinter;
          printers.push({
            name,
            isDefault,
            status: pMatch[2].includes('idle') ? 'Ready' : 'Busy',
          });
        }
      }

      if (printers.length > 0) {
        return { printers, defaultPrinter: defaultPrinter || printers[0].name };
      }
    } catch (_cupsErr) {
      // Fall through to virtual fallback
    }
  }

  // Graceful virtual fallback if no physical OS printers respond
  return {
    printers: [FALLBACK_VIRTUAL_PRINTER],
    defaultPrinter: FALLBACK_VIRTUAL_PRINTER.name,
    isFallback: true,
  };
}

/**
 * Spools a document directly to the host OS print driver without GUI interaction.
 *
 * @param {Object} options
 * @param {string} options.filePath - Path to the file on disk.
 * @param {string} [options.printerName] - Target printer name.
 * @param {number} [options.copies=1] - Number of physical copies.
 * @param {string} [options.duplex='simplex'] - Duplex mode ('simplex' | 'long' | 'short').
 * @param {string} [options.color='bw'] - Color mode ('color' | 'bw').
 * @param {string} [options.paperSize='A4'] - Paper size (e.g. 'A4', 'Letter').
 */
export async function spoolToPrinter({
  filePath,
  printerName,
  copies = 1,
  duplex = 'simplex',
  color = 'bw',
  paperSize = 'A4',
}) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`Spool error: File does not exist at "${filePath}"`);
  }

  const numCopies = Math.max(1, parseInt(copies, 10) || 1);
  const targetPrinter = printerName?.trim();

  // Virtual Spooler simulation for test/dev
  if (
    !targetPrinter ||
    targetPrinter === FALLBACK_VIRTUAL_PRINTER.name ||
    process.env.NODE_ENV === 'test' ||
    process.env.QUICKPRINT_MOCK_SPOOL === 'true'
  ) {
    return {
      success: true,
      spooledTo: targetPrinter || FALLBACK_VIRTUAL_PRINTER.name,
      copies: numCopies,
      duplex,
      color,
      paperSize,
      mode: 'virtual-spool',
    };
  }

  const isWindows = process.platform === 'win32';

  if (isWindows) {
    // Windows silent spooling
    // Sanitize parameters for PowerShell
    const escapedFile = filePath.replace(/"/g, '""');
    const escapedPrinter = targetPrinter.replace(/"/g, '""');

    // PowerShell PrintTo verb silent execution
    const psCommand = `Start-Process -FilePath "${escapedFile}" -Verb PrintTo -ArgumentList '"${escapedPrinter}"' -WindowStyle Hidden -Wait`;

    try {
      await execPromise(`powershell -NoProfile -NonInteractive -Command "${psCommand}"`, {
        timeout: 20000,
      });

      return {
        success: true,
        spooledTo: targetPrinter,
        copies: numCopies,
        duplex,
        color,
        paperSize,
        mode: 'win32-print-to',
      };
    } catch (winErr) {
      throw new Error(`Windows Spooler failed for printer "${targetPrinter}": ${winErr.message}`);
    }
  } else {
    // Linux / macOS CUPS lp spooling
    const args = ['-d', targetPrinter, '-n', String(numCopies)];

    if (duplex === 'long' || duplex === 'double') {
      args.push('-o', 'sides=two-sided-long-edge');
    } else if (duplex === 'short') {
      args.push('-o', 'sides=two-sided-short-edge');
    } else {
      args.push('-o', 'sides=one-sided');
    }

    if (paperSize) {
      args.push('-o', `media=${paperSize}`);
    }

    if (color === 'bw') {
      args.push('-o', 'ColorModel=KGray');
    } else if (color === 'color') {
      args.push('-o', 'ColorModel=Color');
    }

    args.push(filePath);

    try {
      await execFilePromise('lp', args, { timeout: 20000 });

      return {
        success: true,
        spooledTo: targetPrinter,
        copies: numCopies,
        duplex,
        color,
        paperSize,
        mode: 'cups-lp',
      };
    } catch (cupsErr) {
      throw new Error(`CUPS lp spooling failed for printer "${targetPrinter}": ${cupsErr.message}`);
    }
  }
}
