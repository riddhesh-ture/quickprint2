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
        <input {...getInputProps()} />
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
          {isDragActive ? 'Drop your files here' : 'Tap to Browse Documents'}
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
          <span>{hasFiles ? 'Add Another Document' : 'Select Document'}</span>
        </Box>
      </Paper>
    </Box>
  );
}