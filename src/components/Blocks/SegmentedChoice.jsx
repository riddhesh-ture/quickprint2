// src/components/Blocks/SegmentedChoice.jsx
import React from 'react';
import { Box, Typography } from '@mui/material';
import { useThemeMode } from '../../context/ThemeContext';

export default function SegmentedChoice({
  options = [],
  value,
  onChange,
  fullWidth = true,
  size = 'medium',
}) {
  const { isDark, colors } = useThemeMode();

  return (
    <Box
      role="radiogroup"
      sx={{
        display: fullWidth ? 'flex' : 'inline-flex',
        p: 0.5,
        borderRadius: '12px',
        bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
        border: `1px solid ${colors.border}`,
        gap: 0.5,
        userSelect: 'none',
      }}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <Box
            key={opt.value}
            role="radio"
            aria-checked={isSelected}
            tabIndex={0}
            onClick={() => onChange && onChange(opt.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onChange && onChange(opt.value);
              }
            }}
            sx={{
              flex: fullWidth ? 1 : 'none',
              py: size === 'small' ? 0.6 : 0.9,
              px: size === 'small' ? 1.25 : 1.75,
              borderRadius: '9px',
              bgcolor: isSelected
                ? isDark ? colors.primary : '#ffffff'
                : 'transparent',
              color: isSelected
                ? isDark ? '#ffffff' : colors.primary
                : colors.textSecondary,
              boxShadow: isSelected
                ? isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(15,23,42,0.08)'
                : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.75,
              fontWeight: isSelected ? 700 : 600,
              fontSize: size === 'small' ? '0.8rem' : '0.88rem',
              transition: 'all 0.15s ease',
              outline: 'none',
              '&:hover': {
                color: isSelected ? undefined : colors.text,
                bgcolor: isSelected ? undefined : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
              },
            }}
          >
            {opt.icon && <Box sx={{ display: 'flex', alignItems: 'center' }}>{opt.icon}</Box>}
            <Typography variant="body2" sx={{ fontWeight: 'inherit', fontSize: 'inherit', color: 'inherit' }}>
              {opt.label}
            </Typography>
            {opt.badge && (
              <Box
                sx={{
                  px: 0.7,
                  py: 0.1,
                  borderRadius: 999,
                  bgcolor: isSelected
                    ? isDark ? 'rgba(255,255,255,0.2)' : 'rgba(37,99,235,0.1)'
                    : isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
                  color: 'inherit',
                  fontSize: '10.5px',
                  fontWeight: 700,
                }}
              >
                {opt.badge}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
