// src/pages/HomePage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Alert,
  TextField,
  CircularProgress,
  Divider,
  Stack,
  Tooltip
} from '@mui/material';

// Raw icon imports from @mui/icons-material
import RawQrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import RawPrintIcon from '@mui/icons-material/Print';
import RawCloseIcon from '@mui/icons-material/Close';
import RawStorefrontIcon from '@mui/icons-material/Storefront';
import RawStarIcon from '@mui/icons-material/Star';
import RawStarBorderIcon from '@mui/icons-material/StarBorder';
import RawDeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RawKeyboardIcon from '@mui/icons-material/Keyboard';
import RawArrowForwardIcon from '@mui/icons-material/ArrowForward';
import RawHistoryIcon from '@mui/icons-material/History';
import RawBoltIcon from '@mui/icons-material/Bolt';
import RawScheduleIcon from '@mui/icons-material/Schedule';
import RawShieldIcon from '@mui/icons-material/Shield';
import RawCheckIcon from '@mui/icons-material/Check';
import RawReplayIcon from '@mui/icons-material/Replay';
import RawDarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import RawLightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';

// Vite 8 / Rolldown interop unwrap helper for CommonJS icon modules
const unwrapIcon = (icon) => {
  const unwrapped = icon?.default ? (icon.default.default || icon.default) : icon;
  return unwrapped || (() => null);
};

const QrCodeScannerIcon = unwrapIcon(RawQrCodeScannerIcon);
const PrintIcon = unwrapIcon(RawPrintIcon);
const CloseIcon = unwrapIcon(RawCloseIcon);
const StorefrontIcon = unwrapIcon(RawStorefrontIcon);
const StarIcon = unwrapIcon(RawStarIcon);
const StarBorderIcon = unwrapIcon(RawStarBorderIcon);
const DeleteOutlineIcon = unwrapIcon(RawDeleteOutlineIcon);
const KeyboardIcon = unwrapIcon(RawKeyboardIcon);
const ArrowForwardIcon = unwrapIcon(RawArrowForwardIcon);
const HistoryIcon = unwrapIcon(RawHistoryIcon);
const BoltIcon = unwrapIcon(RawBoltIcon);
const ScheduleIcon = unwrapIcon(RawScheduleIcon);
const ShieldIcon = unwrapIcon(RawShieldIcon);
const CheckIcon = unwrapIcon(RawCheckIcon);
const ReplayIcon = unwrapIcon(RawReplayIcon);
const DarkModeOutlinedIcon = unwrapIcon(RawDarkModeOutlinedIcon);
const LightModeOutlinedIcon = unwrapIcon(RawLightModeOutlinedIcon);

import {
  getSavedShops,
  recordShopVisit,
  toggleStarShop,
  removeSavedShop
} from '../utils/recentShops';

// Default mock shop for preview if user has no recent history
const DEFAULT_DEMO_SHOP = {
  id: 'campus-library-04',
  shopCode: 'QP-8421',
  shopName: 'Campus Library Print Station',
  locationDetails: 'Library Ground Floor, Printer #04',
  lastPrinted: 'Last printed today at 11:24 AM',
  isStarred: true,
  isDemo: true
};

