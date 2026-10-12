// src/components/MerchantView/ProcessingDialog.jsx
import React from 'react';
import {
  Dialog,
  DialogContent,
  CircularProgress,
  Typography,
  LinearProgress,
  Box,
} from '@mui/material';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';

export default function ProcessingDialog({ open, printProgress }) {
  if (!open) return null;

  const current = printProgress?.current || 0;
  const total = printProgress?.total || 0;
  const progressPercent = total ? (current / total) * 100 : 0;

  return (
    <Dialog open={open} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3, p: 1 } }}>
      <DialogContent sx={{ textAlign: 'center', py: 4 }}>
        <CircularProgress size={52} thickness={4} sx={{ mb: 2.5 }} />
        <Typography variant="h6" fontWeight={700} gutterBottom>
          Printing in Progress
        </Typography>
        <Typography variant="body2" color="text.secondary" noWrap sx={{ mb: 0.5, px: 2 }}>
          {printProgress?.fileName || 'Processing document'}
        </Typography>
        <Typography variant="caption" color="primary" fontWeight={600} sx={{ display: 'block', mb: 2 }}>
          {printProgress?.status || 'Working...'}
        </Typography>

        <Box sx={{ px: 2, mb: 2 }}>
          <LinearProgress
            variant="determinate"
            value={progressPercent}
            sx={{ height: 6, borderRadius: 3 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            File {current} of {total}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mt: 1 }}>
          <SecurityOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary">
            Files stored locally and deleted upon completion
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
