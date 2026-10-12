// src/components/Editor/PdfEditorStudio.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  Paper,
  Divider,
  TextField,
  CircularProgress,
  Alert,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import { PDFDocument, degrees } from 'pdf-lib';

import {
  loadPdfDocument,
  renderPdfPageToCanvas,
  renderPageThumbnailDataUrl,
  parsePageRangeString,
  formatPageRangeString,
} from '../../utils/pdfRenderer';

export default function PdfEditorStudio({
  blob,
  fileName,
  initialPagesSpec = 'all',
  onExportBlob,
  onPageCountChange,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // PDF Source Document reference
  const pdfSourceRef = useRef(null); // { pdfDoc, numPages, rawBuffer }

  // Total pages in source document
  const [totalPages, setTotalPages] = useState(1);

  // Ordered list of pages: [{ id, origPageIndex (1-based), selected: boolean, rotation: number, thumbUrl: string }]
  const [pagesList, setPagesList] = useState([]);

  // Currently viewed page index in pagesList (0-based)
  const [viewIndex, setViewIndex] = useState(0);

  // Text range input (e.g. "1, 3-5")
  const [rangeInput, setRangeInput] = useState(initialPagesSpec || 'all');

  // Zoom scale: 0.4 to 2.5
  const [zoomScale, setZoomScale] = useState(1.0);

  // Main canvas and viewer container references
  const mainCanvasRef = useRef(null);
  const viewerContainerRef = useRef(null);

  // Load PDF on mount / blob change
  useEffect(() => {
    let isCancelled = false;

    async function initPdf() {
      if (!blob) return;
      setLoading(true);
      setError(null);

      try {
        const loaded = await loadPdfDocument(blob);
        if (isCancelled) return;

        pdfSourceRef.current = loaded;
        const total = loaded.numPages;
        setTotalPages(total);

        // Parse initial selected pages
        const initiallySelected = new Set(parsePageRangeString(initialPagesSpec, total));

        // Generate preliminary page objects
        const initialPages = Array.from({ length: total }, (_, i) => {
          const pageNum = i + 1;
          return {
            id: `p-${pageNum}`,
            origPageIndex: pageNum,
            selected: initiallySelected.has(pageNum),
            rotation: 0,
            thumbUrl: null,
          };
        });

        setPagesList(initialPages);
        setViewIndex(0);
        setRangeInput(formatPageRangeString(Array.from(initiallySelected), total));
        setLoading(false);

        // Async render thumbnails for thumbnail rail
        for (let i = 0; i < total; i++) {
          if (isCancelled) break;
          try {
            const pageProxy = await loaded.pdfDoc.getPage(i + 1);
            const thumbUrl = await renderPageThumbnailDataUrl(pageProxy, 140, 0);
            if (!isCancelled) {
              setPagesList((prev) =>
                prev.map((p) => (p.origPageIndex === i + 1 ? { ...p, thumbUrl } : p))
              );
            }
          } catch (thumbErr) {
            console.warn(`Thumbnail generation notice for page ${i + 1}:`, thumbErr);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Failed to load PDF document:', err);
          setError(err.message || 'Failed to load PDF document');
          setLoading(false);
        }
      }
    }

    initPdf();

    return () => {
      isCancelled = true;
    };
  }, [blob, initialPagesSpec]);

  // Render active page to main canvas whenever viewIndex, zoomScale, or rotation changes
  const activePageItem = pagesList[viewIndex];

  useEffect(() => {
    let isCancelled = false;

    async function renderActivePage() {
      if (!pdfSourceRef.current?.pdfDoc || !activePageItem || !mainCanvasRef.current) return;

      try {
        const pageProxy = await pdfSourceRef.current.pdfDoc.getPage(activePageItem.origPageIndex);
        if (isCancelled) return;
        await renderPdfPageToCanvas(
          pageProxy,
          mainCanvasRef.current,
          zoomScale,
          activePageItem.rotation || 0
        );
      } catch (renderErr) {
        if (!isCancelled) {
          console.error('Failed to render main PDF page canvas:', renderErr);
        }
      }
    }

    renderActivePage();

    return () => {
      isCancelled = true;
    };
  }, [activePageItem, zoomScale]);

  // Sync billable page count to parent modal
  useEffect(() => {
    const selectedCount = pagesList.filter((p) => p.selected).length;
    if (onPageCountChange) {
      onPageCountChange(selectedCount);
    }
  }, [pagesList, onPageCountChange]);

  // Handle Range Text Input Change
  const handleRangeInputChange = (e) => {
    const val = e.target.value;
    setRangeInput(val);
    const parsed = new Set(parsePageRangeString(val, totalPages));

    setPagesList((prev) =>
      prev.map((p) => ({
        ...p,
        selected: parsed.has(p.origPageIndex),
      }))
    );
  };

  // Toggle single page selection
  const handleTogglePageSelect = (index) => {
    setPagesList((prev) => {
      const next = prev.map((p, i) => (i === index ? { ...p, selected: !p.selected } : p));
      const selectedNums = next.filter((p) => p.selected).map((p) => p.origPageIndex);
      setRangeInput(formatPageRangeString(selectedNums, totalPages));
      return next;
    });
  };

  // Select all pages
  const handleSelectAll = () => {
    setPagesList((prev) => prev.map((p) => ({ ...p, selected: true })));
    setRangeInput('all');
  };

  // Deselect all pages
  const handleDeselectAll = () => {
    setPagesList((prev) => prev.map((p) => ({ ...p, selected: false })));
    setRangeInput('none');
  };

  // Dynamic Fit Width zoom calculation
  const handleFitWidth = async () => {
    if (!pdfSourceRef.current?.pdfDoc || !activePageItem || !viewerContainerRef.current) return;
    try {
      const pageProxy = await pdfSourceRef.current.pdfDoc.getPage(activePageItem.origPageIndex);
      const isRotated = Math.abs(activePageItem.rotation || 0) % 180 !== 0;
      const vp = pageProxy.getViewport({ scale: 1 });
      const docWidth = isRotated ? vp.height : vp.width;
      const containerWidth = viewerContainerRef.current.clientWidth - 48;
      if (containerWidth > 100 && docWidth > 0) {
        const targetScale = Math.min(2.5, Math.max(0.4, Number((containerWidth / docWidth).toFixed(2))));
        setZoomScale(targetScale);
      }
    } catch (_) {}
  };

  // Dynamic Fit Page zoom calculation
  const handleFitPage = async () => {
    if (!pdfSourceRef.current?.pdfDoc || !activePageItem || !viewerContainerRef.current) return;
    try {
      const pageProxy = await pdfSourceRef.current.pdfDoc.getPage(activePageItem.origPageIndex);
      const isRotated = Math.abs(activePageItem.rotation || 0) % 180 !== 0;
      const vp = pageProxy.getViewport({ scale: 1 });
      const docWidth = isRotated ? vp.height : vp.width;
      const docHeight = isRotated ? vp.width : vp.height;
      const containerWidth = viewerContainerRef.current.clientWidth - 48;
      const containerHeight = viewerContainerRef.current.clientHeight - 80;
      if (containerWidth > 100 && containerHeight > 100 && docWidth > 0 && docHeight > 0) {
        const scaleW = containerWidth / docWidth;
        const scaleH = containerHeight / docHeight;
        const targetScale = Math.min(2.5, Math.max(0.4, Number(Math.min(scaleW, scaleH).toFixed(2))));
        setZoomScale(targetScale);
      }
    } catch (_) {}
  };

  // Rotate current page
  const handleRotateCurrentPage = (deg) => {
    if (!activePageItem) return;
    const targetId = activePageItem.id;
    setPagesList((prev) =>
      prev.map((p) =>
        p.id === targetId
          ? { ...p, rotation: (((p.rotation || 0) + deg) % 360 + 360) % 360 }
          : p
      )
    );
  };

  // Bulk rotate all pages
  const handleRotateAllPages = (deg) => {
    setPagesList((prev) =>
      prev.map((p) => ({
        ...p,
        rotation: (((p.rotation || 0) + deg) % 360 + 360) % 360,
      }))
    );
  };

  // Reorder page up or down
  const handleMovePage = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= pagesList.length) return;

    setPagesList((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });

    if (viewIndex === index) {
      setViewIndex(targetIndex);
    } else if (viewIndex === targetIndex) {
      setViewIndex(index);
    }
  };

  // Delete page
  const handleDeletePage = (index) => {
    if (pagesList.length <= 1) {
      handleTogglePageSelect(index);
      return;
    }

    setPagesList((prev) => {
      const next = prev.filter((_, i) => i !== index);
      const selectedNums = next.filter((p) => p.selected).map((p) => p.origPageIndex);
      setRangeInput(formatPageRangeString(selectedNums, totalPages));
      return next;
    });

    setViewIndex((curr) => {
      if (curr === index) {
        return Math.min(curr, pagesList.length - 2);
      } else if (curr > index) {
        return curr - 1;
      }
      return curr;
    });
  };

  // Export newly assembled PDF via pdf-lib
  const generateProcessedPdfBlob = useCallback(async () => {
    const rawBuffer = pdfSourceRef.current?.rawBuffer;
    if (!rawBuffer) throw new Error('Original PDF buffer not found');

    const selectedPages = pagesList.filter((p) => p.selected);
    if (selectedPages.length === 0) {
      throw new Error('At least one page must be selected to print');
    }

    // Load original PDF in pdf-lib
    const srcDoc = await PDFDocument.load(rawBuffer, { ignoreEncryption: true });
    const newDoc = await PDFDocument.create();

    // Copy selected pages in their customized order
    const pageIndicesToCopy = selectedPages.map((p) => p.origPageIndex - 1);
    const copiedPages = await newDoc.copyPages(srcDoc, pageIndicesToCopy);

    // Apply rotation for each copied page
    copiedPages.forEach((page, i) => {
      const pageMeta = selectedPages[i];
      const existingRotation = page.getRotation().angle || 0;
      const finalRotation = (existingRotation + (pageMeta.rotation || 0)) % 360;
      page.setRotation(degrees(finalRotation));
      newDoc.addPage(page);
    });

    const newPdfBytes = await newDoc.save();
    return new Blob([newPdfBytes], { type: 'application/pdf' });
  }, [pagesList]);

  // Expose export callback to parent
  useEffect(() => {
    if (onExportBlob) {
      onExportBlob(generateProcessedPdfBlob);
    }
  }, [onExportBlob, generateProcessedPdfBlob]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 8, gap: 2 }}>
        <CircularProgress size={32} />
        <Typography variant="body2" color="text.secondary">
          Loading PDF pages...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  const selectedCount = pagesList.filter((p) => p.selected).length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 480, gap: 1.5 }}>
      {/* Top Page Selection & Syntax Toolbar */}
      <Paper
        elevation={0}
        variant="outlined"
        sx={{
          p: 1.25,
          borderRadius: 1.5,
          bgcolor: 'background.paper',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1.5,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, minWidth: 260 }}>
          <TextField
            size="small"
            label="Selected Pages Range"
            placeholder="e.g. 1, 3-5, 8"
            value={rangeInput}
            onChange={handleRangeInputChange}
            sx={{ maxWidth: 220, bgcolor: 'background.paper' }}
            helperText={`${selectedCount} of ${pagesList.length} pages selected`}
          />
          <Button
            size="small"
            variant="outlined"
            onClick={handleSelectAll}
            sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem' }}
          >
            Select All
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={handleDeselectAll}
            sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem' }}
          >
            Deselect All
          </Button>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            size="small"
            variant="outlined"
            onClick={() => handleRotateAllPages(-90)}
            sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem' }}
          >
            Rotate All -90°
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => handleRotateAllPages(90)}
            sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem' }}
          >
            Rotate All +90°
          </Button>
        </Stack>
      </Paper>

      {/* Main Workspace (Thumbnail Rail + Large Page Canvas) */}
      <Box sx={{ display: 'flex', flex: 1, gap: 2, minHeight: 400, position: 'relative' }}>
        {/* Left Thumbnail Rail */}
        <Paper
          elevation={0}
          variant="outlined"
          sx={{
            width: { xs: 150, sm: 180 },
            p: 1,
            borderRadius: 1.5,
            bgcolor: 'background.paper',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.25,
            overflowY: 'auto',
            maxHeight: 520,
            flexShrink: 0,
          }}
        >
          <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase" sx={{ px: 0.5 }}>
            Pages ({pagesList.length})
          </Typography>

          <Stack spacing={1}>
            {pagesList.map((page, idx) => {
              const isCurrent = viewIndex === idx;
              return (
                <Paper
                  key={page.id}
                  variant="outlined"
                  onClick={() => setViewIndex(idx)}
                  sx={{
                    p: 0.75,
                    borderRadius: 1,
                    cursor: 'pointer',
                    borderColor: isCurrent ? 'primary.main' : 'divider',
                    borderWidth: isCurrent ? 2 : 1,
                    bgcolor: isCurrent ? 'action.hover' : 'background.paper',
                    opacity: page.selected ? 1 : 0.45,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Thumbnail Image */}
                  <Box
                    sx={{
                      width: '100%',
                      height: 105,
                      bgcolor: '#f5f5f5',
                      borderRadius: 0.5,
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {page.thumbUrl ? (
                      <Box
                        component="img"
                        src={page.thumbUrl}
                        alt={`Page ${page.origPageIndex}`}
                        sx={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain',
                        }}
                      />
                    ) : (
                      <CircularProgress size={16} />
                    )}
                  </Box>

                  {/* Page Info & Controls */}
                  <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={page.selected}
                          onChange={() => handleTogglePageSelect(idx)}
                          onClick={(e) => e.stopPropagation()}
                          sx={{ p: 0.25 }}
                        />
                      }
                      label={
                        <Typography variant="caption" fontWeight={700}>
                          Page {page.origPageIndex}
                        </Typography>
                      }
                      sx={{ m: 0 }}
                    />

                    <Stack direction="row" spacing={0.5} onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="small"
                        disabled={idx === 0}
                        onClick={() => handleMovePage(idx, -1)}
                        sx={{ minWidth: 'auto', px: 0.5, py: 0.1, fontSize: '0.68rem', textTransform: 'none' }}
                      >
                        Up
                      </Button>
                      <Button
                        size="small"
                        disabled={idx === pagesList.length - 1}
                        onClick={() => handleMovePage(idx, 1)}
                        sx={{ minWidth: 'auto', px: 0.5, py: 0.1, fontSize: '0.68rem', textTransform: 'none' }}
                      >
                        Down
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => handleDeletePage(idx)}
                        sx={{ minWidth: 'auto', px: 0.5, py: 0.1, fontSize: '0.68rem', textTransform: 'none' }}
                      >
                        Del
                      </Button>
                    </Stack>
                  </Box>
                </Paper>
              );
            })}
          </Stack>
        </Paper>

        {/* Center Main Page Viewport Container */}
        <Box
          ref={viewerContainerRef}
          sx={{
            flex: 1,
            borderRadius: 1.5,
            bgcolor: '#202020',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            p: 2,
            overflow: 'auto',
            maxHeight: 520,
          }}
        >
          {/* Main Document Canvas View */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
              bgcolor: '#fff',
              my: 'auto',
            }}
          >
            <canvas ref={mainCanvasRef} />
          </Box>

          {/* Floating Canvas Navigation & Zoom Bar (Clean text buttons, no emojis, no icons) */}
          <Paper
            elevation={3}
            sx={{
              position: 'sticky',
              bottom: 8,
              mt: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1.25,
              py: 0.5,
              borderRadius: 2,
              bgcolor: 'rgba(25, 25, 25, 0.92)',
              backdropFilter: 'blur(8px)',
              zIndex: 10,
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            {/* Previous Page */}
            <Button
              size="small"
              disabled={viewIndex === 0}
              onClick={() => setViewIndex((prev) => Math.max(0, prev - 1))}
              sx={{ color: '#fff', minWidth: 'auto', px: 1, py: 0.25, fontSize: '0.72rem', textTransform: 'none' }}
            >
              Prev
            </Button>

            <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700, px: 0.5 }}>
              Page {viewIndex + 1} / {pagesList.length}
            </Typography>

            {/* Next Page */}
            <Button
              size="small"
              disabled={viewIndex === pagesList.length - 1}
              onClick={() => setViewIndex((prev) => Math.min(pagesList.length - 1, prev + 1))}
              sx={{ color: '#fff', minWidth: 'auto', px: 1, py: 0.25, fontSize: '0.72rem', textTransform: 'none' }}
            >
              Next
            </Button>

            <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.2)', mx: 0.25 }} />

            {/* Rotate Current Page */}
            <Button
              size="small"
              onClick={() => handleRotateCurrentPage(-90)}
              sx={{ color: '#fff', minWidth: 'auto', px: 1, py: 0.25, fontSize: '0.72rem', textTransform: 'none' }}
            >
              Rot -90°
            </Button>
            <Button
              size="small"
              onClick={() => handleRotateCurrentPage(90)}
              sx={{ color: '#fff', minWidth: 'auto', px: 1, py: 0.25, fontSize: '0.72rem', textTransform: 'none' }}
            >
              Rot +90°
            </Button>
            <Button
              size="small"
              onClick={() => handleRotateCurrentPage(180)}
              sx={{ color: '#fff', minWidth: 'auto', px: 1, py: 0.25, fontSize: '0.72rem', textTransform: 'none' }}
            >
              Rot 180°
            </Button>

            <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.2)', mx: 0.25 }} />

            {/* Zoom Controls */}
            <Button
              size="small"
              onClick={() => setZoomScale((prev) => Math.max(0.4, Number((prev - 0.2).toFixed(1))))}
              sx={{ color: '#fff', minWidth: 'auto', px: 0.75, py: 0.25, fontSize: '0.72rem', textTransform: 'none' }}
            >
              Zoom -
            </Button>
            <Typography variant="caption" sx={{ color: '#fff', minWidth: 36, textAlign: 'center' }}>
              {Math.round(zoomScale * 100)}%
            </Typography>
            <Button
              size="small"
              onClick={() => setZoomScale((prev) => Math.min(2.5, Number((prev + 0.2).toFixed(1))))}
              sx={{ color: '#fff', minWidth: 'auto', px: 0.75, py: 0.25, fontSize: '0.72rem', textTransform: 'none' }}
            >
              Zoom +
            </Button>

            <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.2)', mx: 0.25 }} />

            <Button
              size="small"
              onClick={handleFitWidth}
              sx={{ color: '#fff', minWidth: 'auto', px: 0.75, py: 0.25, fontSize: '0.72rem', textTransform: 'none' }}
            >
              Fit Width
            </Button>
            <Button
              size="small"
              onClick={handleFitPage}
              sx={{ color: '#fff', minWidth: 'auto', px: 0.75, py: 0.25, fontSize: '0.72rem', textTransform: 'none' }}
            >
              Fit Page
            </Button>
            <Button
              size="small"
              onClick={() => setZoomScale(1.0)}
              sx={{ color: '#fff', minWidth: 'auto', px: 0.75, py: 0.25, fontSize: '0.72rem', textTransform: 'none' }}
            >
              100%
            </Button>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
