// src/pages/OrderReceiptCompletedPage.jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';

import { unwrapIcon } from '../utils/iconHelper';
import RawPrintIcon from '@mui/icons-material/Print';
import RawCheckCircleIcon from '@mui/icons-material/CheckCircle';
import RawCheckIcon from '@mui/icons-material/Check';
import RawConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import RawStorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import RawContentCopyIcon from '@mui/icons-material/ContentCopy';
import RawSyncIcon from '@mui/icons-material/Sync';
import RawStorefrontIcon from '@mui/icons-material/Storefront';
import RawPictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import RawReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import RawAddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RawShieldIcon from '@mui/icons-material/Shield';
import RawDarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import RawLightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import RawCloseIcon from '@mui/icons-material/Close';
import RawVerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import RawPublishedWithChangesIcon from '@mui/icons-material/PublishedWithChanges';

const PrintIcon = unwrapIcon(RawPrintIcon);
const CheckCircleIcon = unwrapIcon(RawCheckCircleIcon);
const CheckIcon = unwrapIcon(RawCheckIcon);
const ConfirmationNumberOutlinedIcon = unwrapIcon(RawConfirmationNumberOutlinedIcon);
const StorefrontOutlinedIcon = unwrapIcon(RawStorefrontOutlinedIcon);
const ContentCopyIcon = unwrapIcon(RawContentCopyIcon);
const SyncIcon = unwrapIcon(RawSyncIcon);
const StorefrontIcon = unwrapIcon(RawStorefrontIcon);
const PictureAsPdfIcon = unwrapIcon(RawPictureAsPdfIcon);
const ReceiptLongIcon = unwrapIcon(RawReceiptLongIcon);
const AddCircleOutlineIcon = unwrapIcon(RawAddCircleOutlineIcon);
const ShieldIcon = unwrapIcon(RawShieldIcon);
const DarkModeOutlinedIcon = unwrapIcon(RawDarkModeOutlinedIcon);
const LightModeOutlinedIcon = unwrapIcon(RawLightModeOutlinedIcon);
const CloseIcon = unwrapIcon(RawCloseIcon);
const VerifiedUserIcon = unwrapIcon(RawVerifiedUserIcon);
const PublishedWithChangesIcon = unwrapIcon(RawPublishedWithChangesIcon);

// Default Demo Order State matching user-flow design
const DEFAULT_DEMO_ORDER = {
  orderId: 'QP-849201',
  tokenNumber: 'QP-749382',
  merchantId: 'campus-library-04',
  merchantName: 'Campus Library',
  shopCode: 'QP-8421',
  userName: 'Cheerful Iris',
  userAvatar: '🎭',
  fileName: 'lecture_notes_final.pdf',
  pages: 14,
  specsDescription: '14 Pages  •  B&W Duplex  •  1 Copy  •  A4 75 GSM',
  amount: '28.00',
  formattedDate: 'Today, 03:42 PM',
  counterName: 'Counter 1',
  printerModel: 'HP LaserJet Enterprise M608 (Tray 2)',
  paymentMode: 'UPI Instant (Google Pay - txn_983421774)',
};

