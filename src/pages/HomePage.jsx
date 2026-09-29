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
  Card,
  CardContent,
  CardActions,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Tooltip
} from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import PrintIcon from '@mui/icons-material/Print';
import SecurityIcon from '@mui/icons-material/Security';
import CloseIcon from '@mui/icons-material/Close';
import StorefrontIcon from '@mui/icons-material/Storefront';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import HistoryIcon from '@mui/icons-material/History';
import {
  getSavedShops,
  recordShopVisit,
  toggleStarShop,
  removeSavedShop
} from '../utils/recentShops';

export default function HomePage() {
  const navigate = useNavigate();

  // QR Scanner state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanError, setScanError] = useState(null);
  const scannerRef = useRef(null);
  const resolvingRef = useRef(false);

  // Shop Code dialog state
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [codeError, setCodeError] = useState(null);
  const [codeLoading, setCodeLoading] = useState(false);

  // Saved / Recent Shops state
  const [savedShops, setSavedShops] = useState([]);

  const loadSavedShops = useCallback(() => {
    setSavedShops(getSavedShops());
  }, []);

  useEffect(() => {
    loadSavedShops();
  }, [loadSavedShops]);

  // Clean up QR Scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(() => {});
          }
        } catch (_) {}
        scannerRef.current = null;
      }
    };
  }, []);

  // Handle navigating to shop print page and saving history
  const handleSelectShop = (merchant) => {
    if (!merchant || !merchant.id) return;
    recordShopVisit({
      id: merchant.id,
      shopCode: merchant.shopCode || merchant.shop_code || null,
      shopName: merchant.shopName || merchant.shop_name || 'Print Shop',
      city: merchant.city || merchant.address || ''
    });
    navigate(`/print?merchantId=${merchant.id}`);
  };

  // Resolve scanned text or raw code into a merchant record
  const resolveAndNavigate = async (rawInput) => {
    const trimmed = rawInput.trim();
    if (!trimmed) return false;
    if (resolvingRef.current) return false;

    // 1. Try URL parsing
    let codeOrId = null;
    try {
      const url = new URL(trimmed, window.location.origin);
      codeOrId = url.searchParams.get('merchantId') || url.searchParams.get('code');
    } catch (_) {}

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
      const merchant = await getMerchantByShopCodeOrId(codeOrId);
      if (merchant && merchant.id) {
        handleSelectShop(merchant);
        return true;
      }
    } catch (err) {
      console.error('[HomePage] Resolve error:', err);
    } finally {
      resolvingRef.current = false;
    }
    return false;
  };

  // Start QR Scanner (Dynamically loaded on-demand)
  const startScanner = async () => {
    setScanError(null);

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
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
          stopScanner();
          const success = await resolveAndNavigate(decodedText);
          if (!success) {
            setScanError('Could not find a shop matching this QR code. Please try again or enter the shop code.');
            setScannerOpen(true);
          }
        },
        () => {
          // ignore scan frame errors
        }
      );
    } catch (err) {
      console.error('[HomePage] Scanner start error:', err);
      setScanError('Could not access camera. Please allow camera permissions.');
    }
  };

  const stopScanner = async () => {
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
  };

  const handleOpenScanner = () => {
    setScannerOpen(true);
    setScanError(null);
    setTimeout(() => {
      startScanner();
    }, 400);
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
      const success = await resolveAndNavigate(inputCode);
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

  // Toggle star
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

  return (
    <Container maxWidth="md" sx={{ mt: { xs: 2, sm: 4 }, mb: 8, textAlign: 'center' }}>
      {/* Hero Card */}
      <Paper
        elevation={3}
        sx={{
          p: { xs: 3, sm: 5 },
          mb: 4,
          borderRadius: 3,
          background: 'linear-gradient(135deg, rgba(25,118,210,0.05) 0%, rgba(25,118,210,0.12) 100%)'
        }}
      >
        <QrCodeScannerIcon sx={{ fontSize: 72, color: 'primary.main', mb: 1 }} />
        <Typography variant="h3" component="h1" fontWeight="bold" gutterBottom sx={{ fontSize: { xs: '2rem', sm: '2.8rem' } }}>
          QuickPrint
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
          Fast, Contactless Printing at Local Shops
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 540, mx: 'auto' }}>
          Scan the shop QR code or enter the shop code to upload and print your documents instantly.
          <br />
          <Box component="span" sx={{ color: 'primary.main', fontWeight: 600, display: 'inline-block', mt: 0.5 }}>
            ⚡ No login or sign-up needed!
          </Box>
        </Typography>

        {/* Primary Action Buttons */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center" sx={{ maxWidth: 440, mx: 'auto' }}>
          <Button
            variant="contained"
            size="large"
            onClick={handleOpenScanner}
            startIcon={<QrCodeScannerIcon />}
            sx={{ py: 1.6, px: 3, fontSize: '1.05rem', fontWeight: 600, borderRadius: 2 }}
          >
            Scan Shop QR
          </Button>

          <Button
            variant="outlined"
            size="large"
            onClick={() => {
              setCodeError(null);
              setCodeDialogOpen(true);
            }}
            startIcon={<KeyboardIcon />}
            sx={{ py: 1.6, px: 3, fontSize: '1.05rem', fontWeight: 600, borderRadius: 2 }}
          >
            Enter Shop Code
          </Button>
        </Stack>
      </Paper>

      {/* Previous or Starred Shops Section */}
      <Box sx={{ mb: 5, textAlign: 'left' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <HistoryIcon color="primary" />
          <Typography variant="h5" fontWeight="bold">
            Recent & Starred Shops
          </Typography>
        </Box>

        {savedShops.length > 0 ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
              gap: 2
            }}
          >
            {savedShops.map((shop) => (
              <Card
                key={shop.id}
                variant="outlined"
                sx={{
                  borderRadius: 2.5,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: 'primary.main',
                    boxShadow: 2
                  }
                }}
              >
                <CardContent sx={{ pb: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ pr: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold" noWrap>
                        {shop.shopName || 'Print Shop'}
                      </Typography>
                      {shop.city && (
                        <Typography variant="body2" color="text.secondary" noWrap>
                          📍 {shop.city}
                        </Typography>
                      )}
                    </Box>
                    <Tooltip title={shop.isStarred ? 'Unstar shop' : 'Star shop'}>
                      <IconButton
                        size="small"
                        onClick={(e) => handleToggleStar(shop.id, e)}
                        sx={{ color: shop.isStarred ? 'warning.main' : 'text.disabled' }}
                      >
                        {shop.isStarred ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                  </Box>

                  {shop.shopCode && (
                    <Box sx={{ mt: 1 }}>
                      <Chip
                        label={`Code: ${shop.shopCode}`}
                        size="small"
                        variant="outlined"
                        color="primary"
                        sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                      />
                    </Box>
                  )}
                </CardContent>

                <CardActions sx={{ px: 2, pb: 1.5, pt: 0, justifyContent: 'space-between' }}>
                  <Button
                    size="small"
                    variant="contained"
                    endIcon={<ArrowForwardIcon />}
                    onClick={() => handleSelectShop(shop)}
                    sx={{ textTransform: 'none', fontWeight: 600 }}
                  >
                    Print Here
                  </Button>

                  <Tooltip title="Remove from recent">
                    <IconButton
                      size="small"
                      onClick={(e) => handleRemoveShop(shop.id, e)}
                      sx={{ color: 'text.secondary' }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </CardActions>
              </Card>
            ))}
          </Box>
        ) : (
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              borderRadius: 2,
              textAlign: 'center',
              bgcolor: 'background.default',
              borderStyle: 'dashed'
            }}
          >
            <Typography variant="body1" color="text.secondary">
              No recent shops yet.
            </Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
              Scan a shop QR code or enter a 6-digit shop code above — your shops will be saved here for quick 1-tap printing next time!
            </Typography>
          </Paper>
        )}
      </Box>

      {/* How It Works Section */}
      <Box sx={{ mb: 6 }}>
        <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mb: 3 }}>
          How QuickPrint Works
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3 }}>
          <Paper elevation={1} sx={{ p: 3, borderRadius: 2.5 }}>
            <QrCodeScannerIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1.5 }} />
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              1. Connect to Shop
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Scan the shop's QR code or enter their 6-character code at the counter.
            </Typography>
          </Paper>

          <Paper elevation={1} sx={{ p: 3, borderRadius: 2.5 }}>
            <PrintIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1.5 }} />
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              2. Upload & Customize
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Select files. Copies and color options are pre-filled or easily customized.
            </Typography>
          </Paper>

          <Paper elevation={1} sx={{ p: 3, borderRadius: 2.5 }}>
            <SecurityIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1.5 }} />
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              3. Pay & Instant Print
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Pay via UPI or cash at the counter. Files stream directly to the shop printer.
            </Typography>
          </Paper>
        </Box>
      </Box>

      {/* Privacy Notice Banner */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 6,
          bgcolor: 'success.light',
          color: 'success.contrastText',
          borderRadius: 2.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1.5
        }}
      >
        <SecurityIcon />
        <Typography variant="body2" fontWeight={500}>
          <strong>100% Private:</strong> Files are encrypted in transit and purged immediately after printing. No user account or sign-up needed.
        </Typography>
      </Paper>

      {/* Divider */}
      <Divider sx={{ mb: 4 }} />

      {/* Merchant Entry Section - AT THE VERY BOTTOM */}
      <Box sx={{ py: 2, color: 'text.secondary' }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Own or manage a print shop?
        </Typography>
        <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 1 }}>
          <Button
            variant="text"
            size="small"
            onClick={() => navigate('/merchant/login')}
            startIcon={<StorefrontIcon />}
            sx={{ color: 'text.secondary', textTransform: 'none', fontWeight: 600 }}
          >
            Merchant Sign In
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate('/merchant/signup')}
            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
          >
            Register Your Shop
          </Button>
        </Stack>
      </Box>

      {/* QR Scanner Dialog */}
      <Dialog
        open={scannerOpen}
        onClose={handleCloseScanner}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <QrCodeScannerIcon color="primary" />
            <Typography variant="h6" fontWeight="bold">
              Scan Merchant QR Code
            </Typography>
          </Box>
          <IconButton onClick={handleCloseScanner} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {scanError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {scanError}
            </Alert>
          )}

          <Box
            id="qr-reader"
            sx={{
              width: '100%',
              minHeight: 280,
              bgcolor: '#000',
              borderRadius: 2,
              overflow: 'hidden'
            }}
          />

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
            Point your camera at the QuickPrint QR code at the counter
          </Typography>
        </DialogContent>
      </Dialog>

      {/* Manual Shop Code Dialog */}
      <Dialog
        open={codeDialogOpen}
        onClose={() => setCodeDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <KeyboardIcon color="primary" />
            <Typography variant="h6" fontWeight="bold">
              Enter Shop Code
            </Typography>
          </Box>
          <IconButton onClick={() => setCodeDialogOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter the 6-character code (e.g. <strong>QP-8421</strong>) or Merchant ID displayed at the counter:
          </Typography>

          {codeError && (
            <Alert severity="error" sx={{ mb: 2 }}>
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
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setCodeDialogOpen(false)} disabled={codeLoading} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            onClick={handleCodeSubmit}
            variant="contained"
            disabled={!inputCode.trim() || codeLoading}
            startIcon={codeLoading ? <CircularProgress size={18} color="inherit" /> : <ArrowForwardIcon />}
            sx={{ textTransform: 'none', fontWeight: 600, px: 2.5 }}
          >
            {codeLoading ? 'Checking...' : 'Open Shop'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
