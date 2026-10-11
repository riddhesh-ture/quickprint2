// src/pages/UserPrintPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Container, Box, Typography, Stack, IconButton, Alert, ToggleButtonGroup, ToggleButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { useThemeMode } from '../context/ThemeContext';
import AppHeader from '../components/Blocks/AppHeader';
import ShopIdentityHeader from '../components/Blocks/ShopIdentityHeader';
import PrintCard from '../components/Blocks/PrintCard';
import DocumentCard from '../components/Blocks/DocumentCard';
import TrustBanner from '../components/Blocks/TrustBanner';
import StickyActionDock from '../components/Blocks/StickyActionDock';
import FileUploader from '../components/UserView/FileUploader';
import { getMerchantProfile, generatePrintJobId, createPrintJob } from '../supabase/db';
import { realtimeRelay } from '../utils/realtimeRelay';
import { inspectPdfFile, calculateBillablePages } from '../utils/fileValidation';

const DEFAULT_DEMO_MERCHANT = {
  id: 'campus-library-04',
  shopCode: 'QP-8421',
  shopName: 'Campus Library Print Station',
  pricePerPageBW: 2,
  pricePerPageColor: 5,
};

export default function UserPrintPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const rawMerchantId = searchParams.get('merchantId');
  const merchantId = rawMerchantId || DEFAULT_DEMO_MERCHANT.id;

  const { isDark, colors } = useThemeMode();

  // State
  const [merchantProfile, setMerchantProfile] = useState(DEFAULT_DEMO_MERCHANT);
  const [isMerchantOnline, setIsMerchantOnline] = useState(false);
  const [files, setFiles] = useState([]);
  const [colorMode, setColorMode] = useState('bw'); // 'bw' | 'color'
  const [duplex, setDuplex] = useState(true); // true = double, false = single
  const [copies, setCopies] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Fetch Merchant info and monitor station real-time presence
  useEffect(() => {
    if (merchantId && merchantId !== 'campus-library-04') {
      getMerchantProfile(merchantId)
        .then((profile) => { if (profile) setMerchantProfile(profile); })
        .catch(() => setMerchantProfile(DEFAULT_DEMO_MERCHANT));
    }

    // Connect customer to relay room early to pre-warm connection & track presence
    if (merchantId) {
      realtimeRelay.connect(merchantId, 'customer');
      const unsubscribe = realtimeRelay.subscribe((event) => {
        if (event.type === 'presence') {
          setIsMerchantOnline(Boolean(event.online));
        }
      });
      return () => unsubscribe();
    }
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
    if (files.length === 0) {
      setSubmitError('Please upload at least one document to print.');
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
        merchantName: merchantProfile.shopName,
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
        // Alert merchant station in real time
        realtimeRelay.sendJobComplete(newJobId, jobData);
      } catch (dbErr) {
        console.warn('[UserPrintPage] DB registration note:', dbErr);
      }

      // Seamless navigation to Payment Selection
      navigate(`/payment?merchantId=${merchantId}&jobId=${newJobId}`, {
        state: {
          jobId: newJobId,
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
      '&.Mui-selected': {
        bgcolor: isDark ? colors.primary : '#ffffff',
        color: isDark ? '#ffffff' : colors.primary,
        boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(15,23,42,0.08)',
      },
    },
  };

  const pricePillSx = (isSelected) => ({
    px: 0.8,
    py: 0.15,
    borderRadius: '999px',
    bgcolor: isSelected
      ? (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(37,99,235,0.1)')
      : (isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'),
    fontSize: '10.5px',
    fontWeight: 700,
  });

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: isDark ? colors.bg : '#faf8ff' }}>
      <AppHeader title="Print Documents" showBack backTo="/" />

      <Container maxWidth="xs" sx={{ py: 3, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Shop Header */}
        <ShopIdentityHeader
          shopName={merchantProfile?.shopName}
          shopCode={merchantProfile?.shopCode}
          isOnline={isMerchantOnline}
          pricePerPageBW={priceBW}
          pricePerPageColor={priceColor}
        />

        {submitError && (
          <Alert severity="error" onClose={() => setSubmitError(null)} sx={{ borderRadius: '12px' }}>
            {submitError}
          </Alert>
        )}

        {/* File Dropzone */}
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
