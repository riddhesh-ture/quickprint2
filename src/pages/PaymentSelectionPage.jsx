// src/pages/PaymentSelectionPage.jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Container, Box, Typography, Stack, Paper, Divider, Button, Tooltip } from '@mui/material';
import RawCheckCircleIcon from '@mui/icons-material/CheckCircle';
import RawRadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import RawPaymentsIcon from '@mui/icons-material/Payments';
import RawVerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import RawContentCopyIcon from '@mui/icons-material/ContentCopy';
import RawCheckIcon from '@mui/icons-material/Check';
import RawLaunchIcon from '@mui/icons-material/Launch';
import { unwrapIcon } from '../utils/iconHelper';
import { useThemeMode } from '../context/ThemeContext';

const CheckCircleIcon = unwrapIcon(RawCheckCircleIcon);
const RadioButtonUncheckedIcon = unwrapIcon(RawRadioButtonUncheckedIcon);
const PaymentsIcon = unwrapIcon(RawPaymentsIcon);
const VerifiedUserIcon = unwrapIcon(RawVerifiedUserIcon);
const ContentCopyIcon = unwrapIcon(RawContentCopyIcon);
const CheckIcon = unwrapIcon(RawCheckIcon);
const LaunchIcon = unwrapIcon(RawLaunchIcon);
import {
  AppHeader,
  ShopIdentityHeader,
  PrintCard,
  TrustBanner,
  StickyActionDock,
} from '../components/Blocks';
import { getMerchantProfile, updatePrintJob } from '../supabase/db';
import { getOrCreateUserIdentity } from '../utils/nameGenerator';
import { formatOrderToken, generateDailyTokenNumber, generatePin } from '../utils/tokenGenerator';

const DEFAULT_DEMO_MERCHANT = {
  id: 'campus-library-04',
  shopCode: 'QP-8421',
  shopName: 'Campus Library Print Station',
  pricePerPageBW: 2,
  pricePerPageColor: 5,
};

