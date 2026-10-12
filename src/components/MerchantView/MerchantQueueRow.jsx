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

  const cleanPin = job.pin || (job.tokenNumber ? String(job.tokenNumber).replace(/\D/g, '').slice(-4) : (String(job.id).replace(/\D/g, '').slice(-4) || '0000'));
  const tokenDisplay = `#${cleanPin}`;

  const isPrinted = job.status === 'printed' || job.status === 'awaitingPayment';
  const isPrinting = isProcessing || job.status === 'printing';

  const specsSummary = useMemo(() => {
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
        py: 1.5,
        px: { xs: 1.5, sm: 2.5 },
        bgcolor: isPrinted ? 'action.hover' : 'background.paper',
        transition: 'background-color 0.2s ease',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: { xs: 'wrap', md: 'nowrap' },
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
            sx={{ color: 'text.primary', maxWidth: { xs: 260, sm: 400, md: 500 } }}
          >
            {specsSummary.fileLabel}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
            {specsSummary.details}
          </Typography>
        </Box>

        {/* Action Controls */}
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          {/* Edit & View Studio Action */}
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

      {/* Expanded File Inspection */}
      <Collapse in={expanded} timeout="auto" unmountOnExit>
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
                }}
              >
                <DescriptionOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
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
                <Button
                  size="small"
                  variant="text"
                  color="secondary"
                  onClick={() => onEdit?.(job, i)}
                  sx={{ textTransform: 'none', fontWeight: 600, py: 0.25, fontSize: '0.75rem' }}
                >
                  Edit
                </Button>
              </Box>
            ))}
          </Stack>
        </Box>
      </Collapse>
    </ListItem>
  );
}
