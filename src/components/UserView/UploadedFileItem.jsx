// src/components/UserView/UploadedFileItem.jsx
import React from 'react';
import {
  Paper,
  Box,
  Typography,
  IconButton,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
  Tooltip,
  Collapse,
} from '@mui/material';
import RawDeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RawVisibilityIcon from '@mui/icons-material/Visibility';
import RawPictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import RawImageIcon from '@mui/icons-material/Image';
import RawDescriptionIcon from '@mui/icons-material/Description';
import RawColorLensIcon from '@mui/icons-material/ColorLens';
import RawContentCopyIcon from '@mui/icons-material/ContentCopy';
import RawFlipIcon from '@mui/icons-material/Flip';
import { unwrapIcon } from '../../utils/iconHelper';
import { formatFileSize } from '../../utils/fileValidation';

const DeleteOutlineIcon = unwrapIcon(RawDeleteOutlineIcon);
const VisibilityIcon = unwrapIcon(RawVisibilityIcon);
const PictureAsPdfIcon = unwrapIcon(RawPictureAsPdfIcon);
const ImageIcon = unwrapIcon(RawImageIcon);
const DescriptionIcon = unwrapIcon(RawDescriptionIcon);
const ColorLensIcon = unwrapIcon(RawColorLensIcon);
const ContentCopyIcon = unwrapIcon(RawContentCopyIcon);
const FlipIcon = unwrapIcon(RawFlipIcon);

const getFileTypeDetails = (fileName) => {
  const ext = fileName.split('.').pop().toLowerCase();
  if (ext === 'pdf') {
    return {
      icon: <PictureAsPdfIcon sx={{ fontSize: 20 }} />,
      label: 'PDF',
      bgcolor: '#fee2e2',
      color: '#dc2626',
      borderColor: '#fca5a5',
    };
  }
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    return {
      icon: <ImageIcon sx={{ fontSize: 20 }} />,
      label: 'IMG',
      bgcolor: '#dbeafe',
      color: '#2563eb',
      borderColor: '#bfdbfe',
    };
  }
  return {
    icon: <DescriptionIcon sx={{ fontSize: 20 }} />,
    label: 'DOC',
    bgcolor: '#f3e8ff',
    color: '#7e22ce',
    borderColor: '#e9d5ff',
  };
};

