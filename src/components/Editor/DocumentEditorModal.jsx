// src/components/Editor/DocumentEditorModal.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';

import ImageEditorStudio from './ImageEditorStudio';
import PdfEditorStudio from './PdfEditorStudio';
import { getJobBlob, hasOriginalJobBlob, saveJobBlob } from '../../utils/localJobStorage';
import { getFileCategory, getPdfPageCount } from '../../utils/fileValidation';

export default function DocumentEditorModal({
  open,
  onClose,
  job,
  fileIndex = 0,
  onSaveEdits,
  onRevertEdits,
  onPrintJob,
  pricePerPageBW = 2,
  pricePerPageColor = 5,
}) {
  const [fileBlob, setFileBlob] = useState(null);
  const [loadingFile, setLoadingFile] = useState(true);
  const [fileError, setFileError] = useState(null);
  const [hasBackup, setHasBackup] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef(null);

  // Active file metadata & print specs
  const file = job?.files?.[fileIndex] || null;
  const [specs, setSpecs] = useState({
    color: 'bw',
    duplex: false,
    copies: 1,
    pages: 'all',
  });
  const [activeDocPageCount, setActiveDocPageCount] = useState(1);

  // Studio export callback holder
  const exportGeneratorRef = useRef(null);

  // Initialize or fetch file blob on open / job / fileIndex change
  useEffect(() => {
    if (!open || !job || !file) {
      setFileBlob(null);
      setFileError(null);
      return;
    }

    let isMounted = true;
    setLoadingFile(true);
    setFileError(null);

    const initialSpecs = file.specs || {};
    setSpecs({
      color: initialSpecs.color === 'color' ? 'color' : 'bw',
      duplex: Boolean(initialSpecs.duplex || initialSpecs.sides === 'double'),
      copies: parseInt(initialSpecs.copies, 10) || 1,
      pages: initialSpecs.pages || 'all',
    });
    setActiveDocPageCount(file.pageCount || initialSpecs.pageCount || 1);

    async function loadBlob() {
      try {
        let blob = await getJobBlob(job.id, fileIndex);

        // Check if file object itself has blob/file in memory
        if (!blob && file.blob instanceof Blob) {
          blob = file.blob;
          try {
            await saveJobBlob(job.id, fileIndex, blob);
          } catch (_) {}
        } else if (!blob && file.file instanceof Blob) {
          blob = file.file;
          try {
            await saveJobBlob(job.id, fileIndex, blob);
          } catch (_) {}
        }

        if (!blob) {
          if (isMounted) {
            setFileBlob(null);
            setLoadingFile(false);
          }
          return;
        }

        const backupExists = await hasOriginalJobBlob(job.id, fileIndex);

        if (isMounted) {
          setFileBlob(blob);
          setHasBackup(backupExists || Boolean(file.isEdited));
          setLoadingFile(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error loading document in editor:', err);
          setFileError(err.message || 'Failed to load file');
          setLoadingFile(false);
        }
      }
    }

    loadBlob();

    return () => {
      isMounted = false;
    };
  }, [open, job, fileIndex, file]);

  const fileCategory = useMemo(() => {
    if (!file && !fileBlob) return 'unknown';
    if (fileBlob) return getFileCategory(fileBlob);
    if (file) return getFileCategory(file);
    return 'unknown';
  }, [file, fileBlob]);

  // Live billable calculation (activeDocPageCount is the exact count of pages in edited output)
  const { totalBillable, estimatedCost } = useMemo(() => {
    const billable = specs.duplex ? Math.ceil(activeDocPageCount / 2) : activeDocPageCount;
    const copies = specs.copies || 1;
    const price = specs.color === 'color' ? pricePerPageColor : pricePerPageBW;
    const cost = billable * copies * price;
    return {
      totalBillable: billable * copies,
      estimatedCost: cost.toFixed(2),
    };
  }, [activeDocPageCount, specs.duplex, specs.copies, specs.color, pricePerPageBW, pricePerPageColor]);

  // Handle Download File
  const handleDownloadFile = () => {
    if (!fileBlob || !file) return;
    const url = URL.createObjectURL(fileBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name || 'document';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Manual File Selection Fallback if file was not received via relay
  const handleManualFileSelect = async (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setLoadingFile(true);
    setFileError(null);

    try {
      await saveJobBlob(job.id, fileIndex, selected);
      setFileBlob(selected);

      let detectedPages = 1;
      const cat = getFileCategory(selected);
      if (cat === 'pdf') {
        try {
          detectedPages = await getPdfPageCount(selected);
        } catch (_) {
          detectedPages = 1;
        }
      }
      setActiveDocPageCount(detectedPages);
      setSpecs((prev) => ({
        ...prev,
        pageCount: detectedPages,
        pages: 'all',
      }));
    } catch (err) {
      console.error('Manual file save error:', err);
      setFileError('Failed to load selected file: ' + err.message);
    } finally {
      setLoadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Revert to original unedited document
  const handleRevert = async () => {
    if (!job || !onRevertEdits) return;
    if (!window.confirm('Revert all edits to this file and restore the original?')) return;

    setIsSaving(true);
    try {
      await onRevertEdits(job, fileIndex);
      // Reload blob and metadata
      const origBlob = await getJobBlob(job.id, fileIndex);
      if (origBlob) {
        setFileBlob(origBlob);
        setHasBackup(false);
        let origPageCount = 1;
        if (fileCategory === 'pdf') {
          try {
            origPageCount = await getPdfPageCount(origBlob);
          } catch (_) {
            origPageCount = 1;
          }
        }
        setActiveDocPageCount(origPageCount);
        setSpecs((prev) => ({
          ...prev,
          pages: 'all',
          pageCount: origPageCount,
        }));
      }
    } catch (err) {
      alert(`Revert failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Save changes
  const handleSave = async (shouldPrintAfter = false) => {
    if (!job || !onSaveEdits) return;
    setIsSaving(true);

    try {
      let updatedBlob = null;
      let newPageCount = activeDocPageCount;

      if (exportGeneratorRef.current) {
        updatedBlob = await exportGeneratorRef.current();
      }

      const finalSpecs = {
        ...specs,
        pages: 'all',
        pageCount: newPageCount,
      };

      const updatedJob = await onSaveEdits(job, fileIndex, updatedBlob, finalSpecs, newPageCount);

      if (shouldPrintAfter && onPrintJob) {
        onClose();
        // Invoke secure print with newly updated job to preserve fresh specs and cost
        await onPrintJob(updatedJob || job);
      } else {
        onClose();
      }
    } catch (err) {
      console.error('Save error:', err);
      alert(`Failed to save edits: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={isSaving ? undefined : onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        },
      }}
    >
      {/* Hidden file input for manual file loading */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleManualFileSelect}
      />

      {/* Dialog Header */}
      <DialogTitle
        sx={{
          py: 1.25,
          px: 2.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
          <Chip
            label={fileCategory.toUpperCase()}
            size="small"
            color={fileCategory === 'pdf' ? 'secondary' : 'primary'}
            sx={{ fontWeight: 800, fontSize: '0.72rem', height: 22 }}
          />
          <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ maxWidth: { xs: 200, sm: 360, md: 500 } }}>
            {file?.name || 'Document Editor'}
          </Typography>
          {(hasBackup || file?.isEdited) && (
            <Chip label="Edited" size="small" color="warning" variant="outlined" sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }} />
          )}
        </Box>

        <Stack direction="row" spacing={1} alignItems="center">
          {/* Download File Button */}
          {fileBlob && (
            <Button
              size="small"
              variant="outlined"
              onClick={handleDownloadFile}
              sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem' }}
            >
              Download
            </Button>
          )}

          {/* Revert to Original Button */}
          {hasBackup && (
            <Button
              variant="outlined"
              color="warning"
              size="small"
              onClick={handleRevert}
              disabled={isSaving}
              sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem' }}
            >
              Revert Original
            </Button>
          )}

          {/* Close Dialog */}
          <Button
            size="small"
            variant="text"
            color="inherit"
            onClick={onClose}
            disabled={isSaving}
            sx={{ textTransform: 'none', fontWeight: 700, minWidth: 40 }}
          >
            Close
          </Button>
        </Stack>
      </DialogTitle>

      {/* Dialog Workspace Body */}
      <DialogContent sx={{ p: 2, display: 'flex', flexDirection: 'column', bgcolor: '#fafafa', overflow: 'hidden' }}>
        {loadingFile ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 8, gap: 2 }}>
            <CircularProgress size={32} />
            <Typography variant="body2" color="text.secondary">
              Loading document...
            </Typography>
          </Box>
        ) : fileError ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Alert severity="error" sx={{ mb: 2 }}>
              {fileError}
            </Alert>
            <Button
              variant="contained"
              onClick={() => fileInputRef.current?.click()}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              Select File From Computer
            </Button>
          </Box>
        ) : !fileBlob ? (
          <Box sx={{ p: 6, textAlign: 'center', maxWidth: 460, mx: 'auto' }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              File Not Found in Local Cache
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
              The file data is not present in local station memory. You can select and load the file directly from this computer:
            </Typography>
            <Button
              variant="contained"
              onClick={() => fileInputRef.current?.click()}
              sx={{ textTransform: 'none', fontWeight: 700, px: 3, py: 1 }}
            >
              Select File From Computer
            </Button>
          </Box>
        ) : fileCategory === 'image' ? (
          <ImageEditorStudio
            blob={fileBlob}
            fileName={file?.name}
            onExportBlob={(generator) => {
              exportGeneratorRef.current = generator;
            }}
            isExporting={isSaving}
          />
        ) : fileCategory === 'pdf' ? (
          <PdfEditorStudio
            blob={fileBlob}
            fileName={file?.name}
            initialPagesSpec={specs.pages}
            onExportBlob={(generator) => {
              exportGeneratorRef.current = generator;
            }}
            onPageCountChange={(count) => {
              setActiveDocPageCount(count);
            }}
          />
        ) : (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Alert severity="info">
              Preview and editing is supported for PDF documents and image files (JPG, PNG, WEBP).
            </Alert>
          </Box>
        )}
      </DialogContent>

      {/* Dialog Bottom Action Dock */}
      <DialogActions
        sx={{
          py: 1.25,
          px: 2.5,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1.5,
        }}
      >
        {/* Print Specifications Controls */}
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
          {/* Color vs B&W */}
          <ToggleButtonGroup
            value={specs.color}
            exclusive
            onChange={(_, val) => {
              if (val) setSpecs((prev) => ({ ...prev, color: val }));
            }}
            size="small"
          >
            <ToggleButton value="bw" sx={{ px: 1.5, py: 0.5, fontWeight: 700, fontSize: '0.78rem' }}>
              B&W
            </ToggleButton>
            <ToggleButton value="color" sx={{ px: 1.5, py: 0.5, fontWeight: 700, fontSize: '0.78rem' }}>
              Color
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Single vs Duplex */}
          <ToggleButtonGroup
            value={specs.duplex ? 'double' : 'single'}
            exclusive
            onChange={(_, val) => {
              if (val) setSpecs((prev) => ({ ...prev, duplex: val === 'double' }));
            }}
            size="small"
          >
            <ToggleButton value="single" sx={{ px: 1.5, py: 0.5, fontWeight: 600, fontSize: '0.78rem' }}>
              Single
            </ToggleButton>
            <ToggleButton value="double" sx={{ px: 1.5, py: 0.5, fontWeight: 600, fontSize: '0.78rem' }}>
              Duplex
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Copies Stepper */}
          <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 0.5 }}>
            <Button
              size="small"
              onClick={() => setSpecs((prev) => ({ ...prev, copies: Math.max(1, (prev.copies || 1) - 1) }))}
              disabled={specs.copies <= 1}
              sx={{ minWidth: 28, px: 0.5, py: 0.25, fontWeight: 700 }}
            >
              -
            </Button>
            <Typography variant="body2" fontWeight={700} sx={{ px: 1, minWidth: 20, textAlign: 'center' }}>
              {specs.copies} {specs.copies > 1 ? 'copies' : 'copy'}
            </Typography>
            <Button
              size="small"
              onClick={() => setSpecs((prev) => ({ ...prev, copies: (prev.copies || 1) + 1 }))}
              sx={{ minWidth: 28, px: 0.5, py: 0.25, fontWeight: 700 }}
            >
              +
            </Button>
          </Box>
        </Stack>

        {/* Live Billable Summary & Final Save/Print Actions */}
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ textAlign: 'right', mr: 1 }}>
            <Typography variant="caption" color="text.secondary" display="block">
              {totalBillable} billable {totalBillable === 1 ? 'page' : 'pages'}
            </Typography>
            <Typography variant="subtitle2" fontWeight={800} color="primary.main">
              ₹{estimatedCost}
            </Typography>
          </Box>

          <Button
            variant="outlined"
            color="primary"
            onClick={() => handleSave(false)}
            disabled={isSaving || loadingFile || !fileBlob || Boolean(fileError) || activeDocPageCount === 0}
            sx={{ fontWeight: 700, textTransform: 'none' }}
          >
            {isSaving ? 'Saving...' : 'Apply & Save'}
          </Button>

          <Button
            variant="contained"
            color="primary"
            onClick={() => handleSave(true)}
            disabled={isSaving || loadingFile || !fileBlob || Boolean(fileError) || activeDocPageCount === 0}
            sx={{ fontWeight: 800, textTransform: 'none' }}
          >
            {isSaving ? 'Saving...' : 'Save & Print'}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
