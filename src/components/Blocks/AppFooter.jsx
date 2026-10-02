// src/components/Blocks/AppFooter.jsx
import React from 'react';
import { Box, Typography, Button, Link } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import RawShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import RawHelpOutlineIcon from '@mui/icons-material/HelpOutlined';
import RawStorefrontIcon from '@mui/icons-material/Storefront';
import { unwrapIcon } from '../../utils/iconHelper';
import { useThemeMode } from '../../context/ThemeContext';

const ShieldOutlinedIcon = unwrapIcon(RawShieldOutlinedIcon);
const HelpOutlineIcon = unwrapIcon(RawHelpOutlineIcon);
const StorefrontIcon = unwrapIcon(RawStorefrontIcon);

export default function AppFooter({
  onOpenPrivacy,
  onOpenHelp,
  merchantPortalLink = '/merchant/login',
}) {
  const navigate = useNavigate();
  const { isDark, colors } = useThemeMode();

  return (
    <Box
      component="footer"
      sx={{
        mt: 'auto',
        py: 4,
        px: 2,
        borderTop: `1px solid ${colors.border}`,
        bgcolor: isDark ? 'rgba(15,23,42,0.6)' : 'rgba(250,248,255,0.8)',
        transition: 'all 0.2s ease',
      }}
    >
      <Box
        sx={{
          maxWidth: '680px',
          mx: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          textAlign: 'center',
        }}
      >
        {/* Links row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 3 }, flexWrap: 'wrap', justifyContent: 'center' }}>
          {onOpenPrivacy && (
            <Button
              size="small"
              onClick={onOpenPrivacy}
              startIcon={<ShieldOutlinedIcon sx={{ fontSize: 16 }} />}
              sx={{
                color: colors.textSecondary,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.8rem',
                '&:hover': { color: colors.primary, bgcolor: 'transparent' },
              }}
            >
              Zero-Retention Privacy
            </Button>
          )}

          {onOpenHelp && (
            <Button
              size="small"
              onClick={onOpenHelp}
              startIcon={<HelpOutlineIcon sx={{ fontSize: 16 }} />}
              sx={{
                color: colors.textSecondary,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.8rem',
                '&:hover': { color: colors.primary, bgcolor: 'transparent' },
              }}
            >
              Help & Steps
            </Button>
          )}

          {merchantPortalLink && (
            <Button
              size="small"
              onClick={() => navigate(merchantPortalLink)}
              startIcon={<StorefrontIcon sx={{ fontSize: 16 }} />}
              sx={{
                color: colors.textSecondary,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.8rem',
                '&:hover': { color: colors.primary, bgcolor: 'transparent' },
              }}
            >
              Merchant Terminal
            </Button>
          )}
        </Box>

        {/* Micro-copy / copyright */}
        <Typography
          variant="caption"
          sx={{
            color: colors.textMuted,
            fontSize: '0.72rem',
            lineHeight: 1.4,
          }}
        >
          QuickPrint • Fast, Private Counter Printing • Zero Document Retention
        </Typography>
      </Box>
    </Box>
  );
}
