// src/components/MerchantView/ManualDuplexModal.jsx
import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Box,
  Stack,
  Alert,
  Divider,
} from '@mui/material';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import PrintIcon from '@mui/icons-material/Print';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

export default function ManualDuplexModal({
  open,
  onClose,
  onContinue,
  jobPin,
  fileName,
  printerName,
  totalPages,
}) {
  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          p: 1.5,
          border: '2px solid',
          borderColor: 'primary.main',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            bgcolor: 'primary.light',
            color: 'primary.contrastText',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AutorenewIcon sx={{ fontSize: 28 }} />
        </Box>
        <Box>
          <Typography variant="h6" fontWeight={800}>
            Manual Duplex: Reload Paper
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Order #{jobPin || '----'} • {printerName || 'Counter Printer'}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ py: 2 }}>
        <Alert severity="info" sx={{ mb: 2.5, borderRadius: 2 }}>
          <strong>Pass 1 Complete:</strong> Odd pages (1, 3, 5...) have finished printing.
        </Alert>

        <Stack spacing={2}>
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: 'action.hover',
              border: '1px dashed',
              borderColor: 'divider',
            }}
          >
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              Instructions for Single-Sided Counter Printers:
            </Typography>
            <Typography variant="body2" component="div" sx={{ lineHeight: 1.7, color: 'text.primary' }}>
              1. Take the printed stack of paper directly from the printer's output tray.<br />
              2. <strong>Turn the stack over</strong> so the unprinted blank sides will face the print head.<br />
              3. <strong>Place the stack back into the paper feeder / input tray</strong> in the same orientation.<br />
              4. Click the button below to print the even pages on the reverse side.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center">
            <InfoOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              Document: {fileName || 'Document.pdf'} ({totalPages || 2} total pages)
            </Typography>
          </Stack>
        </Stack>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ pt: 2, px: 2, justifyContent: 'space-between' }}>
        <Button onClick={onClose} color="inherit" variant="text" sx={{ fontWeight: 600 }}>
          Cancel
        </Button>
        <Button
          onClick={onContinue}
          variant="contained"
          color="primary"
          size="large"
          startIcon={<PrintIcon />}
          sx={{ fontWeight: 800, px: 3, borderRadius: 2 }}
        >
          Print Even Pages (2, 4, 6...)
        </Button>
      </DialogActions>
    </Dialog>
  );
}