export default function OrderReceiptCompletedPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const merchantId = searchParams.get('merchantId') || 'campus-library-04';

  // Extract order passed via state or use standard design fallback
  const passedOrder = location.state?.order;
  const order = {
    ...DEFAULT_DEMO_ORDER,
    ...(passedOrder || {}),
    fileName: passedOrder?.file?.name || passedOrder?.fileName || DEFAULT_DEMO_ORDER.fileName,
    pages: passedOrder?.file?.pages || passedOrder?.pages || DEFAULT_DEMO_ORDER.pages,
    amount: passedOrder?.amount ? String(passedOrder.amount) : DEFAULT_DEMO_ORDER.amount,
  };

  // State
  const [isDark, setIsDark] = useState(false);
  const [copied, setCopied] = useState(false);
  const [privacyDialogOpen, setPrivacyDialogOpen] = useState(false);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Handle Token Copying
  const handleCopyToken = () => {
    navigator.clipboard.writeText(order.tokenNumber);
    setCopied(true);
    setSnackbarMessage(`Token ${order.tokenNumber} copied to clipboard!`);
    setTimeout(() => setCopied(false), 2500);
  };

  // Handle PDF Receipt Download / Print
  const handleDownloadReceipt = () => {
    window.print();
  };

  // Handle Print Another Document
  const handlePrintAnother = () => {
    navigate(`/print?merchantId=${merchantId}`);
  };

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
        bgcolor: isDark ? '#0f172a' : '#faf8ff',
        color: isDark ? '#f8fafc' : '#131b2e',
        transition: 'background-color 0.2s ease, color 0.2s ease',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {/* Top Navbar */}
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 1100,
          bgcolor: isDark ? '#1e293b' : '#ffffff',
          borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          transition: 'all 0.2s ease',
          '@media print': { display: 'none' },
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
          {/* Brand Logo */}
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
                bgcolor: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
              }}
            >
              <PrintIcon sx={{ fontSize: 20 }} />
            </Box>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                fontSize: '1.25rem',
                ...serifHeadlineStyle,
                color: isDark ? '#ffffff' : '#0f172a',
              }}
            >
              QuickPrint
            </Typography>
          </Box>

          {/* Theme Toggle */}
          <IconButton
            onClick={() => setIsDark(!isDark)}
            aria-label="Toggle dark mode"
            sx={{
              color: isDark ? '#cbd5e1' : '#475569',
              '&:hover': { bgcolor: isDark ? '#334155' : '#f1f5f9' },
            }}
          >
            {isDark ? <LightModeOutlinedIcon sx={{ fontSize: 20 }} /> : <DarkModeOutlinedIcon sx={{ fontSize: 20 }} />}
          </IconButton>
        </Box>
      </Box>

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flex: 1,
          maxWidth: '520px',
          width: '100%',
          mx: 'auto',
          px: { xs: 2, sm: 2.5 },
          pt: 3.5,
          pb: 6,
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5,
        }}
      >
        {/* Hero Status Section */}
        <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Glowing Green Success Badge */}
          <Box
            sx={{
              width: 76,
              height: 76,
              borderRadius: '50%',
              bgcolor: isDark ? 'rgba(5, 150, 105, 0.25)' : '#d1fae5',
              border: `2px solid ${isDark ? '#059669' : '#34d399'}`,
              boxShadow: isDark
                ? '0 8px 24px rgba(16, 185, 129, 0.35)'
                : '0 8px 24px rgba(16, 185, 129, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 2,
            }}
          >
            <CheckCircleIcon sx={{ fontSize: 40, color: '#059669' }} />
          </Box>

          {/* Title */}
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              fontSize: { xs: '1.65rem', sm: '1.85rem' },
              ...serifHeadlineStyle,
              color: isDark ? '#ffffff' : '#0f172a',
              mb: 0.75,
            }}
          >
            Payment Successful!
          </Typography>

          {/* Subtitle */}
          <Typography
            variant="body1"
            sx={{
              color: isDark ? '#94a3b8' : '#475569',
              fontSize: '0.94rem',
              fontWeight: 500,
              mb: 1.5,
            }}
          >
            Order Confirmed & Sent to Printer
          </Typography>

          {/* Spooling Status Pill */}
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              bgcolor: isDark ? 'rgba(37, 99, 235, 0.15)' : '#eff6ff',
              border: `1px solid ${isDark ? '#1d4ed8' : '#bfdbfe'}`,
              borderRadius: '9999px',
              px: 2.25,
              py: 0.6,
              mb: 1,
            }}
          >
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: '#2563eb',
                animation: 'pulseDot 1.5s infinite',
                '@keyframes pulseDot': {
                  '0%': { opacity: 1, transform: 'scale(1)' },
                  '50%': { opacity: 0.3, transform: 'scale(1.3)' },
                  '100%': { opacity: 1, transform: 'scale(1)' },
                },
              }}
            />
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: isDark ? '#93c5fd' : '#1d4ed8',
                fontSize: '0.82rem',
              }}
            >
              Spooling to Printer (Est. 45s)
            </Typography>
          </Box>

          {/* Timestamp & Order ID Meta */}
          <Typography
            variant="caption"
            sx={{
              color: isDark ? '#94a3b8' : '#64748b',
              fontSize: '0.78rem',
              fontWeight: 600,
              letterSpacing: '0.02em',
              mt: 0.5,
            }}
          >
            {order.formattedDate} • Order #{order.orderId}
          </Typography>
        </Box>

        {/* Counter Pickup Token Card */}
        <Box
          sx={{
            bgcolor: isDark ? '#1e293b' : '#ffffff',
            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            borderRadius: '20px',
            p: 2.5,
            boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subtle Blue/Mint Top Accent */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: 'linear-gradient(90deg, #10b981 0%, #2563eb 100%)',
            }}
          />

          {/* Card Header Row */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ConfirmationNumberOutlinedIcon sx={{ fontSize: 20, color: '#2563eb' }} />
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 800,
                  fontSize: '0.74rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: isDark ? '#cbd5e1' : '#131b2e',
                  lineHeight: 1.2,
                }}
              >
                Counter Pickup Token
              </Typography>
            </Box>

            {/* Counter Ready Pill Badge */}
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                bgcolor: isDark ? 'rgba(5, 150, 105, 0.2)' : '#eef2ff',
                color: isDark ? '#6ee7b7' : '#047857',
                border: `1px solid ${isDark ? '#065f46' : '#c7d2fe'}`,
                borderRadius: '9999px',
                px: 1.5,
                py: 0.4,
                fontSize: '0.74rem',
                fontWeight: 700,
              }}
            >
              <StorefrontOutlinedIcon sx={{ fontSize: 14 }} />
              <span>Counter Ready</span>
            </Box>
          </Box>

          {/* Pickup Token Number Box */}
          <Box
            sx={{
              bgcolor: isDark ? '#0f172a' : '#f0f4ff',
              border: `1.5px solid ${isDark ? '#334155' : '#e0e7ff'}`,
              borderRadius: '14px',
              p: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  fontSize: '0.7rem',
                  letterSpacing: '0.1em',
                  color: isDark ? '#94a3b8' : '#64748b',
                  textTransform: 'uppercase',
                  display: 'block',
                  mb: 0.5,
                }}
              >
                Pickup Token Number
              </Typography>
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: '1.9rem', sm: '2.15rem' },
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontVariantNumeric: 'lining-nums tabular-nums',
                  color: '#004ac6',
                  lineHeight: 1,
                  letterSpacing: '0.04em',
                }}
              >
                {order.tokenNumber.includes('-') && !order.tokenNumber.includes(' - ')
                  ? order.tokenNumber.replace('-', ' – ')
                  : order.tokenNumber}
              </Typography>
            </Box>

            {/* Copy Token Button */}
            <Tooltip title={copied ? 'Copied!' : 'Copy Token'} placement="top">
              <IconButton
                onClick={handleCopyToken}
                aria-label="Copy token number"
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '12px',
                  bgcolor: copied ? '#10b981' : isDark ? '#1e293b' : '#dbeafe',
                  color: copied ? '#ffffff' : '#1d4ed8',
                  border: `1px solid ${copied ? '#10b981' : isDark ? '#334155' : '#bfdbfe'}`,
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    bgcolor: copied ? '#059669' : isDark ? '#334155' : '#bfdbfe',
                  },
                }}
              >
                {copied ? <CheckIcon sx={{ fontSize: 20 }} /> : <ContentCopyIcon sx={{ fontSize: 20 }} />}
              </IconButton>
            </Tooltip>
          </Box>

          {/* Unique Pickup Tag Box */}
          <Box
            sx={{
              mt: 2,
              bgcolor: isDark ? '#0f172a' : '#f8faff',
              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              borderRadius: '14px',
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            {/* Tag Emoji Squircle */}
            <Box
              sx={{
                width: 46,
                height: 46,
                borderRadius: '12px',
                bgcolor: isDark ? 'rgba(37, 99, 235, 0.15)' : '#eff6ff',
                border: `1px solid ${isDark ? '#1d4ed8' : '#bfdbfe'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                flexShrink: 0,
              }}
            >
              {order.userAvatar}
            </Box>

            {/* Tag Details */}
            <Box>
              <Typography
                variant="caption"
                sx={{
                  color: isDark ? '#94a3b8' : '#64748b',
                  fontSize: '0.74rem',
                  fontWeight: 500,
                  display: 'block',
                }}
              >
                Unique Pickup Tag
              </Typography>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 800,
                  fontSize: '1.05rem',
                  ...serifHeadlineStyle,
                  color: isDark ? '#ffffff' : '#0f172a',
                  lineHeight: 1.2,
                  mt: 0.25,
                }}
              >
                {order.userName}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Live Printer Queue Card */}
        <Box
          sx={{
            bgcolor: isDark ? '#1e293b' : '#ffffff',
            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            borderRadius: '20px',
            p: 2.5,
            boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
          }}
        >
          {/* Card Title */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2.5 }}>
            <SyncIcon sx={{ fontSize: 22, color: '#0284c7' }} />
            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                fontSize: '1.15rem',
                ...serifHeadlineStyle,
                color: isDark ? '#ffffff' : '#0f172a',
              }}
            >
              Live Printer Queue
            </Typography>
          </Box>

          {/* Step 1: Payment Verified */}
          <Box sx={{ display: 'flex', position: 'relative' }}>
            {/* Left Node & Vertical Connector Line */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mr: 2 }}>
              <Box
                sx={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  bgcolor: '#059669',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2,
                  boxShadow: '0 2px 6px rgba(5, 150, 105, 0.4)',
                }}
              >
                <CheckIcon sx={{ fontSize: 16 }} />
              </Box>
              <Box
                sx={{
                  width: 2,
                  flex: 1,
                  minHeight: 40,
                  bgcolor: '#10b981',
                  my: 0.5,
                }}
              />
            </Box>

            {/* Content */}
            <Box sx={{ pb: 2.5, flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.92rem',
                    color: isDark ? '#ffffff' : '#0f172a',
                    lineHeight: 1.3,
                  }}
                >
                  Payment Verified
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: '#059669',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                  }}
                >
                  Success
                </Typography>
              </Box>
              <Typography
                variant="caption"
                sx={{
                  color: isDark ? '#94a3b8' : '#64748b',
                  fontSize: '0.78rem',
                  display: 'block',
                  mt: 0.25,
                }}
              >
                Instant settlement via UPI
              </Typography>
            </Box>
          </Box>

          {/* Step 2: Sent to Shop Printer */}
          <Box sx={{ display: 'flex', position: 'relative' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mr: 2 }}>
              <Box
                sx={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  bgcolor: '#2563eb',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2,
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.4)',
                }}
              >
                <PrintIcon sx={{ fontSize: 14 }} />
              </Box>
              <Box
                sx={{
                  width: 2,
                  flex: 1,
                  minHeight: 38,
                  bgcolor: isDark ? '#334155' : '#e2e8f0',
                  my: 0.5,
                }}
              />
            </Box>

            <Box sx={{ pb: 2, flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.92rem',
                    color: '#004ac6',
                    lineHeight: 1.3,
                  }}
                >
                  Sent to Shop Printer
                </Typography>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    bgcolor: isDark ? '#1e3a8a33' : '#eff6ff',
                    color: '#2563eb',
                    border: `1px solid ${isDark ? '#1d4ed8' : '#bfdbfe'}`,
                    borderRadius: '9999px',
                    px: 1.25,
                    py: 0.25,
                    fontSize: '0.7rem',
                    fontWeight: 700,
                  }}
                >
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      bgcolor: '#2563eb',
                      animation: 'pulse 1.5s infinite',
                      '@keyframes pulse': {
                        '0%': { opacity: 1, transform: 'scale(1)' },
                        '50%': { opacity: 0.4, transform: 'scale(1.2)' },
                        '100%': { opacity: 1, transform: 'scale(1)' },
                      },
                    }}
                  />
                  <span>Printing</span>
                </Box>
              </Box>
              <Typography
                variant="caption"
                sx={{
                  color: isDark ? '#94a3b8' : '#64748b',
                  fontSize: '0.78rem',
                  display: 'block',
                  mt: 0.25,
                }}
              >
                Machine: {order.printerModel}
              </Typography>
            </Box>
          </Box>

          {/* Step 3: Ready for Collection */}
          <Box sx={{ display: 'flex' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mr: 2 }}>
              <Box
                sx={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  bgcolor: isDark ? '#475569' : '#cbd5e1',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2,
                }}
              >
                <StorefrontIcon sx={{ fontSize: 14 }} />
              </Box>
            </Box>

            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    color: isDark ? '#94a3b8' : '#64748b',
                  }}
                >
                  Ready for Collection
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: isDark ? '#94a3b8' : '#64748b',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                  }}
                >
                  {order.counterName}
                </Typography>
              </Box>
              <Typography
                variant="caption"
                sx={{
                  color: isDark ? '#64748b' : '#94a3b8',
                  fontSize: '0.76rem',
                  display: 'block',
                  mt: 0.25,
                }}
              >
                Collect your printed bundle using your code or tag
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Shop Destination & Document Specifications Card */}
        <Box
          sx={{
            bgcolor: isDark ? '#1e293b' : '#ffffff',
            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            borderRadius: '20px',
            p: 2.5,
            boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
          }}
        >
          {/* Shop Destination */}
          <Box>
            <Typography
              variant="caption"
              sx={{
                color: isDark ? '#94a3b8' : '#64748b',
                fontSize: '0.74rem',
                fontWeight: 600,
                display: 'block',
                mb: 0.5,
              }}
            >
              Shop Destination
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PrintIcon sx={{ fontSize: 18, color: '#2563eb' }} />
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 700,
                  fontSize: '0.98rem',
                  ...serifHeadlineStyle,
                  color: isDark ? '#ffffff' : '#0f172a',
                }}
              >
                {order.merchantName} ({order.shopCode})
              </Typography>
            </Box>
          </Box>

          {/* Divider */}
          <Box
            sx={{
              height: 1,
              bgcolor: isDark ? '#334155' : '#e2e8f0',
              my: 2,
            }}
          />

          {/* Document Specifications */}
          <Box>
            <Typography
              variant="caption"
              sx={{
                color: isDark ? '#94a3b8' : '#64748b',
                fontSize: '0.74rem',
                fontWeight: 600,
                display: 'block',
                mb: 1,
              }}
            >
              Document Specifications
            </Typography>

            {/* Spec Box */}
            <Box
              sx={{
                bgcolor: isDark ? '#0f172a' : '#f8faff',
                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                borderRadius: '12px',
                p: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '10px',
                  bgcolor: isDark ? '#1e3a8a33' : '#eff6ff',
                  border: `1px solid ${isDark ? '#1d4ed8' : '#dbeafe'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563eb',
                  flexShrink: 0,
                }}
              >
                <PictureAsPdfIcon sx={{ fontSize: 22 }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="subtitle2"
                  noWrap
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.92rem',
                    ...serifHeadlineStyle,
                    color: isDark ? '#ffffff' : '#0f172a',
                  }}
                >
                  {order.fileName}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: isDark ? '#94a3b8' : '#64748b',
                    fontSize: '0.74rem',
                    display: 'block',
                    mt: 0.25,
                  }}
                >
                  {order.specsDescription}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Divider */}
          <Box
            sx={{
              height: 1,
              bgcolor: isDark ? '#334155' : '#e2e8f0',
              my: 2,
            }}
          />

          {/* Payment Status Row */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 1.5,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <CheckCircleIcon sx={{ fontSize: 16, color: '#059669' }} />
              <Typography
                variant="body2"
                sx={{
                  color: isDark ? '#cbd5e1' : '#475569',
                  fontSize: '0.84rem',
                }}
              >
                Payment Status
              </Typography>
            </Box>
            <Box
              sx={{
                bgcolor: isDark ? 'rgba(5, 150, 105, 0.2)' : '#ecfdf5',
                color: isDark ? '#6ee7b7' : '#065f46',
                border: `1px solid ${isDark ? '#065f46' : '#a7f3d0'}`,
                borderRadius: '9999px',
                px: 1.5,
                py: 0.35,
                fontSize: '0.74rem',
                fontWeight: 700,
              }}
            >
              Paid (Success)
            </Box>
          </Box>

          {/* Payment Mode Row */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography
              variant="body2"
              sx={{
                color: isDark ? '#cbd5e1' : '#475569',
                fontSize: '0.84rem',
              }}
            >
              Payment Mode
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                fontSize: '0.84rem',
                color: isDark ? '#ffffff' : '#0f172a',
              }}
            >
              {order.paymentMode}
            </Typography>
          </Box>

          {/* Divider */}
          <Box
            sx={{
              height: 1,
              bgcolor: isDark ? '#334155' : '#e2e8f0',
              my: 2,
            }}
          />

          {/* Total Amount Row */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 800,
                fontSize: '1.05rem',
                ...serifHeadlineStyle,
                color: isDark ? '#ffffff' : '#0f172a',
              }}
            >
              Total Amount
            </Typography>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 800,
                fontSize: '1.45rem',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontVariantNumeric: 'lining-nums tabular-nums',
                color: '#004ac6',
              }}
            >
              ₹{order.amount}
            </Typography>
          </Box>
        </Box>

        {/* Action Buttons */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            mt: 0.5,
            '@media print': { display: 'none' },
          }}
        >
          {/* Download Receipt (PDF) */}
          <Button
            variant="contained"
            fullWidth
            onClick={handleDownloadReceipt}
            startIcon={<ReceiptLongIcon sx={{ fontSize: 20 }} />}
            sx={{
              height: 52,
              borderRadius: '14px',
              bgcolor: '#004ac6',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.96rem',
              textTransform: 'none',
              boxShadow: '0 4px 14px rgba(0, 74, 198, 0.25)',
              '&:hover': { bgcolor: '#003ea8' },
            }}
          >
            Download Receipt (PDF)
          </Button>

          {/* Print Another Document */}
          <Button
            variant="outlined"
            fullWidth
            onClick={handlePrintAnother}
            startIcon={<AddCircleOutlineIcon sx={{ fontSize: 20 }} />}
            sx={{
              height: 52,
              borderRadius: '14px',
              bgcolor: isDark ? '#1e293b' : '#ffffff',
              border: `2px solid ${isDark ? '#334155' : '#bfdbfe'}`,
              color: '#2563eb',
              fontWeight: 700,
              fontSize: '0.96rem',
              textTransform: 'none',
              '&:hover': {
                bgcolor: isDark ? '#334155' : '#eff6ff',
                borderColor: '#2563eb',
              },
            }}
          >
            Print Another Document
          </Button>
        </Box>

        {/* Zero Data Retention Guarantee Banner */}
        <Box
          sx={{
            bgcolor: isDark ? 'rgba(6, 78, 59, 0.2)' : '#ecfdf5',
            border: `1px solid ${isDark ? '#065f46' : '#a7f3d0'}`,
            borderRadius: '16px',
            p: 2,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1.75,
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.05)',
          }}
        >
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              bgcolor: '#059669',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              mt: 0.2,
            }}
          >
            <PublishedWithChangesIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 700,
                color: isDark ? '#6ee7b7' : '#065f46',
                fontSize: '0.88rem',
              }}
            >
              Zero Data Retention Guarantee
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: isDark ? '#a7f3d0' : '#047857',
                display: 'block',
                mt: 0.35,
                lineHeight: 1.5,
                fontSize: '0.76rem',
              }}
            >
              Your file is encrypted in memory and will be permanently shredded immediately upon print job completion. No duplicates are stored on cloud or shop storage.
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          bgcolor: isDark ? '#1e293b' : '#ffffff',
          py: 3.5,
          px: 2,
          mt: 'auto',
          textAlign: 'center',
          '@media print': { display: 'none' },
        }}
      >
        <Box
          sx={{
            maxWidth: '520px',
            mx: 'auto',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            gap: { xs: 1.5, sm: 2 },
            mb: 1.5,
          }}
        >
          <RouterLink
            to="/merchant/login"
            style={{
              color: isDark ? '#94a3b8' : '#475569',
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            Merchant Sign In
          </RouterLink>
          <Typography sx={{ color: isDark ? '#475569' : '#cbd5e1', fontSize: '12px' }}>•</Typography>
          <RouterLink
            to="/merchant/signup"
            style={{
              color: isDark ? '#94a3b8' : '#475569',
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            Register Your Shop
          </RouterLink>
          <Typography sx={{ color: isDark ? '#475569' : '#cbd5e1', fontSize: '12px' }}>•</Typography>
          <Typography
            onClick={() => setPrivacyDialogOpen(true)}
            sx={{
              color: isDark ? '#94a3b8' : '#475569',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            Privacy & Security
          </Typography>
          <Typography sx={{ color: isDark ? '#475569' : '#cbd5e1', fontSize: '12px' }}>•</Typography>
          <Typography
            onClick={() => setHelpDialogOpen(true)}
            sx={{
              color: isDark ? '#94a3b8' : '#475569',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            Help
          </Typography>
        </Box>
        <Typography
          variant="caption"
          sx={{
            color: isDark ? '#64748b' : '#94a3b8',
            display: 'block',
            fontSize: '12px',
          }}
        >
          © 2025 QuickPrint Technologies. Instant & contactless printing.
        </Typography>
      </Box>

      {/* Copy Notification Snackbar */}
      <Snackbar
        open={!!snackbarMessage}
        autoHideDuration={3000}
        onClose={() => setSnackbarMessage('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbarMessage('')}
          severity="success"
          variant="filled"
          sx={{ width: '100%', borderRadius: '12px', fontWeight: 600 }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>

      {/* Privacy & Security Modal */}
      <Dialog
        open={privacyDialogOpen}
        onClose={() => setPrivacyDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '20px',
            bgcolor: isDark ? '#1e293b' : '#ffffff',
            color: isDark ? '#f8fafc' : '#0f172a',
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <VerifiedUserIcon sx={{ color: '#10b981' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
              Privacy & Security
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setPrivacyDialogOpen(false)} sx={{ color: isDark ? '#94a3b8' : '#64748b' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
          <Typography variant="body2" sx={{ mb: 2, color: isDark ? '#cbd5e1' : '#475569', lineHeight: 1.6 }}>
            QuickPrint is engineered for zero data persistence. Files are processed transiently in volatile memory and shredded with cryptographic wiping immediately upon completion.
          </Typography>
          <Typography variant="body2" sx={{ color: isDark ? '#cbd5e1' : '#475569', lineHeight: 1.6 }}>
            Your digital payment transaction was processed securely. No payment cards or credentials are stored on our servers.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setPrivacyDialogOpen(false)}
            variant="contained"
            fullWidth
            sx={{ borderRadius: '10px', bgcolor: '#2563eb', textTransform: 'none', fontWeight: 700 }}
          >
            Understood
          </Button>
        </DialogActions>
      </Dialog>

      {/* Help Modal */}
      <Dialog
        open={helpDialogOpen}
        onClose={() => setHelpDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '20px',
            bgcolor: isDark ? '#1e293b' : '#ffffff',
            color: isDark ? '#f8fafc' : '#0f172a',
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
            Order Pickup Support
          </Typography>
          <IconButton size="small" onClick={() => setHelpDialogOpen(false)} sx={{ color: isDark ? '#94a3b8' : '#64748b' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
          <Typography variant="body2" sx={{ mb: 1.5, color: isDark ? '#cbd5e1' : '#475569' }}>
            1. Your payment of ₹{order.amount} was confirmed. Your document is spooling to the shop printer.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1.5, color: isDark ? '#cbd5e1' : '#475569' }}>
            2. Collect your document at <strong>{order.counterName}</strong> of <strong>{order.merchantName}</strong>.
          </Typography>
          <Typography variant="body2" sx={{ color: isDark ? '#cbd5e1' : '#475569' }}>
            3. Show your pickup token (<strong>{order.tokenNumber}</strong>) or pickup tag (<strong>{order.userAvatar} {order.userName}</strong>).
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setHelpDialogOpen(false)}
            variant="contained"
            fullWidth
            sx={{ borderRadius: '10px', bgcolor: '#2563eb', textTransform: 'none', fontWeight: 700 }}
          >
            Got It
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
