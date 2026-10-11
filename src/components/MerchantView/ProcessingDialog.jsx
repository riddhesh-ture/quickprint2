// src/components/MerchantView/ProcessingDialog.jsx
import React from 'react';
import {
  Dialog,
  DialogContent,
  CircularProgress,
  Typography,
  LinearProgress,
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';

export default function ProcessingDialog({ open, printProgress }) {
  if (!open) return null;

  const current = printProgress?.current || 0;
  const total = printProgress?.total || 0;
  const progressPercent = total ? (current / total) * 100 : 0;

  return (
    <Dialog open={open} maxWidth="sm" fullWidth>
      <DialogContent sx={{ textAlign: 'center', py: 4 }}>
        <SecurityIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
        <CircularProgress size={60} sx={{ mb: 2, display: 'block', mx: 'auto' }} />
        <Typography variant="h6" gutterBottom>
          Secure Print in Progress
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {printProgress?.fileName}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          {printProgress?.status}
        </Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
          File {current} of {total}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={progressPercent}
          sx={{ height: 8, borderRadius: 4 }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          🔒 Safe transfer: files are kept locally and deleted on job completion
        </Typography>
      </DialogContent>
    </Dialog>
  );
}