export default function HomePage() {
  const navigate = useNavigate();

  // Print Mode: 'instant' (default Direct Scan & Print) or 'later' (24h Saved Queue)
  const [printMode, setPrintMode] = useState('instant');

  // Theme state (Visual toggle for light/dark)
  const [isDark, setIsDark] = useState(false);

  // QR Scanner state & refs
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanError, setScanError] = useState(null);
  const scannerRef = useRef(null);
  const scannerTimerRef = useRef(null);
  const resolvingRef = useRef(false);

  // Shop Code input & loading state (Inline on Hero + Dialog support)
  const [inputCode, setInputCode] = useState('');
  const [codeError, setCodeError] = useState(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);

  // Saved / Recent Shops state
  const [savedShops, setSavedShops] = useState([]);

  // Auxiliary info dialogs for footer links
  const [privacyDialogOpen, setPrivacyDialogOpen] = useState(false);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);

  const loadSavedShops = useCallback(() => {
    const list = getSavedShops();
    setSavedShops(list);
  }, []);

  useEffect(() => {
    loadSavedShops();
  }, [loadSavedShops]);

  // Clean up QR Scanner instance and timer
  const stopScanner = useCallback(async () => {
    if (scannerTimerRef.current) {
      clearTimeout(scannerTimerRef.current);
      scannerTimerRef.current = null;
    }
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        console.warn('[HomePage] Scanner stop note:', err);
      } finally {
        scannerRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  // Handle navigating to shop print page with mode awareness and saving history
  const handleSelectShop = (merchant, mode = printMode) => {
    if (!merchant || !merchant.id) return;
    if (!merchant.isDemo) {
      recordShopVisit({
        id: merchant.id,
        shopCode: merchant.shopCode || merchant.shop_code || null,
        shopName: merchant.shopName || merchant.shop_name || 'Print Shop',
        city: merchant.city || merchant.address || ''
      });
    }
    const url = mode === 'later'
      ? `/print?merchantId=${merchant.id}&mode=later`
      : `/print?merchantId=${merchant.id}`;
    navigate(url);
  };

  // Resolve scanned text or raw code into a merchant record with comprehensive format tolerance
  const resolveAndNavigate = async (rawInput, mode = printMode) => {
    const trimmed = rawInput.trim();
    if (!trimmed) return false;
    if (resolvingRef.current) return false;

    // 1. Try URL parsing
    let codeOrId = null;
    try {
      const url = new URL(trimmed, window.location.origin);
      codeOrId = url.searchParams.get('merchantId') || url.searchParams.get('code');
    } catch (_urlErr) {
      void _urlErr;
    }

    if (!codeOrId) {
      const match = trimmed.match(/merchantId=([a-zA-Z0-9_-]+)/);
      if (match) codeOrId = match[1];
    }

    if (!codeOrId) {
      codeOrId = trimmed;
    }

    resolvingRef.current = true;
    try {
      const { getMerchantByShopCodeOrId } = await import('../supabase/db');
      const clean = codeOrId.replace(/\s+/g, '');

      // Try 1: Exact code or ID (e.g. 'QP-8421' or 'QP8421' or raw UID)
      let merchant = await getMerchantByShopCodeOrId(clean);

      // Try 2: If code contains hyphens (e.g. 'QP-8421'), try stripped ('QP8421')
      if (!merchant && clean.includes('-')) {
        merchant = await getMerchantByShopCodeOrId(clean.replace(/-/g, ''));
      }

      // Try 3: If 6 alphanumeric characters without hyphen (e.g. 'QP8421'), try formatted ('QP-8421')
      if (!merchant && !clean.includes('-') && clean.length === 6) {
        merchant = await getMerchantByShopCodeOrId(`${clean.slice(0, 2)}-${clean.slice(2)}`);
      }

      if (merchant && merchant.id) {
        handleSelectShop(merchant, mode);
        return true;
      }
    } catch (err) {
      console.error('[HomePage] Resolve error:', err);
    } finally {
      resolvingRef.current = false;
    }
    return false;
  };

  // Start QR Scanner (Dynamically loaded on-demand to keep landing page 0-overhead)
  const startScanner = async () => {
    setScanError(null);
    const readerEl = document.getElementById('qr-reader');
    if (!readerEl) return;

    try {
      const { Html5Qrcode } = await import('html5-qrcode');

      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
        } catch {
          // ignore
        }
        scannerRef.current = null;
      }

      const html5QrCode = new Html5Qrcode('qr-reader');
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        async (decodedText) => {
          console.log('[HomePage] QR Code scanned:', decodedText);
          await stopScanner();
          const success = await resolveAndNavigate(decodedText, printMode);
          if (!success) {
            setScanError('Could not find a shop matching this QR code. Please try again or enter the shop code.');
          } else {
            setScannerOpen(false);
          }
        },
        () => {
          // ignore frame errors
        }
      );
    } catch (err) {
      console.error('[HomePage] Scanner start error:', err);
      setScanError('Could not access camera. Please allow camera permissions.');
    }
  };

  const handleOpenScanner = () => {
    setScannerOpen(true);
    setScanError(null);
    if (scannerTimerRef.current) clearTimeout(scannerTimerRef.current);
    scannerTimerRef.current = setTimeout(() => {
      startScanner();
    }, 350);
  };

  const handleCloseScanner = () => {
    stopScanner();
    setScannerOpen(false);
    setScanError(null);
  };

  // Handle Manual Shop Code Submit
  const handleCodeSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!inputCode.trim()) return;

    setCodeLoading(true);
    setCodeError(null);

    try {
      const success = await resolveAndNavigate(inputCode, printMode);
      if (!success) {
        setCodeError('Shop not found. Please check the code and try again.');
      } else {
        setCodeDialogOpen(false);
        setInputCode('');
      }
    } catch (err) {
      console.error('[HomePage] Code lookup error:', err);
      setCodeError('Error looking up shop. Please try again.');
    } finally {
      setCodeLoading(false);
    }
  };

  // Toggle star on a saved shop
  const handleToggleStar = (shopId, e) => {
    e.stopPropagation();
    const updated = toggleStarShop(shopId);
    setSavedShops(updated);
  };

  // Remove saved shop
  const handleRemoveShop = (shopId, e) => {
    e.stopPropagation();
    const updated = removeSavedShop(shopId);
    setSavedShops(updated);
  };

  // Display shops: either user's saved list, or default demo shop if none saved
  const displayShops = savedShops.length > 0 ? savedShops : [DEFAULT_DEMO_SHOP];

  // Editorial font style for headlines matching user_home_light design
  const serifHeadlineStyle = {
    fontFamily: '"Newsreader", Georgia, "Times New Roman", serif',
    letterSpacing: '-0.015em',
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: isDark ? '#0f172a' : '#f8faff',
        color: isDark ? '#f8fafc' : '#131b2e',
        transition: 'background-color 0.2s ease, color 0.2s ease',
      }}
    >
      {/* TopAppBar with Brand and Theme Toggle */}
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 1100,
          bgcolor: isDark ? '#1e293b' : '#ffffff',
          borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          transition: 'all 0.2s ease',
        }}
      >
        <Box
          sx={{
            maxWidth: '520px',
            mx: 'auto',
            height: 64,
            px: 2.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Brand Logo & Title */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              userSelect: 'none',
              cursor: 'pointer',
            }}
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                bgcolor: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 1px 3px rgba(37,99,235,0.12)',
              }}
            >
              <PrintIcon sx={{ fontSize: 22 }} />
            </Box>
            <Typography
              variant="h5"
              component="span"
              sx={{
                fontWeight: 800,
                color: isDark ? '#ffffff' : '#0f172a',
                fontSize: '1.35rem',
                letterSpacing: '-0.02em',
                fontFamily: '"Plus Jakarta Sans", sans-serif',
              }}
            >
              QuickPrint
            </Typography>
          </Box>

          {/* Dark / Light Mode Toggle Button */}
          <IconButton
            size="medium"
            onClick={() => setIsDark((prev) => !prev)}
            aria-label="Toggle theme mode"
            sx={{
              width: 40,
              height: 40,
              borderRadius: '10px',
              border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`,
              bgcolor: isDark ? '#1e293b' : '#ffffff',
              color: isDark ? '#cbd5e1' : '#475569',
              transition: 'all 0.2s ease',
              '&:hover': {
                bgcolor: isDark ? '#334155' : '#f1f5f9',
                borderColor: '#cbd5e1',
              },
            }}
          >
            {isDark ? (
              <LightModeOutlinedIcon sx={{ fontSize: 20 }} />
            ) : (
              <DarkModeOutlinedIcon sx={{ fontSize: 20 }} />
            )}
          </IconButton>
        </Box>
      </Box>

      {/* Main Content Canvas (Framed to 520px per user_home_light design) */}
      <Container
        component="main"
        maxWidth={false}
        sx={{
          maxWidth: '520px',
          mx: 'auto',
          px: { xs: 2, sm: 2.5 },
          py: 3,
          flexGrow: 1,
        }}
      >
        {/* 1. Hero Terminal Card */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, sm: 3 },
            mb: 2.5,
            borderRadius: '20px',
            bgcolor: isDark ? '#1e293b' : '#ffffff',
            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            boxShadow: '0 4px 20px -2px rgba(15,23,42,0.05)',
            textAlign: 'center',
            transition: 'all 0.2s ease',
          }}
        >
          {/* Segmented Mode Selector Tabs */}
          <Box
            role="tablist"
            aria-label="Print mode selector"
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 0.5,
              p: 0.6,
              mb: 2,
              bgcolor: isDark ? '#0f172a' : '#f1f3f9',
              borderRadius: '14px',
              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            }}
          >
            {/* Tab 1: Instant Print */}
            <Button
              role="tab"
              aria-selected={printMode === 'instant'}
              onClick={() => setPrintMode('instant')}
              startIcon={
                <BoltIcon
                  sx={{
                    fontSize: 20,
                    color: printMode === 'instant' ? '#2563eb' : (isDark ? '#94a3b8' : '#64748b')
                  }}
                />
              }
              sx={{
                py: 1,
                px: 2,
                borderRadius: '10px',
                bgcolor: printMode === 'instant' ? (isDark ? '#1e293b' : '#ffffff') : 'transparent',
                color: printMode === 'instant' ? '#2563eb' : (isDark ? '#94a3b8' : '#64748b'),
                fontWeight: printMode === 'instant' ? 700 : 600,
                fontSize: '0.9rem',
                textTransform: 'none',
                boxShadow: printMode === 'instant' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                border: printMode === 'instant'
                  ? `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
                  : '1px solid transparent',
                transition: 'all 0.15s ease',
                '&:hover': {
                  bgcolor: printMode === 'instant'
                    ? (isDark ? '#1e293b' : '#ffffff')
                    : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                },
              }}
            >
              Instant Print
            </Button>

            {/* Tab 2: Print Later */}
            <Button
              role="tab"
              aria-selected={printMode === 'later'}
              onClick={() => setPrintMode('later')}
              startIcon={
                <ScheduleIcon
                  sx={{
                    fontSize: 20,
                    color: printMode === 'later' ? '#2563eb' : (isDark ? '#94a3b8' : '#64748b')
                  }}
                />
              }
              sx={{
                py: 1,
                px: 2,
                borderRadius: '10px',
                bgcolor: printMode === 'later' ? (isDark ? '#1e293b' : '#ffffff') : 'transparent',
                color: printMode === 'later' ? '#2563eb' : (isDark ? '#94a3b8' : '#64748b'),
                fontWeight: printMode === 'later' ? 700 : 600,
                fontSize: '0.9rem',
                textTransform: 'none',
                boxShadow: printMode === 'later' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                border: printMode === 'later'
                  ? `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
                  : '1px solid transparent',
                transition: 'all 0.15s ease',
                '&:hover': {
                  bgcolor: printMode === 'later'
                    ? (isDark ? '#1e293b' : '#ffffff')
                    : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                },
              }}
            >
              Print Later
            </Button>
          </Box>

          {/* Mode Status Pill Indicator */}
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 0.6,
              mb: 2.5,
              bgcolor: isDark ? '#0f172a' : '#f1f4fb',
              borderRadius: 999,
              border: `1px solid ${isDark ? '#334155' : '#e2e8f7'}`,
            }}
          >
            <Box
              sx={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                bgcolor: '#10b981',
                boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.25)',
              }}
            />
            <Typography
              variant="caption"
              sx={{
                color: isDark ? '#94a3b8' : '#475569',
                fontWeight: 600,
                fontSize: '0.78rem',
              }}
            >
              {printMode === 'instant'
                ? 'Selected: Instant mode — no login required'
                : 'Selected: Saved queue mode — files saved for 24h'}
            </Typography>
          </Box>

          {/* View Header Text */}
          <Box sx={{ mb: 2.75 }}>
            <Typography
              variant="h5"
              sx={{
                ...serifHeadlineStyle,
                fontWeight: 800,
                color: isDark ? '#ffffff' : '#0f172a',
                mb: 0.75,
                fontSize: { xs: '1.5rem', sm: '1.65rem' },
              }}
            >
              {printMode === 'instant' ? 'Print Instantly at Counter' : 'Upload to 24h Print Queue'}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: isDark ? '#94a3b8' : '#64748b',
                maxWidth: 420,
                mx: 'auto',
                lineHeight: 1.45,
                fontSize: '0.85rem',
              }}
            >
              {printMode === 'instant'
                ? 'Fast contactless print session. Link to the screen at your shop.'
                : 'Upload documents now and print anytime when you arrive at any shop. 24h cloud retention.'}
            </Typography>
          </Box>

          {/* Primary Action Button: SCAN SHOP QR */}
          <Button
            variant="contained"
            fullWidth
            onClick={handleOpenScanner}
            startIcon={<QrCodeScannerIcon sx={{ fontSize: 22 }} />}
            sx={{
              py: 1.6,
              fontSize: '0.95rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              borderRadius: '12px',
              bgcolor: '#2563eb',
              color: '#ffffff',
              boxShadow: '0 4px 14px rgba(37,99,235,0.25)',
              transition: 'all 0.15s ease',
              '&:hover': {
                bgcolor: '#1d4ed8',
                boxShadow: '0 6px 18px rgba(37,99,235,0.35)',
              },
              '&:active': {
                transform: 'scale(0.99)',
              },
            }}
          >
            SCAN SHOP QR
          </Button>

          {/* Divider with OR text */}
          <Box
            sx={{
              position: 'relative',
              my: 2.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Divider sx={{ width: '100%', borderColor: isDark ? '#334155' : '#e2e8f0' }} />
            <Typography
              variant="caption"
              sx={{
                position: 'absolute',
                bgcolor: isDark ? '#1e293b' : '#ffffff',
                px: 1.5,
                color: isDark ? '#64748b' : '#94a3b8',
                fontWeight: 700,
                fontSize: '0.72rem',
                letterSpacing: '0.06em',
              }}
            >
              OR
            </Typography>
          </Box>

          {/* Inline 6-Character Shop Code Input Form */}
          <Box component="form" onSubmit={handleCodeSubmit} sx={{ textAlign: 'left' }}>
            <Typography
              component="label"
              htmlFor="inline-shop-code-input"
              variant="body2"
              sx={{
                fontWeight: 700,
                color: isDark ? '#cbd5e1' : '#334155',
                display: 'block',
                mb: 1,
                fontSize: '0.8rem',
              }}
            >
              Enter 6-Digit Shop Code
            </Typography>

            {codeError && (
              <Alert severity="error" sx={{ mb: 1.5, borderRadius: 2 }} onClose={() => setCodeError(null)}>
                {codeError}
              </Alert>
            )}

            <Stack direction="row" spacing={1.25} alignItems="stretch">
              <TextField
                id="inline-shop-code-input"
                fullWidth
                size="small"
                placeholder="QP-8421"
                value={inputCode}
                onChange={(e) => {
                  setInputCode(e.target.value.toUpperCase());
                  setCodeError(null);
                }}
                disabled={codeLoading}
                inputProps={{
                  maxLength: 10,
                  style: {
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    fontWeight: 700,
                    fontSize: '1.05rem',
                    paddingTop: 11,
                    paddingBottom: 11,
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        px: 0.75,
                        py: 0.25,
                        borderRadius: '6px',
                        border: `1.5px solid ${isDark ? '#475569' : '#94a3b8'}`,
                        color: isDark ? '#cbd5e1' : '#64748b',
                        fontWeight: 800,
                        fontSize: '0.7rem',
                        lineHeight: 1,
                        mr: 1,
                      }}
                    >
                      123
                    </Box>
                  ),
                  sx: {
                    borderRadius: '12px',
                    bgcolor: isDark ? '#0f172a' : '#ffffff',
                    '& fieldset': { borderColor: isDark ? '#334155' : '#cbd5e1' },
                    '&:hover fieldset': { borderColor: '#94a3b8' },
                    '&.Mui-focused fieldset': { borderColor: '#2563eb' },
                  },
                }}
              />

              <Button
                type="submit"
                variant="outlined"
                disabled={!inputCode.trim() || codeLoading}
                endIcon={
                  codeLoading ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <ArrowForwardIcon sx={{ fontSize: 18 }} />
                  )
                }
                sx={{
                  px: 2.75,
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  textTransform: 'none',
                  borderColor: isDark ? '#334155' : '#dbeafe',
                  color: '#2563eb',
                  bgcolor: isDark ? '#0f172a' : '#eff4ff',
                  whiteSpace: 'nowrap',
                  '&:hover': {
                    bgcolor: isDark ? '#1e293b' : '#dbeafe',
                    borderColor: '#93c5fd',
                  },
                }}
              >
                {codeLoading ? 'Checking...' : 'Connect'}
              </Button>
            </Stack>

            <Typography
              variant="caption"
              sx={{
                color: isDark ? '#64748b' : '#94a3b8',
                display: 'block',
                mt: 1,
                fontSize: '0.74rem',
              }}
            >
              Found directly on the shop acrylic stand or printed sticker.
            </Typography>
          </Box>
        </Paper>

        {/* 2. Print Later Callout Card */}
        <Paper
          elevation={0}
          sx={{
            p: 2.25,
            mb: 2.5,
            borderRadius: '16px',
            bgcolor: isDark ? '#1e293b' : '#f3f6ff',
            border: `1px solid ${isDark ? '#334155' : '#dbe4f9'}`,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1.75,
            transition: 'all 0.2s ease',
          }}
        >
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: '10px',
              bgcolor: isDark ? '#0f172a' : '#dbeafe',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              mt: 0.25,
            }}
          >
            <ScheduleIcon sx={{ fontSize: 22 }} />
          </Box>

          <Box sx={{ flexGrow: 1 }}>
            <Typography
              variant="subtitle2"
              sx={{
                ...serifHeadlineStyle,
                fontWeight: 700,
                color: isDark ? '#ffffff' : '#0f172a',
                fontSize: '0.94rem',
                lineHeight: 1.35,
              }}
            >
              Need to print later? Upload now, print when you arrive.
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: isDark ? '#94a3b8' : '#475569',
                mt: 0.5,
                fontSize: '0.8rem',
                lineHeight: 1.45,
              }}
            >
              Upload your documents now and print when you arrive at any shop. Files are auto-purged immediately after printing.
            </Typography>

            <Box
              component="span"
              onClick={() => {
                setPrintMode(printMode === 'instant' ? 'later' : 'instant');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                mt: 1.25,
                color: '#2563eb',
                fontWeight: 700,
                fontSize: '0.84rem',
                cursor: 'pointer',
                userSelect: 'none',
                '&:hover': {
                  textDecoration: 'underline',
                  color: '#1d4ed8',
                },
              }}
            >
              <span>{printMode === 'instant' ? 'Switch to Print Later' : 'Switch to Instant Print'}</span>
              <ArrowForwardIcon sx={{ fontSize: 16 }} />
            </Box>
          </Box>
        </Paper>

        {/* 3. Recent & Starred Shops Section */}
        <Box sx={{ mb: 2.75 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 1.25,
              px: 0.5,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <HistoryIcon sx={{ color: '#2563eb', fontSize: 20 }} />
              <Typography
                variant="subtitle1"
                sx={{
                  ...serifHeadlineStyle,
                  fontWeight: 800,
                  color: isDark ? '#ffffff' : '#0f172a',
                  fontSize: '0.98rem',
                }}
              >
                Recent & Starred Shops
              </Typography>
            </Box>
            <Typography
              variant="caption"
              sx={{
                color: isDark ? '#94a3b8' : '#64748b',
                fontWeight: 600,
                fontSize: '0.78rem',
              }}
            >
              {displayShops.length} Saved Location{displayShops.length > 1 ? 's' : ''}
            </Typography>
          </Box>

          {/* Saved Shop Card */}
          <Stack spacing={1.5}>
            {displayShops.map((shop) => (
              <Paper
                key={shop.id}
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: '16px',
                  bgcolor: isDark ? '#1e293b' : '#ffffff',
                  border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: '#2563eb',
                    boxShadow: '0 4px 14px rgba(37,99,235,0.06)',
                  },
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    mb: 1.5,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: '12px',
                        bgcolor: isDark ? '#0f172a' : '#eff6ff',
                        color: '#2563eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <PrintIcon sx={{ fontSize: 24 }} />
                    </Box>

                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          ...serifHeadlineStyle,
                          fontWeight: 700,
                          color: isDark ? '#ffffff' : '#0f172a',
                          fontSize: '1rem',
                        }}
                        noWrap
                      >
                        {shop.shopName}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: isDark ? '#94a3b8' : '#64748b',
                          display: 'block',
                          fontSize: '0.74rem',
                          mt: 0.25,
                        }}
                        noWrap
                      >
                        {shop.locationDetails || shop.city || 'Counter Print Station'}
                        {shop.lastPrinted && `  •  ${shop.lastPrinted}`}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        if (!shop.isDemo) handleToggleStar(shop.id, e);
                      }}
                      sx={{ color: shop.isStarred ? '#f59e0b' : (isDark ? '#475569' : '#cbd5e1') }}
                    >
                      {shop.isStarred ? (
                        <StarIcon sx={{ fontSize: 22, color: '#f59e0b' }} />
                      ) : (
                        <StarBorderIcon sx={{ fontSize: 22 }} />
                      )}
                    </IconButton>
                    {!shop.isDemo && (
                      <IconButton
                        size="small"
                        onClick={(e) => handleRemoveShop(shop.id, e)}
                        sx={{ color: isDark ? '#64748b' : '#94a3b8', '&:hover': { color: '#ef4444' } }}
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 20 }} />
                      </IconButton>
                    )}
                  </Box>
                </Box>

                {/* Print Here Action Button */}
                <Button
                  fullWidth
                  variant="outlined"
                  endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}
                  onClick={() => handleSelectShop(shop, printMode)}
                  sx={{
                    py: 1,
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    borderRadius: '12px',
                    borderColor: isDark ? '#334155' : '#dbeafe',
                    color: '#2563eb',
                    bgcolor: isDark ? '#0f172a' : '#eff4ff',
                    '&:hover': {
                      bgcolor: '#2563eb',
                      color: '#ffffff',
                      borderColor: '#2563eb',
                    },
                  }}
                >
                  Print Here
                </Button>
              </Paper>
            ))}
          </Stack>
        </Box>

        {/* 4. How It Works Section */}
        <Box sx={{ mb: 2.75 }}>
          <Typography
            variant="subtitle1"
            sx={{
              ...serifHeadlineStyle,
              fontWeight: 800,
              color: isDark ? '#ffffff' : '#0f172a',
              fontSize: '1.05rem',
              mb: 0.25,
            }}
          >
            How It Works
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: isDark ? '#94a3b8' : '#64748b',
              display: 'block',
              mb: 1.5,
              fontSize: '0.78rem',
            }}
          >
            Simple 3-step contactless counter printing
          </Typography>

          {/* 3 Vertically Stacked Cards */}
          <Stack spacing={1.25}>
            {/* Step 1 */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '16px',
                bgcolor: isDark ? '#1e293b' : '#ffffff',
                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                display: 'flex',
                alignItems: 'center',
                gap: 1.75,
              }}
            >
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: '10px',
                  bgcolor: isDark ? '#0f172a' : '#eef2ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  flexShrink: 0,
                }}
              >
                1
              </Box>
              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 700,
                    color: isDark ? '#ffffff' : '#0f172a',
                    fontSize: '0.92rem',
                    lineHeight: 1.3,
                  }}
                >
                  Connect
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: isDark ? '#94a3b8' : '#64748b',
                    display: 'block',
                    fontSize: '0.78rem',
                    mt: 0.25,
                  }}
                >
                  Scan the shop QR or type the 6-digit shop code.
                </Typography>
              </Box>
            </Paper>

            {/* Step 2 */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '16px',
                bgcolor: isDark ? '#1e293b' : '#ffffff',
                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                display: 'flex',
                alignItems: 'center',
                gap: 1.75,
              }}
            >
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: '10px',
                  bgcolor: isDark ? '#0f172a' : '#eef2ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  flexShrink: 0,
                }}
              >
                2
              </Box>
              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 700,
                    color: isDark ? '#ffffff' : '#0f172a',
                    fontSize: '0.92rem',
                    lineHeight: 1.3,
                  }}
                >
                  Upload & Customize
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: isDark ? '#94a3b8' : '#64748b',
                    display: 'block',
                    fontSize: '0.78rem',
                    mt: 0.25,
                  }}
                >
                  Select PDF or images, choose B&W/Color, and page range.
                </Typography>
              </Box>
            </Paper>

            {/* Step 3 */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '16px',
                bgcolor: isDark ? '#1e293b' : '#ffffff',
                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                display: 'flex',
                alignItems: 'center',
                gap: 1.75,
              }}
            >
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: '10px',
                  bgcolor: isDark ? '#0f172a' : '#eef2ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  flexShrink: 0,
                }}
              >
                3
              </Box>
              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 700,
                    color: isDark ? '#ffffff' : '#0f172a',
                    fontSize: '0.92rem',
                    lineHeight: 1.3,
                  }}
                >
                  Pay & Print
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: isDark ? '#94a3b8' : '#64748b',
                    display: 'block',
                    fontSize: '0.78rem',
                    mt: 0.25,
                  }}
                >
                  Pay with Apple Pay or Card. Counter releases pages immediately.
                </Typography>
              </Box>
            </Paper>
          </Stack>
        </Box>

        {/* 5. Zero Data Retention Guarantee (Security Banner) */}
        <Paper
          elevation={0}
          sx={{
            p: 2.25,
            mb: 2.75,
            bgcolor: isDark ? 'rgba(16,185,129,0.06)' : '#f8fffa',
            border: '1.5px solid #6ee7b7',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1.75,
            transition: 'all 0.2s ease',
          }}
        >
          {/* Shield Icon Box */}
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: '10px',
              bgcolor: '#10b981',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              mt: 0.2,
            }}
          >
            <ShieldIcon sx={{ fontSize: 22 }} />
          </Box>

          <Box sx={{ flexGrow: 1 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1,
                mb: 0.5,
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{
                  ...serifHeadlineStyle,
                  fontWeight: 700,
                  color: isDark ? '#6ee7b7' : '#0f172a',
                  fontSize: '0.95rem',
                }}
              >
                Zero Data Retention Guarantee
              </Typography>

              {/* 256-BIT TLS Badge */}
              <Box
                sx={{
                  px: 1.25,
                  py: 0.35,
                  borderRadius: 999,
                  bgcolor: isDark ? '#0f172a' : '#eef2ff',
                  border: `1px solid ${isDark ? '#334155' : '#dbeafe'}`,
                  color: '#1e40af',
                  fontWeight: 800,
                  fontSize: '0.68rem',
                  letterSpacing: '0.04em',
                }}
              >
                256-BIT TLS
              </Box>
            </Box>

            <Typography
              variant="caption"
              sx={{
                color: isDark ? '#cbd5e1' : '#475569',
                display: 'block',
                lineHeight: 1.5,
                fontSize: '0.78rem',
              }}
            >
              Your documents are processed through end-to-end memory buffers and auto-purged immediately upon print release. QuickPrint operators never retain copies of your files.
            </Typography>
          </Box>
        </Paper>

        {/* 6. Own or Manage a Print Shop Card */}
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            mb: 3,
            borderRadius: '16px',
            bgcolor: isDark ? '#1e293b' : '#ffffff',
            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            transition: 'all 0.2s ease',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.75, mb: 2 }}>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: '10px',
                bgcolor: isDark ? '#0f172a' : '#eff4ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <StorefrontIcon sx={{ fontSize: 24 }} />
            </Box>

            <Box>
              <Typography
                variant="subtitle2"
                sx={{
                  ...serifHeadlineStyle,
                  fontWeight: 800,
                  color: isDark ? '#ffffff' : '#0f172a',
                  fontSize: '1.08rem',
                }}
              >
                Own or manage a print shop?
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: isDark ? '#94a3b8' : '#64748b',
                  display: 'block',
                  mt: 0.5,
                  fontSize: '0.8rem',
                  lineHeight: 1.4,
                }}
              >
                Accept contactless student orders & speed up counter pickups.
              </Typography>
            </Box>
          </Box>

          {/* Action Buttons Stack */}
          <Stack spacing={1.25}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<StorefrontIcon sx={{ fontSize: 18 }} />}
              onClick={() => navigate('/merchant/signup')}
              sx={{
                py: 1.3,
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.9rem',
                bgcolor: '#2563eb',
                color: '#ffffff',
                borderRadius: '10px',
                boxShadow: '0 2px 8px rgba(37,99,235,0.2)',
                '&:hover': {
                  bgcolor: '#1d4ed8',
                },
              }}
            >
              Register Your Shop
            </Button>

            <Button
              fullWidth
              variant="outlined"
              onClick={() => navigate('/merchant/login')}
              sx={{
                py: 1.2,
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.9rem',
                borderRadius: '10px',
                borderColor: isDark ? '#475569' : '#cbd5e1',
                color: isDark ? '#ffffff' : '#1e40af',
                bgcolor: isDark ? '#1e293b' : '#ffffff',
                '&:hover': {
                  bgcolor: isDark ? '#334155' : '#f8fafc',
                  borderColor: '#94a3b8',
                },
              }}
            >
              Merchant Sign In
            </Button>
          </Stack>
        </Paper>

        {/* 7. Footer */}
        <Box sx={{ textAlign: 'center', pb: 2 }}>
          {/* Footer Links */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.5,
              mb: 1,
            }}
          >
            <Button
              size="small"
              onClick={() => setPrivacyDialogOpen(true)}
              sx={{
                color: isDark ? '#94a3b8' : '#475569',
                textTransform: 'none',
                fontSize: '0.78rem',
                p: 0,
                minWidth: 'auto',
                '&:hover': { color: '#2563eb', bgcolor: 'transparent' },
              }}
            >
              Privacy & Security
            </Button>
            <Typography variant="caption" sx={{ color: isDark ? '#475569' : '#cbd5e1' }}>
              •
            </Typography>
            <Button
              size="small"
              onClick={() => setHelpDialogOpen(true)}
              sx={{
                color: isDark ? '#94a3b8' : '#475569',
                textTransform: 'none',
                fontSize: '0.78rem',
                p: 0,
                minWidth: 'auto',
                '&:hover': { color: '#2563eb', bgcolor: 'transparent' },
              }}
            >
              Help & Support
            </Button>
          </Box>

          {/* Copyright */}
          <Typography
            variant="caption"
            sx={{
              color: isDark ? '#64748b' : '#94a3b8',
              display: 'block',
              fontSize: '0.74rem',
            }}
          >
            © 2025 QuickPrint Technologies. Instant & contactless printing.
          </Typography>
        </Box>
      </Container>

      {/* QR Scanner Dialog */}
      <Dialog
        open={scannerOpen}
        onClose={handleCloseScanner}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '20px', p: 1 } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <QrCodeScannerIcon sx={{ color: '#2563eb' }} />
            <Typography variant="h6" fontWeight="bold">
              {printMode === 'instant' ? 'Scan Merchant QR Code' : 'Scan Merchant QR (Print Later)'}
            </Typography>
          </Box>
          <IconButton onClick={handleCloseScanner} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {scanError && (
            <Alert
              severity="error"
              sx={{ mb: 2, borderRadius: 2 }}
              action={
                <Button color="inherit" size="small" startIcon={<ReplayIcon />} onClick={startScanner}>
                  Retry
                </Button>
              }
            >
              {scanError}
            </Alert>
          )}

          <Box
            id="qr-reader"
            sx={{
              width: '100%',
              minHeight: 280,
              bgcolor: '#0f172a',
              borderRadius: '14px',
              overflow: 'hidden',
            }}
          />

          <Typography variant="body2" sx={{ mt: 2, textAlign: 'center', color: '#64748b' }}>
            Point your camera at the QuickPrint QR code displayed at the counter.
          </Typography>
        </DialogContent>
      </Dialog>

      {/* Manual Shop Code Dialog */}
      <Dialog
        open={codeDialogOpen}
        onClose={() => setCodeDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '20px', p: 1 } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <KeyboardIcon sx={{ color: '#2563eb' }} />
            <Typography variant="h6" fontWeight="bold">
              Enter Shop Code
            </Typography>
          </Box>
          <IconButton onClick={() => setCodeDialogOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
            Enter the 6-character code (e.g. <strong>QP-8421</strong>) displayed at the counter:
          </Typography>

          {codeError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {codeError}
            </Alert>
          )}

          <TextField
            autoFocus
            fullWidth
            label="Shop Code or ID"
            placeholder="e.g. QP-8421"
            value={inputCode}
            onChange={(e) => {
              setInputCode(e.target.value.toUpperCase());
              setCodeError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCodeSubmit();
            }}
            disabled={codeLoading}
            variant="outlined"
            inputProps={{ style: { textTransform: 'uppercase', letterSpacing: 2, fontWeight: 'bold' } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCodeDialogOpen(false)} disabled={codeLoading} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            onClick={handleCodeSubmit}
            variant="contained"
            disabled={!inputCode.trim() || codeLoading}
            startIcon={codeLoading ? <CircularProgress size={18} color="inherit" /> : <ArrowForwardIcon />}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              bgcolor: '#2563eb',
              '&:hover': { bgcolor: '#1d4ed8' },
            }}
          >
            {codeLoading ? 'Checking...' : (printMode === 'instant' ? 'Open Shop' : 'Queue at Shop')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Privacy Policy Dialog */}
      <Dialog
        open={privacyDialogOpen}
        onClose={() => setPrivacyDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '16px', p: 1 } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight="bold">Privacy & Security Guarantee</Typography>
          <IconButton onClick={() => setPrivacyDialogOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" paragraph sx={{ color: '#334155' }}>
            At QuickPrint, your document privacy is our highest priority. All files transmitted through our service utilize bank-grade 256-bit TLS encryption.
          </Typography>
          <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 2, color: '#0f172a' }}>
            Zero-Retention Buffer
          </Typography>
          <Typography variant="body2" paragraph sx={{ color: '#475569' }}>
            In Instant Counter mode, documents are processed in volatile memory and purged immediately once printed at the counter.
          </Typography>
          <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 2, color: '#0f172a' }}>
            24-Hour Queue Expiration
          </Typography>
          <Typography variant="body2" sx={{ color: '#475569' }}>
            In Print Later mode, files are safely encrypted and automatically wiped after 24 hours if uncollected.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPrivacyDialogOpen(false)} variant="contained" sx={{ textTransform: 'none', bgcolor: '#2563eb' }}>
            Got it
          </Button>
        </DialogActions>
      </Dialog>

      {/* Help & Support Dialog */}
      <Dialog
        open={helpDialogOpen}
        onClose={() => setHelpDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '16px', p: 1 } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight="bold">Help & Support</Typography>
          <IconButton onClick={() => setHelpDialogOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" paragraph sx={{ color: '#334155' }}>
            Need help printing at your counter or have questions about QuickPrint?
          </Typography>
          <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 2, color: '#0f172a' }}>
            1. Where do I find the shop code?
          </Typography>
          <Typography variant="body2" paragraph sx={{ color: '#475569' }}>
            Look for the acrylic stand or sticker next to the printer counter. The 6-digit code is printed clearly underneath the QR code (e.g. QP-8421).
          </Typography>
          <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 2, color: '#0f172a' }}>
            2. Camera permission issues?
          </Typography>
          <Typography variant="body2" paragraph sx={{ color: '#475569' }}>
            If camera scanning is blocked, tap the lock icon in your browser's address bar to allow camera access, or simply type the 6-digit shop code instead.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setHelpDialogOpen(false)} variant="contained" sx={{ textTransform: 'none', bgcolor: '#2563eb' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
