// src/components/Blocks/PrintCard.jsx
import React from 'react';
import { Paper, Box, Typography } from '@mui/material';
import { useThemeMode } from '../../context/ThemeContext';

export default function PrintCard({
  title,
  subtitle,
  action,
  children,
  p = 2.25,
  mb = 2,
  elevation = false,
  sx = {},
  ...props
}) {
  const { isDark, colors } = useThemeMode();

  return (
    <Paper
      elevation={0}
      sx={{
        p,
        mb,
        borderRadius: '16px',
        bgcolor: isDark ? colors.surface : '#ffffff',
        border: `1px solid ${colors.border}`,
        boxShadow: elevation ? (isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 2px 12px rgba(15,23,42,0.04)') : 'none',
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
        ...sx,
      }}
      {...props}
    >
      {(title || action) && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: subtitle ? 0.5 : 1.75 }}>
          <Box sx={{ minWidth: 0 }}>
            {title && (
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 800,
                  fontSize: '1.02rem',
                  color: colors.text,
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                }}
              >
                {title}
              </Typography>
            )}
            {subtitle && (
              <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '0.78rem' }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
        </Box>
      )}
      {children}
    </Paper>
  );
}
