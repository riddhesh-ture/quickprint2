// src/components/Blocks/PrivacyDialog.jsx
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
import RawShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import RawBoltIcon from '@mui/icons-material/Bolt';
import RawDeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import RawNoAccountsIcon from '@mui/icons-material/NoAccounts';
import { unwrapIcon } from '../../utils/iconHelper';
import { useThemeMode } from '../../context/ThemeContext';

const CloseIcon = unwrapIcon(RawCloseIcon);
const ShieldOutlinedIcon = unwrapIcon(RawShieldOutlinedIcon);
const BoltIcon = unwrapIcon(RawBoltIcon);
const DeleteSweepIcon = unwrapIcon(RawDeleteSweepIcon);
const NoAccountsIcon = unwrapIcon(RawNoAccountsIcon);

export default function PrivacyDialog({ open, onClose }) {
  const { isDark, colors } = useThemeMode();

  const points = [
    {
      icon: <BoltIcon sx={{ color: '#2563eb' }} />,
      title: 'Peer-to-Peer Fast-Lane Streaming',
      desc: 'Documents stream directly in encrypted binary chunks to the merchant terminal. Zero intermediary file retention.',
    },
    {
      icon: <ShieldOutlinedIcon sx={{ color: '#10b981' }} />,
      title: 'Zero Cloud Document Storage',
      desc: 'We do not store your PDFs or images on AWS, Supabase, or any cloud server. Your private files never reside in a cloud bucket.',
    },
    {
      icon: <DeleteSweepIcon sx={{ color: '#f59e0b' }} />,
      title: 'Immediate Memory Purge',
      desc: 'Files exist solely in local memory while spooling to the physical printer. They are shredded immediately upon completion.',
    },
    {
      icon: <NoAccountsIcon sx={{ color: '#8b5cf6' }} />,
      title: 'No Required Account or Tracking',
      desc: 'Orders are identified by anonymous, ephemeral tokens (#14-8421). No phone number or account registration required for counter prints.',
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
              bgcolor: isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5',
              color: isDark ? '#34d399' : '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldOutlinedIcon sx={{ fontSize: 20 }} />
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
            Privacy Guarantee
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: colors.textSecondary }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {points.map((p, idx) => (
            <Box key={idx} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
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
                {p.icon}
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.88rem', color: colors.text }}>
                  {p.title}
                </Typography>
                <Typography variant="body2" sx={{ color: colors.textSecondary, fontSize: '0.78rem', mt: 0.25, lineHeight: 1.4 }}>
                  {p.desc}
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
          Understood
        </Button>
      </DialogActions>
    </Dialog>
  );
}
