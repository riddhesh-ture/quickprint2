// src/pages/PaymentSelectionPage.jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Typography,
  Button,
  Box,
  Paper,
  IconButton,
  Tooltip,
  Stack,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';

// Raw icon imports
import RawArrowBackIcon from '@mui/icons-material/ArrowBack';
import RawPrintIcon from '@mui/icons-material/Print';
import RawRefreshIcon from '@mui/icons-material/Refresh';
import RawBoltIcon from '@mui/icons-material/Bolt';
import RawCheckCircleIcon from '@mui/icons-material/CheckCircle';
import RawRadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import RawCreditCardIcon from '@mui/icons-material/CreditCard';
import RawPaymentsIcon from '@mui/icons-material/Payments';
import RawShieldIcon from '@mui/icons-material/Shield';
import RawArrowForwardIcon from '@mui/icons-material/ArrowForward';
import RawDescriptionIcon from '@mui/icons-material/Description';
import RawAutoStoriesIcon from '@mui/icons-material/AutoStories';
import RawWaterDropIcon from '@mui/icons-material/WaterDrop';
import RawContentCopyIcon from '@mui/icons-material/ContentCopy';
import RawDarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import RawLightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import RawVerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import RawCloseIcon from '@mui/icons-material/Close';

import { unwrapIcon } from '../utils/iconHelper';
import { getOrCreateUserIdentity, regenerateUserName } from '../utils/nameGenerator';
import { getMerchantProfile } from '../supabase/db';

const ArrowBackIcon = unwrapIcon(RawArrowBackIcon);
const PrintIcon = unwrapIcon(RawPrintIcon);
const RefreshIcon = unwrapIcon(RawRefreshIcon);
const BoltIcon = unwrapIcon(RawBoltIcon);
const CheckCircleIcon = unwrapIcon(RawCheckCircleIcon);
const RadioButtonUncheckedIcon = unwrapIcon(RawRadioButtonUncheckedIcon);
const CreditCardIcon = unwrapIcon(RawCreditCardIcon);
const PaymentsIcon = unwrapIcon(RawPaymentsIcon);
const ShieldIcon = unwrapIcon(RawShieldIcon);
const ArrowForwardIcon = unwrapIcon(RawArrowForwardIcon);
const DescriptionIcon = unwrapIcon(RawDescriptionIcon);
const AutoStoriesIcon = unwrapIcon(RawAutoStoriesIcon);
const WaterDropIcon = unwrapIcon(RawWaterDropIcon);
const ContentCopyIcon = unwrapIcon(RawContentCopyIcon);
const DarkModeOutlinedIcon = unwrapIcon(RawDarkModeOutlinedIcon);
const LightModeOutlinedIcon = unwrapIcon(RawLightModeOutlinedIcon);
const VerifiedUserIcon = unwrapIcon(RawVerifiedUserIcon);
const CloseIcon = unwrapIcon(RawCloseIcon);

// Default mock shop fallback
const DEFAULT_DEMO_MERCHANT = {
  id: 'campus-library-04',
  shopCode: 'QP-8421',
  shopName: 'Campus Library Print',
  pricePerPageBW: 2,
  pricePerPageColor: 5,
};

