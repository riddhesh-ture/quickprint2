// src/components/UserView/FileUploader.jsx
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Box, Typography, Paper, Alert } from '@mui/material';
import RawUploadFileIcon from '@mui/icons-material/UploadFile';
import RawAddIcon from '@mui/icons-material/Add';
import { unwrapIcon } from '../../utils/iconHelper';
import { MAX_FILE_SIZE } from '../../utils/fileValidation';
import { useThemeMode } from '../../context/ThemeContext';

const UploadFileIcon = unwrapIcon(RawUploadFileIcon);
const AddIcon = unwrapIcon(RawAddIcon);

export default function FileUploader({ onFilesAdded, hasFiles = false }) {
  const [error, setError] = useState(null);
  const { isDark, colors } = useThemeMode();

  // Mobile-first mode preference: defaults to button on mobile screens (<640px)
  const [mode, setMode] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      return 'button';
    }
    return 'button';
  });

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    setError(null);

    // Handle rejected files
    if (rejectedFiles && rejectedFiles.length > 0) {
      const errors = rejectedFiles.map((f) => {
        if (f.errors?.[0]?.code === 'file-too-large') {
          return `${f.file.name}: Exceeds maximum 50MB size limit`;
        }
        if (f.errors?.[0]?.code === 'file-invalid-type') {
          return `${f.file.name}: Unsupported format. Only PDF, Images (JPG, PNG, WebP), and Word (DOC, DOCX) allowed`;
        }
        return `${f.file.name}: ${f.errors?.[0]?.message || 'Invalid file'}`;
      });
      setError(errors.join('. '));
    }

    // Process accepted files
    if (acceptedFiles && acceptedFiles.length > 0) {
      onFilesAdded(acceptedFiles);
    }
  }, [onFilesAdded]);

  const { getRootProps, getinputprops, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxSize: MAX_FILE_SIZE, // 50MB
    multiple: true,
  });

  return (
    <Box>
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2, borderRadius: '12px' }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {/* Mode Switcher: Mobile Button vs Drop Zone */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.25 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: colors.textSecondary, letterSpacing: '0.04em' }}>
          DOCUMENT UPLOAD
        </Typography>
        <Box
          sx={{
            display: 'inline-flex',
            bgcolor: isDark ? 'rgba(255,255,255,0.06)' : '#edf2f7',
            p: '3px',
            borderRadius: '10px',
            gap: 0.5,
          }}
        >
          <Box
            component="button"
            type="button"
            onClick={() => setMode('button')}
            sx={{
              border: 0,
              bgcolor: mode === 'button' ? (isDark ? colors.surface : '#ffffff') : 'transparent',
              color: mode === 'button' ? colors.primary : colors.textSecondary,
              fontWeight: 700,
              fontSize: '0.75rem',
              py: 0.35,
              px: 1.25,
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: mode === 'button' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            Button
          </Box>
          <Box
            component="button"
            type="button"
            onClick={() => setMode('dropzone')}
            sx={{
              border: 0,
              bgcolor: mode === 'dropzone' ? (isDark ? colors.surface : '#ffffff') : 'transparent',
              color: mode === 'dropzone' ? colors.primary : colors.textSecondary,
              fontWeight: 700,
              fontSize: '0.75rem',
              py: 0.35,
              px: 1.25,
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: mode === 'dropzone' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            Drop Zone
          </Box>
        </Box>
      </Box>

      {/* 1. When files are already present */}
      {hasFiles ? (
        <Paper
          elevation={0}
          {...getRootProps()}
          sx={{
            p: 1.75,
            borderRadius: '14px',
            bgcolor: isDragActive
              ? (isDark ? 'rgba(37, 99, 235, 0.16)' : '#eff6ff')
              : (isDark ? colors.surface : '#ffffff'),
            border: `2px dashed ${isDragActive ? colors.primary : (isDark ? 'rgba(255, 255, 255, 0.2)' : '#93c5fd')}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.25,
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: isDragActive ? 'scale(1.01)' : 'none',
            '&:hover': {
              borderColor: colors.primary,
              bgcolor: isDark ? 'rgba(37, 99, 235, 0.12)' : '#eff6ff',
            },
          }}
        >
          <input {...getinputprops()} />
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              bgcolor: isDark ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff',
              color: colors.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AddIcon sx={{ fontSize: 20 }} />
          </Box>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 800,
              color: colors.primary,
              fontSize: '0.92rem',
              fontFamily: '"Plus Jakarta Sans", sans-serif',
            }}
          >
            {isDragActive ? 'Drop to Add More Documents' : 'Add Another Document'}
          </Typography>
        </Paper>
      ) : mode === 'button' ? (
        /* 2. Mobile-First Button Mode (Single Tap Target) */
        <Paper
          elevation={0}
          {...getRootProps()}
          sx={{
            p: 2.25,
            borderRadius: '16px',
            bgcolor: isDragActive
              ? (isDark ? 'rgba(37, 99, 235, 0.16)' : '#eff6ff')
              : (isDark ? colors.surface : '#ffffff'),
            border: `2px solid ${isDragActive ? colors.primary : colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            '&:hover': {
              borderColor: colors.primary,
              bgcolor: isDark ? 'rgba(37, 99, 235, 0.08)' : '#f8faff',
            },
            '&:active': {
              transform: 'scale(0.99)',
            },
          }}
        >
          <input {...getinputprops()} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                bgcolor: colors.primary,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 3px 10px rgba(37, 99, 235, 0.25)',
              }}
            >
              <UploadFileIcon sx={{ fontSize: 24 }} />
            </Box>
            <Box>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 800,
                  fontSize: '0.98rem',
                  color: colors.text,
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                }}
              >
                Select Document to Print
              </Typography>
              <Typography variant="caption" sx={{ color: colors.textSecondary, display: 'block' }}>
                Tap to browse • PDF, Images, Word (Up to 50MB)
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
              px: 2,
              py: 0.85,
              borderRadius: '10px',
              bgcolor: isDark ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff',
              color: colors.primary,
              fontWeight: 800,
              fontSize: '0.82rem',
              border: `1px solid ${isDark ? 'rgba(37, 99, 235, 0.4)' : '#bfdbfe'}`,
            }}
          >
            Browse
          </Box>
        </Paper>
      ) : (
        /* 3. Drop Zone Mode (Drag & Drop + Tap Area) */
        <Paper
          elevation={0}
          {...getRootProps()}
          sx={{
            p: { xs: 2.75, sm: 3.5 },
            borderRadius: '16px',
            bgcolor: isDragActive
              ? (isDark ? 'rgba(37, 99, 235, 0.16)' : '#eff6ff')
              : (isDark ? colors.surface : '#f8faff'),
            border: '2px dashed',
            borderColor: isDragActive
              ? colors.primary
              : (isDark ? 'rgba(255, 255, 255, 0.16)' : '#93c5fd'),
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: isDragActive ? 'scale(1.01)' : 'none',
            '&:hover': {
              borderColor: colors.primary,
              bgcolor: isDark ? 'rgba(37, 99, 235, 0.12)' : '#eff6ff',
            },
          }}
        >
          <input {...getinputprops()} />
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              bgcolor: colors.primary,
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 1.5,
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
            }}
          >
            <UploadFileIcon sx={{ fontSize: 28 }} />
          </Box>

          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 800,
              color: colors.text,
              fontSize: '1.05rem',
              fontFamily: '"Plus Jakarta Sans", sans-serif',
            }}
          >
            {isDragActive ? 'Drop your files here' : 'Drop Files or Tap to Browse'}
          </Typography>

          <Typography variant="body2" sx={{ color: colors.textSecondary, mt: 0.5, mb: 2, fontSize: '0.82rem' }}>
            Supports PDF, Images, Word Documents (Auto-scaled to A4)
          </Typography>

          <Box
            component="span"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              px: 2.75,
              py: 1,
              borderRadius: '10px',
              bgcolor: isDark ? 'rgba(37, 99, 235, 0.18)' : '#eff6ff',
              color: colors.primary,
              fontWeight: 700,
              fontSize: '0.86rem',
              border: `1px solid ${isDark ? 'rgba(37, 99, 235, 0.35)' : '#bfdbfe'}`,
              transition: 'all 0.15s ease',
              '&:hover': {
                bgcolor: isDark ? 'rgba(37, 99, 235, 0.28)' : '#dbeafe',
              },
            }}
          >
            <AddIcon sx={{ fontSize: 18 }} />
            <span>Select Document</span>
          </Box>
        </Paper>
      )}
    </Box>
  );
}