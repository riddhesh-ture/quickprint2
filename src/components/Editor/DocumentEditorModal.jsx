// src/components/Editor/DocumentEditorModal.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Stack,
  Divider,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
  Slider,
  FormControlLabel,
  Switch,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  Checkbox,
  RadioGroup,
  Radio,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';

import CloseIcon from '@mui/icons-material/Close';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import RestoreIcon from '@mui/icons-material/Restore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ViewSidebarIcon from '@mui/icons-material/ViewSidebar';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import AspectRatioIcon from '@mui/icons-material/AspectRatio';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CropIcon from '@mui/icons-material/Crop';
import PrintIcon from '@mui/icons-material/Print';

import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocument, degrees, StandardFonts, rgb } from 'pdf-lib';

import { getJobBlob, hasOriginalJobBlob } from '../../utils/localJobStorage';
import { getFileCategory, calculateBillablePages } from '../../utils/fileValidation';

// Configure PDF.js worker
try {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
} catch {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

// Standard paper dimensions in points (72 pt / inch)
const PAPER_DIMENSIONS = {
  a4: { width: 595.28, height: 841.89, label: 'A4 (210 × 297 mm)' },
  letter: { width: 612.0, height: 792.0, label: 'Letter (8.5 × 11 in)' },
  legal: { width: 612.0, height: 1008.0, label: 'Legal (8.5 × 14 in)' },
};

// Margin presets in points
const MARGIN_PRESETS = {
  default: { pt: 34, label: 'Default (~12 mm)' },
  none: { pt: 0, label: 'None (0 mm)' },
  minimum: { pt: 14, label: 'Minimum (~5 mm)' },
  custom: { pt: 24, label: 'Custom' },
};

/**
 * Parses range string (e.g. "1-3, 5") into a Set of 1-based page numbers
 */
function parseRangeToSet(rangeStr, totalPages) {
  if (!rangeStr || rangeStr.trim().toLowerCase() === 'all') {
    return new Set(Array.from({ length: totalPages }, (_, i) => i + 1));
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
        for (let p = Math.max(1, start); p <= Math.min(totalPages, end); p++) {
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
  return selected;
}

/**
 * Formats a Set of 1-based page numbers into a clean range string (e.g. "1-3, 5")
 */
function formatSetToRange(pageSet, totalPages) {
  if (!pageSet || pageSet.size === 0) return '';
  if (pageSet.size === totalPages) return 'all';

  const sorted = Array.from(pageSet).sort((a, b) => a - b);
  const ranges = [];
  let start = sorted[0];
  let prev = start;

  for (let i = 1; i < sorted.length; i++) {
    const curr = sorted[i];
    if (curr === prev + 1) {
      prev = curr;
    } else {
      ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = curr;
      prev = curr;
    }
  }
  ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
  return ranges.join(', ');
}

export default function DocumentEditorModal({
  open,
  onClose,
  job,
  fileIndex = 0,
  onSaveEdits,
  onRevertEdits,
  pricePerPageBW = 2,
  pricePerPageColor = 5,
}) {
  const [fileBlob, setFileBlob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [hasBackup, setHasBackup] = useState(false);

  // Active file metadata
  const file = job?.files?.[fileIndex] || null;
  const isPdf = useMemo(() => {
    if (fileBlob) return getFileCategory(fileBlob) === 'pdf';
    if (file) return getFileCategory(file) === 'pdf';
    return false;
  }, [file, fileBlob]);

  // Viewport / Screen Zoom & Pager
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [screenZoom, setScreenZoom] = useState(1.0);
  const [showThumbnails, setShowThumbnails] = useState(true);

  // ==========================================
  // COMPLETE CHROME PRINT SETTINGS STATE
  // ==========================================
  const [pageSelectionMode, setPageSelectionMode] = useState('all'); // 'all' | 'odd' | 'even' | 'custom'
  const [customRangeText, setCustomRangeText] = useState('all');
  const [selectedPagesSet, setSelectedPagesSet] = useState(new Set([1]));

  const [copies, setCopies] = useState(1);
  const [layout, setLayout] = useState('portrait'); // 'portrait' | 'landscape'
  const [colorMode, setColorMode] = useState('bw'); // 'bw' | 'color'
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270

  // More Settings
  const [paperSize, setPaperSize] = useState('a4'); // 'a4' | 'letter' | 'legal'
  const [pagesPerSheet, setPagesPerSheet] = useState(1); // 1, 2, 4
  const [margins, setMargins] = useState('default'); // 'default' | 'none' | 'minimum' | 'custom'
  const [customMarginMm, setCustomMarginMm] = useState(10); // in mm
  const [scaleMode, setScaleMode] = useState('default'); // 'default' | 'fit_printable' | 'fit_paper' | 'custom'
  const [customScalePercent, setCustomScalePercent] = useState(100); // 50 to 200

  const [twoSided, setTwoSided] = useState(false);
  const [duplexFlip, setDuplexFlip] = useState('long'); // 'long' | 'short'

  const [headersFooters, setHeadersFooters] = useState(false);
  const [moreSettingsExpanded, setMoreSettingsExpanded] = useState(true);

  // Image-specific adjustments
  const [imagePreset, setImagePreset] = useState('original');
  const [xeroxMode, setXeroxMode] = useState(false);
  const [xeroxThreshold, setXeroxThreshold] = useState(150);
  const [cropActive, setCropActive] = useState(false);

  // Load document blob on modal open
  useEffect(() => {
    if (!open || !job || !file) {
      setFileBlob(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);
    setRotation(0);
    setScreenZoom(1.0);
    setCurrentPage(1);
    setShowThumbnails(true);
    setCropActive(false);
    setImagePreset('original');
    setXeroxMode(false);
    setXeroxThreshold(150);

    const initialSpecs = file.specs || {};
    setColorMode(initialSpecs.color === 'color' ? 'color' : 'bw');
    setTwoSided(Boolean(initialSpecs.duplex || initialSpecs.sides === 'double'));
    setDuplexFlip(initialSpecs.duplexFlip || 'long');
    setCopies(parseInt(initialSpecs.copies, 10) || 1);
    setPaperSize(initialSpecs.paperSize || 'a4');
    setPagesPerSheet(parseInt(initialSpecs.pagesPerSheet, 10) || 1);
    setMargins(initialSpecs.margins || 'default');
    setScaleMode(initialSpecs.scaleMode || 'default');
    setCustomScalePercent(initialSpecs.customScalePercent || 100);
    setHeadersFooters(Boolean(initialSpecs.headersFooters));

    const initPages = initialSpecs.pages || 'all';
    setCustomRangeText(initPages);
    setPageSelectionMode(initPages === 'all' ? 'all' : 'custom');

    async function loadData() {
      try {
        let blob = await getJobBlob(job.id, fileIndex);
        if (!blob && file.blob instanceof Blob) blob = file.blob;
        if (!blob && file.file instanceof Blob) blob = file.file;

        if (!blob) {
          throw new Error('Document binary not found in local cache.');
        }

        const backupExists = await hasOriginalJobBlob(job.id, fileIndex);

        if (isMounted) {
          setFileBlob(blob);
          setHasBackup(backupExists || Boolean(file.isEdited));
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error loading prepress document:', err);
          setError(err.message || 'Failed to load file');
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [open, job, fileIndex]);

  // Handle PDF load success from react-pdf
  const onDocumentLoadSuccess = useCallback(
    ({ numPages }) => {
      setTotalPages(numPages);
      const parsed = parseRangeToSet(customRangeText, numPages);
      setSelectedPagesSet(parsed.size > 0 ? parsed : new Set(Array.from({ length: numPages }, (_, i) => i + 1)));
    },
    [customRangeText]
  );

  // Synchronize Page Selection Mode Dropdown
  const handleSelectionModeChange = (e) => {
    const mode = e.target.value;
    setPageSelectionMode(mode);

    if (mode === 'all') {
      const all = new Set(Array.from({ length: totalPages }, (_, i) => i + 1));
      setSelectedPagesSet(all);
      setCustomRangeText('all');
    } else if (mode === 'odd') {
      const odd = new Set(Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 === 1));
      setSelectedPagesSet(odd);
      setCustomRangeText(formatSetToRange(odd, totalPages));
    } else if (mode === 'even') {
      const even = new Set(Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 === 0));
      setSelectedPagesSet(even);
      setCustomRangeText(formatSetToRange(even, totalPages));
    }
  };

  // Synchronize Custom Range Input text changes
  const handleCustomRangeInput = (e) => {
    const text = e.target.value;
    setCustomRangeText(text);
    setPageSelectionMode('custom');
    const parsed = parseRangeToSet(text, totalPages);
    setSelectedPagesSet(parsed);
  };

  // Toggle individual page checkbox on thumbnail rail
  const handleTogglePageCheckbox = (pageNumber) => {
    const updated = new Set(selectedPagesSet);
    if (updated.has(pageNumber)) {
      if (updated.size > 1) {
        updated.delete(pageNumber);
      }
    } else {
      updated.add(pageNumber);
    }
    setSelectedPagesSet(updated);
    setPageSelectionMode('custom');
    setCustomRangeText(formatSetToRange(updated, totalPages));
  };

  // Dynamic Prepress Billable Calculation (incorporating N-Up & Duplex)
  const { billableSheets, physicalSheetsPerCopy, estimatedCost } = useMemo(() => {
    const rawCount = isPdf ? selectedPagesSet.size : 1;
    const sheetsPerCopy = calculateBillablePages(rawCount, 'all', twoSided, pagesPerSheet);
    const copyCount = copies || 1;
    const totalSheets = sheetsPerCopy * copyCount;
    const price = colorMode === 'color' ? pricePerPageColor : pricePerPageBW;
    const totalAmount = (totalSheets * price).toFixed(2);
    return {
      billableSheets: totalSheets,
      physicalSheetsPerCopy: sheetsPerCopy,
      estimatedCost: totalAmount,
    };
  }, [isPdf, selectedPagesSet, twoSided, pagesPerSheet, copies, colorMode, pricePerPageBW, pricePerPageColor]);

  // Rotate 90° Clockwise
  const handleRotate90 = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Effective Print Scale Multiplier
  const effectivePrintScale = useMemo(() => {
    if (scaleMode === 'custom') return customScalePercent / 100;
    if (scaleMode === 'fit_printable') return 0.92;
    if (scaleMode === 'fit_paper') return 1.0;
    return 1.0; // default 100%
  }, [scaleMode, customScalePercent]);

  // Margin offset in points
  const marginOffsetPt = useMemo(() => {
    if (margins === 'none') return 0;
    if (margins === 'minimum') return MARGIN_PRESETS.minimum.pt;
    if (margins === 'custom') return (customMarginMm * 72) / 25.4;
    return MARGIN_PRESETS.default.pt;
  }, [margins, customMarginMm]);

  // Continuous scroll sheets mapping
  const sortedSelectedPages = useMemo(() => {
    return Array.from(selectedPagesSet).sort((a, b) => a - b);
  }, [selectedPagesSet]);

  const sheetsToRender = useMemo(() => {
    if (!sortedSelectedPages.length) return [];
    const chunks = [];
    for (let i = 0; i < sortedSelectedPages.length; i += pagesPerSheet) {
      chunks.push(sortedSelectedPages.slice(i, i + pagesPerSheet));
    }
    return chunks;
  }, [sortedSelectedPages, pagesPerSheet]);

  const handleJumpToPage = (targetPage) => {
    const p = Math.max(1, Math.min(totalPages, targetPage));
    setCurrentPage(p);
    const el = document.getElementById(`prepress-page-${p}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Revert to original document
  const handleRevert = async () => {
    if (!job || !onRevertEdits) return;
    setSaving(true);
    try {
      await onRevertEdits(job, fileIndex);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to revert edits');
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // PHYSICAL PDF ASSEMBLY & DIRECT PRINT
  // ==========================================
  const handleDirectPrint = async () => {
    if (!fileBlob || !job || !onSaveEdits) return;
    setSaving(true);
    setError(null);

    try {
      let finalBlob = fileBlob;
      let finalPageCount = totalPages;

      if (isPdf) {
        const sortedSelected = Array.from(selectedPagesSet).sort((a, b) => a - b);
        const zeroIndexed = sortedSelected.map((p) => p - 1);

        const arrayBuffer = await fileBlob.arrayBuffer();
        const sourcePdf = await PDFDocument.load(arrayBuffer);
        const outDoc = await PDFDocument.create();

        // Target paper dimensions
        const paperBase = PAPER_DIMENSIONS[paperSize] || PAPER_DIMENSIONS.a4;
        const isLandscape = layout === 'landscape';
        const sheetWidth = isLandscape ? paperBase.height : paperBase.width;
        const sheetHeight = isLandscape ? paperBase.width : paperBase.height;

        let font = null;
        if (headersFooters) {
          font = await outDoc.embedFont(StandardFonts.Helvetica);
        }

        // Fast path: 1-page per sheet, default scale, default margins, no headers/footers
        const isSimpleTransform =
          pagesPerSheet === 1 &&
          scaleMode === 'default' &&
          margins === 'default' &&
          !headersFooters &&
          layout === 'portrait';

        if (isSimpleTransform) {
          // Standard copyPages with rotation & subset
          const copiedPages = await outDoc.copyPages(sourcePdf, zeroIndexed);
          copiedPages.forEach((page) => {
            if (rotation !== 0) {
              const currentAngle = page.getRotation().angle;
              page.setRotation(degrees((currentAngle + rotation) % 360));
            }
            outDoc.addPage(page);
          });
          finalPageCount = sortedSelected.length;
        } else {
          // Advanced physical sheet layout: N-Up, Scale, Margins, Headers/Footers
          const embeddedPages = await outDoc.embedPdf(sourcePdf, zeroIndexed);
          const totalSelected = embeddedPages.length;

          // Group into sheets based on pagesPerSheet
          for (let i = 0; i < totalSelected; i += pagesPerSheet) {
            const sheet = outDoc.addPage([sheetWidth, sheetHeight]);
            const chunk = embeddedPages.slice(i, i + pagesPerSheet);

            const usableLeft = marginOffsetPt;
            const usableBottom = marginOffsetPt + (headersFooters ? 20 : 0);
            const usableWidth = Math.max(10, sheetWidth - marginOffsetPt * 2);
            const usableHeight = Math.max(10, sheetHeight - marginOffsetPt * 2 - (headersFooters ? 40 : 0));

            if (pagesPerSheet === 1) {
              const emb = chunk[0];
              const embAspect = emb.width / emb.height;
              let targetW = usableWidth * effectivePrintScale;
              let targetH = targetW / embAspect;

              if (targetH > usableHeight * effectivePrintScale) {
                targetH = usableHeight * effectivePrintScale;
                targetW = targetH * embAspect;
              }

              const posX = usableLeft + (usableWidth - targetW) / 2;
              const posY = usableBottom + (usableHeight - targetH) / 2;

              sheet.drawPage(emb, {
                x: posX,
                y: posY,
                width: targetW,
                height: targetH,
                rotate: degrees(rotation),
              });
            } else if (pagesPerSheet === 2) {
              // 2 pages side-by-side
              const halfW = (usableWidth - 10) / 2;
              chunk.forEach((emb, idx) => {
                const embAspect = emb.width / emb.height;
                let targetW = halfW * effectivePrintScale;
                let targetH = targetW / embAspect;

                if (targetH > usableHeight * effectivePrintScale) {
                  targetH = usableHeight * effectivePrintScale;
                  targetW = targetH * embAspect;
                }

                const posX = usableLeft + idx * (halfW + 10) + (halfW - targetW) / 2;
                const posY = usableBottom + (usableHeight - targetH) / 2;

                sheet.drawPage(emb, {
                  x: posX,
                  y: posY,
                  width: targetW,
                  height: targetH,
                  rotate: degrees(rotation),
                });
              });
            } else if (pagesPerSheet === 4) {
              // 4 pages in a 2x2 grid
              const cellW = (usableWidth - 10) / 2;
              const cellH = (usableHeight - 10) / 2;

              chunk.forEach((emb, idx) => {
                const col = idx % 2;
                const row = Math.floor(idx / 2); // 0 = top, 1 = bottom

                const embAspect = emb.width / emb.height;
                let targetW = cellW * effectivePrintScale;
                let targetH = targetW / embAspect;

                if (targetH > cellH * effectivePrintScale) {
                  targetH = cellH * effectivePrintScale;
                  targetW = targetH * embAspect;
                }

                const posX = usableLeft + col * (cellW + 10) + (cellW - targetW) / 2;
                const posY = usableBottom + (1 - row) * (cellH + 10) + (cellH - targetH) / 2;

                sheet.drawPage(emb, {
                  x: posX,
                  y: posY,
                  width: targetW,
                  height: targetH,
                  rotate: degrees(rotation),
                });
              });
            }

            // Headers & Footers stamping
            if (headersFooters && font) {
              const tokenDisplay = job.pin || String(job.id).slice(-4);
              const headerText = `QuickPrint #${tokenDisplay} • ${file.name || 'Document'}`;
              const footerText = `Sheet ${Math.floor(i / pagesPerSheet) + 1} of ${Math.ceil(totalSelected / pagesPerSheet)}`;

              sheet.drawText(headerText, {
                x: marginOffsetPt || 30,
                y: sheetHeight - 20,
                size: 8,
                font,
                color: rgb(0.35, 0.35, 0.35),
              });

              sheet.drawText(footerText, {
                x: sheetWidth - 80,
                y: 12,
                size: 8,
                font,
                color: rgb(0.35, 0.35, 0.35),
              });
            }
          }

          finalPageCount = outDoc.getPageCount();
        }

        const savedBytes = await outDoc.save();
        finalBlob = new Blob([savedBytes], { type: 'application/pdf' });
      }

      // 2. Image Prepress Assembly via Canvas
      if (!isPdf) {
        finalBlob = await new Promise((resolve, reject) => {
          const img = new window.Image();
          const tempUrl = URL.createObjectURL(fileBlob);
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const isRotated90 = rotation === 90 || rotation === 270;
            const drawW = isRotated90 ? img.height : img.width;
            const drawH = isRotated90 ? img.width : img.height;

            canvas.width = drawW;
            canvas.height = drawH;

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.drawImage(img, -img.width / 2, -img.height / 2);
            ctx.restore();

            if (xeroxMode) {
              const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const data = imgData.data;
              const thresh = xeroxThreshold;
              for (let i = 0; i < data.length; i += 4) {
                const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                const val = gray >= thresh ? 255 : 0;
                data[i] = val;
                data[i + 1] = val;
                data[i + 2] = val;
              }
              ctx.putImageData(imgData, 0, 0);
            }

            URL.revokeObjectURL(tempUrl);
            canvas.toBlob(
              (b) => (b ? resolve(b) : reject(new Error('Failed to render image canvas output'))),
              'image/jpeg',
              0.95
            );
          };
          img.onerror = () => {
            URL.revokeObjectURL(tempUrl);
            reject(new Error('Failed to render image'));
          };
          img.src = tempUrl;
        });
        finalPageCount = 1;
      }

      const updatedSpecs = {
        ...file.specs,
        color: colorMode,
        duplex: twoSided,
        duplexFlip,
        copies,
        paperSize,
        pagesPerSheet,
        margins,
        scaleMode,
        customScalePercent,
        headersFooters,
        pages: isPdf ? formatSetToRange(selectedPagesSet, totalPages) : 'all',
        pageCount: finalPageCount,
      };

      // Direct print without intermediate save step
      await onSaveEdits(job, fileIndex, finalBlob, updatedSpecs, finalPageCount, true);
      onClose();
    } catch (err) {
      console.error('Error in prepress direct print:', err);
      setError(err.message || 'Failed to print document');
    } finally {
      setSaving(false);
    }
  };

  const tokenDisplay =
    job?.pin ||
    (job?.tokenNumber
      ? String(job.tokenNumber).replace(/\D/g, '').slice(-4)
      : String(job?.id || '').slice(-4) || '----');

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth={false}
      fullWidth
      PaperProps={{
        sx: {
          width: '96vw',
          height: '94vh',
          maxWidth: '1720px',
          maxHeight: '96vh',
          borderRadius: 2.5,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          bgcolor: 'background.paper',
        },
      }}
    >
      {/* 1. TOP PREPRESS TOOLBAR */}
      <DialogTitle
        sx={{
          py: 1,
          px: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: '#16191f',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1.5,
        }}
      >
        {/* Left: Document info & Sidebar toggle */}
        <Stack direction="row" spacing={1.5} alignItems="center">
          {isPdf && (
            <Tooltip title={showThumbnails ? 'Hide page thumbnails' : 'Show page thumbnails'}>
              <IconButton
                size="small"
                onClick={() => setShowThumbnails(!showThumbnails)}
                sx={{
                  color: showThumbnails ? 'primary.main' : 'grey.400',
                  bgcolor: showThumbnails ? 'rgba(25, 118, 210, 0.15)' : 'transparent',
                }}
              >
                <ViewSidebarIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {isPdf ? (
            <PictureAsPdfIcon color="error" sx={{ fontSize: 24 }} />
          ) : (
            <ImageIcon color="primary" sx={{ fontSize: 24 }} />
          )}

          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle1" fontWeight="bold" sx={{ color: 'white' }}>
                Prepress Studio
              </Typography>
              <Chip
                label={`#${tokenDisplay}`}
                size="small"
                color="primary"
                sx={{ fontWeight: 'bold', height: 22, fontSize: '0.75rem' }}
              />
              {pagesPerSheet > 1 && (
                <Chip
                  label={`${pagesPerSheet}-Up`}
                  size="small"
                  color="secondary"
                  sx={{ height: 20, fontSize: '0.7rem', fontWeight: 'bold' }}
                />
              )}
            </Stack>
            <Typography variant="caption" sx={{ color: 'grey.400' }} noWrap>
              {file?.name || 'Document'} {isPdf && `• ${selectedPagesSet.size} of ${totalPages} pgs selected`}
            </Typography>
          </Box>
        </Stack>

        {/* Center: Pager & Live Viewport Controls */}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ bgcolor: '#232731', px: 1.5, py: 0.5, borderRadius: 2 }}>
          {isPdf && (
            <>
              <IconButton
                size="small"
                onClick={() => handleJumpToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                sx={{ color: 'grey.300' }}
              >
                <NavigateBeforeIcon fontSize="small" />
              </IconButton>
              <Typography variant="body2" sx={{ color: 'white', minWidth: 65, textAlign: 'center', fontWeight: 'bold' }}>
                {currentPage} / {totalPages}
              </Typography>
              <IconButton
                size="small"
                onClick={() => handleJumpToPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                sx={{ color: 'grey.300' }}
              >
                <NavigateNextIcon fontSize="small" />
              </IconButton>
              <Divider orientation="vertical" flexItem sx={{ borderColor: 'grey.700', mx: 0.5 }} />
            </>
          )}

          {/* Screen Zoom Controls */}
          <IconButton
            size="small"
            onClick={() => setScreenZoom((z) => Math.max(0.4, +(z - 0.15).toFixed(2)))}
            sx={{ color: 'grey.300' }}
          >
            <ZoomOutIcon fontSize="small" />
          </IconButton>
          <Typography variant="caption" sx={{ color: 'grey.300', width: 44, textAlign: 'center', fontWeight: 'bold' }}>
            {Math.round(screenZoom * 100)}%
          </Typography>
          <IconButton
            size="small"
            onClick={() => setScreenZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2)))}
            sx={{ color: 'grey.300' }}
          >
            <ZoomInIcon fontSize="small" />
          </IconButton>

          <Tooltip title="Reset to 100%">
            <IconButton size="small" onClick={() => setScreenZoom(1.0)} sx={{ color: 'grey.300' }}>
              <AspectRatioIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Fit Width">
            <IconButton size="small" onClick={() => setScreenZoom(1.2)} sx={{ color: 'grey.300' }}>
              <FitScreenIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ borderColor: 'grey.700', mx: 0.5 }} />

          {/* 1-Click Live Rotate 90° CW */}
          <Button
            size="small"
            variant="outlined"
            startIcon={<RotateRightIcon />}
            onClick={handleRotate90}
            sx={{
              color: 'white',
              borderColor: 'grey.600',
              textTransform: 'none',
              py: 0.25,
              fontWeight: 'bold',
              '&:hover': { borderColor: 'primary.light', bgcolor: 'rgba(255,255,255,0.05)' },
            }}
          >
            Rotate CW ({rotation}°)
          </Button>

          <Tooltip title="Toggle margin trim / crop guides">
            <IconButton
              size="small"
              onClick={() => setCropActive(!cropActive)}
              sx={{ color: cropActive ? 'primary.main' : 'grey.300' }}
            >
              <CropIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Right: Close button */}
        <IconButton onClick={onClose} disabled={saving} size="small" sx={{ color: 'grey.400' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* 2. MAIN STAGE & SIDEBAR */}
      <DialogContent
        sx={{
          p: 0,
          flexGrow: 1,
          display: 'flex',
          overflow: 'hidden',
          bgcolor: '#1e2229',
        }}
      >
        {/* Left: Collapsible Thumbnail Rail */}
        {isPdf && showThumbnails && (
          <Box
            sx={{
              width: 170,
              minWidth: 170,
              borderRight: '1px solid',
              borderColor: 'grey.800',
              bgcolor: '#16191f',
              overflowY: 'auto',
              p: 1.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
            }}
          >
            <Typography variant="caption" fontWeight="bold" sx={{ color: 'grey.400', textTransform: 'uppercase' }}>
              Pages ({selectedPagesSet.size}/{totalPages})
            </Typography>

            {fileBlob && (
              <Document file={fileBlob} loading={<CircularProgress size={16} sx={{ alignSelf: 'center', my: 2 }} />}>
                <Stack spacing={1.5}>
                  {Array.from({ length: totalPages }, (_, i) => {
                    const pageNum = i + 1;
                    const isSelected = selectedPagesSet.has(pageNum);
                    const isCurrent = currentPage === pageNum;

                    return (
                      <Box
                        key={pageNum}
                        onClick={() => handleJumpToPage(pageNum)}
                        sx={{
                          position: 'relative',
                          cursor: 'pointer',
                          p: 0.75,
                          borderRadius: 1.5,
                          border: '2px solid',
                          borderColor: isCurrent ? 'primary.main' : isSelected ? 'grey.700' : 'grey.900',
                          bgcolor: isCurrent ? 'rgba(25, 118, 210, 0.15)' : '#1e2229',
                          opacity: isSelected ? 1 : 0.45,
                          transition: 'all 0.15s ease',
                          '&:hover': { borderColor: 'primary.light' },
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                          <Typography variant="caption" fontWeight="bold" sx={{ color: 'grey.300', fontSize: '0.75rem' }}>
                            P. {pageNum}
                          </Typography>
                          <Checkbox
                            size="small"
                            checked={isSelected}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTogglePageCheckbox(pageNum);
                            }}
                            sx={{ p: 0, color: 'grey.500', '&.Mui-checked': { color: 'primary.main' } }}
                          />
                        </Stack>

                        <Box
                          sx={{
                            width: '100%',
                            height: 125,
                            bgcolor: 'white',
                            borderRadius: 1,
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Page
                            pageNumber={pageNum}
                            width={140}
                            rotate={rotation}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                          />
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
              </Document>
            )}
          </Box>
        )}

        {/* Center: WYSIWYG Print Sheet Stage with Continuous Scroll */}
        <Box
          id="prepress-scroll-container"
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            overflowY: 'auto',
            overflowX: 'auto',
            p: 3,
            bgcolor: '#1e2229',
            gap: 3,
          }}
        >
          {loading && (
            <Stack spacing={2} alignItems="center" sx={{ my: 'auto' }}>
              <CircularProgress size={45} sx={{ color: 'primary.light' }} />
              <Typography variant="body2" sx={{ color: 'grey.300' }}>
                Rendering prepress print stage...
              </Typography>
            </Stack>
          )}

          {error && !loading && (
            <Alert severity="error" sx={{ maxWidth: 450, my: 'auto' }}>
              {error}
            </Alert>
          )}

          {!loading && !error && fileBlob && (
            <>
              {isPdf ? (
                <Document
                  file={fileBlob}
                  loading={
                    <Stack spacing={2} alignItems="center" sx={{ my: 6 }}>
                      <CircularProgress size={32} sx={{ color: 'primary.light' }} />
                      <Typography variant="caption" sx={{ color: 'grey.400' }}>
                        Loading PDF document...
                      </Typography>
                    </Stack>
                  }
                >
                  <Stack spacing={4} alignItems="center" sx={{ width: '100%', py: 1 }}>
                    {sheetsToRender.map((sheetPages, sheetIndex) => {
                      const sheetNum = sheetIndex + 1;
                      const totalSheets = sheetsToRender.length;

                      return (
                        <Box
                          key={`sheet-${sheetIndex}`}
                          id={`prepress-sheet-${sheetNum}`}
                          sx={{
                            width: layout === 'landscape' ? 620 : 440,
                            minHeight: layout === 'landscape' ? 440 : 620,
                            bgcolor: 'white',
                            borderRadius: 1,
                            boxShadow: '0 12px 36px rgba(0,0,0,0.7)',
                            p: `${marginOffsetPt / 2.5}px`,
                            display: 'flex',
                            flexDirection: 'column',
                            position: 'relative',
                            border: cropActive ? '2px dashed #1976d2' : '1px solid rgba(0,0,0,0.1)',
                            transform: `scale(${screenZoom})`,
                            transformOrigin: 'top center',
                            transition: 'transform 0.15s ease',
                          }}
                        >
                          {/* Header stamp preview */}
                          {headersFooters && (
                            <Box
                              sx={{
                                pb: 0.5,
                                borderBottom: '1px dashed #ccc',
                                mb: 0.75,
                                display: 'flex',
                                justifyContent: 'space-between',
                              }}
                            >
                              <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#666' }}>
                                QuickPrint #{tokenDisplay} • {file?.name || 'Document'}
                              </Typography>
                              <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#666' }}>
                                Sheet {sheetNum} of {totalSheets}
                              </Typography>
                            </Box>
                          )}

                          {/* Document Page Content Container (N-Up Grid) */}
                          <Box
                            sx={{
                              flex: 1,
                              display: 'grid',
                              gridTemplateColumns: pagesPerSheet === 1 ? '1fr' : '1fr 1fr',
                              gridTemplateRows: pagesPerSheet === 4 ? '1fr 1fr' : '1fr',
                              gap: 1.5,
                              alignItems: 'center',
                              justifyItems: 'center',
                            }}
                          >
                            {sheetPages.map((pageNum) => (
                              <Box
                                key={pageNum}
                                id={`prepress-page-${pageNum}`}
                                onClick={() => setCurrentPage(pageNum)}
                                sx={{
                                  transform: `scale(${effectivePrintScale})`,
                                  transformOrigin: 'center center',
                                  transition: 'transform 0.15s ease',
                                  border: currentPage === pageNum ? '2px solid #1976d2' : '1px solid transparent',
                                  borderRadius: 1,
                                  p: 0.25,
                                  cursor: 'pointer',
                                }}
                              >
                                <Page
                                  pageNumber={pageNum}
                                  width={
                                    layout === 'landscape'
                                      ? pagesPerSheet === 2
                                        ? 270
                                        : pagesPerSheet === 4
                                        ? 270
                                        : 560
                                      : pagesPerSheet === 2
                                      ? 190
                                      : pagesPerSheet === 4
                                      ? 190
                                      : 380
                                  }
                                  rotate={rotation}
                                  renderTextLayer={false}
                                  renderAnnotationLayer={false}
                                />
                              </Box>
                            ))}
                          </Box>

                          {/* Footer stamp preview */}
                          {headersFooters && (
                            <Box sx={{ pt: 0.5, borderTop: '1px dashed #ccc', mt: 0.75, textAlign: 'center' }}>
                              <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#666' }}>
                                Sheet {sheetNum} of {totalSheets}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      );
                    })}
                  </Stack>
                </Document>
              ) : (
                // Image Prepress Stage
                <Box
                  sx={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    my: 'auto',
                  }}
                >
                  <Box
                    component="img"
                    src={URL.createObjectURL(fileBlob)}
                    alt="Preview"
                    sx={{
                      maxWidth: '90%',
                      maxHeight: '75vh',
                      objectFit: 'contain',
                      borderRadius: 1,
                      boxShadow: '0 8px 30px rgba(0,0,0,0.7)',
                      transform: `rotate(${rotation}deg) scale(${effectivePrintScale * screenZoom})`,
                      transition: 'transform 0.15s ease',
                      filter: xeroxMode ? `grayscale(1) contrast(${xeroxThreshold / 50})` : 'none',
                    }}
                  />
                </Box>
              )}
            </>
          )}
        </Box>

        {/* Right: Full Chrome Print Settings Drawer */}
        <Box
          sx={{
            width: 360,
            minWidth: 360,
            p: 2.5,
            bgcolor: 'background.paper',
            borderLeft: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            overflowY: 'auto',
          }}
        >
          {/* Destination */}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight="bold">
              DESTINATION
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5, p: 1, bgcolor: 'action.hover', borderRadius: 1.5 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'success.main' }} />
              <Typography variant="body2" fontWeight="bold">
                Counter Local Station
              </Typography>
              <Chip label="Silent Spooler" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem', ml: 'auto' }} />
            </Stack>
          </Box>

          {/* 1. Pages */}
          {isPdf && (
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight="bold">
                PAGES
              </Typography>
              <FormControl size="small" fullWidth sx={{ mt: 0.5, mb: 1 }}>
                <Select value={pageSelectionMode} onChange={handleSelectionModeChange}>
                  <MenuItem value="all">All pages (1–{totalPages})</MenuItem>
                  <MenuItem value="odd">Odd pages only</MenuItem>
                  <MenuItem value="even">Even pages only</MenuItem>
                  <MenuItem value="custom">Custom range</MenuItem>
                </Select>
              </FormControl>

              {pageSelectionMode === 'custom' && (
                <TextField
                  size="small"
                  fullWidth
                  label="Pages e.g. 1-3, 5"
                  value={customRangeText}
                  onChange={handleCustomRangeInput}
                  helperText={`${selectedPagesSet.size} of ${totalPages} pages selected`}
                />
              )}
            </Box>
          )}

          {/* 2. Copies */}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight="bold">
              COPIES
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
              <IconButton
                size="small"
                onClick={() => setCopies((c) => Math.max(1, c - 1))}
                disabled={copies <= 1}
              >
                <RemoveIcon />
              </IconButton>
              <Typography variant="h6" fontWeight="bold" sx={{ width: 45, textAlign: 'center' }}>
                {copies}
              </Typography>
              <IconButton size="small" onClick={() => setCopies((c) => c + 1)}>
                <AddIcon />
              </IconButton>
            </Stack>
          </Box>

          {/* 3. Layout (Portrait vs Landscape) */}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight="bold">
              LAYOUT
            </Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              fullWidth
              value={layout}
              onChange={(_, val) => val && setLayout(val)}
              sx={{ mt: 0.5 }}
            >
              <ToggleButton value="portrait">Portrait</ToggleButton>
              <ToggleButton value="landscape">Landscape</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* 4. Color Mode */}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight="bold">
              COLOR
            </Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              fullWidth
              value={colorMode}
              onChange={(_, val) => val && setColorMode(val)}
              sx={{ mt: 0.5 }}
            >
              <ToggleButton value="bw">Black and white (₹{pricePerPageBW})</ToggleButton>
              <ToggleButton value="color">Color (₹{pricePerPageColor})</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Divider />

          {/* 5. More Settings Accordion */}
          <Accordion
            expanded={moreSettingsExpanded}
            onChange={() => setMoreSettingsExpanded(!moreSettingsExpanded)}
            disableGutters
            elevation={0}
            sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ p: 0, minHeight: 32 }}>
              <Typography variant="subtitle2" fontWeight="bold" color="primary.main">
                {moreSettingsExpanded ? 'Fewer settings' : 'More settings (Scale, N-Up, Margins)'}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0, pt: 1.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Paper Size */}
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight="bold">
                  PAPER SIZE
                </Typography>
                <FormControl size="small" fullWidth sx={{ mt: 0.5 }}>
                  <Select value={paperSize} onChange={(e) => setPaperSize(e.target.value)}>
                    <MenuItem value="a4">{PAPER_DIMENSIONS.a4.label}</MenuItem>
                    <MenuItem value="letter">{PAPER_DIMENSIONS.letter.label}</MenuItem>
                    <MenuItem value="legal">{PAPER_DIMENSIONS.legal.label}</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              {/* Pages Per Sheet (N-Up) */}
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight="bold">
                  PAGES PER SHEET (N-UP)
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  fullWidth
                  value={pagesPerSheet}
                  onChange={(_, val) => val && setPagesPerSheet(val)}
                  sx={{ mt: 0.5 }}
                >
                  <ToggleButton value={1}>1</ToggleButton>
                  <ToggleButton value={2}>2</ToggleButton>
                  <ToggleButton value={4}>4</ToggleButton>
                </ToggleButtonGroup>
                {pagesPerSheet > 1 && (
                  <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 0.5, fontWeight: 'bold' }}>
                    Saves {pagesPerSheet === 2 ? '50%' : '75%'} physical paper sheets
                  </Typography>
                )}
              </Box>

              {/* Margins */}
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight="bold">
                  MARGINS
                </Typography>
                <FormControl size="small" fullWidth sx={{ mt: 0.5 }}>
                  <Select value={margins} onChange={(e) => setMargins(e.target.value)}>
                    <MenuItem value="default">{MARGIN_PRESETS.default.label}</MenuItem>
                    <MenuItem value="none">{MARGIN_PRESETS.none.label}</MenuItem>
                    <MenuItem value="minimum">{MARGIN_PRESETS.minimum.label}</MenuItem>
                    <MenuItem value="custom">Custom (mm)</MenuItem>
                  </Select>
                </FormControl>
                {margins === 'custom' && (
                  <Box sx={{ mt: 1, px: 0.5 }}>
                    <Typography variant="caption">Margin size: {customMarginMm} mm</Typography>
                    <Slider
                      value={customMarginMm}
                      min={0}
                      max={30}
                      step={1}
                      onChange={(_, v) => setCustomMarginMm(v)}
                      size="small"
                    />
                  </Box>
                )}
              </Box>

              {/* Scale / Zoom */}
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight="bold">
                  SCALE
                </Typography>
                <FormControl size="small" fullWidth sx={{ mt: 0.5 }}>
                  <Select value={scaleMode} onChange={(e) => setScaleMode(e.target.value)}>
                    <MenuItem value="default">Default (100%)</MenuItem>
                    <MenuItem value="fit_printable">Fit to printable area</MenuItem>
                    <MenuItem value="fit_paper">Fit to paper</MenuItem>
                    <MenuItem value="custom">Custom</MenuItem>
                  </Select>
                </FormControl>
                {scaleMode === 'custom' && (
                  <Box sx={{ mt: 1, px: 0.5 }}>
                    <Typography variant="caption">Custom print scale: {customScalePercent}%</Typography>
                    <Slider
                      value={customScalePercent}
                      min={50}
                      max={180}
                      step={5}
                      onChange={(_, v) => setCustomScalePercent(v)}
                      size="small"
                    />
                  </Box>
                )}
              </Box>

              {/* Two-Sided (Duplex) */}
              <Box>
                <FormControlLabel
                  control={<Checkbox checked={twoSided} onChange={(e) => setTwoSided(e.target.checked)} size="small" />}
                  label={<Typography variant="body2" fontWeight="700">Print on both sides</Typography>}
                />
                {twoSided && (
                  <RadioGroup
                    value={duplexFlip}
                    onChange={(e) => setDuplexFlip(e.target.value)}
                    sx={{ pl: 3 }}
                  >
                    <FormControlLabel
                      value="long"
                      control={<Radio size="small" />}
                      label={<Typography variant="caption">Flip on long edge (booklet)</Typography>}
                    />
                    <FormControlLabel
                      value="short"
                      control={<Radio size="small" />}
                      label={<Typography variant="caption">Flip on short edge (calendar)</Typography>}
                    />
                  </RadioGroup>
                )}
              </Box>

              {/* Options: Headers & Footers */}
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight="bold">
                  OPTIONS
                </Typography>
                <FormControlLabel
                  control={<Checkbox checked={headersFooters} onChange={(e) => setHeadersFooters(e.target.checked)} size="small" />}
                  label={<Typography variant="body2">Headers and footers (#Token & Page No.)</Typography>}
                />

                {/* Xerox binarization for scanned docs */}
                <FormControlLabel
                  control={<Checkbox checked={xeroxMode} onChange={(e) => setXeroxMode(e.target.checked)} size="small" />}
                  label={<Typography variant="body2">Xerox High-Contrast (Clean faint text)</Typography>}
                />
                {xeroxMode && (
                  <Box sx={{ px: 1 }}>
                    <Typography variant="caption" color="text.secondary">Threshold: {xeroxThreshold}</Typography>
                    <Slider
                      value={xeroxThreshold}
                      min={80}
                      max={220}
                      step={5}
                      onChange={(_, v) => setXeroxThreshold(v)}
                      size="small"
                    />
                  </Box>
                )}
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Dynamic Billing Card */}
          <Box
            sx={{
              mt: 'auto',
              p: 2,
              borderRadius: 2,
              bgcolor: 'primary.50',
              border: '1px solid',
              borderColor: 'primary.200',
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="caption" color="text.secondary">
                Selected Pages:
              </Typography>
              <Typography variant="caption" fontWeight="bold">
                {isPdf ? selectedPagesSet.size : 1} pgs
              </Typography>
            </Stack>

            {pagesPerSheet > 1 && (
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.25 }}>
                <Typography variant="caption" color="text.secondary">
                  Pages Per Sheet:
                </Typography>
                <Typography variant="caption" fontWeight="bold" color="secondary.main">
                  {pagesPerSheet}-Up
                </Typography>
              </Stack>
            )}

            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                Physical Sheets to Print:
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {billableSheets} sheets
              </Typography>
            </Stack>

            <Divider sx={{ my: 1 }} />

            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle1" fontWeight="bold" color="primary.dark">
                Total Price:
              </Typography>
              <Typography variant="h6" fontWeight="bold" color="primary.main">
                ₹{estimatedCost}
              </Typography>
            </Stack>
          </Box>
        </Box>
      </DialogContent>

      {/* 3. FOOTER ACTIONS */}
      <DialogActions
        sx={{
          py: 1.25,
          px: 3,
          borderTop: '1px solid',
          borderColor: 'divider',
          justifyContent: 'space-between',
        }}
      >
        <Box>
          {hasBackup && (
            <Button
              variant="outlined"
              color="warning"
              startIcon={<RestoreIcon />}
              onClick={handleRevert}
              disabled={saving}
              size="small"
            >
              Revert to Original
            </Button>
          )}
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button variant="outlined" onClick={onClose} disabled={saving} sx={{ px: 2.5, fontWeight: 600 }}>
            Cancel
          </Button>

          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <PrintIcon />}
            onClick={handleDirectPrint}
            disabled={saving || Boolean(error) || (isPdf && selectedPagesSet.size === 0)}
            sx={{
              fontWeight: 800,
              px: 4,
              py: 1,
              borderRadius: 2,
              fontSize: '0.95rem',
              boxShadow: '0 4px 14px rgba(25, 118, 210, 0.4)',
            }}
          >
            {saving ? 'Processing Print...' : 'Print'}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