export default function PaymentSelectionPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const rawMerchantId = searchParams.get('merchantId');
  const merchantId = rawMerchantId || DEFAULT_DEMO_MERCHANT.id;
  const incomingState = location.state || {};
  const passedJobId = searchParams.get('jobId') || incomingState.jobId || null;

  // Resolve dynamic order data with demo fallbacks
  const filesList = incomingState.files || [];
  const primaryFileName = filesList.length > 0
    ? (filesList[0]?.name || 'document.pdf') + (filesList.length > 1 ? ` (+${filesList.length - 1} more)` : '')
    : 'lecture_notes_final.pdf';
  const totalPages = incomingState.totalPagesCount || (filesList.length > 0 ? filesList.reduce((acc, f) => acc + (f.pageCount || 1), 0) : 14);
  const bwPages = incomingState.bwPagesCount ?? (filesList.length > 0 ? totalPages : 14);
  const colorPages = incomingState.colorPagesCount ?? 0;
  const totalCost = incomingState.estimatedCost != null
    ? Number(incomingState.estimatedCost).toFixed(2)
    : '28.00';
  const pickupCode = incomingState.pickupCode || null;
  const specsDescription = `${totalPages} Pages  •  ${colorPages > 0 ? `${colorPages} Color, ${bwPages} B&W` : 'B&W'}  •  1 Copy  •  A4 75 GSM`;

  // Theme & State
  const [isDark, setIsDark] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('upi'); // 'upi', 'card', 'cash'
  const [userIdentity, setUserIdentity] = useState(null);
  const [merchantProfile, setMerchantProfile] = useState(DEFAULT_DEMO_MERCHANT);
  const [privacyDialogOpen, setPrivacyDialogOpen] = useState(false);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);

  // Load identity and merchant info
  useEffect(() => {
    const identity = getOrCreateUserIdentity();
    setUserIdentity(identity || { name: 'Cheerful Iris', avatar: '🎭' });

    if (merchantId && merchantId !== 'campus-library-04') {
      getMerchantProfile(merchantId)
        .then((profile) => {
          if (profile) setMerchantProfile(profile);
        })
        .catch(() => {
          setMerchantProfile(DEFAULT_DEMO_MERCHANT);
        });
    }
  }, [merchantId]);

  const handleRegenerateName = () => {
    const newIdentity = regenerateUserName();
    setUserIdentity(newIdentity);
  };

  const serifHeadlineStyle = {
    fontFamily: '"Newsreader", Georgia, "Times New Roman", serif',
    letterSpacing: '-0.015em',
  };

  const handlePayAndPrint = () => {
    const activeJobId = passedJobId || 'QP-' + Math.floor(100000 + Math.random() * 900000);
    const tokenDigits = activeJobId.replace(/[^0-9]/g, '');
    const tokenDisplay = `TOKEN #${tokenDigits ? tokenDigits.slice(-4) : '14'}`;

    const orderData = {
      jobId: activeJobId,
      orderId: activeJobId,
      tokenNumber: tokenDisplay,
      merchantId,
      merchantName: merchantProfile?.shopName || 'Campus Library',
      shopCode: merchantProfile?.shopCode || 'QP-8421',
      userName: userIdentity?.name || 'Cheerful Iris',
      userAvatar: userIdentity?.avatar || '🎭',
      fileName: primaryFileName,
      pages: totalPages,
      specsDescription,
      amount: totalCost,
      paymentMethod: selectedMethod,
      formattedDate: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      counterName: 'Counter 1',
      printerModel: 'HP LaserJet Enterprise M608 (Tray 2)',
      pickupCode,
    };

    navigate(`/receipt/pending?merchantId=${merchantId}&jobId=${activeJobId}`, { state: { order: orderData } });
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
      {/* Top Header */}
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
          {/* Back Button */}
          <IconButton
            edge="start"
            onClick={() => navigate(-1)}
            aria-label="Go Back"
            sx={{
              color: isDark ? '#cbd5e1' : '#475569',
              '&:hover': { bgcolor: isDark ? '#334155' : '#f1f5f9' },
            }}
          >
            <ArrowBackIcon />
          </IconButton>

          {/* Centered Brand */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              userSelect: 'none',
              cursor: 'pointer',
            }}
            onClick={() => navigate('/')}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                bgcolor: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 1px 3px rgba(37,99,235,0.12)',
              }}
            >
              <PrintIcon sx={{ fontSize: 20 }} />
            </Box>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                color: isDark ? '#ffffff' : '#0f172a',
                fontSize: '1.25rem',
                letterSpacing: '-0.02em',
                fontFamily: '"Plus Jakarta Sans", sans-serif',
              }}
            >
              QuickPrint
            </Typography>
          </Box>

          {/* Theme Toggle Button */}
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
              '&:hover': {
                bgcolor: isDark ? '#334155' : '#f1f5f9',
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

      {/* Main Container constrained to 520px per user-flow prototype */}
      <Container
        component="main"
        maxWidth={false}
        sx={{
          maxWidth: '520px',
          mx: 'auto',
          px: { xs: 2, sm: 2.5 },
          pt: 2.5,
          pb: 18,
          flexGrow: 1,
        }}
      >
        {/* Page Title & Step Badge Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2.5 }}>
          <Box>
            <Typography
              variant="h5"
              sx={{
                ...serifHeadlineStyle,
                fontWeight: 800,
                color: isDark ? '#ffffff' : '#0f172a',
                fontSize: { xs: '1.45rem', sm: '1.65rem' },
                lineHeight: 1.25,
              }}
            >
              Payment & Order
            </Typography>
            <Typography variant="body2" sx={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: '0.84rem', mt: 0.25 }}>
              Review specs and complete secure checkout
            </Typography>
          </Box>

          {/* Step 2 of 2 Badge */}
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.6,
              px: 1.25,
              py: 0.45,
              borderRadius: 999,
              bgcolor: isDark ? '#0f172a' : '#eff6ff',
              border: `1px solid ${isDark ? '#334155' : '#bfdbfe'}`,
              color: '#2563eb',
              fontWeight: 700,
              fontSize: '0.76rem',
              flexShrink: 0,
              mt: 0.5,
            }}
          >
            <VerifiedUserIcon sx={{ fontSize: 14 }} />
            <span>Step 2 of 2</span>
          </Box>
        </Box>

        {/* 1. Shop & Pickup Tag Card */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 2,
            borderRadius: '16px',
            bgcolor: isDark ? '#1e293b' : '#ffffff',
            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            transition: 'all 0.2s ease',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            {/* Shop Name & Online Badge */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography
                variant="subtitle1"
                sx={{
                  ...serifHeadlineStyle,
                  fontWeight: 800,
                  color: isDark ? '#ffffff' : '#0f172a',
                  fontSize: '1.05rem',
                }}
                noWrap
              >
                {merchantProfile?.shopName || 'Campus Library Print'}
              </Typography>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1,
                  py: 0.2,
                  borderRadius: 999,
                  bgcolor: '#dcfce7',
                  color: '#15803d',
                  fontWeight: 700,
                  fontSize: '11px',
                }}
              >
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#16a34a' }} />
                <span>Online</span>
              </Box>
            </Box>

            {/* Shop Code & Pricing Subline */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
              <Box
                sx={{
                  px: 0.75,
                  py: 0.15,
                  borderRadius: '6px',
                  bgcolor: isDark ? '#0f172a' : '#f1f5f9',
                  border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                  color: isDark ? '#cbd5e1' : '#334155',
                  fontWeight: 700,
                  fontSize: '11px',
                  letterSpacing: '0.04em',
                }}
              >
                {merchantProfile?.shopCode || 'QP-8421'}
              </Box>
              <Typography variant="caption" sx={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: '0.78rem' }}>
                • ₹2/pg B&W • ₹5/pg Color
              </Typography>
            </Box>
          </Box>

          {/* Pickup Tag Card */}
          <Box
            sx={{
              flexShrink: 0,
              bgcolor: isDark ? '#0f172a' : '#f1f4fb',
              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              borderRadius: '12px',
              p: 1.25,
              textAlign: 'right',
            }}
          >
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                fontSize: '9px',
                textTransform: 'uppercase',
                fontWeight: 800,
                letterSpacing: '0.06em',
                color: isDark ? '#94a3b8' : '#64748b',
              }}
            >
              YOUR PICKUP TAG
            </Typography>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                color: isDark ? '#ffffff' : '#0f172a',
                fontWeight: 700,
                fontSize: '0.86rem',
                mt: 0.25,
              }}
            >
              <span>{userIdentity?.avatar || '🎭'}</span>
              <span style={{ whiteSpace: 'nowrap' }}>{userIdentity?.name || 'Cheerful Iris'}</span>
              <Tooltip title="Regenerate tag">
                <IconButton
                  size="small"
                  onClick={handleRegenerateName}
                  sx={{ p: 0.2, color: isDark ? '#94a3b8' : '#64748b', '&:hover': { color: '#2563eb' } }}
                >
                  <RefreshIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Paper>

        {/* 2. Order Summary / File Specs Card */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 2,
            borderRadius: '16px',
            bgcolor: isDark ? '#1e293b' : '#ffffff',
            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          }}
        >
          {/* Top Row: File icon, Filename, PDF badge */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: '10px',
                  bgcolor: isDark ? '#0f172a' : '#eff6ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <DescriptionIcon sx={{ fontSize: 20 }} />
              </Box>
              <Typography
                variant="subtitle2"
                noWrap
                sx={{
                  fontWeight: 700,
                  color: isDark ? '#ffffff' : '#0f172a',
                  fontSize: '0.96rem',
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                }}
              >
                {primaryFileName}
              </Typography>
            </Box>

            <Box
              sx={{
                px: 1,
                py: 0.2,
                borderRadius: '6px',
                bgcolor: isDark ? '#0f172a' : '#eff6ff',
                color: '#2563eb',
                fontWeight: 800,
                fontSize: '11px',
                letterSpacing: '0.04em',
              }}
            >
              PDF
            </Box>
          </Box>

          <Typography variant="caption" sx={{ color: isDark ? '#94a3b8' : '#64748b', display: 'block', mb: 1.5, pl: 6.25, fontSize: '0.78rem' }}>
            ₹{totalPages > 0 ? (Number(totalCost) / totalPages).toFixed(2) : '2.00'} / page ({totalPages} pages)
          </Typography>

          {/* Badges Row */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1.25,
                py: 0.4,
                borderRadius: '8px',
                bgcolor: isDark ? '#0f172a' : '#f1f5f9',
                color: isDark ? '#cbd5e1' : '#334155',
                fontSize: '0.76rem',
                fontWeight: 600,
              }}
            >
              <AutoStoriesIcon sx={{ fontSize: 13, color: '#2563eb' }} />
              <span>{totalPages} Pages</span>
            </Box>

            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1.25,
                py: 0.4,
                borderRadius: '8px',
                bgcolor: isDark ? '#0f172a' : '#f1f5f9',
                color: isDark ? '#cbd5e1' : '#334155',
                fontSize: '0.76rem',
                fontWeight: 600,
              }}
            >
              <WaterDropIcon sx={{ fontSize: 13, color: isDark ? '#94a3b8' : '#475569' }} />
              <span>{colorPages > 0 ? `${colorPages} Color, ${bwPages} B&W` : 'B&W (Double Sided)'}</span>
            </Box>

            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1.25,
                py: 0.4,
                borderRadius: '8px',
                bgcolor: isDark ? '#0f172a' : '#f1f5f9',
                color: isDark ? '#cbd5e1' : '#334155',
                fontSize: '0.76rem',
                fontWeight: 600,
              }}
            >
              <ContentCopyIcon sx={{ fontSize: 13, color: '#2563eb' }} />
              <span>1 Copy</span>
            </Box>

            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1.25,
                py: 0.4,
                borderRadius: '8px',
                bgcolor: isDark ? '#0f172a' : '#f1f5f9',
                color: isDark ? '#cbd5e1' : '#334155',
                fontSize: '0.76rem',
                fontWeight: 600,
              }}
            >
              <span>All Pages</span>
            </Box>
          </Box>
        </Paper>

        {/* 3. Payment Breakdown Card */}
        <Paper
          elevation={0}
          sx={{
            p: 2.25,
            mb: 2.5,
            borderRadius: '16px',
            bgcolor: isDark ? '#1e293b' : '#ffffff',
            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography
              variant="subtitle1"
              sx={{
                ...serifHeadlineStyle,
                fontWeight: 800,
                color: isDark ? '#ffffff' : '#0f172a',
                fontSize: '1.05rem',
              }}
            >
              Payment Breakdown
            </Typography>
            <Typography variant="caption" sx={{ color: '#006c49', fontWeight: 700, fontSize: '0.78rem' }}>
              Self-Service Pricing
            </Typography>
          </Box>

          {/* Line items */}
          <Stack spacing={1.25} sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" sx={{ color: isDark ? '#94a3b8' : '#475569', fontSize: '0.84rem' }}>
                Printing Cost ({totalPages} pages {colorPages > 0 ? `(${colorPages} Color, ${bwPages} B&W)` : 'B&W'})
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: isDark ? '#ffffff' : '#0f172a', fontSize: '0.9rem' }}>
                ₹{totalCost}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" sx={{ color: isDark ? '#94a3b8' : '#475569', fontSize: '0.84rem' }}>
                Paper & Binding
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#006c49', fontSize: '0.84rem' }}>
                ₹0.00 (Included)
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" sx={{ color: isDark ? '#94a3b8' : '#475569', fontSize: '0.84rem' }}>
                Platform Fee
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#006c49', fontSize: '0.84rem' }}>
                ₹0.00 (Free)
              </Typography>
            </Box>
          </Stack>

          <Divider sx={{ my: 1.5, borderColor: isDark ? '#334155' : '#e2e8f0' }} />

          {/* Total Payable Row */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', pt: 0.5 }}>
            <Box>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 800,
                  color: isDark ? '#ffffff' : '#0f172a',
                  fontSize: '1.15rem',
                  lineHeight: 1.2,
                }}
              >
                Total Payable
              </Typography>
              <Typography variant="caption" sx={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: '0.72rem' }}>
                Includes all terminal & utility charges
              </Typography>
            </Box>

            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                color: '#2563eb',
                fontSize: '1.65rem',
                lineHeight: 1,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontVariantNumeric: 'lining-nums tabular-nums',
              }}
            >
              ₹{totalCost}
            </Typography>
          </Box>
        </Paper>

        {/* 4. Select Payment Method Section */}
        <Box sx={{ mb: 2.5 }}>
          <Typography
            variant="h6"
            sx={{
              ...serifHeadlineStyle,
              fontWeight: 800,
              color: isDark ? '#ffffff' : '#0f172a',
              fontSize: '1.1rem',
              mb: 1.5,
              px: 0.5,
            }}
          >
            Select Payment Method
          </Typography>

          <Stack spacing={1.25}>
            {/* Option 1: UPI Instant Transfer (Fastest) */}
            <Paper
              elevation={0}
              onClick={() => setSelectedMethod('upi')}
              sx={{
                p: 2,
                borderRadius: '16px',
                bgcolor: selectedMethod === 'upi' ? (isDark ? 'rgba(37,99,235,0.08)' : '#eff6ff') : (isDark ? '#1e293b' : '#ffffff'),
                border: '2px solid',
                borderColor: selectedMethod === 'upi' ? '#2563eb' : (isDark ? '#334155' : '#e2e8f0'),
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.15s ease',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {selectedMethod === 'upi' ? (
                  <CheckCircleIcon sx={{ color: '#2563eb', fontSize: 22 }} />
                ) : (
                  <RadioButtonUncheckedIcon sx={{ color: isDark ? '#475569' : '#cbd5e1', fontSize: 22 }} />
                )}
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 700,
                        color: isDark ? '#ffffff' : '#0f172a',
                        fontSize: '0.94rem',
                      }}
                    >
                      UPI Instant Transfer
                    </Typography>
                    <Box
                      sx={{
                        px: 0.9,
                        py: 0.2,
                        borderRadius: 999,
                        bgcolor: '#2563eb',
                        color: '#ffffff',
                        fontWeight: 800,
                        fontSize: '9.5px',
                        letterSpacing: '0.04em',
                      }}
                    >
                      FASTEST
                    </Box>
                  </Box>
                  <Typography variant="caption" sx={{ color: isDark ? '#94a3b8' : '#64748b', display: 'block', mt: 0.25, fontSize: '0.78rem' }}>
                    Google Pay, PhonePe, Paytm, Any UPI ID
                  </Typography>
                </Box>
              </Box>

              {/* UPI Badges */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box
                  sx={{
                    px: 0.8,
                    py: 0.25,
                    borderRadius: '6px',
                    bgcolor: isDark ? '#0f172a' : '#f1f5f9',
                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                    fontWeight: 800,
                    fontSize: '10px',
                    color: isDark ? '#cbd5e1' : '#334155',
                  }}
                >
                  UPI
                </Box>
                <Box
                  sx={{
                    px: 0.8,
                    py: 0.25,
                    borderRadius: '6px',
                    bgcolor: isDark ? '#0f172a' : '#f1f5f9',
                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                    fontWeight: 800,
                    fontSize: '10px',
                    color: isDark ? '#cbd5e1' : '#334155',
                  }}
                >
                  GPay
                </Box>
              </Box>
            </Paper>

            {selectedMethod === 'upi' && (
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: '12px',
                  bgcolor: isDark ? 'rgba(37,99,235,0.12)' : '#eff6ff',
                  border: `1px solid ${isDark ? '#1d4ed8' : '#bfdbfe'}`,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1.25,
                }}
              >
                <VerifiedUserIcon sx={{ color: '#2563eb', fontSize: 18, mt: 0.2, flexShrink: 0 }} />
                <Typography variant="body2" sx={{ color: isDark ? '#93c5fd' : '#1e40af', fontSize: '0.82rem', fontWeight: 500, lineHeight: 1.45 }}>
                  <strong>Counter Verification:</strong> Pay using any UPI app (GPay, PhonePe, Paytm, etc.). Please show your payment success screenshot to the merchant at the counter for instant job release.
                </Typography>
              </Box>
            )}

            {/* Option 2: Debit / Credit Card */}
            <Paper
              elevation={0}
              onClick={() => setSelectedMethod('card')}
              sx={{
                p: 2,
                borderRadius: '16px',
                bgcolor: selectedMethod === 'card' ? (isDark ? 'rgba(37,99,235,0.08)' : '#eff6ff') : (isDark ? '#1e293b' : '#ffffff'),
                border: '2px solid',
                borderColor: selectedMethod === 'card' ? '#2563eb' : (isDark ? '#334155' : '#e2e8f0'),
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.15s ease',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {selectedMethod === 'card' ? (
                  <CheckCircleIcon sx={{ color: '#2563eb', fontSize: 22 }} />
                ) : (
                  <RadioButtonUncheckedIcon sx={{ color: isDark ? '#475569' : '#cbd5e1', fontSize: 22 }} />
                )}
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 700,
                      color: isDark ? '#ffffff' : '#0f172a',
                      fontSize: '0.94rem',
                    }}
                  >
                    Debit / Credit Card
                  </Typography>
                  <Typography variant="caption" sx={{ color: isDark ? '#94a3b8' : '#64748b', display: 'block', mt: 0.25, fontSize: '0.78rem' }}>
                    Visa, Mastercard, RuPay, Maestro
                  </Typography>
                </Box>
              </Box>

              <CreditCardIcon sx={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: 22 }} />
            </Paper>

            {/* Option 3: Pay Cash at Counter */}
            <Paper
              elevation={0}
              onClick={() => setSelectedMethod('cash')}
              sx={{
                p: 2,
                borderRadius: '16px',
                bgcolor: selectedMethod === 'cash' ? (isDark ? 'rgba(37,99,235,0.08)' : '#eff6ff') : (isDark ? '#1e293b' : '#ffffff'),
                border: '2px solid',
                borderColor: selectedMethod === 'cash' ? '#2563eb' : (isDark ? '#334155' : '#e2e8f0'),
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.15s ease',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {selectedMethod === 'cash' ? (
                  <CheckCircleIcon sx={{ color: '#2563eb', fontSize: 22 }} />
                ) : (
                  <RadioButtonUncheckedIcon sx={{ color: isDark ? '#475569' : '#cbd5e1', fontSize: 22 }} />
                )}
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 700,
                      color: isDark ? '#ffffff' : '#0f172a',
                      fontSize: '0.94rem',
                    }}
                  >
                    Pay Cash at Counter
                  </Typography>
                  <Typography variant="caption" sx={{ color: isDark ? '#94a3b8' : '#64748b', display: 'block', mt: 0.25, fontSize: '0.78rem' }}>
                    Generates an instant release PIN upon payment
                  </Typography>
                </Box>
              </Box>

              <PaymentsIcon sx={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: 22 }} />
            </Paper>
          </Stack>
        </Box>

        {/* 5. Zero Data Retention Guarantee Card */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: '16px',
            bgcolor: isDark ? 'rgba(16,185,129,0.06)' : '#eff4fe',
            border: `1px solid ${isDark ? '#334155' : '#dbeafe'}`,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1.5,
            mb: 2.5,
          }}
        >
          <Box
            sx={{
              width: 36,
              height: 36,
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
            <ShieldIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: isDark ? '#6ee7b7' : '#0f172a', fontSize: '0.88rem' }}>
              Zero Data Retention Guarantee
            </Typography>
            <Typography variant="caption" sx={{ color: isDark ? '#cbd5e1' : '#475569', display: 'block', mt: 0.25, lineHeight: 1.45, fontSize: '0.76rem' }}>
              Files are cryptographically shredded immediately upon print job completion at the counter terminal.
            </Typography>
          </Box>
        </Paper>
      </Container>

      {/* Sticky Bottom Action Dock */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1100,
          bgcolor: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(12px)',
          borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          py: 1.5,
          px: 2,
          boxShadow: '0 -4px 20px rgba(15, 23, 42, 0.08)',
        }}
      >
        <Box sx={{ maxWidth: '520px', mx: 'auto', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {/* Primary Action Button */}
          <Button
            variant="contained"
            fullWidth
            onClick={handlePayAndPrint}
            endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}
            sx={{
              height: 50,
              borderRadius: '12px',
              bgcolor: '#2563eb',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.96rem',
              textTransform: 'none',
              boxShadow: '0 4px 14px rgba(37,99,235,0.25)',
              '&:hover': { bgcolor: '#1d4ed8' },
            }}
          >
            Pay ₹28.00 & Print Now
          </Button>

          {/* Footer Indicators */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.5,
              fontSize: '11px',
              color: isDark ? '#94a3b8' : '#64748b',
              fontWeight: 600,
              mt: 0.25,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <BoltIcon sx={{ fontSize: 14, color: '#10b981' }} />
              <span>Instant printer queue release</span>
            </Box>
            <span>•</span>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <span>24h pickup guarantee</span>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Footer Links */}
      <Box sx={{ textAlign: 'center', pb: 4, pt: 1, maxWidth: '520px', mx: 'auto' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 1 }}>
          <RouterLink to="/merchant/login" style={{ color: isDark ? '#94a3b8' : '#475569', textDecoration: 'none', fontSize: '12px', fontWeight: 600 }}>
            Merchant Sign In
          </RouterLink>
          <RouterLink to="/merchant/signup" style={{ color: isDark ? '#94a3b8' : '#475569', textDecoration: 'none', fontSize: '12px', fontWeight: 600 }}>
            Register Your Shop
          </RouterLink>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 1 }}>
          <Typography
            component="span"
            onClick={() => setPrivacyDialogOpen(true)}
            sx={{ color: isDark ? '#94a3b8' : '#475569', fontSize: '12px', fontWeight: 500, cursor: 'pointer', '&:hover': { color: '#2563eb' } }}
          >
            Privacy & Security
          </Typography>
          <Typography
            component="span"
            onClick={() => setHelpDialogOpen(true)}
            sx={{ color: isDark ? '#94a3b8' : '#475569', fontSize: '12px', fontWeight: 500, cursor: 'pointer', '&:hover': { color: '#2563eb' } }}
          >
            Help
          </Typography>
        </Box>

        <Typography variant="caption" sx={{ color: isDark ? '#64748b' : '#94a3b8', display: 'block', fontSize: '11px' }}>
          © 2025 QuickPrint Technologies. Instant & contactless printing.
        </Typography>
      </Box>

      {/* Privacy Dialog */}
      <Dialog open={privacyDialogOpen} onClose={() => setPrivacyDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700 }}>
          Privacy & Security
          <IconButton size="small" onClick={() => setPrivacyDialogOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" paragraph>
            <strong>Zero Data Retention:</strong> QuickPrint does not store your documents permanently. Once printed or after 24 hours in the cloud queue, documents are shredded automatically.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPrivacyDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Help Dialog */}
      <Dialog open={helpDialogOpen} onClose={() => setHelpDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700 }}>
          Need Help?
          <IconButton size="small" onClick={() => setHelpDialogOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" paragraph>
            Select your preferred payment method: UPI, Credit/Debit card, or Pay Cash directly to the counter operator upon pickup.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHelpDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
