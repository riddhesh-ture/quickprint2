// src/pages/UserPrintPage.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Typography,
  Button,
  Box,
  Paper,
  CircularProgress,
  Alert,
  LinearProgress,
  Divider,
  Chip,
  IconButton,
  Tooltip,
  Stack,
  Switch,
  Tabs,
  Tab,
  TextField,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';

// Raw icon imports from @mui/icons-material
import RawArrowBackIcon from '@mui/icons-material/ArrowBack';
import RawPrintIcon from '@mui/icons-material/Print';
import RawRefreshIcon from '@mui/icons-material/Refresh';
import RawBoltIcon from '@mui/icons-material/Bolt';
import RawCloudQueueIcon from '@mui/icons-material/CloudQueue';
import RawQrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import RawCheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RawHourglassTopIcon from '@mui/icons-material/HourglassTop';
import RawStorefrontIcon from '@mui/icons-material/Storefront';
import RawPaymentsIcon from '@mui/icons-material/Payments';
import RawPaletteIcon from '@mui/icons-material/Palette';
import RawContentCopyIcon from '@mui/icons-material/ContentCopy';
import RawAutoStoriesIcon from '@mui/icons-material/AutoStories';
import RawFlipToBackIcon from '@mui/icons-material/FlipToBack';
import RawSecurityIcon from '@mui/icons-material/Security';
import RawShieldIcon from '@mui/icons-material/Shield';
import RawLockIcon from '@mui/icons-material/Lock';
import RawArrowForwardIcon from '@mui/icons-material/ArrowForward';
import RawCheckCircleIcon from '@mui/icons-material/CheckCircle';
import RawRadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import RawCloseIcon from '@mui/icons-material/Close';
import RawDarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import RawLightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';

import { unwrapIcon } from '../utils/iconHelper';

const ArrowBackIcon = unwrapIcon(RawArrowBackIcon);
const PrintIcon = unwrapIcon(RawPrintIcon);
const RefreshIcon = unwrapIcon(RawRefreshIcon);
const BoltIcon = unwrapIcon(RawBoltIcon);
const CloudQueueIcon = unwrapIcon(RawCloudQueueIcon);
const QrCodeScannerIcon = unwrapIcon(RawQrCodeScannerIcon);
const CheckCircleOutlineIcon = unwrapIcon(RawCheckCircleOutlineIcon);
const HourglassTopIcon = unwrapIcon(RawHourglassTopIcon);
const StorefrontIcon = unwrapIcon(RawStorefrontIcon);
const PaymentsIcon = unwrapIcon(RawPaymentsIcon);
const PaletteIcon = unwrapIcon(RawPaletteIcon);
const ContentCopyIcon = unwrapIcon(RawContentCopyIcon);
const AutoStoriesIcon = unwrapIcon(RawAutoStoriesIcon);
const FlipToBackIcon = unwrapIcon(RawFlipToBackIcon);
const SecurityIcon = unwrapIcon(RawSecurityIcon);
const ShieldIcon = unwrapIcon(RawShieldIcon);
const LockIcon = unwrapIcon(RawLockIcon);
const ArrowForwardIcon = unwrapIcon(RawArrowForwardIcon);
const CheckCircleIcon = unwrapIcon(RawCheckCircleIcon);
const RadioButtonUncheckedIcon = unwrapIcon(RawRadioButtonUncheckedIcon);
const CloseIcon = unwrapIcon(RawCloseIcon);
const DarkModeOutlinedIcon = unwrapIcon(RawDarkModeOutlinedIcon);
const LightModeOutlinedIcon = unwrapIcon(RawLightModeOutlinedIcon);

import { QRCodeSVG } from 'qrcode.react';
import FileUploader from '../components/UserView/FileUploader';
import UploadedFileItem from '../components/UserView/UploadedFileItem';
import GoogleIcon from '../components/GoogleIcon';
import { CustomerAuthProvider, useCustomerAuth } from '../context/CustomerAuthContext';
import {
  createPrintJob,
  updatePrintJob,
  generatePrintJobId,
  createPrintJobWithId,
  getMerchantProfile,
  generatePickupCode,
} from '../supabase/db';
import { useDocument } from '../hooks/useSupabase';
import { supabase } from '../supabase/client';
import { getOrCreateUserIdentity, regenerateUserName } from '../utils/nameGenerator';
import { realtimeRelay } from '../utils/realtimeRelay';
import { recordShopVisit } from '../utils/recentShops';
import {
  REALTIME_MAX_SIZE,
  MAX_TOTAL_SIZE,
  getPdfPageCount,
  calculateBillablePages,
  formatFileSize,
} from '../utils/fileValidation';

