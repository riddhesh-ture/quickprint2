// src/components/Blocks/AppHeader.jsx
import React from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import RawArrowBackIcon from '@mui/icons-material/ArrowBack';
import RawPrintIcon from '@mui/icons-material/Print';
import RawDarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import RawLightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import RawStorefrontIcon from '@mui/icons-material/Storefront';
import { unwrapIcon } from '../../utils/iconHelper';
import { useThemeMode } from '../../context/ThemeContext';

const ArrowBackIcon = unwrapIcon(RawArrowBackIcon);
const PrintIcon = unwrapIcon(RawPrintIcon);
const DarkModeOutlinedIcon = unwrapIcon(RawDarkModeOutlinedIcon);
const LightModeOutlinedIcon = unwrapIcon(RawLightModeOutlinedIcon);
const StorefrontIcon = unwrapIcon(RawStorefrontIcon);

export default function AppHeader({
  title = 'QuickPrint',
  subtitle,
  showBack = false,
  onBack,
  backTo = '/',
  isMerchant = false,
  merchantName,
  rightAction,
}) {
  const navigate = useNavigate();
  const { isDark, toggleTheme, colors } = useThemeMode();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backTo) {
      navigate(backTo);
    } else {
      navigate(-1);
    }
  };

  return (
    <Box
      component="header"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 1100,
        bgcolor: isDark ? colors.surface : '#ffffff',
        borderBottom: `1px solid ${colors.border}`,
        transition: 'all 0.2s ease',
        backdropFilter: 'blur(8px)',
      }}
    >
      <Box
        sx={{
          maxWidth: '680px',
          mx: 'auto',
          height: 64,
          px: { xs: 2, sm: 3 },
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Left Slot: Back Button or Spacer */}
        <Box sx={{ width: 44, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', zIndex: 2 }}>
          {showBack && (
            <IconButton
              edge="start"
              onClick={handleBack}
              aria-label="Go Back"
              sx={{
                color: colors.textSecondary,
                p: 1,
                borderRadius: '10px',
                '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' },
              }}
            >
              <ArrowBackIcon sx={{ fontSize: 20 }} />
            </IconButton>
          )}
        </Box>

        {/* Center Slot: QuickPrint Logo & Branding (Dead-center) */}
        <Box
          onClick={() => navigate(isMerchant ? '/merchant/dashboard' : '/')}
          sx={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            cursor: 'pointer',
            userSelect: 'none',
            zIndex: 1,
            maxWidth: 'calc(100% - 110px)',
            justifyContent: 'center',
          }}
        >
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              bgcolor: isDark ? 'rgba(37,99,235,0.18)' : '#eff6ff',
              color: colors.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {isMerchant ? <StorefrontIcon sx={{ fontSize: 20 }} /> : <PrintIcon sx={{ fontSize: 20 }} />}
          </Box>

          <Box sx={{ minWidth: 0, textAlign: 'left' }}>
            <Typography
              variant="h6"
              noWrap
              sx={{
                fontWeight: 800,
                fontSize: { xs: '1.05rem', sm: '1.15rem' },
                letterSpacing: '-0.02em',
                color: colors.text,
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                lineHeight: 1.2,
              }}
            >
              {title}
            </Typography>
            {(subtitle || (isMerchant && merchantName)) && (
              <Typography
                variant="caption"
                noWrap
                sx={{
                  display: 'block',
                  color: colors.textSecondary,
                  fontSize: '0.72rem',
                  fontWeight: 500,
                  lineHeight: 1,
                }}
              >
                {subtitle || merchantName}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Right Slot: Custom Slot + Theme Toggle */}
        <Box sx={{ width: 44, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, zIndex: 2 }}>
          {rightAction}

          <Tooltip title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'} arrow>
            <IconButton
              onClick={toggleTheme}
              aria-label="Toggle Theme"
              sx={{
                color: colors.textSecondary,
                p: 1,
                borderRadius: '10px',
                bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' },
              }}
            >
              {isDark ? <LightModeOutlinedIcon sx={{ fontSize: 20, color: '#f59e0b' }} /> : <DarkModeOutlinedIcon sx={{ fontSize: 20 }} />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
}
