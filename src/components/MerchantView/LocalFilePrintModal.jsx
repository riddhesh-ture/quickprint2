// src/components/MerchantView/LocalFilePrintModal.jsx
import React, { useState, useRef, useId, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  Stack,
  TextField,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  InputAdornment,
} from '@mui/material';

import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';
import DescriptionIcon from '@mui/icons-material/Description';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import PrintIcon from '@mui/icons-material/Print';
import QueueIcon from '@mui/icons-material/Queue';
import EditIcon from '@mui/icons-material/Edit';

import { createPrintJob } from '../../supabase/db';
import { saveJobBlob } from '../../utils/localJobStorage';
import {
  getPdfPageCount,
  getFileCategory,
  formatFileSize,
  calculateBillablePages,
} from '../../utils/fileValidation';

export default function LocalFilePrintModal({
  open,
  onClose,
  merchantId,
  merchantName = 'QuickPrint',
  pricePerPageBW = 2,
  pricePerPageColor = 5,
  onPrintJob,
  onEditDoc,
  onJobCreated,
}) {
  const [files, setFiles] = useState([]);
  const [customerName, setCustomerName] = useState('Counter (Direct)');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const fileInputId = useId();

  // Reset state on close
  const handleModalClose = () => {
    if (loading) return;
    setFiles([]);
    setCustomerName('Counter (Direct)');
    setError(null);
    onClose?.();
  };

  // Inspect and parse files into items with initial print specs
  const processIncomingFiles = useCallback(async (selectedFiles) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      const parsed = await Promise.all(
        Array.from(selectedFiles).map(async (file) => {
          let pageCount = 1;
          const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
          if (isPdf) {
            try {
              const res = await getPdfPageCount(file);
              pageCount = (typeof res === 'object' ? res?.pageCount : res) || 1;
            } catch {
              pageCount = 1;
            }
          }

          return {
            id: `${file.name}_${file.size}_${Date.now()}_${Math.random()}`,
            file,
            name: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream',
            pageCount: Math.max(1, pageCount),
            specs: {
              color: 'bw',
              duplex: false,
              copies: 1,
              pages: 'all',
              pagesPerSheet: 1,
              pageCount: Math.max(1, pageCount),
            },
          };
        })
      );

      setFiles((prev) => [...prev, ...parsed]);
    } catch (err) {
      console.error('Error reading files:', err);
      setError(`Failed to read files: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFileInputChange = (e) => {
    const list = e.target.files;
    processIncomingFiles(list);
    e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      processIncomingFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateSpec = (index, key, value) => {
    setFiles((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        return {
          ...item,
          specs: {
            ...item.specs,
            [key]: value,
          },
        };
      })
    );
  };

  // Cost calculations
  const calculateItemCost = (item) => {
    const billableSheets = calculateBillablePages(
      item.pageCount,
      item.specs.pages,
      item.specs.duplex,
      item.specs.pagesPerSheet
    );
    const rate = item.specs.color === 'color' ? pricePerPageColor : pricePerPageBW;
    const copies = Math.max(1, parseInt(item.specs.copies, 10) || 1);
    return billableSheets * rate * copies;
  };

  const totalCost = files.reduce((acc, item) => acc + calculateItemCost(item), 0);
  const totalBillableSheets = files.reduce(
    (acc, item) =>
      acc +
      calculateBillablePages(
        item.pageCount,
        item.specs.pages,
        item.specs.duplex,
        item.specs.pagesPerSheet
      ) *
        (parseInt(item.specs.copies, 10) || 1),
    0
  );

  // Job Creation (Save to Supabase/Local + save blobs to IndexedDB)
  const submitJob = async (actionType = 'queue', targetFileIndex = 0) => {
    if (files.length === 0) {
      setError('Please select at least one file to print.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const pin = String(Math.floor(1000 + Math.random() * 9000));
      const jobPayload = {
        merchantId,
        customerName: customerName.trim() || 'Counter (Direct)',
        status: 'pending',
        pin,
        tokenNumber: pin,
        totalCost,
        paymentMethod: 'cash',
        paymentStatus: 'pending',
        files: files.map((item) => ({
          name: item.name,
          size: item.size,
          type: item.type,
          pageCount: item.pageCount,
          specs: item.specs,
        })),
      };

      let createdJob = null;
      try {
        createdJob = await createPrintJob(jobPayload);
      } catch (cloudErr) {
        console.warn('Could not persist local job to cloud database, saving local fallback:', cloudErr);
        createdJob = {
          ...jobPayload,
          id: `local_${Date.now()}`,
          created_at: new Date().toISOString(),
        };
      }

      // Save all binary blobs to local IndexedDB
      for (let i = 0; i < files.length; i++) {
        await saveJobBlob(createdJob.id, i, files[i].file);
      }

      const fullJob = {
        ...createdJob,
        files: files.map((item) => ({
          name: item.name,
          size: item.size,
          type: item.type,
          pageCount: item.pageCount,
          specs: item.specs,
          file: item.file,
          blob: item.file,
        })),
      };

      onJobCreated?.();
      handleModalClose();

      if (actionType === 'print') {
        onPrintJob?.(fullJob);
      } else if (actionType === 'edit') {
        onEditDoc?.(fullJob, targetFileIndex);
      }
    } catch (err) {
      console.error('Failed to create local print job:', err);
      setError(`Failed to process job: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (file) => {
    const cat = getFileCategory(file);
    if (cat === 'pdf') return <PictureAsPdfIcon sx={{ color: 'error.main' }} />;
    if (cat === 'image') return <ImageIcon sx={{ color: 'primary.main' }} />;
    return <DescriptionIcon sx={{ color: 'info.main' }} />;
  };

  return (
    <Dialog
      open={Boolean(open)}
      onClose={handleModalClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: 2,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PrintIcon fontSize="small" />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Print File
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Upload and print documents directly from your computer for {merchantName}
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={handleModalClose} disabled={loading} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2.5, pb: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Customer Name and Pricing Bar */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          sx={{ mb: 2.5 }}
        >
          <TextField
            label="Customer Name / Note"
            size="small"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            disabled={loading}
            sx={{ flex: 1 }}
          />
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              label={`B&W: ₹${pricePerPageBW}/pg`}
              size="small"
              variant="outlined"
              color="default"
            />
            <Chip
              label={`Color: ₹${pricePerPageColor}/pg`}
              size="small"
              variant="outlined"
              color="secondary"
            />
          </Stack>
        </Stack>

        {/* Drag & Drop File Zone */}
        <Box
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          sx={{
            border: '2px dashed',
            borderColor: dragActive ? 'primary.main' : 'divider',
            bgcolor: dragActive ? 'action.hover' : 'background.default',
            borderRadius: 3,
            p: 3,
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            mb: 2.5,
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: 'action.hover',
            },
          }}
        >
          <input
            id={fileInputId}
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.bmp"
            style={{ display: 'none' }}
            onChange={handleFileInputChange}
          />
          <CloudUploadIcon sx={{ fontSize: 44, color: 'primary.main', mb: 1 }} />
          <Typography variant="subtitle1" fontWeight={700}>
            Click to browse or drop documents here
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Supported formats: PDF, Word (DOCX/DOC), Images (JPG, PNG, WEBP)
          </Typography>
        </Box>

        {/* Selected Files List */}
        {files.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
              Selected Documents ({files.length})
            </Typography>

            {files.map((item, index) => {
              const itemCost = calculateItemCost(item);
              const billableSheets = calculateBillablePages(
                item.pageCount,
                item.specs.pages,
                item.specs.duplex,
                item.specs.pagesPerSheet
              );

              return (
                <Box
                  key={item.id}
                  sx={{
                    p: 2,
                    borderRadius: 2.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1.5}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', md: 'center' }}
                  >
                    {/* File Info */}
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 200, flex: 1 }}>
                      {getFileIcon(item.file)}
                      <Box sx={{ overflow: 'hidden' }}>
                        <Typography
                          variant="body2"
                          fontWeight={700}
                          noWrap
                          title={item.name}
                          sx={{ maxWidth: { xs: 240, sm: 320 } }}
                        >
                          {item.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatFileSize(item.size)} • {item.pageCount} {item.pageCount === 1 ? 'page' : 'pages'}
                        </Typography>
                      </Box>
                    </Stack>

                    {/* Print Specs Controls */}
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      flexWrap="wrap"
                      sx={{ gap: 1 }}
                    >
                      {/* B&W vs Color Toggle */}
                      <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={item.specs.color}
                        onChange={(_, val) => val && handleUpdateSpec(index, 'color', val)}
                      >
                        <ToggleButton value="bw" sx={{ px: 1.5, py: 0.5, fontSize: '0.75rem', fontWeight: 600 }}>
                          B&W
                        </ToggleButton>
                        <ToggleButton value="color" sx={{ px: 1.5, py: 0.5, fontSize: '0.75rem', fontWeight: 600 }}>
                          Color
                        </ToggleButton>
                      </ToggleButtonGroup>

                      {/* Duplex Toggle */}
                      <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={item.specs.duplex ? 'double' : 'single'}
                        onChange={(_, val) => val && handleUpdateSpec(index, 'duplex', val === 'double')}
                      >
                        <ToggleButton value="single" sx={{ px: 1.5, py: 0.5, fontSize: '0.75rem', fontWeight: 600 }}>
                          1-Sided
                        </ToggleButton>
                        <ToggleButton value="double" sx={{ px: 1.5, py: 0.5, fontSize: '0.75rem', fontWeight: 600 }}>
                          2-Sided
                        </ToggleButton>
                      </ToggleButtonGroup>

                      {/* Copies Input */}
                      <TextField
                        label="Copies"
                        type="number"
                        size="small"
                        value={item.specs.copies}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                          handleUpdateSpec(index, 'copies', val);
                        }}
                        inputProps={{ min: 1, max: 999 }}
                        sx={{ width: 75 }}
                      />

                      {/* Page Range Input */}
                      <TextField
                        label="Pages"
                        size="small"
                        placeholder="all or 1-3"
                        value={item.specs.pages}
                        onChange={(e) => handleUpdateSpec(index, 'pages', e.target.value)}
                        sx={{ width: 100 }}
                      />

                      {/* Cost Badge */}
                      <Chip
                        label={`₹${itemCost}`}
                        color="primary"
                        variant="filled"
                        size="small"
                        sx={{ fontWeight: 700, minWidth: 55 }}
                      />

                      {/* Edit Doc in DocumentEditorModal */}
                      {onEditDoc && (
                        <Tooltip title="Preview & Edit Document">
                          <IconButton
                            size="small"
                            color="info"
                            onClick={() => submitJob('edit', index)}
                            disabled={loading}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}

                      {/* Remove file */}
                      <Tooltip title="Remove File">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleRemoveFile(index)}
                          disabled={loading}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </Box>
              );
            })}
          </Box>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Typography variant="body2" color="text.secondary">
            Total Sheets: <strong>{totalBillableSheets}</strong>
          </Typography>
          <Typography variant="subtitle1" fontWeight={800} color="primary.main">
            Total: ₹{totalCost}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1.5}>
          <Button onClick={handleModalClose} disabled={loading} color="inherit">
            Cancel
          </Button>

          <Button
            variant="outlined"
            color="primary"
            startIcon={loading ? <CircularProgress size={16} /> : <QueueIcon />}
            onClick={() => submitJob('queue')}
            disabled={loading || files.length === 0}
            sx={{ fontWeight: 700 }}
          >
            Add to Queue
          </Button>

          <Button
            variant="contained"
            color="primary"
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <PrintIcon />}
            onClick={() => submitJob('print')}
            disabled={loading || files.length === 0}
            sx={{
              fontWeight: 700,
              boxShadow: '0 2px 8px rgba(25, 118, 210, 0.3)',
            }}
          >
            Print Now
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
