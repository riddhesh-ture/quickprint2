// src/components/UserView/FileUploader.jsx
import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Box, Typography, Paper, Alert, Chip, Stack } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';
import DescriptionIcon from '@mui/icons-material/Description';
import { MAX_FILE_SIZE } from '../../utils/fileValidation';

export default function FileUploader({ onFilesAdded }) {
  const [error, setError] = React.useState(null);

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    setError(null);

    // Handle rejected files
    if (rejectedFiles && rejectedFiles.length > 0) {
      const errors = rejectedFiles.map(f => {
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
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      <Paper
        {...getRootProps()}
        sx={{
          p: 4,
          textAlign: 'center',
          cursor: 'pointer',
          bgcolor: isDragActive ? 'action.hover' : 'background.paper',
          border: '2px dashed',
          borderColor: isDragActive ? 'primary.main' : 'divider',
          borderRadius: 2,
          transition: 'all 0.2s ease',
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: 'action.hover',
          },
        }}
      >
        <input {...getInputProps()} />
        <CloudUploadIcon sx={{ fontSize: 52, color: 'primary.main', mb: 1 }} />
        <Typography variant="h6" gutterBottom fontWeight="600">
          {isDragActive ? 'Drop files here...' : 'Drag & drop your files here'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          or click anywhere to browse documents
        </Typography>

        <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
          <Chip icon={<PictureAsPdfIcon fontSize="small" />} label="PDF (.pdf)" size="small" variant="outlined" />
          <Chip icon={<ImageIcon fontSize="small" />} label="Images (.jpg, .png, .webp)" size="small" variant="outlined" />
          <Chip icon={<DescriptionIcon fontSize="small" />} label="Word (.doc, .docx)" size="small" variant="outlined" />
          <Chip label="Max 50MB" size="small" color="primary" variant="filled" />
        </Stack>
      </Paper>
    </Box>
  );
}