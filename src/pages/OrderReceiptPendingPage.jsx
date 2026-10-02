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

  // Supabase Realtime CDC subscription + Polling fallback for in-place green flip
  useEffect(() => {
    if (!jobId || !supabase) return;

    let isMounted = true;

    const checkLatestStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('print_jobs')
          .select('status')
          .eq('id', jobId)
          .single();

        if (!error && data?.status && isMounted) {
          if (['completed', 'printing', 'paymentClaimed', 'paid'].includes(data.status)) {
            setStatus(data.status);
          }
        }
      } catch (err) {
        // Silent catch for network drops
      }
    };

    // Initial check
    checkLatestStatus();

    // Visibility change handler (tab switch / mobile screen unlock)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkLatestStatus();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Fallback polling interval (every 4 seconds until completed)
    const intervalId = setInterval(() => {
      checkLatestStatus();
    }, 4000);

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
      isMounted = false;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
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
      <AppHeader title="QuickPrint" subtitle="Receipt" showBack backTo="/" />

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
                ? 'Show your Pickup Token and payment screenshot to the attendant for instant job release.'
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
              bgcolor: isCompleted
                ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5')
                : (isDark ? 'rgba(37, 99, 235, 0.15)' : '#eff6ff'),
              border: isCompleted
                ? '2px solid #10b981'
                : `2px dashed ${colors.primary}`,
              color: isCompleted ? '#10b981' : colors.primary,
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'all 0.3s ease',
              animation: !isCompleted ? 'receiptPulse 2.4s infinite ease-in-out' : 'none',
              '@keyframes receiptPulse': {
                '0%': { boxShadow: '0 0 0 0 rgba(37, 99, 235, 0.3)' },
                '70%': { boxShadow: '0 0 0 8px rgba(37, 99, 235, 0)' },
                '100%': { boxShadow: '0 0 0 0 rgba(37, 99, 235, 0)' },
              },
              '&:active': {
                transform: 'scale(0.97)',
              },
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

          <Box sx={{ mt: 1, mb: 1, display: 'flex', justifyContent: 'center' }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1.5,
                py: 0.35,
                borderRadius: 999,
                bgcolor: order.paymentMethod === 'upi'
                  ? (isDark ? 'rgba(37,99,235,0.15)' : '#eff6ff')
                  : (isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5'),
                color: order.paymentMethod === 'upi' ? colors.primary : '#10b981',
                fontSize: '0.78rem',
                fontWeight: 700,
                border: `1px solid ${order.paymentMethod === 'upi' ? (isDark ? 'rgba(37,99,235,0.3)' : '#bfdbfe') : (isDark ? 'rgba(16,185,129,0.3)' : '#a7f3d0')}`,
              }}
            >
              <span>{order.paymentMethod === 'upi' ? '📱 UPI (Show Screenshot at Counter)' : '💵 Cash at Counter'}</span>
            </Box>
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
            Print Another Document
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
