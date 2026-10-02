// src/components/Blocks/StickyActionDock.jsx
import React from 'react';
import { Box, Button, Typography, CircularProgress } from '@mui/material';
import RawArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { unwrapIcon } from '../../utils/iconHelper';
import { useThemeMode } from '../../context/ThemeContext';

const ArrowForwardIcon = unwrapIcon(RawArrowForwardIcon);

export default function StickyActionDock({
  priceText,
  priceLabel = 'Total Payable',
  badge,
  primaryLabel = 'Proceed to Payment',
  primaryIcon = <ArrowForwardIcon sx={{ fontSize: 18 }} />,
  onPrimaryClick,
  disabled = false,
  loading = false,
  secondaryAction,
}) {
  const { isDark, colors } = useThemeMode();

  return (
    <Box
      sx={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        bgcolor: isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(12px)',
        borderTop: `1px solid ${colors.border}`,
        boxShadow: isDark ? '0 -4px 20px rgba(0,0,0,0.4)' : '0 -4px 20px rgba(15,23,42,0.06)',
        pt: { xs: 1.5, sm: 2 },
        pb: { xs: 'calc(14px + env(safe-area-inset-bottom, 0px))', sm: 2 },
        px: { xs: 2, sm: 3 },
        transition: 'all 0.2s ease',
      }}
    >
      <Box
        sx={{
          maxWidth: '680px',
          mx: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        {/* Left: Summary or Price */}
        {(priceText || badge) && (
          <Box sx={{ minWidth: 0 }}>
            {priceLabel && (
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  color: colors.textSecondary,
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {priceLabel}
              </Typography>
            )}
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
              {priceText && (
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 800,
                    fontSize: { xs: '1.25rem', sm: '1.45rem' },
                    color: colors.text,
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    lineHeight: 1.1,
                  }}
                >
                  {priceText}
                </Typography>
              )}
              {badge && (
                <Box
                  sx={{
                    px: 0.8,
                    py: 0.15,
                    borderRadius: '6px',
                    bgcolor: isDark ? 'rgba(37,99,235,0.15)' : '#eff6ff',
                    color: colors.primary,
                    fontWeight: 700,
                    fontSize: '11px',
                  }}
                >
                  {badge}
                </Box>
              )}
            </Box>
          </Box>
        )}

        {/* Right: Primary Button + Optional Secondary */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flex: (priceText || badge) ? 'none' : 1 }}>
          {secondaryAction}

          <Button
            variant="contained"
            disabled={disabled || loading}
            onClick={onPrimaryClick}
            endIcon={!loading && primaryIcon}
            fullWidth={!(priceText || badge)}
            sx={{
              bgcolor: colors.primary,
              color: '#ffffff',
              py: { xs: 1.35, sm: 1.5 },
              px: { xs: 2.75, sm: 3.5 },
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 800,
              fontSize: { xs: '0.92rem', sm: '0.98rem' },
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
              minHeight: '48px',
              transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                bgcolor: colors.primaryHover,
                boxShadow: '0 6px 20px rgba(37,99,235,0.4)',
              },
              '&:active': {
                transform: 'scale(0.98)',
              },
              '&:disabled': {
                bgcolor: isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0',
                color: isDark ? 'rgba(255,255,255,0.3)' : '#94a3b8',
              },
            }}
          >
            {loading ? <CircularProgress size={22} color="inherit" /> : primaryLabel}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
