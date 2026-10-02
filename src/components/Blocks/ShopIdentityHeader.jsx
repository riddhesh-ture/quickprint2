// src/components/Blocks/ShopIdentityHeader.jsx
import React from 'react';
import { Box, Typography } from '@mui/material';
import RawStorefrontIcon from '@mui/icons-material/Storefront';
import RawNumbersIcon from '@mui/icons-material/Numbers';
import { unwrapIcon } from '../../utils/iconHelper';
import { useThemeMode } from '../../context/ThemeContext';
import { formatShopCode } from '../../utils/tokenGenerator';

const StorefrontIcon = unwrapIcon(RawStorefrontIcon);
const NumbersIcon = unwrapIcon(RawNumbersIcon);

export default function ShopIdentityHeader({
  shopName = 'QuickPrint Station',
  shopCode = 'QP-8421',
  isOnline = true,
  pricePerPageBW = 2,
  pricePerPageColor = 5,
  tokenBadge,
  subtitle,
  compact = false,
  elevation = true,
}) {
  const { isDark, colors } = useThemeMode();
  const formattedCode = formatShopCode(shopCode);

  return (
    <Box
      sx={{
        p: compact ? 1.75 : 2.25,
        borderRadius: '16px',
        bgcolor: isDark ? colors.surface : '#ffffff',
        border: `1px solid ${colors.border}`,
        boxShadow: elevation ? (isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 2px 12px rgba(15,23,42,0.04)') : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 1.5,
        transition: 'all 0.2s ease',
      }}
    >
      {/* Left: Shop Info */}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography
            variant="subtitle1"
            noWrap
            sx={{
              fontWeight: 800,
              fontSize: compact ? '0.96rem' : '1.08rem',
              color: colors.text,
              fontFamily: '"Plus Jakarta Sans", sans-serif',
            }}
          >
            {shopName}
          </Typography>

          {/* Online status indicator */}
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 0.9,
              py: 0.2,
              borderRadius: 999,
              bgcolor: isOnline ? (isDark ? 'rgba(16,185,129,0.15)' : '#dcfce7') : (isDark ? 'rgba(239,68,68,0.15)' : '#fee2e2'),
              color: isOnline ? (isDark ? '#34d399' : '#15803d') : (isDark ? '#f87171' : '#b91c1c'),
              fontWeight: 700,
              fontSize: '11px',
              flexShrink: 0,
            }}
          >
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: isOnline ? '#16a34a' : '#ef4444',
              }}
            />
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </Box>
        </Box>

        {/* Subline: Shop Code & Pricing */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.4,
              px: 0.8,
              py: 0.2,
              borderRadius: '6px',
              bgcolor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
              color: colors.textSecondary,
              fontFamily: 'monospace',
              fontWeight: 700,
              fontSize: '11.5px',
              letterSpacing: '0.04em',
            }}
          >
            <StorefrontIcon sx={{ fontSize: 13, color: colors.primary }} />
            <span>{formattedCode}</span>
          </Box>

          <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '0.78rem' }}>
            {subtitle || `₹${pricePerPageBW} B&W • ₹${pricePerPageColor} Color`}
          </Typography>
        </Box>
      </Box>

      {/* Right: Optional Token Badge or Action */}
      {tokenBadge && (
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1.5,
            py: 0.6,
            borderRadius: '10px',
            bgcolor: isDark ? 'rgba(37,99,235,0.15)' : '#eff6ff',
            border: `1.5px solid ${isDark ? '#2563eb' : '#bfdbfe'}`,
            color: colors.primary,
            fontWeight: 800,
            fontSize: '0.86rem',
            fontFamily: 'monospace',
            letterSpacing: '0.03em',
          }}
        >
          <NumbersIcon sx={{ fontSize: 15 }} />
          <span>{tokenBadge}</span>
        </Box>
      )}
    </Box>
  );
}
