import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  TextField,
  InputAdornment,
  Button,
  Stack,
  IconButton,
  CircularProgress,
} from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import StorefrontIcon from '@mui/icons-material/Storefront';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import HistoryIcon from '@mui/icons-material/History';
import { useThemeMode } from '../context/ThemeContext';
import QrCodeScannerModal from '../components/UserView/QrCodeScannerModal';
import AppHeader from '../components/Blocks/AppHeader';
import PrintCard from '../components/Blocks/PrintCard';
import TrustBanner from '../components/Blocks/TrustBanner';
import AppFooter from '../components/Blocks/AppFooter';
import PrivacyDialog from '../components/Blocks/PrivacyDialog';
import HelpDialog from '../components/Blocks/HelpDialog';
import { getSavedShops, removeSavedShop, recordShopVisit } from '../utils/recentShops';

const DEFAULT_DEMO_SHOP = {
  id: 'campus-library-04',
  shopCode: 'QP-8421',
  shopName: 'Campus Library Print Station',
  locationDetails: 'Library Ground Floor, Printer #04',
  isDemo: true,
};

export default function HomePage() {
  const navigate = useNavigate();
  const { isDark, colors } = useThemeMode();

  const [inputCode, setInputCode] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState(null);
  const [savedShops, setSavedShops] = useState([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    setSavedShops(getSavedShops());
  }, []);

  const handleSelectShop = (merchant) => {
    if (!merchant?.id) return;
    if (!merchant.isDemo) {
      recordShopVisit({
        id: merchant.id,
        shopCode: merchant.shopCode || merchant.shop_code || null,
        shopName: merchant.shopName || merchant.shop_name || 'Print Shop',
      });
    }
    navigate(`/print?merchantId=${merchant.id}`);
  };

  const handleResolveCode = async (rawCode) => {
    let raw = (rawCode || inputCode).trim();
    if (!raw) return;

    // Check if raw is a URL (e.g. from scanned QR code)
    if (raw.includes('http://') || raw.includes('https://') || raw.includes('/print?') || raw.includes('?')) {
      try {
        const url = new URL(raw, window.location.origin);
        let searchParams = url.searchParams;
        if (url.hash && url.hash.includes('?')) {
          const hashQuery = url.hash.split('?')[1];
          searchParams = new URLSearchParams(hashQuery);
        }
        const urlMerchantId = searchParams.get('merchantId') || searchParams.get('id');
        const urlCode = searchParams.get('code') || searchParams.get('shop') || searchParams.get('shopCode');
        if (urlMerchantId) {
          raw = urlMerchantId;
        } else if (urlCode) {
          raw = urlCode;
        } else if (url.pathname) {
          const pathEnd = url.pathname.split('/').filter(Boolean).pop();
          if (pathEnd && (/^\d{4}$/.test(pathEnd) || /^QP-/i.test(pathEnd))) {
            raw = pathEnd;
          }
        }
      } catch {
        // Fallback to text parsing
      }
    }

    const trimmed = raw.trim().toUpperCase();
    setCodeLoading(true);
    setCodeError(null);

    try {
      const { getMerchantByShopCodeOrId } = await import('../supabase/db');
      const clean = trimmed.replace(/\s+/g, '');

      // Check if it's the demo station
      if (clean === 'QP-8421' || clean === 'QP8421' || clean === '8421' || clean === 'CAMPUS-LIBRARY-04') {
        handleSelectShop(DEFAULT_DEMO_SHOP);
        return;
      }

      let merchant = await getMerchantByShopCodeOrId(clean);

      if (!merchant && !clean.startsWith('QP-') && /^\d{4}$/.test(clean)) {
        merchant = await getMerchantByShopCodeOrId(`QP-${clean}`);
      }

      if (merchant?.id) {
        handleSelectShop(merchant);
      } else {
        setCodeError('Shop code not found. Please verify the 4-digit code.');
      }
    } catch {
      if (trimmed.includes('8421') || trimmed.includes('DEMO')) {
        handleSelectShop(DEFAULT_DEMO_SHOP);
      } else {
        setCodeError('Could not verify shop. Try again or scan QR.');
      }
    } finally {
      setCodeLoading(false);
    }
  };

  const handleRemoveSaved = (e, shopId) => {
    e.stopPropagation();
    const updated = removeSavedShop(shopId);
    setSavedShops(updated);
  };

  const displayShops = savedShops.length > 0 ? savedShops : [DEFAULT_DEMO_SHOP];

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: isDark ? colors.bg : '#faf8ff' }}>
      <AppHeader title="QuickPrint" subtitle="Fast & Private Printing" />

      <Container maxWidth="xs" sx={{ py: 3, flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* 1. Hero Hub Card: Enter Shop Code or Scan QR */}
        <PrintCard
          title="Print Instantly"
          subtitle="Enter 4-digit code (e.g. 8421) or scan counter QR"
          elevation
          sx={{ textAlign: 'center' }}
        >
          <Box component="form" onSubmit={(e) => { e.preventDefault(); handleResolveCode(); }} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              value={inputCode}
              onChange={(e) => {
                const rawVal = e.target.value;
                if (rawVal.includes('http://') || rawVal.includes('https://') || rawVal.includes('?')) {
                  handleResolveCode(rawVal);
                  return;
                }
                let val = rawVal.toUpperCase();
                if (val.startsWith('QP-')) val = val.slice(3);
                else if (val.startsWith('QP')) val = val.slice(2);
                const cleaned = val.replace(/\D/g, '').slice(0, 4);
                setInputCode(cleaned);
              }}
              placeholder="8421"
              error={Boolean(codeError)}
              helperText={codeError}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Typography sx={{ fontWeight: 800, color: colors.primary, fontSize: '1.25rem', letterSpacing: '0.05em' }}>
                      QP-
                    </Typography>
                  </InputAdornment>
                ),
              }}
              inputProps={{
                inputMode: 'numeric',
                pattern: '[0-9]*',
                maxLength: 4,
                style: { textAlign: 'left', fontSize: '1.25rem', fontWeight: 800, letterSpacing: '0.12em' },
              }}
              sx={{ mb: 1.5 }}
            />

            <Button
              fullWidth
              variant="contained"
              disabled={codeLoading || !inputCode.trim()}
              onClick={() => handleResolveCode()}
              endIcon={codeLoading ? <CircularProgress size={18} color="inherit" /> : <ArrowForwardIcon />}
              sx={{
                bgcolor: colors.primary,
                py: 1.25,
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '0.94rem',
                textTransform: 'none',
              }}
            >
              Connect to Station
            </Button>
          </Box>

          <Button
            fullWidth
            variant="outlined"
            onClick={() => setScannerOpen(true)}
            startIcon={<QrCodeScannerIcon />}
            sx={{
              mt: 1.5,
              py: 1.1,
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '0.88rem',
              textTransform: 'none',
              borderColor: colors.border,
              color: colors.primary,
            }}
          >
            Scan Counter QR Code
          </Button>
        </PrintCard>

        {/* 2. Recent / Demo Shops */}
        <PrintCard
          title="Recent Stations"
          subtitle="1-tap reconnect to your frequent print spots"
          action={<HistoryIcon sx={{ fontSize: 20, color: colors.textSecondary }} />}
        >
          <Stack spacing={1}>
            {displayShops.map((shop) => (
              <Box
                key={shop.id}
                onClick={() => handleSelectShop(shop)}
                sx={{
                  p: 1.5,
                  borderRadius: '12px',
                  bgcolor: isDark ? 'rgba(255,255,255,0.04)' : '#f8faff',
                  border: `1px solid ${colors.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.08)' : '#eff6ff' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                  <StorefrontIcon sx={{ color: colors.primary, fontSize: 20 }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700, color: colors.text }}>
                      {shop.shopName || 'Campus Library Print Station'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                      {shop.shopCode || 'QP-8421'} {shop.isDemo ? '• Demo Station' : ''}
                    </Typography>
                  </Box>
                </Box>

                {!shop.isDemo && (
                  <IconButton size="small" onClick={(e) => handleRemoveSaved(e, shop.id)} sx={{ color: colors.textSecondary }}>
                    <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                )}
              </Box>
            ))}
          </Stack>
        </PrintCard>

        {/* 3. Trust Banner */}
        <TrustBanner onLearnMore={() => setPrivacyOpen(true)} />
      </Container>

      {/* Real Camera QR Scanner Modal with Fallback */}
      <QrCodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={(decodedText) => {
          setScannerOpen(false);
          handleResolveCode(decodedText);
        }}
        onSimulateScan={() => {
          setScannerOpen(false);
          handleSelectShop(DEFAULT_DEMO_SHOP);
        }}
      />

      <PrivacyDialog open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />

      <AppFooter
        onOpenPrivacy={() => setPrivacyOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
      />
    </Box>
  );
}
