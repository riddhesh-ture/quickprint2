// src/components/UserView/FileUploader.jsx
import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Box, Typography, Paper, Alert } from '@mui/material';
import RawUploadFileIcon from '@mui/icons-material/UploadFile';
import RawAddIcon from '@mui/icons-material/Add';
import { unwrapIcon } from '../../utils/iconHelper';
import { MAX_FILE_SIZE } from '../../utils/fileValidation';

const UploadFileIcon = unwrapIcon(RawUploadFileIcon);
const AddIcon = unwrapIcon(RawAddIcon);

export default function FileUploader({ onFilesAdded, hasFiles = false }) {
  const [error, setError] = React.useState(null);

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
          sx={{ mb: 2, borderRadius: 2 }}
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
          bgcolor: isDragActive ? '#eff6ff' : '#f8faff',
          border: '2px dashed',
          borderColor: isDragActive ? '#2563eb' : '#93c5fd',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          '&:hover': {
            borderColor: '#2563eb',
            bgcolor: '#eff6ff',
          },
        }}
      >
        <input {...getInputProps()} />
        <Box
          sx={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            bgcolor: '#2563eb',
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
            color: '#0f172a',
            fontSize: '1.05rem',
            fontFamily: '"Newsreader", Georgia, serif',
          }}
        >
          {isDragActive ? 'Drop files here' : 'Tap to Browse Files'}
        </Typography>

        <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5, mb: 2, fontSize: '0.82rem' }}>
          Supports PDF, JPG, PNG, DOCX (Auto-scaled to A4)
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
            bgcolor: '#eff6ff',
            color: '#2563eb',
            fontWeight: 700,
            fontSize: '0.86rem',
            border: '1px solid #bfdbfe',
            transition: 'all 0.15s ease',
            '&:hover': { bgcolor: '#dbeafe', borderColor: '#93c5fd' },
          }}
        >
          <AddIcon sx={{ fontSize: 18 }} />
          <span>{hasFiles ? 'Choose Another Document' : 'Choose Document'}</span>
        </Box>
      </Paper>
    </Box>
  );
}