const UPI_NAME = 'QuickPrint';

// Default mock shop fallback for preview or demo
const DEFAULT_DEMO_MERCHANT = {
  id: 'campus-library-04',
  shopCode: 'QP-8421',
  shopName: 'Campus Library Print Station',
  pricePerPageBW: 2,
  pricePerPageColor: 5,
};

// Initial demo file to match file_upload_options design prototype
const DEFAULT_DEMO_FILE = {
  id: 'demo-lecture-notes-final',
  file: {
    name: 'lecture_notes_final.pdf',
    size: 4.2 * 1024 * 1024,
    type: 'application/pdf',
  },
  specs: {
    copies: 1,
    color: 'bw',
    sides: 'double',
    pages: '',
    pageCount: 14,
  },
  isDemo: true,
};

function UserPrintPageContent() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const rawMerchantId = searchParams.get('merchantId');
  const merchantId = rawMerchantId || DEFAULT_DEMO_MERCHANT.id;
  const initialMode = searchParams.get('mode') === 'later';

  // State
  const [isDark, setIsDark] = useState(false);
  const [files, setFiles] = useState([DEFAULT_DEMO_FILE]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [createdJobPickupCode, setCreatedJobPickupCode] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [userIdentity, setUserIdentity] = useState(null);
  const [isMerchantOnline, setIsMerchantOnline] = useState(true);
  const [merchantProfile, setMerchantProfile] = useState(DEFAULT_DEMO_MERCHANT);
  const [merchantLoadError, setMerchantLoadError] = useState(null);

  // Print Mode: false = Instant Print (Counter flow), true = Print Later (24h Cloud Queue)
  const [printForLater, setPrintForLater] = useState(initialMode);

  // Settings State matching file_upload_options prototype
  const [colorMode, setColorMode] = useState('bw'); // 'bw' or 'color'
  const [copies, setCopies] = useState(1);
  const [rangeMode, setRangeMode] = useState('all'); // 'all', 'custom', 'odd_even'
  const [customRange, setCustomRange] = useState('');
  const [oddEvenChoice, setOddEvenChoice] = useState('odd'); // 'odd' or 'even'
  const [duplex, setDuplex] = useState(true);

  // Payment method selection tab for awaitingPayment state ('upi' or 'cash')
  const [paymentMethodTab, setPaymentMethodTab] = useState('upi');

  // Informational Dialogs
  const [privacyDialogOpen, setPrivacyDialogOpen] = useState(false);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);

  // Isolated Customer Google Auth Hook
  const {
    customer,
    signInWithGoogle,
    signOut,
    loading: authLoading,
    authError,
  } = useCustomerAuth();

  // Firestore listeners for submitted print job
  const { document: jobData, error: jobError } = useDocument('printJobs', jobId);

  // One-time cached fetch for merchant pricing and info + automatic recent shop recording
  useEffect(() => {
    let isMounted = true;
    if (!merchantId || merchantId === 'campus-library-04') {
      setMerchantProfile(DEFAULT_DEMO_MERCHANT);
      setIsMerchantOnline(true);
      return;
    }

    setMerchantLoadError(null);
    getMerchantProfile(merchantId)
      .then((profile) => {
        if (!isMounted) return;
        if (profile) {
          setMerchantProfile(profile);
          recordShopVisit({
            id: profile.id || merchantId,
            shopCode: profile.shopCode || profile.shop_code || null,
            shopName: profile.shopName || profile.shop_name || 'Campus Library Print Station',
            city: profile.city || profile.address || '',
          });
        } else {
          setMerchantProfile(DEFAULT_DEMO_MERCHANT);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Failed to load merchant profile, falling back to default:', err);
        setMerchantProfile(DEFAULT_DEMO_MERCHANT);
      });

    return () => {
      isMounted = false;
    };
  }, [merchantId]);

  // Get or create user identity on mount
  useEffect(() => {
    const identity = getOrCreateUserIdentity();
    // Default to 'Cheerful Iris' if identity exists or seed
    setUserIdentity(identity || { name: 'Cheerful Iris', avatar: '🎭' });
  }, []);

  // Total upload size in bytes
  const totalFilesSize = useMemo(() => {
    return files.reduce((acc, f) => acc + (f.file?.size || 0), 0);
  }, [files]);

  // Total detected document pages across all files
  const totalBasePages = useMemo(() => {
    return files.reduce((acc, f) => acc + (f.specs?.pageCount || 1), 0);
  }, [files]);

  // Calculate billable pages count for active range selection
  const activeSelectedPages = useMemo(() => {
    if (rangeMode === 'all') return totalBasePages || 1;
    if (rangeMode === 'odd_even') {
      return oddEvenChoice === 'odd' ? Math.ceil(totalBasePages / 2) : Math.max(1, Math.floor(totalBasePages / 2));
    }
    if (rangeMode === 'custom') {
      return calculateBillablePages(totalBasePages || 1, customRange);
    }
    return totalBasePages || 1;
  }, [rangeMode, oddEvenChoice, totalBasePages, customRange]);

  // Pricing from merchant profile with sensible fallbacks
  const priceBW = merchantProfile?.pricePerPageBW ?? 2;
  const priceColor = merchantProfile?.pricePerPageColor ?? 5;

  // Determine transfer mode
  const isRealtimeEligible = !printForLater && isMerchantOnline && totalFilesSize <= REALTIME_MAX_SIZE && totalFilesSize > 0;

  // Calculate estimated cost
  const { estimatedCost, totalPagesCount, bwPagesCount, colorPagesCount } = useMemo(() => {
    let cost = 0;
    let totalPages = 0;
    let bwPages = 0;
    let colorPages = 0;

    for (const f of files) {
      const pageCount = f.specs?.pageCount || 1;
      let billable = pageCount;

      if (f.specs?.pages) {
        billable = calculateBillablePages(pageCount, f.specs.pages);
      } else if (rangeMode === 'custom' && customRange.trim()) {
        billable = calculateBillablePages(pageCount, customRange);
      } else if (rangeMode === 'odd_even') {
        billable = oddEvenChoice === 'odd' ? Math.ceil(pageCount / 2) : Math.max(1, Math.floor(pageCount / 2));
      }

      const fileCopies = Math.max(1, parseInt(f.specs?.copies || copies, 10) || 1);
      const isColor = (f.specs?.color || colorMode) === 'color';
      const filePages = billable * fileCopies;
      const rate = isColor ? priceColor : priceBW;

      cost += filePages * rate;
      totalPages += filePages;
      if (isColor) {
        colorPages += filePages;
      } else {
        bwPages += filePages;
      }
    }

    return {
      estimatedCost: cost,
      totalPagesCount: totalPages,
      bwPagesCount: bwPages,
      colorPagesCount: colorPages,
    };
  }, [files, copies, colorMode, rangeMode, customRange, oddEvenChoice, priceBW, priceColor]);

  const handleRegenerateName = () => {
    const newIdentity = regenerateUserName();
    setUserIdentity(newIdentity);
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        console.error('Google sign-in error:', err);
      }
    }
  };

  const generateUPIUrl = (amount, merchantUpiId, merchantName) => {
    const upi = merchantUpiId || merchantProfile?.upiId;
    if (!upi) return '';
    const pa = upi;
    const pn = encodeURIComponent(merchantName || merchantProfile?.shopName || UPI_NAME);
    const am = Number(amount || 0).toFixed(2);
    const tn = encodeURIComponent(`QuickPrint Job #${jobId?.slice(-6) || ''}`);
    return `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=INR&tn=${tn}`;
  };

  const handleFilesAdded = async (newFiles) => {
    const fileEntries = await Promise.all(
      newFiles.map(async (file) => {
        let detectedPages = 1;
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (file.type === 'application/pdf' || ext === 'pdf') {
          try {
            detectedPages = await getPdfPageCount(file);
          } catch (e) {
            console.warn('Could not detect PDF page count:', e);
          }
        }

        return {
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          file,
          specs: {
            copies: 1,
            color: 'bw',
            sides: 'double',
            pages: '',
            pageCount: detectedPages,
          },
        };
      })
    );

    setFiles((prev) => [...prev.filter((f) => !f.isDemo), ...fileEntries]);
  };

  const handleRemoveFile = (fileId) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleSpecChange = (fileId, newSpecs) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, specs: { ...f.specs, ...newSpecs } } : f))
    );
  };

  // Submit print job
  const handleProceed = async () => {
    if (!merchantId || files.length === 0 || !userIdentity) {
      alert('Please upload a document to proceed.');
      return;
    }

    if (totalFilesSize > MAX_TOTAL_SIZE) {
      alert('Total files size exceeds 50MB maximum limit. Please remove some files.');
      return;
    }

    // If all files are demo, simulate proceeding
    const hasRealFiles = files.some((f) => !f.isDemo);
    if (!hasRealFiles) {
      const demoJobId = generatePrintJobId();
      const pickupCode = printForLater ? generatePickupCode() : null;
      navigate(`/payment?merchantId=${merchantId}&jobId=${demoJobId}`, {
        state: {
          jobId: demoJobId,
          merchantId,
          merchantProfile,
          files: files.map((f) => ({
            name: f.file?.name || 'lecture_notes_final.pdf',
            size: f.file?.size || 4.2 * 1024 * 1024,
            type: f.file?.type || 'application/pdf',
            pageCount: f.specs?.pageCount || 14,
            specs: f.specs || {},
          })),
          totalPagesCount,
          bwPagesCount,
          colorPagesCount,
          estimatedCost,
          pickupCode,
          isDemo: true,
        },
      });
      return;
    }

    let currentCustomer = customer;
    if (printForLater && !currentCustomer) {
      try {
        currentCustomer = await signInWithGoogle();
        if (!currentCustomer) return;
      } catch (err) {
        if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
          return;
        }
        alert(`Google Sign-In is required for Print Later queue: ${err.message || 'Please sign in to proceed'}`);
        return;
      }
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    let transportMode = isRealtimeEligible ? 'realtime' : 'supabase';

    try {
      const filesForJob = [];
      const pickupCode = printForLater ? generatePickupCode() : null;
      if (pickupCode) {
        setCreatedJobPickupCode(pickupCode);
      }

      const preparedFiles = files.map((f) => {
        const detectedPages = f.specs?.pageCount || 1;
        let effectivePages = f.specs?.pages || '';
        if (!effectivePages) {
          if (rangeMode === 'custom') effectivePages = customRange;
          else if (rangeMode === 'odd_even') effectivePages = oddEvenChoice;
        }

        return {
          ...f,
          effectiveSpecs: {
            ...f.specs,
            copies: f.specs?.copies || copies,
            color: f.specs?.color || colorMode,
            sides: f.specs?.sides || (duplex ? 'double' : 'single'),
            pages: effectivePages,
            pageCount: detectedPages,
          },
        };
      });

      if (transportMode === 'realtime') {
        setUploadStatusText('Connecting real-time fast lane...');
        try {
          await realtimeRelay.ensureConnected(merchantId, 'customer');
        } catch (relayErr) {
          console.warn('Real-time fast lane connection failed, falling back to cloud queue:', relayErr);
          transportMode = 'supabase';
        }
      }

      if (transportMode === 'realtime') {
        const newJobId = generatePrintJobId();

        for (let i = 0; i < preparedFiles.length; i++) {
          const entry = preparedFiles[i];
          filesForJob.push({
            name: entry.file.name,
            size: entry.file.size,
            type: entry.file.type,
            pageCount: entry.effectiveSpecs.pageCount,
            specs: entry.effectiveSpecs,
            fileUrl: null,
          });
        }

        for (let i = 0; i < preparedFiles.length; i++) {
          const entry = preparedFiles[i];
          setUploadStatusText(`Streaming "${entry.file.name}" in real-time...`);

          await realtimeRelay.streamFile(
            newJobId,
            i,
            entry.file,
            entry.effectiveSpecs,
            ({ progress }) => {
              const fileWeight = 100 / preparedFiles.length;
              const overallProgress = i * fileWeight + (progress * fileWeight) / 100;
              setUploadProgress(Math.min(99, overallProgress));
            }
          );
        }

        setUploadStatusText('Finalizing job...');

        const jobDataToSave = {
          merchantId,
          merchantName: merchantProfile?.shopName || 'Print Shop',
          customerName: userIdentity.name,
          customerAvatar: userIdentity.avatar,
          files: filesForJob,
          status: 'pending',
          cost: estimatedCost,
          totalPages: totalPagesCount,
          bwPages: bwPagesCount,
          colorPages: colorPagesCount,
          createdAt: new Date().toISOString(),
          transport: 'realtime',
          isAnonymous: true,
          pickupTag: `🎭 ${userIdentity.name}`,
          pickupCode: null,
          userPhone: null,
        };

        await createPrintJobWithId(newJobId, jobDataToSave);
        setJobId(newJobId);
        setFiles([]);
        navigate(`/payment?merchantId=${merchantId}&jobId=${newJobId}`, {
          state: {
            jobId: newJobId,
            merchantId,
            merchantProfile,
            files: filesForJob,
            totalPagesCount,
            bwPagesCount,
            colorPagesCount,
            estimatedCost,
            pickupCode: null,
            printForLater: false,
            transport: 'realtime',
          },
        });
      } else {
        // Cloud queue flow
        setUploadStatusText('Uploading files to encrypted queue...');
        const totalFiles = preparedFiles.length;

        for (let i = 0; i < totalFiles; i++) {
          const entry = preparedFiles[i];
          const file = entry.file;
          const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const filePath = `${merchantId}/${Date.now()}-${i}-${cleanFileName}`;

          const { error: uploadErr } = await supabase.storage
            .from('print-files')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false,
            });

          if (uploadErr) {
            throw new Error(`Upload failed for ${file.name}: ${uploadErr.message}`);
          }

          const { data: signedData, error: signedErr } = await supabase.storage
            .from('print-files')
            .createSignedUrl(filePath, 86400);

          if (signedErr) {
            throw new Error(`Failed to generate secure URL: ${signedErr.message}`);
          }

          filesForJob.push({
            name: file.name,
            size: file.size,
            type: file.type,
            pageCount: entry.effectiveSpecs.pageCount,
            specs: entry.effectiveSpecs,
            fileUrl: signedData.signedUrl,
            storagePath: filePath,
          });

          setUploadProgress(Math.min(99, Math.round(((i + 1) / totalFiles) * 100)));
        }

        setUploadStatusText('Registering print job...');

        const newJobRef = await createPrintJob({
          merchantId,
          merchantName: merchantProfile?.shopName || 'Print Shop',
          customerName: printForLater && currentCustomer ? currentCustomer.displayName || 'Customer' : userIdentity.name,
          customerAvatar: printForLater && currentCustomer ? currentCustomer.photoURL : userIdentity.avatar,
          files: filesForJob,
          status: 'pending',
          cost: estimatedCost,
          totalPages: totalPagesCount,
          bwPages: bwPagesCount,
          colorPages: colorPagesCount,
          createdAt: new Date().toISOString(),
          transport: 'supabase',
          isAnonymous: !printForLater,
          pickupTag: printForLater ? (pickupCode ? `P-${pickupCode}` : '24h Queue') : `🎭 ${userIdentity.name}`,
          pickupCode: pickupCode || null,
          userPhone: null,
          customerId: currentCustomer?.uid || null,
          customerEmail: currentCustomer?.email || null,
          isSavedQueue: printForLater,
          expiresAt: printForLater ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
        });

        const submittedJobId = newJobRef.id;
        setJobId(submittedJobId);
        setFiles([]);
        navigate(`/payment?merchantId=${merchantId}&jobId=${submittedJobId}`, {
          state: {
            jobId: submittedJobId,
            merchantId,
            merchantProfile,
            files: filesForJob,
            totalPagesCount,
            bwPagesCount,
            colorPagesCount,
            estimatedCost,
            pickupCode,
            printForLater,
            transport: 'supabase',
          },
        });
      }
    } catch (error) {
      console.error('Error submitting print job:', error);
      alert(`There was an error sending your print job: ${error.message || 'Please try again'}`);
    } finally {
      setIsSubmitting(false);
      setUploadStatusText('');
    }
  };

  const handleClaimPayment = async (method = 'upi') => {
    if (!jobId) return;
    try {
      await updatePrintJob(jobId, {
        status: 'paymentClaimed',
        paymentMethod: method,
        paymentClaimedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Error claiming payment:', e);
      alert('Could not update payment status. Please try again.');
    }
  };

  // Serif styling matching user-flow design
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
            onClick={() => navigate('/')}
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
        {merchantLoadError && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {merchantLoadError}
          </Alert>
        )}

        {/* 1. Connected Shop & Pickup Tag Card */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 2.5,
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
            {/* Online Status Pill */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  bgcolor: '#10b981',
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  color: '#006c49',
                  fontSize: '0.8rem',
                }}
              >
                Online
              </Typography>
            </Box>

            {/* Shop Name */}
            <Typography
              variant="subtitle1"
              noWrap
              sx={{
                ...serifHeadlineStyle,
                fontWeight: 800,
                color: isDark ? '#ffffff' : '#0f172a',
                fontSize: '1.05rem',
              }}
              title={merchantProfile?.shopName || 'Campus Library Print Station'}
            >
              {merchantProfile?.shopName ? `${merchantProfile.shopName.slice(0, 22)}...` : 'Campus Library Print ...'}
            </Typography>

            {/* Shop Code Tag */}
            <Typography
              variant="caption"
              sx={{
                color: isDark ? '#94a3b8' : '#64748b',
                display: 'block',
                fontSize: '0.8rem',
                mt: 0.25,
              }}
            >
              Shop: <strong style={{ color: '#2563eb' }}>{merchantProfile?.shopCode || 'QP-8421'}</strong>
            </Typography>
          </Box>

          {/* Pickup Tag Card */}
          <Box
            sx={{
              flexShrink: 0,
              bgcolor: isDark ? '#0f172a' : '#f2f3ff',
              border: `1px solid ${isDark ? '#334155' : '#e2e7ff'}`,
              borderRadius: '12px',
              p: 1.25,
              textAlign: 'right',
            }}
          >
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                fontSize: '9.5px',
                textTransform: 'uppercase',
                fontWeight: 800,
                letterSpacing: '0.06em',
                color: isDark ? '#94a3b8' : '#64748b',
              }}
            >
              PICKUP TAG
            </Typography>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                color: '#2563eb',
                fontWeight: 700,
                fontSize: '0.86rem',
                mt: 0.25,
              }}
            >
              <span>{userIdentity?.avatar || '🎭'}</span>
              <span style={{ whiteSpace: 'nowrap' }}>{userIdentity?.name || 'Cheerful Iris'}</span>
              <Tooltip title="Regenerate pickup tag">
                <IconButton
                  size="small"
                  onClick={handleRegenerateName}
                  sx={{ p: 0.2, color: isDark ? '#94a3b8' : '#64748b', '&:hover': { color: '#2563eb' } }}
                >
                  <RefreshIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Paper>

        {/* 2. Files Section */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25, px: 0.5 }}>
            <Typography
              variant="h6"
              sx={{
                ...serifHeadlineStyle,
                fontWeight: 800,
                color: isDark ? '#ffffff' : '#0f172a',
                fontSize: '1.15rem',
              }}
            >
              Files
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b' }}>
              Max 50MB
            </Typography>
          </Box>

          {/* Dotted Upload Dropzone */}
          <FileUploader onFilesAdded={handleFilesAdded} hasFiles={files.length > 0} />

          {/* Uploaded File Items */}
          {files.length > 0 && (
            <Stack spacing={1.25} sx={{ mt: 1.5 }}>
              {files.map((fileEntry) => (
                <UploadedFileItem
                  key={fileEntry.id}
                  fileEntry={fileEntry}
                  onSpecChange={handleSpecChange}
                  onRemove={handleRemoveFile}
                />
              ))}
            </Stack>
          )}
        </Box>

        {/* 3. Print Settings Section */}
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="h6"
            sx={{
              ...serifHeadlineStyle,
              fontWeight: 800,
              color: isDark ? '#ffffff' : '#0f172a',
              fontSize: '1.15rem',
              mb: 1.5,
              px: 0.5,
            }}
          >
            Print Settings
          </Typography>

          <Stack spacing={1.5}>
            {/* Setting 1: Color Mode */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '16px',
                bgcolor: isDark ? '#1e293b' : '#ffffff',
                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PaletteIcon sx={{ color: '#2563eb', fontSize: 20 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: isDark ? '#ffffff' : '#0f172a' }}>
                    Color Mode
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: '0.78rem' }}>
                  Default: B&W
                </Typography>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25 }}>
                {/* Black & White Tile */}
                <Box
                  onClick={() => setColorMode('bw')}
                  sx={{
                    p: 1.5,
                    borderRadius: '12px',
                    border: '2px solid',
                    borderColor: colorMode === 'bw' ? '#2563eb' : (isDark ? '#334155' : '#e2e8f0'),
                    bgcolor: colorMode === 'bw' ? (isDark ? 'rgba(37,99,235,0.1)' : '#eff6ff') : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Box>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 700, color: colorMode === 'bw' ? '#2563eb' : (isDark ? '#ffffff' : '#0f172a') }}
                    >
                      Black & White
                    </Typography>
                    <Typography variant="caption" sx={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                      ₹{priceBW} / page
                    </Typography>
                  </Box>
                  {colorMode === 'bw' ? (
                    <CheckCircleIcon sx={{ color: '#2563eb', fontSize: 20 }} />
                  ) : (
                    <RadioButtonUncheckedIcon sx={{ color: isDark ? '#475569' : '#cbd5e1', fontSize: 20 }} />
                  )}
                </Box>

                {/* Full Color Tile */}
                <Box
                  onClick={() => setColorMode('color')}
                  sx={{
                    p: 1.5,
                    borderRadius: '12px',
                    border: '2px solid',
                    borderColor: colorMode === 'color' ? '#2563eb' : (isDark ? '#334155' : '#e2e8f0'),
                    bgcolor: colorMode === 'color' ? (isDark ? 'rgba(37,99,235,0.1)' : '#eff6ff') : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Box>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 700, color: colorMode === 'color' ? '#2563eb' : (isDark ? '#ffffff' : '#0f172a') }}
                    >
                      Full Color
                    </Typography>
                    <Typography variant="caption" sx={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                      ₹{priceColor} / page
                    </Typography>
                  </Box>
                  {colorMode === 'color' ? (
                    <CheckCircleIcon sx={{ color: '#2563eb', fontSize: 20 }} />
                  ) : (
                    <RadioButtonUncheckedIcon sx={{ color: isDark ? '#475569' : '#cbd5e1', fontSize: 20 }} />
                  )}
                </Box>
              </Box>
            </Paper>

            {/* Setting 2: Number of Copies Stepper */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '16px',
                bgcolor: isDark ? '#1e293b' : '#ffffff',
                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ContentCopyIcon sx={{ color: '#2563eb', fontSize: 18 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: isDark ? '#ffffff' : '#0f172a' }}>
                    Number of Copies
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: isDark ? '#94a3b8' : '#64748b', display: 'block', mt: 0.25 }}>
                  Print identical document sets
                </Typography>
              </Box>

              {/* Stepper Controls */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  bgcolor: isDark ? '#0f172a' : '#f1f5f9',
                  borderRadius: '12px',
                  p: 0.5,
                  border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                }}
              >
                <IconButton
                  size="small"
                  disabled={copies <= 1}
                  onClick={() => setCopies((c) => Math.max(1, c - 1))}
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '8px',
                    bgcolor: isDark ? '#1e293b' : '#ffffff',
                    fontWeight: 800,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                >
                  −
                </IconButton>
                <Typography
                  sx={{
                    width: 36,
                    textAlign: 'center',
                    fontWeight: 800,
                    fontSize: '1.05rem',
                    color: isDark ? '#ffffff' : '#0f172a',
                  }}
                >
                  {copies}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => setCopies((c) => Math.min(100, c + 1))}
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '8px',
                    bgcolor: isDark ? '#1e293b' : '#ffffff',
                    fontWeight: 800,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                >
                  +
                </IconButton>
              </Box>
            </Paper>

            {/* Setting 3: Page Selection */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '16px',
                bgcolor: isDark ? '#1e293b' : '#ffffff',
                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <AutoStoriesIcon sx={{ color: '#2563eb', fontSize: 18 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: isDark ? '#ffffff' : '#0f172a' }}>
                  Page Selection
                </Typography>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                <Box
                  onClick={() => setRangeMode('all')}
                  sx={{
                    py: 1.25,
                    px: 1,
                    textAlign: 'center',
                    borderRadius: '10px',
                    border: '2px solid',
                    borderColor: rangeMode === 'all' ? '#2563eb' : (isDark ? '#334155' : '#e2e8f0'),
                    bgcolor: rangeMode === 'all' ? (isDark ? 'rgba(37,99,235,0.1)' : '#eff6ff') : 'transparent',
                    color: rangeMode === 'all' ? '#2563eb' : (isDark ? '#cbd5e1' : '#475569'),
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  All ({totalBasePages})
                </Box>
                <Box
                  onClick={() => setRangeMode('custom')}
                  sx={{
                    py: 1.25,
                    px: 1,
                    textAlign: 'center',
                    borderRadius: '10px',
                    border: '2px solid',
                    borderColor: rangeMode === 'custom' ? '#2563eb' : (isDark ? '#334155' : '#e2e8f0'),
                    bgcolor: rangeMode === 'custom' ? (isDark ? 'rgba(37,99,235,0.1)' : '#eff6ff') : 'transparent',
                    color: rangeMode === 'custom' ? '#2563eb' : (isDark ? '#cbd5e1' : '#475569'),
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Custom Range
                </Box>
                <Box
                  onClick={() => setRangeMode('odd_even')}
                  sx={{
                    py: 1.25,
                    px: 1,
                    textAlign: 'center',
                    borderRadius: '10px',
                    border: '2px solid',
                    borderColor: rangeMode === 'odd_even' ? '#2563eb' : (isDark ? '#334155' : '#e2e8f0'),
                    bgcolor: rangeMode === 'odd_even' ? (isDark ? 'rgba(37,99,235,0.1)' : '#eff6ff') : 'transparent',
                    color: rangeMode === 'odd_even' ? '#2563eb' : (isDark ? '#cbd5e1' : '#475569'),
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Odd / Even
                </Box>
              </Box>

              {/* Custom Range Subsegment */}
              {rangeMode === 'custom' && (
                <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px dashed ${isDark ? '#334155' : '#e2e8f0'}` }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="e.g. 1-5, 8, 11-14"
                    value={customRange}
                    onChange={(e) => setCustomRange(e.target.value.replace(/[^0-9,-]/g, ''))}
                    sx={{
                      '& input': { fontFamily: 'monospace', fontSize: '0.85rem' },
                    }}
                  />
                  <Typography variant="caption" sx={{ color: '#2563eb', fontWeight: 700, mt: 0.5, display: 'block' }}>
                    {activeSelectedPages} pages selected
                  </Typography>
                </Box>
              )}

              {/* Odd / Even Subsegment */}
              {rangeMode === 'odd_even' && (
                <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px dashed ${isDark ? '#334155' : '#e2e8f0'}` }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                    <Button
                      size="small"
                      variant={oddEvenChoice === 'odd' ? 'contained' : 'outlined'}
                      onClick={() => setOddEvenChoice('odd')}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                        bgcolor: oddEvenChoice === 'odd' ? '#2563eb' : 'transparent',
                        borderColor: '#2563eb',
                        color: oddEvenChoice === 'odd' ? '#fff' : '#2563eb',
                      }}
                    >
                      Odd Pages ({Math.ceil(totalBasePages / 2)})
                    </Button>
                    <Button
                      size="small"
                      variant={oddEvenChoice === 'even' ? 'contained' : 'outlined'}
                      onClick={() => setOddEvenChoice('even')}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                        bgcolor: oddEvenChoice === 'even' ? '#2563eb' : 'transparent',
                        borderColor: '#2563eb',
                        color: oddEvenChoice === 'even' ? '#fff' : '#2563eb',
                      }}
                    >
                      Even Pages ({Math.floor(totalBasePages / 2)})
                    </Button>
                  </Box>
                </Box>
              )}
            </Paper>

            {/* Setting 4: Double Sided (Duplex) */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '16px',
                bgcolor: isDark ? '#1e293b' : '#ffffff',
                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
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
                  }}
                >
                  <FlipToBackIcon sx={{ fontSize: 20 }} />
                </Box>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: isDark ? '#ffffff' : '#0f172a' }}>
                      Double Sided (Duplex)
                    </Typography>
                    <Box
                      sx={{
                        px: 1,
                        py: 0.25,
                        borderRadius: 999,
                        bgcolor: '#dcfce7',
                        color: '#15803d',
                        fontWeight: 700,
                        fontSize: '10px',
                      }}
                    >
                      Eco Choice
                    </Box>
                  </Box>
                  <Typography variant="caption" sx={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                    Print both front & back to save paper
                  </Typography>
                </Box>
              </Box>

              <Switch
                checked={duplex}
                onChange={(e) => setDuplex(e.target.checked)}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: '#2563eb',
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: '#2563eb',
                  },
                }}
              />
            </Paper>

            {/* Setting 5: Zero Data Retention Guarantee Card */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '16px',
                bgcolor: isDark ? 'rgba(16,185,129,0.06)' : '#f0fdf4',
                border: '1.5px solid #6ee7b7',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
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
                  mt: 0.25,
                }}
              >
                <ShieldIcon sx={{ fontSize: 20 }} />
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#006c49' }}>
                  Zero Data Retention Guarantee
                </Typography>
                <Typography variant="caption" sx={{ color: isDark ? '#cbd5e1' : '#475569', display: 'block', mt: 0.25, lineHeight: 1.45 }}>
                  Files are transferred via encrypted tunnels and shredded permanently right after physical printing is completed.
                </Typography>
              </Box>
            </Paper>
          </Stack>
        </Box>
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
          {/* Centered Brand Title */}
          <Typography
            variant="caption"
            sx={{
              textAlign: 'center',
              fontWeight: 800,
              color: isDark ? '#cbd5e1' : '#0f172a',
              letterSpacing: '-0.01em',
              fontSize: '0.8rem',
            }}
          >
            QuickPrint
          </Typography>

          {/* Primary Action Button */}
          <Button
            variant="contained"
            fullWidth
            onClick={handleProceed}
            disabled={isSubmitting || files.length === 0}
            startIcon={<LockIcon sx={{ fontSize: 18 }} />}
            endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}
            sx={{
              height: 50,
              borderRadius: '12px',
              bgcolor: '#2563eb',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.92rem',
              textTransform: 'none',
              boxShadow: '0 4px 14px rgba(37,99,235,0.25)',
              '&:hover': { bgcolor: '#1d4ed8' },
            }}
          >
            {files.length === 0 ? 'Upload a file to continue' : 'Continue to Payment'}
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
              <span>Instant printer release</span>
            </Box>
            <span>•</span>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <span>⏱</span>
              <span>24h pickup window</span>
            </Box>
          </Box>
        </Box>
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
            <strong>Instant Counter Print:</strong> Show your Pickup Tag (e.g. 🎭 Cheerful Iris) to the shopkeeper. They will print your documents immediately.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHelpDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function UserPrintPage(props) {
  return (
    <CustomerAuthProvider>
      <UserPrintPageContent {...props} />
    </CustomerAuthProvider>
  );
}
