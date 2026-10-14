// src/components/Blocks/AppHeader.jsx
import React from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PrintIcon from '@mui/icons-material/Print';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { useThemeMode } from '../../context/ThemeContext';

export default function AppHeader({
  title = 'QuickPrint',
  showBack,
  onBack,
  backTo,
  isMerchant = false,
  rightAction,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggleTheme, colors } = useThemeMode();

  // Automatically show back button on all non-root pages unless explicitly disabled
  const shouldShowBack = showBack !== undefined
    ? Boolean(showBack)
    : location.pathname !== '/';

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    // Prefer navigating back in history if history exists in this tab session
    const hasHistory = window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0;
    if (hasHistory) {
      navigate(-1);
    } else if (backTo) {
      navigate(backTo);
    } else {
      navigate('/');
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
          height: 60,
          px: { xs: 2, sm: 3 },
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Left Slot: Back Button (High z-index to guarantee hit target) */}
        <Box sx={{ width: 44, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', zIndex: 10 }}>
          {shouldShowBack ? (
            <IconButton
              edge="start"
              onClick={handleBack}
              aria-label="Go Back"
              sx={{
                color: colors.textSecondary,
                p: 1,
                borderRadius: '10px',
                cursor: 'pointer',
                pointerEvents: 'auto',
                '&:hover': {
                  bgcolor: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
                  color: colors.text,
                },
              }}
            >
              <ArrowBackIcon sx={{ fontSize: 22 }} />
            </IconButton>
          ) : (
            <Box sx={{ width: 44 }} />
          )}
        </Box>

        {/* Center Slot: Consistent QuickPrint Logo & Branding (Dead-center) */}
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
            zIndex: 5,
            pointerEvents: 'auto',
            justifyContent: 'center',
            maxWidth: 'calc(100% - 110px)',
          }}
        >
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: '10px',
              bgcolor: isDark ? 'rgba(37,99,235,0.18)' : '#eff6ff',
              color: colors.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {isMerchant ? <StorefrontIcon sx={{ fontSize: 19 }} /> : <PrintIcon sx={{ fontSize: 19 }} />}
          </Box>

          <Typography
            variant="h6"
            noWrap
            sx={{
              fontWeight: 800,
              fontSize: { xs: '1.12rem', sm: '1.22rem' },
              letterSpacing: '-0.02em',
              color: colors.text,
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              lineHeight: 1,
            }}
          >
            {title}
          </Typography>
        </Box>

        {/* Right Slot: Custom Slot + Theme Toggle (High z-index to guarantee hit target) */}
        <Box sx={{ width: 44, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, zIndex: 10 }}>
          {rightAction}

          <Tooltip title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'} arrow>
            <IconButton
              onClick={toggleTheme}
              aria-label="Toggle Theme"
              sx={{
                color: colors.textSecondary,
                p: 1,
                borderRadius: '10px',
                cursor: 'pointer',
                pointerEvents: 'auto',
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