export default function UploadedFileItem({ fileEntry, onSpecChange, onRemove }) {
  const { file, specs } = fileEntry;
  const [expanded, setExpanded] = React.useState(false);
  const typeDetails = getFileTypeDetails(file.name);
  const detectedPages = specs.pageCount || 1;

  const handleCopiesChange = (e) => {
    const raw = e.target.value;
    if (raw === '') {
      onSpecChange(fileEntry.id, { copies: '' });
      return;
    }
    const val = parseInt(raw, 10);
    if (!isNaN(val)) {
      onSpecChange(fileEntry.id, { copies: Math.max(1, Math.min(100, val)) });
    }
  };

  const handleCopiesBlur = () => {
    if (!specs.copies || specs.copies < 1) {
      onSpecChange(fileEntry.id, { copies: 1 });
    }
  };

  const handlePagesChange = (e) => {
    const value = e.target.value.replace(/[^0-9,-]/g, '');
    onSpecChange(fileEntry.id, { pages: value });
  };

  return (
    <Paper
      elevation={0}
      sx={{
        mt: 1.5,
        borderRadius: '14px',
        overflow: 'hidden',
        bgcolor: '#ffffff',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
      }}
    >
      {/* File Card Header / Preview Bar */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          {/* File Type Pill */}
          <Box
            sx={{
              width: 44,
              height: 48,
              borderRadius: '10px',
              bgcolor: typeDetails.bgcolor,
              color: typeDetails.color,
              border: `1px solid ${typeDetails.borderColor}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {typeDetails.icon}
            <Typography
              variant="caption"
              sx={{
                fontSize: '8px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                lineHeight: 1,
                mt: 0.25,
              }}
            >
              {typeDetails.label}
            </Typography>
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="subtitle2"
              noWrap
              sx={{
                fontWeight: 700,
                color: '#0f172a',
                fontSize: '0.92rem',
                fontFamily: '"Plus Jakarta Sans", sans-serif',
              }}
              title={file.name}
            >
              {file.name}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.78rem' }}>
              {formatFileSize(file.size)} •{' '}
              <strong style={{ color: '#2563eb' }}>
                {detectedPages} {detectedPages === 1 ? 'page' : 'pages'}
              </strong>
            </Typography>
          </Box>
        </Box>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          <Tooltip title={expanded ? 'Hide file settings' : 'View file details'}>
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
              sx={{
                color: expanded ? '#2563eb' : '#64748b',
                '&:hover': { color: '#2563eb', bgcolor: '#eff6ff' },
              }}
            >
              <VisibilityIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Remove file">
            <IconButton
              size="small"
              onClick={() => onRemove(fileEntry.id)}
              sx={{
                color: '#ef4444',
                '&:hover': { color: '#dc2626', bgcolor: '#fee2e2' },
              }}
            >
              <DeleteOutlineIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Expanded Per-file Customization Drawer */}
      <Collapse in={expanded}>
        <Divider sx={{ borderColor: '#e2e8f0' }} />
        <Box sx={{ p: 2, bgcolor: '#f8faff' }}>
          <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 1.5, fontWeight: 600 }}>
            ⚙️ <strong>Per-file override</strong>: Leave unchanged to use job-wide settings.
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            {/* Copies */}
            <Box>
              <Typography variant="caption" sx={{ color: '#334155', fontWeight: 600, display: 'block', mb: 0.5 }}>
                <ContentCopyIcon sx={{ fontSize: 13, mr: 0.5, verticalAlign: 'middle' }} />
                Copies for this file
              </Typography>
              <TextField
                type="number"
                size="small"
                value={specs.copies === '' ? '' : (specs.copies || 1)}
                onChange={handleCopiesChange}
                onBlur={handleCopiesBlur}
                inputProps={{ min: 1, max: 100 }}
                fullWidth
              />
            </Box>

            {/* Custom page interval */}
            <Box>
              <Typography variant="caption" sx={{ color: '#334155', fontWeight: 600, display: 'block', mb: 0.5 }}>
                Specific pages (e.g. 1-3, 5)
              </Typography>
              <TextField
                size="small"
                value={specs.pages || ''}
                onChange={handlePagesChange}
                placeholder="Leave blank for all"
                fullWidth
              />
            </Box>

            {/* Color Mode */}
            <Box>
              <Typography variant="caption" sx={{ color: '#334155', fontWeight: 600, display: 'block', mb: 0.5 }}>
                <ColorLensIcon sx={{ fontSize: 13, mr: 0.5, verticalAlign: 'middle' }} />
                Color Mode
              </Typography>
              <ToggleButtonGroup
                value={specs.color || 'bw'}
                exclusive
                onChange={(_, val) => val && onSpecChange(fileEntry.id, { color: val })}
                size="small"
                fullWidth
              >
                <ToggleButton value="bw">B&W</ToggleButton>
                <ToggleButton value="color">Color</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {/* Print sides */}
            <Box>
              <Typography variant="caption" sx={{ color: '#334155', fontWeight: 600, display: 'block', mb: 0.5 }}>
                <FlipIcon sx={{ fontSize: 13, mr: 0.5, verticalAlign: 'middle' }} />
                Print Sides
              </Typography>
              <ToggleButtonGroup
                value={specs.sides || 'double'}
                exclusive
                onChange={(_, val) => val && onSpecChange(fileEntry.id, { sides: val })}
                size="small"
                fullWidth
              >
                <ToggleButton value="double">2-Sided</ToggleButton>
                <ToggleButton value="single">1-Sided</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
}