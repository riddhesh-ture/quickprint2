import React from 'react';
import {
  Paper, Box, Typography, IconButton, TextField, ToggleButton, ToggleButtonGroup,
  Divider, Chip, Tooltip, Collapse
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';
import DescriptionIcon from '@mui/icons-material/Description';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ColorLensIcon from '@mui/icons-material/ColorLens';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FlipIcon from '@mui/icons-material/Flip';
import TuneIcon from '@mui/icons-material/Tune';

const getFileIcon = (fileName) => {
  const ext = fileName.split('.').pop().toLowerCase();
  if (ext === 'pdf') return <PictureAsPdfIcon color="error" />;
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return <ImageIcon color="primary" />;
  return <DescriptionIcon color="action" />;
};

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export default function UploadedFileItem({ fileEntry, onSpecChange, onRemove }) {
  const { file, specs } = fileEntry;
  // Settings are optional and collapsed by default with standard defaults (1 copy, B&W, 1-sided A4)
  const [expanded, setExpanded] = React.useState(false);

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
    // Allow formats: "1-5", "1,3,5", "all", or empty
    const value = e.target.value.replace(/[^0-9,-]/g, '');
    onSpecChange(fileEntry.id, { pages: value });
  };

  const handleColorChange = (e, newValue) => {
    if (newValue) onSpecChange(fileEntry.id, { color: newValue });
  };

  const handleSidesChange = (e, newValue) => {
    if (newValue) onSpecChange(fileEntry.id, { sides: newValue });
  };

  const handleOrientationChange = (e, newValue) => {
    if (newValue) onSpecChange(fileEntry.id, { orientation: newValue });
  };

  const handlePaperSizeChange = (e, newValue) => {
    if (newValue) onSpecChange(fileEntry.id, { paperSize: newValue });
  };

  return (
    <Paper elevation={1} sx={{ mb: 2, overflow: 'hidden', border: '1px solid #e0e0e0', borderRadius: 2 }}>
      {/* Header */}
      <Box 
        sx={{ 
          p: 2, 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1.5,
          bgcolor: expanded ? 'grey.100' : 'grey.50',
          cursor: 'pointer',
          transition: 'background-color 0.2s'
        }}
        onClick={() => setExpanded(!expanded)}
      >
        {getFileIcon(file.name)}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap title={file.name} fontWeight="bold">
            {file.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatFileSize(file.size)}
          </Typography>
        </Box>
        
        {/* Quick specs preview */}
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
          {specs.pageCount && specs.pageCount > 1 && (
            <Chip 
              size="small" 
              label={`${specs.pageCount} pages`} 
              color="info" 
              variant="outlined" 
            />
          )}
          <Chip 
            size="small" 
            label={`${specs.copies || 1} ${specs.copies > 1 ? 'copies' : 'copy'}`} 
            icon={<ContentCopyIcon sx={{ fontSize: 13 }} />}
            variant="outlined"
          />
          <Chip 
            size="small" 
            label={specs.color === 'color' ? 'Color' : 'B&W (Default)'} 
            color={specs.color === 'color' ? 'primary' : 'default'}
            variant="outlined"
          />
          <Chip 
            size="small" 
            label={specs.sides === 'double' ? '2-Sided' : '1-Sided'} 
            variant="outlined"
          />
        </Box>

        <Tooltip title={expanded ? 'Hide settings' : 'Customize settings (Optional)'}>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
            {expanded ? <ExpandLessIcon /> : <TuneIcon fontSize="small" color="action" />}
          </IconButton>
        </Tooltip>
        
        <Tooltip title="Remove file">
          <IconButton 
            size="small" 
            color="error" 
            onClick={(e) => { e.stopPropagation(); onRemove(fileEntry.id); }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Expanded Settings */}
      <Collapse in={expanded}>
        <Divider />
        <Box sx={{ p: 2, bgcolor: '#fafafa' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            ⚙️ <strong>Optional Settings</strong>: Default is 1 copy, Black & White, all pages, 1-sided A4. Change only if needed.
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
            
            {/* Copies */}
            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                <ContentCopyIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                Copies (Default: 1)
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

            {/* Pages */}
            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                Pages (leave empty for all)
              </Typography>
              <TextField
                size="small"
                value={specs.pages || ''}
                onChange={handlePagesChange}
                placeholder="e.g., 1-5 or 1,3,5"
                fullWidth
              />
            </Box>

            {/* Color Mode */}
            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                <ColorLensIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                Color
              </Typography>
              <ToggleButtonGroup
                value={specs.color || 'bw'}
                exclusive
                onChange={handleColorChange}
                size="small"
                fullWidth
              >
                <ToggleButton value="bw">B&W</ToggleButton>
                <ToggleButton value="color">Color</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {/* Sides */}
            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                <FlipIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                Print Sides
              </Typography>
              <ToggleButtonGroup
                value={specs.sides || 'single'}
                exclusive
                onChange={handleSidesChange}
                size="small"
                fullWidth
              >
                <ToggleButton value="single">1-Sided</ToggleButton>
                <ToggleButton value="double">2-Sided</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {/* Paper Size */}
            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                Paper Size
              </Typography>
              <ToggleButtonGroup
                value={specs.paperSize || 'a4'}
                exclusive
                onChange={handlePaperSizeChange}
                size="small"
                fullWidth
              >
                <ToggleButton value="a4">A4</ToggleButton>
                <ToggleButton value="a3">A3</ToggleButton>
                <ToggleButton value="letter">Letter</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {/* Orientation */}
            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                Orientation
              </Typography>
              <ToggleButtonGroup
                value={specs.orientation || 'portrait'}
                exclusive
                onChange={handleOrientationChange}
                size="small"
                fullWidth
              >
                <ToggleButton value="portrait">Portrait</ToggleButton>
                <ToggleButton value="landscape">Landscape</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
}