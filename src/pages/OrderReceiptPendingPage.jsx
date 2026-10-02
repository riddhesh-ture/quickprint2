// src/pages/OrderReceiptPendingPage.jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { Container, Box, Typography, Button, Divider, Alert, Tooltip } from '@mui/material';
import RawCheckCircleIcon from '@mui/icons-material/CheckCircle';
import RawWarningAmberIcon from '@mui/icons-material/WarningAmber';
import RawPrintIcon from '@mui/icons-material/Print';
import RawContentCopyIcon from '@mui/icons-material/ContentCopy';
import RawCheckIcon from '@mui/icons-material/Check';
import RawStorefrontIcon from '@mui/icons-material/Storefront';
import RawNumbersIcon from '@mui/icons-material/Numbers';
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
import { supabase } from '../supabase/client';

const CheckCircleIcon = unwrapIcon(RawCheckCircleIcon);
const WarningAmberIcon = unwrapIcon(RawWarningAmberIcon);
const PrintIcon = unwrapIcon(RawPrintIcon);
const ContentCopyIcon = unwrapIcon(RawContentCopyIcon);
const CheckIcon = unwrapIcon(RawCheckIcon);
const StorefrontIcon = unwrapIcon(RawStorefrontIcon);
const NumbersIcon = unwrapIcon(RawNumbersIcon);

const DEFAULT_DEMO_ORDER = {
  orderId: 'QP-849201',
  tokenNumber: '#14-8421',
  merchantId: 'campus-library-04',
  merchantName: 'Campus Library Print Station',
  shopCode: 'QP-8421',
  fileName: 'lecture_notes_final.pdf',
  pages: 14,
  amount: '28.00',
  paymentMethod: 'upi',
  formattedDate: 'Today, 03:42 PM',
};

