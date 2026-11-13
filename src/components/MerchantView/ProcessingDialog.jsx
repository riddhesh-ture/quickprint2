// src/components/MerchantView/ProcessingDialog.jsx
import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Paper,
  Box,
  Typography,
  LinearProgress,
  CircularProgress,
  Button,
  IconButton,
  Slide,
  Tooltip,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import CloseIcon from '@mui/icons-material/Close';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';

export default function ProcessingDialog({ open, printProgress, onCancel }) {
  const [showCancel, setShowCancel] = useState(false);

  useEffect(() => {
    if (!open) {
      setShowCancel(false);
      return;
    }
    const timer = setTimeout(() => setShowCancel(true), 2000);
    return () => clearTimeout(timer);
  }, [open]);

  const current = printProgress?.current || 0;
  const total = printProgress?.total || 0;
  const progressPercent = total ? (current / total) * 100 : 0;

  return (
    <Slide direction="up" in={open} mountOnEnter unmountOnExit>
      <Paper
        elevation={6}
        sx={{
          position: 'fixed',
          bottom: { xs: 80, sm: 24 },
          right: { xs: 16, sm: 24 },
          zIndex: 1350,
          width: { xs: 'calc(100% - 32px)', sm: 380 },
          maxWidth: '100%',
          p: 2,
          borderRadius: 3,
          border: '1px solid',
          borderColor: (theme) =>
            theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
          bgcolor: 'background.paper',
          boxShadow: (theme) =>
            theme.palette.mode === 'dark'
              ? '0 12px 32px rgba(0,0,0,0.6)'
              : '0 12px 32px rgba(0,0,0,0.12)',
        }}
      >
        {/* Header: Status title + animated spinner + Dismiss button */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box sx={{ position: 'relative', display: 'inline-flex' }}>
              <CircularProgress size={26} thickness={4.5} color="primary" />
              <Box
                sx={{
                  top: 0,
                  left: 0,
                  bottom: 0,
                  right: 0,
                  position: 'absolute',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <PrintIcon sx={{ fontSize: 13, color: 'primary.main' }} />
              </Box>
            </Box>
            <Box>
              <Typography variant="subtitle2" fontWeight={800} lineHeight={1.2}>
                Printing in Progress
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Background Spooler Active
              </Typography>
            </Box>
          </Box>

          {onCancel && (
            <Tooltip title="Dismiss / Cancel print">
              <IconButton size="small" onClick={onCancel} sx={{ color: 'text.secondary' }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* File & Status details */}
        <Box sx={{ mb: 1.5, px: 0.5 }}>
          <Typography
            variant="body2"
            fontWeight={600}
            noWrap
            title={printProgress?.fileName || 'Processing document'}
            sx={{ mb: 0.25 }}
          >
            {printProgress?.fileName || 'Processing document'}
          </Typography>
          <Typography
            variant="caption"
            color="primary.main"
            fontWeight={600}
            sx={{ display: 'block', lineHeight: 1.3 }}
          >
            {printProgress?.status || 'Working...'}
          </Typography>
        </Box>

        {/* Progress Bar & Page Count */}
        <Box sx={{ mb: 1.5 }}>
          <LinearProgress
            variant={total > 0 ? 'determinate' : 'indeterminate'}
            value={progressPercent}
            sx={{ height: 6, borderRadius: 3 }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              {total > 0 ? `File ${current} of ${total}` : 'Preparing spool stream...'}
            </Typography>
            {total > 0 && (
              <Typography variant="caption" fontWeight={700} color="text.secondary">
                {Math.round(progressPercent)}%
              </Typography>
            )}
          </Box>
        </Box>

        {/* Security & Dismiss Action */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pt: 1,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <SecurityOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
              Ephemeral • Locally shredded
            </Typography>
          </Box>

          {showCancel && onCancel && (
            <Button
              size="small"
              color="inherit"
              onClick={onCancel}
              sx={{
                textTransform: 'none',
                fontSize: '0.75rem',
                py: 0.2,
                px: 1,
                minHeight: 'auto',
                color: 'text.secondary',
                '&:hover': { color: 'error.main' },
              }}
            >
              Cancel Spool
            </Button>
          )}
        </Box>
      </Paper>
    </Slide>
  );
}

ProcessingDialog.propTypes = {
  open: PropTypes.bool,
  printProgress: PropTypes.shape({
    current: PropTypes.number,
    total: PropTypes.number,
    fileName: PropTypes.string,
    status: PropTypes.string,
  }),
  onCancel: PropTypes.func,
};
