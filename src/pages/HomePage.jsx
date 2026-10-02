// src/pages/HomePage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
} from '@mui/material';
import RawQrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import RawArrowForwardIcon from '@mui/icons-material/ArrowForward';
import RawStorefrontIcon from '@mui/icons-material/Storefront';
import RawCloseIcon from '@mui/icons-material/Close';
import RawDeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RawHistoryIcon from '@mui/icons-material/History';
import { unwrapIcon } from '../utils/iconHelper';
import { useThemeMode } from '../context/ThemeContext';
import {
  AppHeader,
  PrintCard,
  TrustBanner,
  AppFooter,
  PrivacyDialog,
  HelpDialog,
} from '../components/Blocks';
import { getSavedShops, removeSavedShop, recordShopVisit } from '../utils/recentShops';

const QrCodeScannerIcon = unwrapIcon(RawQrCodeScannerIcon);
const ArrowForwardIcon = unwrapIcon(RawArrowForwardIcon);
const StorefrontIcon = unwrapIcon(RawStorefrontIcon);
const CloseIcon = unwrapIcon(RawCloseIcon);
const DeleteOutlineIcon = unwrapIcon(RawDeleteOutlineIcon);
const HistoryIcon = unwrapIcon(RawHistoryIcon);

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

  const scannerRef = useRef(null);

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
    const trimmed = (rawCode || inputCode).trim().toUpperCase();
    if (!trimmed) return;
    setCodeLoading(true);
    setCodeError(null);

    try {
      const { getMerchantByShopCodeOrId } = await import('../supabase/db');
      const clean = trimmed.replace(/\s+/g, '');
      let merchant = await getMerchantByShopCodeOrId(clean);

      if (!merchant && clean.includes('-')) {
        merchant = await getMerchantByShopCodeOrId(clean.replace(/-/g, ''));
      }
      if (!merchant && !clean.includes('-') && clean.length === 6) {
        merchant = await getMerchantByShopCodeOrId(`${clean.slice(0, 2)}-${clean.slice(2)}`);
      }

      if (merchant?.id) {
        handleSelectShop(merchant);
      } else if (clean === 'QP-8421' || clean === 'QP8421' || clean === '8421') {
        handleSelectShop(DEFAULT_DEMO_SHOP);
      } else {
        setCodeError('Shop code not found. Please verify the 6-character code.');
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
      <AppHeader title="QuickPrint" subtitle="Zero-Memory Kiosk Printing" />

      <Container maxWidth="xs" sx={{ py: 3, flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* 1. Hero Hub Card: Enter Shop Code or Scan QR */}
        <PrintCard
          title="Print Instantly"
          subtitle="Enter 6-character shop code or scan kiosk QR"
          elevation
          sx={{ textAlign: 'center' }}
        >
          <Box component="form" onSubmit={(e) => { e.preventDefault(); handleResolveCode(); }} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              placeholder="e.g. QP-8421"
              error={Boolean(codeError)}
              helperText={codeError}
              inputProps={{
                maxLength: 10,
                style: { textAlign: 'center', fontSize: '1.25rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' },
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

      {/* QR Scanner Dialog */}
      <Dialog open={scannerOpen} onClose={() => setScannerOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Scan Station QR</Typography>
          <IconButton onClick={() => setScannerOpen(false)}><CloseIcon sx={{ fontSize: 18 }} /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center', pb: 3 }}>
          <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2 }}>
            Point your camera at the QuickPrint QR code at the counter
          </Typography>
          <Button
            variant="contained"
            onClick={() => { setScannerOpen(false); handleSelectShop(DEFAULT_DEMO_SHOP); }}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Simulate Station QR Scan
          </Button>
        </DialogContent>
      </Dialog>

      <PrivacyDialog open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />

      <AppFooter
        onOpenPrivacy={() => setPrivacyOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
      />
    </Box>
  );
}