export default function OrderReceiptPendingPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark, colors } = useThemeMode();

  const merchantId = searchParams.get('merchantId') || 'campus-library-04';
  const passedOrder = location.state?.order || DEFAULT_DEMO_ORDER;

  const order = {
    ...DEFAULT_DEMO_ORDER,
    ...passedOrder,
    tokenNumber: passedOrder.tokenNumber || '#14-8421',
    fileName: passedOrder.fileName || DEFAULT_DEMO_ORDER.fileName,
    pages: passedOrder.pages || DEFAULT_DEMO_ORDER.pages,
    amount: String(passedOrder.amount || DEFAULT_DEMO_ORDER.amount),
  };

  const jobId = order.jobId || order.orderId;

  // Realtime Status State: 'pending' | 'printing' | 'completed' | 'paid'
  const [status, setStatus] = useState('pending');
  const [copied, setCopied] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Supabase Realtime CDC subscription for in-place green flip
  useEffect(() => {
    if (!jobId || !supabase) return;

    const channel = supabase
      .channel(`receipt-status-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'print_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          const newStatus = payload.new?.status;
          if (newStatus && ['completed', 'printing', 'paymentClaimed', 'paid'].includes(newStatus)) {
            setStatus(newStatus);
          }
        }
      )
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [jobId]);

  const isCompleted = status === 'completed' || status === 'paid';
  const isPrinting = status === 'printing';

  const handleCopyToken = () => {
    navigator.clipboard.writeText(order.tokenNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: isDark ? colors.bg : '#faf8ff' }}>
      <AppHeader title="Print Receipt" showBack backTo="/" />

      <Container maxWidth="xs" sx={{ py: 3, flex: 1, display: 'flex', flexDirection: 'column', gap: 2.25 }}>
        {/* 1. Realtime Status Banner (In-place Green Flip) */}
        <Box
          sx={{
            p: 2,
            borderRadius: '16px',
            bgcolor: isCompleted
              ? (isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5')
              : (isDark ? 'rgba(245,158,11,0.15)' : '#fffbeb'),
            border: `1.5px solid ${isCompleted ? (isDark ? '#10b981' : '#a7f3d0') : (isDark ? '#f59e0b' : '#fde047')}`,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1.5,
            transition: 'all 0.3s ease',
          }}
        >
          {isCompleted ? (
            <CheckCircleIcon sx={{ fontSize: 26, color: '#10b981', mt: 0.2 }} />
          ) : (
            <WarningAmberIcon sx={{ fontSize: 26, color: '#f59e0b', mt: 0.2 }} />
          )}

          <Box sx={{ flex: 1 }}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 800,
                fontSize: '1.05rem',
                color: isCompleted ? (isDark ? '#34d399' : '#065f46') : (isDark ? '#fbbf24' : '#92400e'),
                lineHeight: 1.25,
              }}
            >
              {isCompleted
                ? 'Print Completed & Ready!'
                : isPrinting
                ? 'Printing In Progress...'
                : order.paymentMethod === 'upi'
                ? `Verification Pending: ₹${order.amount}`
                : `Payment Pending at Counter: ₹${order.amount}`}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: isCompleted ? (isDark ? '#a7f3d0' : '#047857') : (isDark ? '#fde68a' : '#78350f'),
                fontSize: '0.8rem',
                mt: 0.25,
                lineHeight: 1.4,
              }}
            >
              {isCompleted
                ? 'Your document has been printed successfully. Collect it from the counter.'
                : isPrinting
                ? 'The printer is actively printing your document.'
                : order.paymentMethod === 'upi'
                ? 'Show your Token # and UPI payment screenshot to the attendant for instant job release.'
                : `Pay ₹${order.amount} in cash to the attendant upon pickup.`}
            </Typography>
          </Box>
        </Box>

        {/* 2. Customer Order Token Card */}
        <PrintCard elevation sx={{ textAlign: 'center', py: 3 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: colors.textSecondary, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            YOUR PICKUP TOKEN
          </Typography>

          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              my: 1.5,
              px: 3,
              py: 1.25,
              borderRadius: '14px',
              bgcolor: isDark ? 'rgba(37,99,235,0.15)' : '#eff6ff',
              border: `2px dashed ${colors.primary}`,
              color: colors.primary,
              cursor: 'pointer',
              userSelect: 'none',
            }}
            onClick={handleCopyToken}
          >
            <NumbersIcon sx={{ fontSize: 26 }} />
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                fontFamily: 'monospace',
                fontSize: '2rem',
                letterSpacing: '0.04em',
              }}
            >
              {order.tokenNumber}
            </Typography>
            <Tooltip title={copied ? 'Copied!' : 'Copy Token'} arrow>
              <Box sx={{ ml: 0.5, display: 'flex' }}>
                {copied ? <CheckIcon sx={{ fontSize: 20, color: '#10b981' }} /> : <ContentCopyIcon sx={{ fontSize: 18 }} />}
              </Box>
            </Tooltip>
          </Box>

          <Typography variant="body2" sx={{ color: colors.textSecondary, fontSize: '0.82rem' }}>
            Quote this token at the counter or show this screen to the attendant
          </Typography>
        </PrintCard>

        {/* 3. Itemized Receipt Card */}
        <PrintCard title="Receipt Details" subtitle={`Station: ${order.merchantName || 'QuickPrint'}`}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" sx={{ color: colors.textSecondary }}>File Name</Typography>
            <Typography variant="body2" noWrap sx={{ fontWeight: 700, color: colors.text, maxWidth: '60%' }}>
              {order.fileName}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" sx={{ color: colors.textSecondary }}>Total Pages</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: colors.text }}>{order.pages} Pages</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" sx={{ color: colors.textSecondary }}>Payment Method</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: colors.text, textTransform: 'uppercase' }}>
              {order.paymentMethod === 'upi' ? 'UPI Transfer' : 'Cash at Counter'}
            </Typography>
          </Box>
          <Divider sx={{ my: 1.5, borderColor: colors.border }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: colors.text }}>Total Amount</Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, color: colors.primary }}>₹{order.amount}</Typography>
          </Box>
        </PrintCard>

        {/* 4. Action Buttons */}
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => window.print()}
            startIcon={<PrintIcon />}
            sx={{
              py: 1.25,
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 700,
              borderColor: colors.border,
              color: colors.text,
            }}
          >
            Save / Print Receipt
          </Button>
          <Button
            fullWidth
            variant="contained"
            onClick={() => navigate(`/print?merchantId=${merchantId}`)}
            sx={{
              py: 1.25,
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 800,
              bgcolor: colors.primary,
              '&:hover': { bgcolor: colors.primaryHover },
            }}
          >
            Print Another
          </Button>
        </Box>

        {/* Trust Banner */}
        <TrustBanner compact />
      </Container>

      <PrivacyDialog open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />

      <AppFooter
        onOpenPrivacy={() => setPrivacyOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
      />
    </Box>
  );
}
