// src/pages/UserPrintPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link as RouterLink } from 'react-router-dom';
import {
  Container, Typography, Button, Box, Paper, List, CircularProgress,
  Alert, LinearProgress, Divider, Chip, IconButton, Tooltip, Stack, Card, CardContent,
  Switch, FormControlLabel, Tabs, Tab, TextField
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import BoltIcon from '@mui/icons-material/Bolt';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import StorefrontIcon from '@mui/icons-material/Storefront';
import PaymentsIcon from '@mui/icons-material/Payments';
import { QRCodeSVG } from 'qrcode.react';

import FileUploader from '../components/UserView/FileUploader';
import UploadedFileItem from '../components/UserView/UploadedFileItem';
import { createPrintJob, updatePrintJob, generatePrintJobId, createPrintJobWithId, getMerchantProfile } from '../supabase/db';
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
  formatFileSize
} from '../utils/fileValidation';

const UPI_NAME = 'QuickPrint';

export default function UserPrintPage() {
  const [searchParams] = useSearchParams();
  const merchantId = searchParams.get('merchantId');

  const [files, setFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [userIdentity, setUserIdentity] = useState(null);
  const [isMerchantOnline, setIsMerchantOnline] = useState(false);
  const [merchantProfile, setMerchantProfile] = useState(null);
  const [merchantLoadError, setMerchantLoadError] = useState(null);

  // Print for Later (24h Cloud Queue) & Customer Mobile
  const [printForLater, setPrintForLater] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');

  // Payment method selection tab for awaitingPayment state ('upi' or 'cash')
  const [paymentMethodTab, setPaymentMethodTab] = useState('upi');

  // Firestore listeners
  const { document: jobData, error: jobError } = useDocument('printJobs', jobId);

  // One-time cached fetch for merchant pricing and info + automatic recent shop recording
  useEffect(() => {
    let isMounted = true;
    if (!merchantId) {
      setMerchantLoadError('No shop selected. Please scan a QR code or enter a shop code.');
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
            shopName: profile.shopName || profile.shop_name || 'Print Shop',
            city: profile.city || profile.address || '',
          });
        } else {
          setMerchantLoadError('Shop details could not be found. Please check the shop code or scan the QR code again.');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to load merchant profile:', err);
        setMerchantLoadError('Unable to load shop details due to a network error. Please refresh the page.');
      });

    return () => {
      isMounted = false;
    };
  }, [merchantId]);

  // Get or create user identity on mount
  useEffect(() => {
    const identity = getOrCreateUserIdentity();
    setUserIdentity(identity);
  }, []);

  // Connect to Cloudflare DO Relay room only when files are selected and not in "Print for Later" mode
  useEffect(() => {
    if (!merchantId || files.length === 0 || printForLater) {
      realtimeRelay.disconnect();
      setIsMerchantOnline(false);
      return;
    }

    realtimeRelay.connect(merchantId, 'customer');

    const unsubscribe = realtimeRelay.subscribe((event) => {
      if (event.type === 'presence') {
        setIsMerchantOnline(Boolean(event.online));
      }
    });

    return () => {
      unsubscribe();
      realtimeRelay.disconnect();
    };
  }, [merchantId, files.length, printForLater]);

  // Total upload size in bytes
  const totalFilesSize = useMemo(() => {
    return files.reduce((acc, f) => acc + (f.file?.size || 0), 0);
  }, [files]);

  // Determine transfer mode: Mode 1 (Real-Time Fast Lane via Cloudflare) vs Mode 2 (Supabase Storage)
  // If user explicitly chooses "Print for Later", force Supabase cloud storage (24h retention)
  const isRealtimeEligible = !printForLater && isMerchantOnline && totalFilesSize <= REALTIME_MAX_SIZE && totalFilesSize > 0;

  // Pricing from merchant profile with sensible fallbacks
  const priceBW = merchantProfile?.pricePerPageBW ?? 2;
  const priceColor = merchantProfile?.pricePerPageColor ?? 5;

  // Calculate estimated cost, billable pages, bwPages and colorPages in a single memoized pass
  const { estimatedCost, totalPagesCount, bwPagesCount, colorPagesCount } = useMemo(() => {
    let cost = 0;
    let totalPages = 0;
    let bwPages = 0;
    let colorPages = 0;
    for (const f of files) {
      const pageCount = f.specs?.pageCount || 1;
      const billable = calculateBillablePages(pageCount, f.specs?.pages);
      const copies = Math.max(1, parseInt(f.specs?.copies, 10) || 1);
      const isColor = f.specs?.color === 'color';
      const filePages = billable * copies;
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
  }, [files, priceBW, priceColor]);

  const handleRegenerateName = () => {
    const newIdentity = regenerateUserName();
    setUserIdentity(newIdentity);
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
    // Process page count detection for each file
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
            pages: '',
            color: 'bw',
            sides: 'single',
            paperSize: 'a4',
            orientation: 'portrait',
            pageCount: detectedPages,
          },
        };
      })
    );

    setFiles((prev) => [...prev, ...fileEntries]);
  };

  const handleSpecChange = (fileId, newSpecs) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, specs: { ...f.specs, ...newSpecs } } : f))
    );
  };

  const handleRemoveFile = (fileId) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  // Mode 2: Upload file to Supabase Storage
  const uploadFileToSupabase = async (file, index, totalFiles) => {
    const fileName = `${merchantId}/${userIdentity.id}/${Date.now()}_${file.name}`;
    setUploadStatusText(`Uploading file ${index + 1} of ${totalFiles} to Cloud...`);

    const { error } = await supabase.storage
      .from('print-jobs')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw error;
    }

    // Storage bucket is public: getPublicUrl generates URL client-side with 0 network calls
    const { data } = supabase.storage
      .from('print-jobs')
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  // Submit print job (Dual Mode: Mode 1 Real-time Stream or Mode 2 Supabase Upload)
  const handleProceed = async () => {
    if (!merchantId || files.length === 0 || !userIdentity) {
      alert('Error: Missing merchant ID or files.');
      return;
    }

    if (totalFilesSize > MAX_TOTAL_SIZE) {
      alert(`Total files size exceeds 50MB maximum limit. Please remove some files.`);
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    let transportMode = isRealtimeEligible ? 'realtime' : 'supabase';

    try {
      const filesForJob = [];

      if (transportMode === 'realtime') {
        // --- MODE 1: Fast Direct Stream via Cloudflare Durable Object ---
        setUploadStatusText('Connecting real-time fast lane...');
        try {
          await realtimeRelay.ensureConnected(merchantId, 'customer');
        } catch (relayErr) {
          console.warn('Real-time fast lane connection failed, falling back to cloud queue:', relayErr);
          transportMode = 'supabase';
        }
      }

      if (transportMode === 'realtime') {
        // 1. Generate client-side jobId upfront
        const newJobId = generatePrintJobId();

        // 2. Prepare files metadata
        for (let i = 0; i < files.length; i++) {
          const entry = files[i];
          filesForJob.push({
            name: entry.file.name,
            size: entry.file.size,
            type: entry.file.type,
            pageCount: entry.specs.pageCount || 1,
            specs: entry.specs,
            fileUrl: null, // Zero cloud storage
          });
        }

        // 3. Stream binary chunks directly into merchant PC's IndexedDB
        for (let i = 0; i < files.length; i++) {
          const entry = files[i];
          setUploadStatusText(`Streaming "${entry.file.name}" in real-time...`);

          await realtimeRelay.streamFile(
            newJobId,
            i,
            entry.file,
            entry.specs,
            ({ progress }) => {
              const fileWeight = 100 / files.length;
              const overallProgress = (i * fileWeight) + (progress * fileWeight / 100);
              setUploadProgress(Math.min(99, overallProgress));
            }
          );
        }

        // 4. Notify merchant completion over WebSocket
        realtimeRelay.sendJobComplete(newJobId, {
          id: newJobId,
          userName: userIdentity.name,
          filesCount: files.length,
        });

        // 5. Commit to Firestore as 'pending' only AFTER 100% chunks have arrived on merchant PC
        await createPrintJobWithId(newJobId, {
          merchantId,
          orderId: userIdentity.id,
          userName: userIdentity.name,
          customerPhone: customerPhone ? customerPhone.trim() : null,
          files: filesForJob,
          transport: 'realtime',
          status: 'pending',
          estimatedCost,
          totalPages: totalPagesCount,
          bwPages: bwPagesCount,
          colorPages: colorPagesCount,
          paymentMethod: 'none',
          merchantUpiId: merchantProfile?.upiId || '',
          merchantName: merchantProfile?.shopName || UPI_NAME,
        });

        setUploadProgress(100);
        setJobId(newJobId);
        setFiles([]);

      } else {
        // --- MODE 2: Asynchronous Cloud Fallback via Supabase Storage ---
        setUploadStatusText('Uploading files to cloud queue...');

        // Concurrent pool (concurrency = 3) to drastically reduce multi-file upload time (Issue 11)
        const CONCURRENCY = 3;
        const filesForJob = new Array(files.length);
        let completedCount = 0;

        const uploadTask = async (index) => {
          const entry = files[index];
          const fileUrl = await uploadFileToSupabase(entry.file, index, files.length);

          filesForJob[index] = {
            name: entry.file.name,
            size: entry.file.size,
            type: entry.file.type,
            pageCount: entry.specs.pageCount || 1,
            specs: entry.specs,
            fileUrl,
          };

          completedCount++;
          setUploadProgress((completedCount / files.length) * 100);
          setUploadStatusText(`Uploaded ${completedCount} of ${files.length} file(s)...`);
        };

        // Execute uploads concurrently with pool limit
        let nextIndex = 0;
        const workers = Array.from({ length: Math.min(CONCURRENCY, files.length) }, async () => {
          while (nextIndex < files.length) {
            const current = nextIndex++;
            await uploadTask(current);
          }
        });

        await Promise.all(workers);

        const newJobRef = await createPrintJob({
          merchantId,
          orderId: userIdentity.id,
          userName: userIdentity.name,
          customerPhone: customerPhone ? customerPhone.trim() : null,
          files: filesForJob,
          transport: 'supabase',
          status: 'pending',
          estimatedCost,
          totalPages: totalPagesCount,
          bwPages: bwPagesCount,
          colorPages: colorPagesCount,
          paymentMethod: 'none',
          merchantUpiId: merchantProfile?.upiId || '',
          merchantName: merchantProfile?.shopName || UPI_NAME,
        });

        setUploadProgress(100);
        setJobId(newJobRef.id);
        setFiles([]);
      }

    } catch (error) {
      console.error('Error submitting print job:', error);
      alert(`There was an error sending your print job: ${error.message || 'Please try again'}`);
    } finally {
      setIsSubmitting(false);
      setUploadStatusText('');
    }
  };

  // Payment claimed step: Customer flags they sent the payment (UPI or Cash)
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

  // Fallback UI when merchantId is missing
  if (!merchantId) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, mb: 4, textAlign: 'center' }}>
        <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
          <StorefrontIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h5" gutterBottom fontWeight="bold">
            No Print Shop Selected
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            To print your documents, please scan the QR code displayed at your local print shop counter.
          </Typography>
          <Box sx={{ my: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
            <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
              <QrCodeScannerIcon color="primary" />
              <Typography variant="body2" fontWeight="medium">
                Point your mobile camera at the shop's QuickPrint standee
              </Typography>
            </Stack>
          </Box>
          <Button component={RouterLink} to="/" variant="outlined" sx={{ mt: 1 }}>
            Return to Home
          </Button>
        </Paper>
      </Container>
    );
  }

  // Loading identity
  if (!userIdentity) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Render job status tracking
  const renderJobStatus = () => {
    if (jobError) return <Alert severity="error">{jobError}</Alert>;
    if (!jobData) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>;

    switch (jobData.status) {
      case 'pending':
        return (
          <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
            <CircularProgress size={48} sx={{ mb: 2 }} />
            <Typography variant="h5" gutterBottom fontWeight="bold">
              Job Sent to Merchant!
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Waiting for the merchant to accept and print your documents...
            </Typography>
            <Stack direction="row" spacing={1} justifyContent="center">
              <Chip
                label={`Your Name: ${userIdentity?.name}`}
                color="primary"
                variant="outlined"
              />
              <Chip
                label={jobData.transport === 'realtime' ? '⚡ Real-Time Fast Lane' : '☁️ Cloud Queue'}
                color={jobData.transport === 'realtime' ? 'success' : 'info'}
                variant="filled"
              />
            </Stack>
          </Paper>
        );

      case 'processing':
        return (
          <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
            <CircularProgress size={48} sx={{ mb: 2, color: 'info.main' }} />
            <Typography variant="h5" gutterBottom fontWeight="bold" color="info.main">
              Printing in Progress...
            </Typography>
            <Typography color="text.secondary">
              The merchant is currently printing your documents.
            </Typography>
          </Paper>
        );

      case 'awaitingPayment': {
        const cost = Number(jobData?.cost ?? estimatedCost ?? 0);
        const upiUrl = generateUPIUrl(cost, jobData?.merchantUpiId, jobData?.merchantName);
        const displayUpiId = jobData?.merchantUpiId || merchantProfile?.upiId;
        const totalPgs = jobData?.totalPages ?? totalPagesCount;
        const bwPgs = jobData?.bwPages ?? bwPagesCount;
        const colorPgs = jobData?.colorPages ?? colorPagesCount;

        return (
          <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
            <Typography variant="h5" gutterBottom color="primary" fontWeight="bold">
              Payment Required
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total {totalPgs} page(s) ({bwPgs} B&W, {colorPgs} Color)
            </Typography>
            <Divider sx={{ my: 2 }} />

            <Typography variant="h3" sx={{ my: 1, fontWeight: 'bold' }}>
              ₹{cost.toFixed(2)}
            </Typography>

            {/* Payment Method Selector (UPI vs Cash) */}
            <Box sx={{ width: '100%', mb: 2 }}>
              <Tabs
                value={paymentMethodTab}
                onChange={(_, val) => setPaymentMethodTab(val)}
                centered
                sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
              >
                <Tab value="upi" icon={<QrCodeScannerIcon />} iconPosition="start" label="Pay via UPI" />
                <Tab value="cash" icon={<PaymentsIcon />} iconPosition="start" label="Pay Cash at Counter" />
              </Tabs>
            </Box>

            {paymentMethodTab === 'upi' ? (
              <Box sx={{ mt: 1 }}>
                {displayUpiId ? (
                  <>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Scan the QR code with any UPI app (GPay, PhonePe, Paytm) or tap below
                    </Typography>

                    <Box
                      sx={{
                        display: 'inline-block',
                        p: 2,
                        bgcolor: 'white',
                        borderRadius: 2,
                        border: '2px solid',
                        borderColor: 'primary.main',
                        mb: 2,
                      }}
                    >
                      <QRCodeSVG value={upiUrl} size={200} level="H" includeMargin />
                    </Box>

                    <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 2 }}>
                      Merchant UPI ID: {displayUpiId}
                    </Typography>

                    <Button
                      variant="contained"
                      size="large"
                      fullWidth
                      href={upiUrl}
                      sx={{
                        mb: 2,
                        py: 1.5,
                        bgcolor: '#5f259f',
                        '&:hover': { bgcolor: '#4a1d7a' },
                      }}
                    >
                      Pay ₹{cost.toFixed(2)} with UPI App
                    </Button>

                    <Button
                      variant="outlined"
                      size="large"
                      fullWidth
                      onClick={() => handleClaimPayment('upi')}
                      sx={{ py: 1.5 }}
                    >
                      I've Completed UPI Payment
                    </Button>
                  </>
                ) : (
                  <Box sx={{ py: 2 }}>
                    <Alert severity="info" sx={{ mb: 2 }}>
                      Digital UPI is not configured for this shop. Please switch to <strong>Pay Cash at Counter</strong>.
                    </Alert>
                    <Button
                      variant="contained"
                      color="success"
                      onClick={() => setPaymentMethodTab('cash')}
                    >
                      Switch to Cash Payment
                    </Button>
                  </Box>
                )}
              </Box>
            ) : (
              <Box sx={{ mt: 2 }}>
                <Paper variant="outlined" sx={{ p: 3, mb: 3, bgcolor: 'grey.50', borderRadius: 2 }}>
                  <PaymentsIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Hand Cash to Merchant
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Please pay <strong>₹{cost.toFixed(2)}</strong> in cash directly at the shop counter. Once handed over, tap the button below so the merchant can confirm and release your printouts.
                  </Typography>
                </Paper>

                <Button
                  variant="contained"
                  color="success"
                  size="large"
                  fullWidth
                  onClick={() => handleClaimPayment('cash')}
                  sx={{ py: 1.5, fontWeight: 'bold' }}
                >
                  I'm Paying ₹{cost.toFixed(2)} Cash at Counter
                </Button>
              </Box>
            )}
          </Paper>
        );
      }

      case 'paymentClaimed': {
        const isCash = jobData.paymentMethod === 'cash';
        return (
          <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, bgcolor: isCash ? '#f1f8e9' : '#fff8e1' }}>
            <HourglassTopIcon sx={{ fontSize: 52, color: isCash ? 'success.main' : 'warning.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom fontWeight="bold" color={isCash ? 'success.dark' : 'warning.dark'}>
              {isCash ? 'Cash Payment Requested' : 'Payment Sent! Verifying...'}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              {isCash
                ? `Please hand ₹${Number(jobData?.cost ?? estimatedCost ?? 0).toFixed(2)} in cash to the shopkeeper. They will hand you your printouts upon confirmation.`
                : 'The merchant is confirming your digital UPI payment. Your printout will be ready for pickup in a moment.'}
            </Typography>
            <Stack direction="row" spacing={1} justifyContent="center">
              <Chip
                label={`Job #${jobId?.slice(-6) || ''}`}
                variant="outlined"
                color={isCash ? 'success' : 'warning'}
              />
              <Chip
                label={isCash ? '💵 Cash at Counter' : '📱 UPI Payment'}
                color={isCash ? 'success' : 'primary'}
                variant="filled"
              />
            </Stack>
          </Paper>
        );
      }

      case 'paid':
      case 'completed': {
        const isCash = jobData?.paymentMethod === 'cash';
        const totalPgs = jobData?.totalPages ?? totalPagesCount;
        const bwPgs = jobData?.bwPages ?? bwPagesCount;
        const colorPgs = jobData?.colorPages ?? colorPagesCount;

        return (
          <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#e8f5e9', borderRadius: 2 }}>
            <CheckCircleOutlineIcon sx={{ fontSize: 56, color: 'success.main', mb: 1 }} />
            <Typography variant="h5" gutterBottom fontWeight="bold" color="success.main">
              Print Job Complete!
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Payment confirmed (₹{Number(jobData?.cost ?? estimatedCost ?? 0).toFixed(2)}). Please collect your printouts from the counter.
            </Typography>
            <Stack direction="row" spacing={1} justifyContent="center" sx={{ mb: 3 }}>
              <Chip
                label={isCash ? '💵 Paid Cash' : '📱 Paid via UPI'}
                color="success"
                size="small"
              />
              <Chip
                label={`${totalPgs} page(s) (${bwPgs} B&W, ${colorPgs} Color)`}
                variant="outlined"
                size="small"
              />
            </Stack>
            <Button
              variant="contained"
              color="success"
              onClick={() => {
                setJobId(null);
                setFiles([]);
              }}
            >
              Print More Documents
            </Button>
          </Paper>
        );
      }

      default:
        return (
          <Paper sx={{ p: 3 }}>
            <Typography>Status: {jobData.status}</Typography>
          </Paper>
        );
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 3, mb: 5 }}>
      {merchantLoadError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {merchantLoadError}
        </Alert>
      )}

      {/* Merchant Header & Identity Banner */}
      <Card sx={{ mb: 3, borderRadius: 2, boxShadow: 1 }}>
        <CardContent sx={{ pb: '16px !important' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Box>
              <Typography variant="h6" fontWeight="bold">
                {merchantProfile?.shopName || 'QuickPrint Shop'}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: isMerchantOnline ? 'success.main' : 'grey.400',
                  }}
                />
                <Typography variant="caption" color={isMerchantOnline ? 'success.main' : 'text.secondary'} fontWeight="600">
                  {isMerchantOnline ? 'Merchant Online' : 'Merchant Offline'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  • ₹{priceBW}/pg B&W • ₹{priceColor}/pg Color
                </Typography>
              </Stack>
            </Box>

            <Paper
              variant="outlined"
              sx={{
                px: 1.5,
                py: 0.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                bgcolor: 'grey.50',
                borderRadius: 2,
              }}
            >
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  Your Pickup Tag
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  🎭 {userIdentity.name}
                </Typography>
              </Box>
              <Tooltip title="Change pickup tag">
                <IconButton size="small" onClick={handleRegenerateName}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Paper>
          </Box>
        </CardContent>
      </Card>

      {/* Main Flow: Upload or Status */}
      {jobId ? (
        renderJobStatus()
      ) : (
        <>
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Upload Documents
          </Typography>

          {/* Mode Indicator Banner */}
          <Alert
            severity={printForLater ? 'info' : (isRealtimeEligible ? 'success' : 'info')}
            icon={printForLater ? <CloudQueueIcon /> : (isRealtimeEligible ? <BoltIcon /> : <CloudQueueIcon />)}
            sx={{ mb: 3, borderRadius: 2 }}
          >
            {printForLater ? (
              <Box>
                <strong>Mode 2: Cloud Queue (Print for Later — 24h Expiration)</strong>
                <Typography variant="body2">
                  Files are saved securely in the Cloud for 24 hours. The merchant can print them when you arrive at the counter.
                </Typography>
              </Box>
            ) : isRealtimeEligible ? (
              <Box>
                <strong>Mode 1: Fast Direct Transfer (Instant Print)</strong>
                <Typography variant="body2">
                  Merchant is online and files are under 25MB. Files stream directly to merchant PC with zero delay via Cloudflare relay.
                </Typography>
              </Box>
            ) : (
              <Box>
                <strong>Mode 2: Cloud Queue (Print when ready — 24h Expiration)</strong>
                <Typography variant="body2">
                  {isMerchantOnline
                    ? 'Total files exceed 25MB. Uploading securely to Cloud Storage.'
                    : 'Merchant dashboard is offline. Files will be queued in the Cloud for 24 hours and printed once online.'}
                </Typography>
              </Box>
            )}
          </Alert>

          {/* Print for Later (24h Cloud Queue) Option */}
          <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: printForLater ? '#f0f7ff' : '#fafafa' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <CloudQueueIcon color={printForLater ? 'primary' : 'action'} />
                <Box>
                  <Typography variant="subtitle2" fontWeight="bold">
                    Print for Later (24-Hour Cloud Queue)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Send files to shop queue now, print when you reach the shop. Files auto-expire in 24 hours.
                  </Typography>
                </Box>
              </Box>
              <Switch
                checked={printForLater}
                onChange={(e) => setPrintForLater(e.target.checked)}
                color="primary"
              />
            </Box>

            {printForLater && (
              <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px dashed #ccc' }}>
                <TextField
                  label="Contact Mobile Number (Optional)"
                  placeholder="10-digit mobile number"
                  size="small"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  helperText="Shopkeeper can look up your queued files using your phone or pickup tag"
                  sx={{ maxWidth: 360 }}
                />
              </Box>
            )}
          </Paper>

          <Paper elevation={1} sx={{ p: 2, mb: 3, borderRadius: 2 }}>
            <FileUploader onFilesAdded={handleFilesAdded} />
          </Paper>

          {files.length > 0 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="h6" fontWeight="bold">
                  Files to Print ({files.length})
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Total Size: {formatFileSize(totalFilesSize)} / 50MB
                </Typography>
              </Box>

              <List disablePadding>
                {files.map((fileEntry) => (
                  <UploadedFileItem
                    key={fileEntry.id}
                    fileEntry={fileEntry}
                    onSpecChange={handleSpecChange}
                    onRemove={handleRemoveFile}
                  />
                ))}
              </List>

              {isSubmitting && (
                <Paper sx={{ p: 2, my: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                  <Typography variant="body2" color="primary" fontWeight="bold" gutterBottom>
                    {uploadStatusText || 'Transferring files...'} ({Math.round(uploadProgress)}%)
                  </Typography>
                  <LinearProgress variant="determinate" value={uploadProgress} sx={{ height: 8, borderRadius: 4 }} />
                </Paper>
              )}

              {/* Bottom Submit Bar */}
              <Paper
                elevation={3}
                sx={{
                  p: 2.5,
                  mt: 3,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                }}
              >
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Total: {totalPagesCount} page(s) ({bwPagesCount} B&W, {colorPagesCount} Color)
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="primary">
                    Estimated: ₹{(estimatedCost ?? 0).toFixed(2)}
                  </Typography>
                </Box>

                <Button
                  variant="contained"
                  size="large"
                  onClick={handleProceed}
                  disabled={isSubmitting || files.length === 0}
                  startIcon={printForLater ? <CloudQueueIcon /> : (isRealtimeEligible ? <BoltIcon /> : <CloudQueueIcon />)}
                  sx={{ px: 4, py: 1.2, fontWeight: 'bold' }}
                >
                  {isSubmitting
                    ? 'Sending...'
                    : printForLater
                    ? 'Queue in Cloud (24h)'
                    : isRealtimeEligible
                    ? 'Instant Stream & Print'
                    : 'Send to Print Queue'}
                </Button>
              </Paper>
            </Box>
          )}
        </>
      )}
    </Container>
  );
}
