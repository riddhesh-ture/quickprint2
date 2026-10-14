// src/components/UserView/FileUploader.jsx
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Box, Typography, Paper, Alert } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AddIcon from '@mui/icons-material/Add';
import { MAX_FILE_SIZE } from '../../utils/fileValidation';
import { useThemeMode } from '../../context/ThemeContext';

export default function FileUploader({ onFilesAdded, hasFiles = false }) {
  const [error, setError] = useState(null);
  const { isDark, colors } = useThemeMode();

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    setError(null);

    // Handle rejected files
    if (rejectedFiles && rejectedFiles.length > 0) {
      const errors = rejectedFiles.map((f) => {
        if (f.errors?.[0]?.code === 'file-too-large') {
          return `${f.file.name}: Exceeds maximum 25MB size limit`;
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxSize: MAX_FILE_SIZE, // 25MB
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

      {/* Header */}
      <Box sx={{ mb: 1.25 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: colors.textSecondary, letterSpacing: '0.04em' }}>
          DOCUMENT UPLOAD
        </Typography>
      </Box>

      {/* 1. When files are already present: Compact Add More Button */}
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
          <input {...getInputProps()} />
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
      ) : (
        /* 2. Mobile-First Single Tap Target Card */
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
          <input {...getInputProps()} />
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
                Tap to browse • PDF, Images, Word (Up to 25MB)
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
      )}
    </Box>
  );
}