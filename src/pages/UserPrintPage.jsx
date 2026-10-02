// src/pages/UserPrintPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Container, Box, Typography, Stack, IconButton, Alert } from '@mui/material';
import RawAddIcon from '@mui/icons-material/Add';
import RawRemoveIcon from '@mui/icons-material/Remove';
import { unwrapIcon } from '../utils/iconHelper';
import { useThemeMode } from '../context/ThemeContext';
import {
  AppHeader,
  ShopIdentityHeader,
  PrintCard,
  DocumentCard,
  SegmentedChoice,
  TrustBanner,
  StickyActionDock,
} from '../components/Blocks';
import FileUploader from '../components/UserView/FileUploader';
import { getMerchantProfile, generatePrintJobId, createPrintJobWithId } from '../supabase/db';
import { getOrCreateUserIdentity } from '../utils/nameGenerator';
import { realtimeRelay } from '../utils/realtimeRelay';
import { inspectPdfFile, calculateBillablePages } from '../utils/fileValidation';

const AddIcon = unwrapIcon(RawAddIcon);
const RemoveIcon = unwrapIcon(RawRemoveIcon);

const DEFAULT_DEMO_MERCHANT = {
  id: 'campus-library-04',
  shopCode: 'QP-8421',
  shopName: 'Campus Library Print Station',
  pricePerPageBW: 2,
  pricePerPageColor: 5,
};

const DEFAULT_DEMO_FILE = {
  id: 'demo-lecture-notes',
  file: {
    name: 'lecture_notes_final.pdf',
    size: 4.2 * 1024 * 1024,
    type: 'application/pdf',
  },
  specs: { copies: 1, color: 'bw', sides: 'double', pageCount: 14 },
  isDemo: true,
};

export default function UserPrintPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const rawMerchantId = searchParams.get('merchantId');
  const merchantId = rawMerchantId || DEFAULT_DEMO_MERCHANT.id;

  const { isDark, colors } = useThemeMode();

  // State
  const [merchantProfile, setMerchantProfile] = useState(DEFAULT_DEMO_MERCHANT);
  const [files, setFiles] = useState([DEFAULT_DEMO_FILE]);
  const [colorMode, setColorMode] = useState('bw'); // 'bw' | 'color'
  const [duplex, setDuplex] = useState(true); // true = double, false = single
  const [copies, setCopies] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Fetch Merchant info
  useEffect(() => {
    if (merchantId && merchantId !== 'campus-library-04') {
      getMerchantProfile(merchantId)
        .then((profile) => { if (profile) setMerchantProfile(profile); })
        .catch(() => setMerchantProfile(DEFAULT_DEMO_MERCHANT));
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
        isDemo: false,
        isAnalyzing: isPdf,
        error: null,
      };
    });

    setFiles((prev) => [...prev.filter((item) => !item.isDemo), ...formatted]);

    // Inspect each PDF asynchronously
    for (const item of formatted) {
      const isPdf = item.file.type === 'application/pdf' || item.file.name.toLowerCase().endsWith('.pdf');
      if (isPdf) {
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

  const { totalPagesCount, estimatedCost } = useMemo(() => {
    const pages = files.reduce((acc, f) => {
      const docPages = f.specs?.pageCount || 1;
      const billable = f.specs?.pages && f.specs.pages !== 'all'
        ? calculateBillablePages(docPages, f.specs.pages)
        : docPages;
      return acc + billable;
    }, 0);
    const rate = colorMode === 'color' ? priceColor : priceBW;
    const cost = pages * rate * copies;
    return { totalPagesCount: pages, estimatedCost: cost.toFixed(2) };
  }, [files, colorMode, copies, priceBW, priceColor]);

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
      const identity = getOrCreateUserIdentity() || { name: 'Student Guest', avatar: '🎓' };
      const newJobId = generatePrintJobId();
      const hasRealFiles = files.some((f) => !f.isDemo);

      const filesForJob = files.map((f) => ({
        name: f.file?.name || 'document.pdf',
        size: f.file?.size || 0,
        type: f.file?.type || 'application/pdf',
        pageCount: f.specs?.pageCount || 1,
        specs: { ...f.specs, color: colorMode, copies, duplex },
      }));

      // Mode 1: stream real files if available
      if (hasRealFiles) {
        try {
          await realtimeRelay.ensureConnected(merchantId, 'customer');
          const realEntries = files.filter((f) => !f.isDemo);
          for (let i = 0; i < realEntries.length; i++) {
            await realtimeRelay.streamFile(newJobId, i, realEntries[i].file, realEntries[i].specs);
          }
        } catch (relayErr) {
          console.warn('[UserPrintPage] Relay stream notice:', relayErr);
        }
      }

      // Save metadata to database
      const jobData = {
        merchantId,
        merchantName: merchantProfile.shopName,
        customerName: identity.name,
        customerAvatar: identity.avatar,
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
        await createPrintJobWithId(newJobId, jobData);
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

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: isDark ? colors.bg : '#faf8ff' }}>
      <AppHeader title="Print Documents" showBack backTo="/" />

      <Container maxWidth="xs" sx={{ py: 3, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Shop Header */}
        <ShopIdentityHeader
          shopName={merchantProfile?.shopName}
          shopCode={merchantProfile?.shopCode}
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
                isDemo={item.isDemo}
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
          <SegmentedChoice
            value={colorMode}
            onChange={setColorMode}
            options={[
              { value: 'bw', label: 'Black & White', badge: `₹${priceBW}/page` },
              { value: 'color', label: 'Full Color', badge: `₹${priceColor}/page` },
            ]}
          />

          <Typography variant="caption" sx={{ fontWeight: 700, color: colors.textSecondary, display: 'block', mt: 2, mb: 0.75 }}>
            PRINT SIDES
          </Typography>
          <SegmentedChoice
            value={duplex ? 'double' : 'single'}
            onChange={(val) => setDuplex(val === 'double')}
            options={[
              { value: 'double', label: 'Double Sided (Duplex)' },
              { value: 'single', label: 'Single Sided' },
            ]}
          />

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
        badge={`${totalPagesCount} ${totalPagesCount === 1 ? 'Page' : 'Pages'}`}
        primaryLabel={isSubmitting ? 'Sending...' : isAnyFileAnalyzing ? 'Checking Pages...' : 'Proceed to Payment'}
        onPrimaryClick={handlePrintSubmission}
        disabled={files.length === 0 || isSubmitting || hasFileErrors || isAnyFileAnalyzing}
        loading={isSubmitting}
      />
    </Box>
  );
}
