// src/components/Blocks/TrustBanner.jsx
import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import RawShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { unwrapIcon } from '../../utils/iconHelper';
import { useThemeMode } from '../../context/ThemeContext';

const ShieldOutlinedIcon = unwrapIcon(RawShieldOutlinedIcon);

export default function TrustBanner({
  compact = false,
  onLearnMore,
  sx = {},
}) {
  const { isDark, colors } = useThemeMode();

  return (
    <Box
      sx={{
        p: compact ? 1.5 : 2,
        borderRadius: '14px',
        bgcolor: isDark ? 'rgba(16,185,129,0.08)' : '#ecfdf5',
        border: `1px solid ${isDark ? 'rgba(16,185,129,0.25)' : '#a7f3d0'}`,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        transition: 'all 0.2s ease',
        ...sx,
      }}
    >
      <Box
        sx={{
          color: isDark ? '#34d399' : '#059669',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mt: 0.25,
          flexShrink: 0,
        }}
      >
        <ShieldOutlinedIcon sx={{ fontSize: compact ? 20 : 22 }} />
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 800,
            fontSize: compact ? '0.86rem' : '0.92rem',
            color: isDark ? '#6ee7b7' : '#065f46',
            lineHeight: 1.25,
            fontFamily: '"Plus Jakarta Sans", sans-serif',
          }}
        >
          Zero Data Retention Guarantee
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: isDark ? '#a7f3d0' : '#047857',
            fontSize: compact ? '0.74rem' : '0.78rem',
            mt: 0.25,
            lineHeight: 1.4,
          }}
        >
          Files stream peer-to-peer into merchant printer memory and are purged immediately. Zero PDF storage in cloud databases.
        </Typography>
      </Box>

      {onLearnMore && (
        <Button
          size="small"
          onClick={onLearnMore}
          sx={{
            textTransform: 'none',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: isDark ? '#34d399' : '#059669',
            p: '2px 8px',
            minWidth: 0,
            flexShrink: 0,
            '&:hover': { bgcolor: isDark ? 'rgba(16,185,129,0.1)' : 'rgba(5,150,105,0.08)' },
          }}
        >
          Details
        </Button>
      )}
    </Box>
  );
}
