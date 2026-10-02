// src/components/Blocks/HelpDialog.jsx
import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
} from '@mui/material';
import RawCloseIcon from '@mui/icons-material/Close';
import RawHelpOutlineIcon from '@mui/icons-material/HelpOutlined';
import RawQrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import RawTuneIcon from '@mui/icons-material/Tune';
import RawCheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import { unwrapIcon } from '../../utils/iconHelper';
import { useThemeMode } from '../../context/ThemeContext';

const CloseIcon = unwrapIcon(RawCloseIcon);
const HelpOutlineIcon = unwrapIcon(RawHelpOutlineIcon);
const QrCodeScannerIcon = unwrapIcon(RawQrCodeScannerIcon);
const TuneIcon = unwrapIcon(RawTuneIcon);
const CheckCircleOutlineIcon = unwrapIcon(RawCheckCircleOutlineIcon);

export default function HelpDialog({ open, onClose }) {
  const { isDark, colors } = useThemeMode();

  const steps = [
    {
      num: 1,
      icon: <QrCodeScannerIcon sx={{ color: '#2563eb' }} />,
      title: 'Pair With Print Station',
      desc: 'Scan the QR code displayed at the shop counter, or manually enter the 6-character shop code (e.g., QP-8421).',
    },
    {
      num: 2,
      icon: <TuneIcon sx={{ color: '#10b981' }} />,
      title: 'Upload Files & Configure Specs',
      desc: 'Select your PDF or document, choose B&W or Color, set copies, and review your transparent total pricing.',
    },
    {
      num: 3,
      icon: <CheckCircleOutlineIcon sx={{ color: '#f59e0b' }} />,
      title: 'Pay & Collect With Token',
      desc: 'Pay via UPI or Cash. Mention your Token # (e.g., #14-8421) and show your UPI success screenshot to the merchant for instant print release.',
    },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '20px',
          bgcolor: isDark ? colors.surface : '#ffffff',
          backgroundImage: 'none',
          border: `1px solid ${colors.border}`,
          p: 1,
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              bgcolor: isDark ? 'rgba(37,99,235,0.15)' : '#eff6ff',
              color: colors.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <HelpOutlineIcon sx={{ fontSize: 20 }} />
          </Box>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              fontSize: '1.08rem',
              color: colors.text,
              fontFamily: '"Plus Jakarta Sans", sans-serif',
            }}
          >
            How QuickPrint Works
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: colors.textSecondary }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {steps.map((s) => (
            <Box key={s.num} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <Box
                sx={{
                  mt: 0.25,
                  p: 0.75,
                  borderRadius: '8px',
                  bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f8faff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {s.icon}
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.88rem', color: colors.text }}>
                  Step {s.num}: {s.title}
                </Typography>
                <Typography variant="body2" sx={{ color: colors.textSecondary, fontSize: '0.78rem', mt: 0.25, lineHeight: 1.4 }}>
                  {s.desc}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 1.5 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={onClose}
          sx={{
            bgcolor: colors.primary,
            borderRadius: '10px',
            textTransform: 'none',
            fontWeight: 700,
            py: 1,
            '&:hover': { bgcolor: colors.primaryHover },
          }}
        >
          Got it
        </Button>
      </DialogActions>
    </Dialog>
  );
}
