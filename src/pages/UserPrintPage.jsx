// src/pages/UserPrintPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Container, Box, Typography, Stack, IconButton, Alert, ToggleButtonGroup, ToggleButton, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import { useThemeMode } from '../context/ThemeContext';
import AppHeader from '../components/Blocks/AppHeader';
import ShopIdentityHeader from '../components/Blocks/ShopIdentityHeader';
import PrintCard from '../components/Blocks/PrintCard';
import DocumentCard from '../components/Blocks/DocumentCard';
import TrustBanner from '../components/Blocks/TrustBanner';
import StickyActionDock from '../components/Blocks/StickyActionDock';
import FileUploader from '../components/UserView/FileUploader';
import { getMerchantProfile, generatePrintJobId, createPrintJob, getActiveJobPins } from '../supabase/db';
import { generatePin, formatOrderToken } from '../utils/tokenGenerator';
import { realtimeRelay } from '../utils/realtimeRelay';
import { inspectPdfFile, calculateBillablePages } from '../utils/fileValidation';
import { recordShopVisit } from '../utils/recentShops';

export default function UserPrintPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const merchantId = searchParams.get('merchantId');

  const { isDark, colors } = useThemeMode();

  // State
  const [merchantProfile, setMerchantProfile] = useState(null);
  const [isStationLoading, setIsStationLoading] = useState(Boolean(merchantId));
  const [isMerchantOnline, setIsMerchantOnline] = useState(false);
  const [files, setFiles] = useState([]);
  const [colorMode, setColorMode] = useState('bw'); // 'bw' | 'color'
  const [duplex, setDuplex] = useState(true); // true = double, false = single
  const [copies, setCopies] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Fetch Merchant info, record recent shop visit, and monitor station presence
  useEffect(() => {
    if (!merchantId) {
      setIsStationLoading(false);
      return;
    }

    setIsStationLoading(true);
    getMerchantProfile(merchantId)
      .then((profile) => {
        if (profile) {
          setMerchantProfile(profile);
          recordShopVisit({
            id: profile.id || merchantId,
            shopCode: profile.shopCode || profile.shop_code || null,
            shopName: profile.shopName || profile.shop_name || 'Print Station',
          });
        } else {
          setMerchantProfile({
            id: merchantId,
            shopCode: 'STATION',
            shopName: 'QuickPrint Station',
            pricePerPageBW: 2,
            pricePerPageColor: 5,
          });
        }
      })
      .catch((err) => {
        console.warn('[UserPrintPage] Profile fetch note:', err);
        setMerchantProfile({
          id: merchantId,
          shopCode: 'STATION',
          shopName: 'QuickPrint Station',
          pricePerPageBW: 2,
          pricePerPageColor: 5,
        });
      })
      .finally(() => {
        setIsStationLoading(false);
      });

    // Connect customer to relay room to track live station presence
    realtimeRelay.connect(merchantId, 'customer');
    const unsubscribe = realtimeRelay.subscribe((event) => {
      if (event.type === 'presence') {
        setIsMerchantOnline(Boolean(event.online));
      }
    });
    return () => unsubscribe();
  }, [merchantId]);

  // Handle adding new files with asynchronous page counting & validation
  const handleFilesAdded = async (newRawFiles) => {
    const formatted = newRawFiles.map((f, i) => {
      const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
      return {
        id: `${Date.now()}-${i}-${f.name}`,
        file: f,
        specs: { copies: 1, color: colorMode, sides: duplex ? 'double' : 'single', pageCount: 1, pages: 'all' },
        isAnalyzing: isPdf,
        error: null,
      };
    });

    setFiles((prev) => [...prev, ...formatted]);

    // Inspect each PDF asynchronously
    for (const item of formatted) {
      if (item.isAnalyzing) {
        try {
          const inspection = await inspectPdfFile(item.file);
          setFiles((prev) =>
            prev.map((f) => {
              if (f.id === item.id) {
                return {
                  ...f,
                  isAnalyzing: false,
                  specs: {
                    ...f.specs,
                    pageCount: inspection.pageCount || 1,
                  },
                  error: inspection.error || null,
                };
              }
              return f;
            })
          );
        } catch {
          setFiles((prev) =>
            prev.map((f) => (f.id === item.id ? { ...f, isAnalyzing: false } : f))
          );
        }
      }
    }
  };

  const handleRemoveFile = (indexToRemove) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Pricing calculations using actual detected billable pages
  const priceBW = merchantProfile?.pricePerPageBW ?? 2;
  const priceColor = merchantProfile?.pricePerPageColor ?? 5;

  const hasFileErrors = useMemo(() => files.some((f) => Boolean(f.error)), [files]);
  const isAnyFileAnalyzing = useMemo(() => files.some((f) => Boolean(f.isAnalyzing)), [files]);

  const { totalPagesCount, estimatedCost, rawPagesCount } = useMemo(() => {
    let rawTotal = 0;
    let billableTotal = 0;

    files.forEach((f) => {
      const docPages = f.specs?.pageCount || 1;
      const billable = f.specs?.pages && f.specs.pages !== 'all'
        ? calculateBillablePages(docPages, f.specs.pages, false)
        : docPages;
      rawTotal += billable;
      const sheets = duplex ? Math.ceil(billable / 2) : billable;
      billableTotal += sheets;
    });

    const rate = colorMode === 'color' ? priceColor : priceBW;
    const cost = billableTotal * rate * copies;
    return {
      rawPagesCount: rawTotal,
      totalPagesCount: billableTotal,
      estimatedCost: cost.toFixed(2),
    };
  }, [files, colorMode, duplex, copies, priceBW, priceColor]);

  // Submission Flow (Direct Transfer + DB metadata)
  const handlePrintSubmission = async () => {
    if (!merchantId) {
      setSubmitError('No print station selected. Please scan a counter QR code.');
      return;
    }

    if (files.length === 0) {
      setSubmitError('Please select at least one document to print.');
      return;
    }

    if (hasFileErrors) {
      setSubmitError('Please remove or fix invalid documents before proceeding.');
      return;
    }

    if (isAnyFileAnalyzing) {
      setSubmitError('Please wait while page counts are being verified.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const newJobId = generatePrintJobId();

      // Check active PINs currently at merchant to guarantee zero overlap
      let activePins = [];
      try {
        activePins = await getActiveJobPins(merchantId);
      } catch (pinErr) {
        console.warn('[UserPrintPage] Active PIN query notice:', pinErr);
      }

      // Generate guaranteed unique 4-digit numeric PIN
      const pin = generatePin(activePins);
      const tokenNumber = formatOrderToken(pin);

      const filesForJob = files.map((f) => ({
        name: f.file?.name || 'document.pdf',
        size: f.file?.size || 0,
        type: f.file?.type || 'application/pdf',
        pageCount: f.specs?.pageCount || 1,
        specs: { ...f.specs, color: colorMode, copies, duplex, sides: duplex ? 'double' : 'single' },
      }));

      // Stream uploaded files via realtime relay
      try {
        await realtimeRelay.ensureConnected(merchantId, 'customer');
        for (let i = 0; i < files.length; i++) {
          await realtimeRelay.streamFile(newJobId, i, files[i].file, files[i].specs);
        }
      } catch (relayErr) {
        console.warn('[UserPrintPage] Relay stream notice:', relayErr);
      }

      // Save metadata to database
      const jobData = {
        merchantId,
        merchantName: merchantProfile?.shopName || 'Print Station',
        pin,
        tokenNumber,
        files: filesForJob,
        status: 'pending',
        cost: Number(estimatedCost),
        totalPages: totalPagesCount,
        bwPages: colorMode === 'bw' ? totalPagesCount : 0,
        colorPages: colorMode === 'color' ? totalPagesCount : 0,
        transport: 'realtime',
        createdAt: new Date().toISOString(),
      };

      try {
        await createPrintJob(newJobId, jobData);
        realtimeRelay.sendJobComplete(newJobId, jobData);
      } catch (dbErr) {
        console.warn('[UserPrintPage] DB registration note:', dbErr);
      }

      // Seamless navigation to Payment Selection
      navigate(`/payment?merchantId=${merchantId}&jobId=${newJobId}`, {
        state: {
          jobId: newJobId,
          pin,
          tokenNumber,
          merchantId,
          merchantProfile,
          files: filesForJob,
          totalPagesCount,
          rawPagesCount,
          bwPagesCount: colorMode === 'bw' ? totalPagesCount : 0,
          colorPagesCount: colorMode === 'color' ? totalPagesCount : 0,
          estimatedCost,
          colorMode,
          copies,
          duplex,
        },
      });
    } catch (err) {
      console.error('[UserPrintPage] Submit error:', err);
      setSubmitError('Failed to process documents. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleGroupSx = {
    bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
    p: 0.5,
    borderRadius: '12px',
    border: `1px solid ${colors.border}`,
    '& .MuiToggleButtonGroup-grouped': {
      border: 0,
      borderRadius: '9px !important',
      py: 0.85,
      px: 1.5,
      fontWeight: 700,
      fontSize: '0.86rem',
      textTransform: 'none',
      color: colors.textSecondary,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 0.75,
      transition: 'all 0.15s ease',
      '&:hover': {
        bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.65)',
        color: colors.text,
      },
      '&.Mui-selected': {
        bgcolor: isDark ? colors.primary : '#ffffff',
        color: isDark ? '#ffffff' : colors.primary,
        boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 4px rgba(15,23,42,0.08)',
        '&:hover': {
          bgcolor: isDark ? colors.primary : '#ffffff',
          color: isDark ? '#ffffff' : colors.primary,
        },
      },
    },
  };

  const pricePillSx = (isSelected) => ({
    px: 0.85,
    py: 0.2,
    borderRadius: '999px',
    bgcolor: isSelected
      ? (isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(37, 99, 235, 0.12)')
      : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.06)'),
    color: isSelected
      ? (isDark ? '#ffffff' : colors.primary)
      : colors.textSecondary,
    border: `1px solid ${isSelected
      ? (isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(37, 99, 235, 0.2)')
      : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(15, 23, 42, 0.08)')}`,
    fontSize: '11px',
    fontWeight: 700,
    transition: 'all 0.15s ease',
  });

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: isDark ? colors.bg : '#faf8ff' }}>
      <AppHeader title="Print Documents" showBack backTo="/" />

      <Container maxWidth="xs" sx={{ py: 3, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Missing Station Warning */}
        {!merchantId && !isStationLoading && (
          <PrintCard
            title="No Print Station Selected"
            subtitle="Connect to a station to configure printing"
            elevation
            sx={{ textAlign: 'center' }}
          >
            <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2 }}>
              Scan the counter QR code at your print station or enter the 4-digit code to begin.
            </Typography>
            <Button
              variant="contained"
              fullWidth
              startIcon={<QrCodeScannerIcon />}
              onClick={() => navigate('/')}
              sx={{
                bgcolor: colors.primary,
                py: 1.25,
                borderRadius: '12px',
                fontWeight: 800,
                textTransform: 'none',
              }}
            >
              Scan Station QR
            </Button>
          </PrintCard>
        )}

        {/* Shop Header */}
        {merchantId && (
          <ShopIdentityHeader
            shopName={merchantProfile?.shopName || 'Print Station'}
            shopCode={merchantProfile?.shopCode || 'STATION'}
            isOnline={isMerchantOnline}
            pricePerPageBW={priceBW}
            pricePerPageColor={priceColor}
          />
        )}

        {submitError && (
          <Alert severity="error" onClose={() => setSubmitError(null)} sx={{ borderRadius: '12px' }}>
            {submitError}
          </Alert>
        )}

        {/* Mobile-First File Uploader */}
        <FileUploader onFilesAdded={handleFilesAdded} hasFiles={files.length > 0} />

        {/* Uploaded Documents List */}
        {files.length > 0 && (
          <Stack spacing={1.25}>
            {files.map((item, idx) => (
              <DocumentCard
                key={item.id || idx}
                fileName={item.file?.name}
                fileSize={item.file?.size}
                pageCount={item.specs?.pageCount || 1}
                colorMode={colorMode}
                copies={copies}
                duplex={duplex}
                isAnalyzing={item.isAnalyzing}
                error={item.error}
                pageRange={item.specs?.pages}
                onRemove={() => handleRemoveFile(idx)}
              />
            ))}
          </Stack>
        )}

        {/* Print Configuration Card */}
        <PrintCard title="Print Settings" subtitle="Configure color mode, copies, and duplex">
          <Typography variant="caption" sx={{ fontWeight: 700, color: colors.textSecondary, display: 'block', mb: 0.75 }}>
            COLOR MODE
          </Typography>
          <ToggleButtonGroup
            value={colorMode}
            exclusive
            onChange={(_, val) => val && setColorMode(val)}
            fullWidth
            size="small"
            sx={toggleGroupSx}
          >
            <ToggleButton value="bw">
              Black & White
              <Box component="span" sx={pricePillSx(colorMode === 'bw')}>
                ₹{priceBW}/page
              </Box>
            </ToggleButton>
            <ToggleButton value="color">
              Full Color
              <Box component="span" sx={pricePillSx(colorMode === 'color')}>
                ₹{priceColor}/page
              </Box>
            </ToggleButton>
          </ToggleButtonGroup>

          <Typography variant="caption" sx={{ fontWeight: 700, color: colors.textSecondary, display: 'block', mt: 2, mb: 0.75 }}>
            PRINT SIDES
          </Typography>
          <ToggleButtonGroup
            value={duplex ? 'double' : 'single'}
            exclusive
            onChange={(_, val) => val && setDuplex(val === 'double')}
            fullWidth
            size="small"
            sx={toggleGroupSx}
          >
            <ToggleButton value="double">Double Sided (Duplex)</ToggleButton>
            <ToggleButton value="single">Single Sided</ToggleButton>
          </ToggleButtonGroup>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: colors.text }}>
              Number of Copies
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <IconButton
                size="small"
                disabled={copies <= 1}
                onClick={() => setCopies((c) => Math.max(1, c - 1))}
                sx={{ border: `1px solid ${colors.border}`, borderRadius: '8px' }}
              >
                <RemoveIcon sx={{ fontSize: 16 }} />
              </IconButton>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, minWidth: 20, textAlign: 'center' }}>
                {copies}
              </Typography>
              <IconButton
                size="small"
                disabled={copies >= 50}
                onClick={() => setCopies((c) => c + 1)}
                sx={{ border: `1px solid ${colors.border}`, borderRadius: '8px' }}
              >
                <AddIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          </Box>
        </PrintCard>

        {/* Zero Data Retention Trust Banner */}
        <TrustBanner compact />
      </Container>

      {/* Sticky Bottom Dock */}
      <StickyActionDock
        priceText={`₹${estimatedCost}`}
        badge={`${totalPagesCount} ${totalPagesCount === 1 ? (duplex ? 'Sheet' : 'Page') : (duplex ? 'Sheets' : 'Pages')}`}
        primaryLabel={isSubmitting ? 'Sending...' : isAnyFileAnalyzing ? 'Checking Pages...' : 'Proceed to Payment'}
        onPrimaryClick={handlePrintSubmission}
        disabled={files.length === 0 || isSubmitting || hasFileErrors || isAnyFileAnalyzing}
        loading={isSubmitting}
      />
    </Box>
  );
}
