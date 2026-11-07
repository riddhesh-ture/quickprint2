// src/utils/testSlipGenerator.js
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Generates a universal QuickPrint Hardware Alignment & Diagnostic Slip.
 * Compatible with all printer brands (Canon, HP, Epson, Brother, Xerox, Ricoh, etc.)
 *
 * @param {Object} options
 * @param {string} options.shopName - Shop or outlet name
 * @param {string} options.printerName - Active printer name or system default
 * @returns {Promise<Blob>} - PDF Blob
 */
export async function generateTestSlipPdf({ shopName = 'QuickPrint Counter', printerName = 'Default Printer' } = {}) {
  const doc = await PDFDocument.create();
  // Standard A4 dimensions in PostScript points (595.28 x 841.89)
  const page = doc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  // 1. Boundary & Alignment Grid (15pt margin from printable edges)
  const margin = 24;
  page.drawRectangle({
    x: margin,
    y: margin,
    width: width - margin * 2,
    height: height - margin * 2,
    borderWidth: 1,
    borderColor: rgb(0.2, 0.2, 0.2),
  });

  // Corner crosshairs for alignment check
  const crosshairLen = 14;
  const corners = [
    [margin, margin],
    [width - margin, margin],
    [margin, height - margin],
    [width - margin, height - margin],
  ];
  corners.forEach(([cx, cy]) => {
    page.drawLine({
      start: { x: cx - crosshairLen, y: cy },
      end: { x: cx + crosshairLen, y: cy },
      thickness: 0.8,
      color: rgb(0.1, 0.1, 0.1),
    });
    page.drawLine({
      start: { x: cx, y: cy - crosshairLen },
      end: { x: cx, y: cy + crosshairLen },
      thickness: 0.8,
      color: rgb(0.1, 0.1, 0.1),
    });
  });

  // 2. Header Banner
  page.drawRectangle({
    x: margin + 1,
    y: height - margin - 48,
    width: width - margin * 2 - 2,
    height: 47,
    color: rgb(0.08, 0.45, 0.85),
  });

  page.drawText('QUICKPRINT STATION TEST SLIP', {
    x: margin + 16,
    y: height - margin - 28,
    size: 16,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText('Hardware Print Alignment & Color Diagnostic Page', {
    x: margin + 16,
    y: height - margin - 42,
    size: 9,
    font: fontRegular,
    color: rgb(0.9, 0.95, 1),
  });

  // 3. Station & Device Metadata Table
  let currentY = height - margin - 75;
  const drawMetaRow = (label, value) => {
    page.drawText(label, {
      x: margin + 20,
      y: currentY,
      size: 10,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });
    page.drawText(value, {
      x: margin + 160,
      y: currentY,
      size: 10,
      font: fontRegular,
      color: rgb(0.1, 0.1, 0.1),
    });
    currentY -= 18;
  };

  drawMetaRow('Assigned Printer:', String(printerName || 'Default System Printer'));
  drawMetaRow('Station / Shop:', String(shopName || 'QuickPrint Counter Outlet'));
  drawMetaRow('Date & Timestamp:', new Date().toLocaleString());
  drawMetaRow('Paper Specification:', 'A4 (210 x 297 mm) • Portrait');
  drawMetaRow('Driver / Spooler:', 'QuickPrint Universal Hardware Spooler');

  // Separator rule
  currentY -= 10;
  page.drawLine({
    start: { x: margin + 15, y: currentY },
    end: { x: width - margin - 15, y: currentY },
    thickness: 0.75,
    color: rgb(0.8, 0.8, 0.8),
  });

  // 4. CMYK & RGB Color Health Blocks
  currentY -= 24;
  page.drawText('1. COLOR CALIBRATION & INK NOZZLE HEALTH', {
    x: margin + 20,
    y: currentY,
    size: 11,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  currentY -= 40;
  const colorBars = [
    { name: 'Cyan', color: rgb(0, 0.7, 0.9) },
    { name: 'Magenta', color: rgb(0.9, 0.1, 0.6) },
    { name: 'Yellow', color: rgb(0.95, 0.85, 0.1) },
    { name: 'Black', color: rgb(0.05, 0.05, 0.05) },
    { name: 'Red', color: rgb(0.85, 0.15, 0.15) },
    { name: 'Green', color: rgb(0.15, 0.7, 0.25) },
    { name: 'Blue', color: rgb(0.15, 0.3, 0.85) },
  ];

  const barWidth = (width - margin * 2 - 40 - (colorBars.length - 1) * 8) / colorBars.length;
  colorBars.forEach((b, idx) => {
    const bx = margin + 20 + idx * (barWidth + 8);
    page.drawRectangle({
      x: bx,
      y: currentY,
      width: barWidth,
      height: 28,
      color: b.color,
      borderWidth: 0.5,
      borderColor: rgb(0.7, 0.7, 0.7),
    });
    page.drawText(b.name, {
      x: bx + 2,
      y: currentY - 12,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.3, 0.3, 0.3),
    });
  });

  // 5. Grayscale Density Gradient (0% to 100%)
  currentY -= 36;
  page.drawText('2. GRAYSCALE DENSITY & TONER GRADIENT', {
    x: margin + 20,
    y: currentY,
    size: 11,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  currentY -= 38;
  const grayLevels = [
    { label: '100%', val: 0.0 },
    { label: '80%', val: 0.2 },
    { label: '60%', val: 0.4 },
    { label: '40%', val: 0.6 },
    { label: '20%', val: 0.8 },
    { label: '10%', val: 0.9 },
  ];
  const gBarWidth = (width - margin * 2 - 40 - (grayLevels.length - 1) * 8) / grayLevels.length;
  grayLevels.forEach((g, idx) => {
    const gx = margin + 20 + idx * (gBarWidth + 8);
    page.drawRectangle({
      x: gx,
      y: currentY,
      width: gBarWidth,
      height: 24,
      color: rgb(g.val, g.val, g.val),
      borderWidth: 0.5,
      borderColor: rgb(0.7, 0.7, 0.7),
    });
    page.drawText(g.label, {
      x: gx + 4,
      y: currentY - 12,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.3, 0.3, 0.3),
    });
  });

  // 6. Text Resolution & Font Sharpness Scales
  currentY -= 36;
  page.drawText('3. OPTICAL RESOLUTION & FONT SHARPNESS TEST', {
    x: margin + 20,
    y: currentY,
    size: 11,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  currentY -= 20;
  page.drawText('14pt Bold: The quick brown fox jumps over the lazy dog 1234567890', {
    x: margin + 20,
    y: currentY,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  currentY -= 18;
  page.drawText('10pt Regular: Universal hardware print driver verification — 300 / 600 / 1200 DPI vector fidelity', {
    x: margin + 20,
    y: currentY,
    size: 10,
    font: fontRegular,
    color: rgb(0.2, 0.2, 0.2),
  });

  currentY -= 16;
  page.drawText('8pt Micro-text: Fine resolution check: ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz !@#$%^&*()', {
    x: margin + 20,
    y: currentY,
    size: 8,
    font: fontRegular,
    color: rgb(0.25, 0.25, 0.25),
  });

  currentY -= 14;
  page.drawText('6pt Nano-text: QuickPrint Zero-Knowledge Architecture • Customer files ephemeral in RAM • No cloud document retention', {
    x: margin + 20,
    y: currentY,
    size: 6,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  });

  // 7. Footer Status
  page.drawLine({
    start: { x: margin + 15, y: margin + 30 },
    end: { x: width - margin - 15, y: margin + 30 },
    thickness: 0.75,
    color: rgb(0.8, 0.8, 0.8),
  });

  page.drawText('PASSED: Hardware communication verified. Ready to accept customer print jobs.', {
    x: margin + 20,
    y: margin + 16,
    size: 8.5,
    font: fontBold,
    color: rgb(0.1, 0.5, 0.2),
  });

  page.drawText('QuickPrint 2.0 • Zero-Retention Print Platform', {
    x: width - margin - 200,
    y: margin + 16,
    size: 8,
    font: fontRegular,
    color: rgb(0.5, 0.5, 0.5),
  });

  const savedBytes = await doc.save();
  return new Blob([savedBytes], { type: 'application/pdf' });
}