export default function PaymentSelectionPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const rawMerchantId = searchParams.get('merchantId');
  const merchantId = rawMerchantId || DEFAULT_DEMO_MERCHANT.id;
  const incoming = location.state || {};
  const activeJobId = searchParams.get('jobId') || incoming.jobId || `QP-${Math.floor(100000 + Math.random() * 900000)}`;

  const { isDark, colors } = useThemeMode();

  const [merchantProfile, setMerchantProfile] = useState(DEFAULT_DEMO_MERCHANT);
  const [selectedMethod, setSelectedMethod] = useState('upi'); // 'upi' | 'cash'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Extract order properties
  const filesList = incoming.files || [];
  const primaryFileName = filesList.length > 0
    ? filesList[0]?.name + (filesList.length > 1 ? ` (+${filesList.length - 1} more)` : '')
    : 'lecture_notes_final.pdf';
  const totalPages = incoming.totalPagesCount || 14;
  const bwPages = incoming.bwPagesCount ?? totalPages;
  const colorPages = incoming.colorPagesCount ?? 0;
  const totalCost = incoming.estimatedCost != null ? Number(incoming.estimatedCost).toFixed(2) : '28.00';

  useEffect(() => {
    if (merchantId && merchantId !== 'campus-library-04') {
      getMerchantProfile(merchantId)
        .then((profile) => { if (profile) setMerchantProfile(profile); })
        .catch(() => setMerchantProfile(DEFAULT_DEMO_MERCHANT));
    }
  }, [merchantId]);

  const merchantUpiId = merchantProfile?.upiId || merchantProfile?.upi_id;

  const upiIntentUrl = useMemo(() => {
    if (!merchantUpiId) return null;
    const params = new URLSearchParams({
      pa: merchantUpiId,
      pn: merchantProfile?.shopName || 'QuickPrint Station',
      am: totalCost,
      cu: 'INR',
      tn: `Order ${activeJobId.slice(-6)}`,
    });
    return `upi://pay?${params.toString()}`;
  }, [merchantUpiId, merchantProfile?.shopName, totalCost, activeJobId]);

  const handlePayAndProceed = async () => {
    setIsSubmitting(true);
    try {
      const identity = getOrCreateUserIdentity() || { name: 'Student Guest', avatar: '🎓' };
      const dailyToken = incoming.dailyToken || generateDailyTokenNumber();
      const pin = incoming.pin || generatePin();
      const tokenDisplay = incoming.tokenNumber || formatOrderToken(dailyToken, pin);

      const orderData = {
        jobId: activeJobId,
        orderId: activeJobId,
        tokenNumber: tokenDisplay,
        dailyToken,
        pin,
        merchantId,
        merchantName: merchantProfile.shopName,
        shopCode: merchantProfile.shopCode,
        userName: identity.name,
        userAvatar: identity.avatar,
        fileName: primaryFileName,
        pages: totalPages,
        amount: totalCost,
        paymentMethod: selectedMethod,
        formattedDate: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      // Persist token & payment state to Supabase so merchant sees it in real time
      try {
        await updatePrintJob(activeJobId, {
          tokenNumber: tokenDisplay,
          dailyToken,
          pin,
          paymentMethod: selectedMethod,
          status: selectedMethod === 'upi' ? 'paymentClaimed' : 'pending',
          cost: Number(totalCost),
        });
      } catch (dbErr) {
        console.warn('[PaymentSelectionPage] DB token registration notice:', dbErr);
      }

      navigate(`/receipt/pending?merchantId=${merchantId}&jobId=${activeJobId}`, {
        state: { order: orderData },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: isDark ? colors.bg : '#faf8ff' }}>
      <AppHeader title="QuickPrint" subtitle="Payment" showBack backTo={`/print?merchantId=${merchantId}`} />

      <Container maxWidth="xs" sx={{ py: 3, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Shop Info Header */}
        <ShopIdentityHeader
          shopName={merchantProfile?.shopName}
          shopCode={merchantProfile?.shopCode}
          subtitle={`Counter Terminal • ${merchantProfile.shopCode || 'QP-8421'}`}
        />

        {/* Order Summary Card */}
        <PrintCard title="Order Summary" subtitle={primaryFileName}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" sx={{ color: colors.textSecondary }}>
              Printing ({totalPages} pages {colorPages > 0 ? `• ${colorPages} Color` : '• B&W'})
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: colors.text }}>
              ₹{totalCost}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="body2" sx={{ color: colors.textSecondary }}>
              Platform Fee & Utility Charges
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#10b981' }}>
              Free (₹0.00)
            </Typography>
          </Box>
          <Divider sx={{ my: 1, borderColor: colors.border }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', pt: 0.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: colors.text }}>
              Total Payable
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: colors.primary }}>
              ₹{totalCost}
            </Typography>
          </Box>
        </PrintCard>

        {/* Payment Method Selection Card */}
        <PrintCard title="Select Payment Method" subtitle="Fast checkout without cards or login">
          <Stack spacing={1.25}>
            {/* UPI Option */}
            <Paper
              elevation={0}
              onClick={() => setSelectedMethod('upi')}
              sx={{
                p: 2,
                borderRadius: '14px',
                bgcolor: selectedMethod === 'upi' ? (isDark ? 'rgba(37,99,235,0.1)' : '#eff6ff') : (isDark ? colors.surface : '#ffffff'),
                border: `2px solid ${selectedMethod === 'upi' ? colors.primary : colors.border}`,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {selectedMethod === 'upi' ? (
                  <CheckCircleIcon sx={{ color: colors.primary, fontSize: 22 }} />
                ) : (
                  <RadioButtonUncheckedIcon sx={{ color: colors.textSecondary, fontSize: 22 }} />
                )}
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colors.text }}>
                      UPI Instant Transfer
                    </Typography>
                    <Box sx={{ px: 0.75, py: 0.15, borderRadius: 999, bgcolor: colors.primary, color: '#fff', fontSize: '10px', fontWeight: 800 }}>
                      RECOMMENDED
                    </Box>
                  </Box>
                  <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                    GPay, PhonePe, Paytm, or any UPI app
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {/* UPI Guidance Box */}
            {selectedMethod === 'upi' && (
              <Box
                sx={{
                  p: 1.75,
                  borderRadius: '12px',
                  bgcolor: isDark ? 'rgba(37,99,235,0.12)' : '#eff6ff',
                  border: `1px solid ${isDark ? '#1d4ed8' : '#bfdbfe'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.25,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                  <VerifiedUserIcon sx={{ color: colors.primary, fontSize: 18, mt: 0.2, flexShrink: 0 }} />
                  <Typography variant="body2" sx={{ color: isDark ? '#93c5fd' : '#1e40af', fontSize: '0.8rem', lineHeight: 1.4 }}>
                    <strong>Counter Verification:</strong> Pay via UPI and show your payment screenshot along with your Pickup Token at the counter.
                  </Typography>
                </Box>

                {merchantUpiId && (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 1,
                      borderRadius: '8px',
                      bgcolor: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 700, color: colors.text }}>
                      UPI: {merchantUpiId}
                    </Typography>
                    <Button
                      size="small"
                      startIcon={copiedUpi ? <CheckIcon sx={{ fontSize: 14 }} /> : <ContentCopyIcon sx={{ fontSize: 14 }} />}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(merchantUpiId);
                        setCopiedUpi(true);
                        setTimeout(() => setCopiedUpi(false), 2000);
                      }}
                      sx={{ textTransform: 'none', fontSize: '0.74rem', py: 0.2, px: 1, fontWeight: 700 }}
                    >
                      {copiedUpi ? 'Copied' : 'Copy'}
                    </Button>
                  </Box>
                )}

                {upiIntentUrl && (
                  <Button
                    component="a"
                    href={upiIntentUrl}
                    variant="outlined"
                    size="small"
                    endIcon={<LaunchIcon sx={{ fontSize: 14 }} />}
                    sx={{
                      width: '100%',
                      borderRadius: '8px',
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      borderColor: colors.primary,
                      color: colors.primary,
                    }}
                  >
                    Pay ₹{totalCost} via Installed UPI App
                  </Button>
                )}
              </Box>
            )}

            {/* Cash at Counter Option */}
            <Paper
              elevation={0}
              onClick={() => setSelectedMethod('cash')}
              sx={{
                p: 2,
                borderRadius: '14px',
                bgcolor: selectedMethod === 'cash' ? (isDark ? 'rgba(37,99,235,0.1)' : '#eff6ff') : (isDark ? colors.surface : '#ffffff'),
                border: `2px solid ${selectedMethod === 'cash' ? colors.primary : colors.border}`,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {selectedMethod === 'cash' ? (
                  <CheckCircleIcon sx={{ color: colors.primary, fontSize: 22 }} />
                ) : (
                  <RadioButtonUncheckedIcon sx={{ color: colors.textSecondary, fontSize: 22 }} />
                )}
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colors.text }}>
                    Pay Cash at Counter
                  </Typography>
                  <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                    Pay exact cash at counter upon pickup
                  </Typography>
                </Box>
              </Box>
              <PaymentsIcon sx={{ color: colors.textSecondary, fontSize: 22 }} />
            </Paper>
          </Stack>
        </PrintCard>

        {/* Trust Banner */}
        <TrustBanner compact />
      </Container>

      {/* Sticky Bottom Dock */}
      <StickyActionDock
        priceText={`₹${totalCost}`}
        primaryLabel={isSubmitting ? 'Confirming...' : (selectedMethod === 'upi' ? 'Confirm Payment & Get Token' : 'Get Pickup Token')}
        onPrimaryClick={handlePayAndProceed}
        disabled={isSubmitting}
        loading={isSubmitting}
      />
    </Box>
  );
}
