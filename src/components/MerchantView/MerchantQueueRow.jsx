// src/components/MerchantView/MerchantQueueRow.jsx
import React, { useState, useMemo } from 'react';
import {
  ListItem,
  Box,
  Typography,
  Button,
  IconButton,
  Chip,
  CircularProgress,
  Stack,
  Collapse,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';

export default function MerchantQueueRow({
  job,
  onPrint,
  onDone,
  onDelete,
  onEdit,
  isProcessing,
}) {
  const [expanded, setExpanded] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const cleanPin = job.pin || (job.tokenNumber ? String(job.tokenNumber).replace(/\D/g, '').slice(-4) : (String(job.id).replace(/\D/g, '').slice(-4) || '0000'));
  const tokenDisplay = `#${cleanPin}`;

  const isPrinted = job.status === 'printed' || job.status === 'awaitingPayment';
  const isPrinting = isProcessing || job.status === 'printing';

  const specs = useMemo(() => {
    const files = job.files || [];
    const count = files.length;
    const firstFileName = files[0]?.name || 'Document';
    const fileLabel = count > 1 ? `${firstFileName} (+${count - 1} more)` : firstFileName;

    const firstSpecs = files[0]?.specs || {};
    const copies = parseInt(firstSpecs.copies, 10) || 1;
    const isColor = firstSpecs.color === 'color' || job.colorPages > 0;
    const isDuplex = Boolean(firstSpecs.duplex || firstSpecs.sides === 'double');
    const pages = job.totalPages || 1;
    const cost = Number(job.cost || job.estimatedCost || 0).toFixed(2);

    return {
      fileLabel,
      copies: `${copies} ${copies > 1 ? 'copies' : 'copy'}`,
      pages: `${pages} pgs`,
      colorType: isColor ? 'Color' : 'B&W',
      duplexType: isDuplex ? 'Duplex' : 'Single',
      cost: `₹${cost}`,
      details: `${copies} ${copies > 1 ? 'copies' : 'copy'} • ${pages} pgs • ${isColor ? 'Color' : 'B&W'} • ${isDuplex ? 'Duplex' : 'Single'} • ₹${cost}`,
    };
  }, [job]);

  return (
    <ListItem
      sx={{
        flexDirection: 'column',
        alignItems: 'stretch',
        borderBottom: '1px solid',
        borderColor: 'divider',
        py: { xs: 2, sm: 1.75 },
        px: { xs: 2, sm: 2.5 },
        bgcolor: isPrinted ? 'action.hover' : 'background.paper',
        transition: 'background-color 0.2s ease',
      }}
    >
      {isMobile ? (
        /* Mobile Card Layout - Clean, Touch-First, No "Edit & View" */
        <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {/* Top Row: Token Badge, Status Tag, and Amount */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Chip
                label={tokenDisplay}
                color={isPrinted ? 'success' : 'primary'}
                variant={isPrinted ? 'filled' : 'outlined'}
                sx={{
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  fontFamily: 'monospace',
                  letterSpacing: 0.5,
                  borderRadius: 1.5,
                  height: 28,
                }}
              />
              <Chip
                label={isPrinted ? 'Printed' : 'Pending'}
                size="small"
                color={isPrinted ? 'success' : 'warning'}
                variant="outlined"
                sx={{ fontWeight: 700, fontSize: '0.7rem', height: 22 }}
              />
            </Stack>
            <Typography variant="subtitle1" fontWeight={800} color="text.primary">
              {specs.cost}
            </Typography>
          </Box>

          {/* Document Name and Spec Pills */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
              <DescriptionOutlinedIcon fontSize="small" sx={{ color: 'text.secondary', fontSize: 18 }} />
              <Typography variant="body2" fontWeight={700} noWrap sx={{ color: 'text.primary', flex: 1 }}>
                {specs.fileLabel}
              </Typography>
            </Box>

            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              <Chip label={specs.pages} size="small" variant="outlined" sx={{ fontSize: '0.72rem', height: 22 }} />
              <Chip label={specs.copies} size="small" variant="outlined" sx={{ fontSize: '0.72rem', height: 22 }} />
              <Chip
                label={specs.colorType}
                size="small"
                color={specs.colorType === 'Color' ? 'secondary' : 'default'}
                variant="outlined"
                sx={{ fontSize: '0.72rem', height: 22, fontWeight: 600 }}
              />
              <Chip label={specs.duplexType} size="small" variant="outlined" sx={{ fontSize: '0.72rem', height: 22 }} />
            </Stack>
          </Box>

          {/* Action Row: Full-width Print / Done Button + Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            {!isPrinted ? (
              <Button
                fullWidth
                variant="contained"
                color="primary"
                size="medium"
                startIcon={isPrinting ? <CircularProgress size={18} color="inherit" /> : <PrintIcon />}
                onClick={() => onPrint(job)}
                disabled={isPrinting}
                sx={{
                  py: 1,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                }}
              >
                {isPrinting ? 'Opening Print...' : 'Print'}
              </Button>
            ) : (
              <Button
                fullWidth
                variant="contained"
                color="success"
                size="medium"
                startIcon={<CheckCircleOutlineIcon />}
                onClick={() => onDone(job)}
                sx={{
                  py: 1,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                }}
              >
                Done
              </Button>
            )}

            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
              sx={{
                p: 1,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                color: 'text.secondary',
              }}
            >
              {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>

            <IconButton
              size="small"
              onClick={() => onDelete(job.id)}
              sx={{
                p: 1,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                color: 'error.main',
              }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      ) : (
        /* Desktop Horizontal Row Layout - Includes "Edit & View" Prepress Studio */
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            width: '100%',
          }}
        >
          {/* Token Badge */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: { sm: 110 } }}>
            <Chip
              label={tokenDisplay}
              color={isPrinted ? 'success' : 'primary'}
              variant={isPrinted ? 'filled' : 'outlined'}
              sx={{
                fontWeight: 800,
                fontSize: '0.95rem',
                fontFamily: 'monospace',
                letterSpacing: 0.5,
                borderRadius: 1.5,
              }}
            />
          </Box>

          {/* Specs Overview */}
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Typography
              variant="body2"
              fontWeight={700}
              noWrap
              sx={{ color: 'text.primary', maxWidth: { sm: 380, md: 500 } }}
            >
              {specs.fileLabel}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
              {specs.details}
            </Typography>
          </Box>

          {/* Desktop Action Controls */}
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {/* Edit & View Studio Action - Desktop Only */}
            <Button
              variant="outlined"
              color="secondary"
              size="small"
              onClick={() => onEdit?.(job, 0)}
              disabled={isPrinting}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              Edit & View
            </Button>

            {/* Dynamic Action Button: Print -> Printing -> Done */}
            {!isPrinted ? (
              <Button
                variant="contained"
                color="primary"
                size="small"
                startIcon={isPrinting ? <CircularProgress size={16} color="inherit" /> : <PrintIcon />}
                onClick={() => onPrint(job)}
                disabled={isPrinting}
                sx={{ minWidth: 100, textTransform: 'none', fontWeight: 700 }}
              >
                {isPrinting ? 'Printing' : 'Print'}
              </Button>
            ) : (
              <Button
                variant="contained"
                color="success"
                size="small"
                startIcon={<CheckCircleOutlineIcon />}
                onClick={() => onDone(job)}
                sx={{ minWidth: 100, textTransform: 'none', fontWeight: 800 }}
              >
                Done
              </Button>
            )}

            {/* Details Expand Toggle */}
            <IconButton size="small" onClick={() => setExpanded(!expanded)} sx={{ color: 'text.secondary' }}>
              {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>

            {/* Delete Action */}
            <IconButton size="small" onClick={() => onDelete(job.id)} sx={{ color: 'text.secondary' }}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Box>
      )}

      {/* Expanded File Inspection */}
      <Collapse in={expanded} timeout="auto" unmountOnExit sx={{ width: '100%' }}>
        <Box sx={{ pt: 1.5, pb: 0.5, pl: { sm: 2 } }}>
          <Divider sx={{ mb: 1.5 }} />
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
            Files in Order:
          </Typography>
          <Stack spacing={1} sx={{ mt: 1 }}>
            {job.files?.map((f, i) => (
              <Box
                key={i}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  py: 0.5,
                  px: 1,
                  borderRadius: 1,
                  bgcolor: 'action.hover',
                  flexWrap: { xs: 'wrap', sm: 'nowrap' },
                }}
              >
                <DescriptionOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                <Typography variant="body2" sx={{ flex: 1, fontWeight: 500, minWidth: 150 }}>
                  {f.name}
                </Typography>
                {f.isEdited && (
                  <Chip
                    label="Edited"
                    size="small"
                    color="warning"
                    variant="outlined"
                    sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }}
                  />
                )}
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {f.specs?.copies || 1} {f.specs?.copies > 1 ? 'copies' : 'copy'} •{' '}
                  {f.specs?.pageCount || 1} pgs •{' '}
                  {f.specs?.color === 'color' ? 'Color' : 'B&W'} •{' '}
                  {f.specs?.duplex || f.specs?.sides === 'double' ? 'Duplex' : 'Single'}
                </Typography>
                {/* File Edit button is ONLY shown on desktop */}
                {!isMobile && (
                  <Button
                    size="small"
                    variant="text"
                    color="secondary"
                    onClick={() => onEdit?.(job, i)}
                    sx={{ textTransform: 'none', fontWeight: 600, py: 0.25, fontSize: '0.75rem' }}
                  >
                    Edit
                  </Button>
                )}
              </Box>
            ))}
          </Stack>
        </Box>
      </Collapse>
    </ListItem>
  );
}
