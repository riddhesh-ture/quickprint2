// src/pages/MerchantDashboardPage.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Container, Typography, Box, Alert, CircularProgress, Dialog, DialogContent,
  LinearProgress, Tabs, Tab, Paper, Chip, Card, CardContent, Grid, IconButton,
  Tooltip, Fade, Snackbar, Stack
} from '@mui/material';
import { useNavigate, useOutletContext } from 'react-router-dom';
import PrintQueue from '../components/MerchantView/PrintQueue';
import { 
  updatePrintJob, 
  deletePrintJob, 
  confirmPaymentAndIncrementStats, 
  completePrintJob, 
  incrementMerchantStats 
} from '../supabase/db';
import { useAuth } from '../hooks/useAuth';
import { useCollection } from '../hooks/useSupabase';
import { deleteFileFromStorage, deleteMultipleFilesFromStorage } from '../supabase/client';
import { securePrint, preOpenPrintWindow } from '../utils/securePrint';
import { calculateBillablePages, getPdfPageCount } from '../utils/fileValidation';
import { realtimeRelay } from '../utils/realtimeRelay';
import { getJobBlob, deleteJobBlobs } from '../utils/localJobStorage';

import RefreshIcon from '@mui/icons-material/Refresh';
import PrintIcon from '@mui/icons-material/Print';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import PaymentIcon from '@mui/icons-material/Payment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TodayIcon from '@mui/icons-material/Today';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import SecurityIcon from '@mui/icons-material/Security';
import BoltIcon from '@mui/icons-material/Bolt';

const QuickStatCard = ({ title, value, icon, color = 'primary', subtitle }) => (
  <Card sx={{ height: '100%', borderTop: 3, borderColor: `${color}.main` }}>
    <CardContent sx={{ py: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {title}
          </Typography>
          <Typography variant="h4" fontWeight="bold" color={`${color}.main`}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: `${color}.lighter`, color: `${color}.main` }}>
          {icon}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

export default function MerchantDashboardPage() {
  const { user, userData, loading } = useAuth();
  const navigate = useNavigate();
  const isMountedRef = useRef(true);
  const [processingJobId, setProcessingJobId] = useState(null);
  const [printProgress, setPrintProgress] = useState({ current: 0, total: 0, fileName: '', status: '' });
  const [activeTab, setActiveTab] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [isRelayConnected, setIsRelayConnected] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!loading && userData && userData.role !== 'merchant') {
      navigate('/', { replace: true });
    }
  }, [user, userData, loading, navigate]);

  const merchantId = user?.uid;
  const merchantName = userData?.shopName || 'QuickPrint';
  const pricePerPageBW = userData?.pricePerPageBW ?? 2;
  const pricePerPageColor = userData?.pricePerPageColor ?? 5;

  // Connect to Cloudflare DO Relay room as role=merchant with verified token
  useEffect(() => {
    if (!merchantId) return;

    let isMounted = true;

    // Provide tokenProvider so automatic WebSocket reconnects always fetch a fresh Firebase token
    realtimeRelay.setTokenProvider(async () => {
      if (user && typeof user.getIdToken === 'function') {
        try {
          return await user.getIdToken();
        } catch (e) {
          console.warn('Could not refresh Firebase token for relay auth:', e);
        }
      }
      return null;
    });

    const initRelay = async () => {
      let token = null;
      if (user && typeof user.getIdToken === 'function') {
        try {
          token = await user.getIdToken();
        } catch (e) {
          console.warn('Could not get Firebase token for relay auth:', e);
        }
      }
      if (isMounted) {
        realtimeRelay.connect(merchantId, 'merchant', token);
      }
    };

    initRelay();

    const unsubscribe = realtimeRelay.subscribe((event) => {
      if (!isMountedRef.current) return;
      if (event.type === 'connection_change') {
        setIsRelayConnected(Boolean(event.connected));
      } else if (event.type === 'session_replaced') {
        setSnackbar({
          open: true,
          message: '⚠️ Relay session paused: QuickPrint dashboard opened in another tab.',
          severity: 'warning',
        });
      } else if (event.type === 'transfer_start') {
        setSnackbar({
          open: true,
          message: `⚡ Receiving real-time file: ${event.fileName}`,
          severity: 'info',
        });
      } else if (event.type === 'job_submitted') {
        setSnackbar({
          open: true,
          message: `⚡ New real-time job received from customer!`,
          severity: 'success',
        });
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
      realtimeRelay.disconnect();
    };
  }, [merchantId, user]);

  // Scope Realtime live job subscription directly to the dashboard page where queue is rendered
  const outletCtx = useOutletContext();
  const { documents: jobs, error, refetch: refreshJobs } = useCollection('printJobs', {
    fieldName: 'merchantId',
    operator: '==',
    value: merchantId,
  }, 100);

  // Sync live pending count with layout drawer badge
  useEffect(() => {
    if (jobs && outletCtx?.setPendingCount) {
      const count = jobs.filter(j => j.status === 'pending').length;
      outletCtx.setPendingCount(count);
    }
  }, [jobs, outletCtx]);

  if (loading || !userData) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  }

  if (userData.role !== 'merchant') return null;

  const { pendingJobs, processingJobs, awaitingPaymentJobs, completedJobs, paymentClaimedCount } = useMemo(() => {
    const list = jobs || [];
    const pending = [];
    const processing = [];
    const awaitingPayment = [];
    const completed = [];
    let paymentClaimed = 0;

    for (const j of list) {
      if (j.status === 'pending') pending.push(j);
      else if (j.status === 'processing') processing.push(j);
      else if (j.status === 'awaitingPayment') awaitingPayment.push(j);
      else if (j.status === 'paymentClaimed') {
        awaitingPayment.push(j);
        paymentClaimed++;
      } else if (j.status === 'paid' || j.status === 'completed') {
        completed.push(j);
      }
    }

    return {
      pendingJobs: pending,
      processingJobs: processing,
      awaitingPaymentJobs: awaitingPayment,
      completedJobs: completed,
      paymentClaimedCount: paymentClaimed,
    };
  }, [jobs]);

  // Update merchant stats in Supabase
  const updateMerchantStats = async (cost, pages) => {
    try {
      await incrementMerchantStats(merchantId, pages, cost);
    } catch (e) {
      console.error('Stats update error:', e);
    }
  };

  // Safely cleanup files for a job when finished or deleted
  const cleanupJobFiles = async (job) => {
    if (!job) return;
    try {
      // 1. Purge locally stored blobs from IndexedDB
      if (job.transport === 'realtime') {
        await deleteJobBlobs(job.id);
      }

      // 2. Purge cloud files from Supabase Storage in single batch call
      if (job.files && Array.isArray(job.files)) {
        const fileUrls = job.files.map((f) => f.fileUrl).filter(Boolean);
        if (fileUrls.length > 0) {
          await deleteMultipleFilesFromStorage(fileUrls);
        }
      }
    } catch (err) {
      console.error('Error cleaning up job files:', err);
    }
  };

  // Handle accepting and printing a job
  const handleAcceptJob = async (job) => {
    // 1. SYNCHRONOUSLY pre-open print window to bypass popup blockers completely!
    const printWin = preOpenPrintWindow(`Print Job - ${job.userName || 'Customer'}`);

    setProcessingJobId(job.id);
    setPrintProgress({ current: 0, total: job.files.length, fileName: '', status: 'Starting...' });

    // 2. Accurate Multi-Page Billing: calculate cost = pages * copies * rate
    let totalCost = 0;
    let totalPages = 0;

    for (const file of job.files) {
      const pageCount = file.pageCount || file.specs?.pageCount || 1;
      const billable = calculateBillablePages(pageCount, file.specs?.pages);
      const copies = parseInt(file.specs?.copies, 10) || 1;
      const pricePerPage = file.specs?.color === 'color' ? pricePerPageColor : pricePerPageBW;
      totalCost += billable * copies * pricePerPage;
      totalPages += billable * copies;
    }

    // Update status to processing in Firestore/Supabase
    try {
      await updatePrintJob(job.id, { status: 'processing' });
    } catch (statusErr) {
      console.warn('Could not update job status to processing:', statusErr);
    }

    const failedFiles = [];

    try {
      for (let i = 0; i < job.files.length; i++) {
        const file = job.files[i];
        let fileDetectedPages = file.pageCount || file.specs?.pageCount || 1;

        setPrintProgress({
          current: i + 1,
          total: job.files.length,
          fileName: file.name,
          status: job.transport === 'realtime' ? 'Loading from local cache...' : 'Downloading from cloud...',
        });

        try {
          let fileBlob = null;

          // Retrieve file blob based on transport mode
          if (job.transport === 'realtime') {
            // Mode 1: Retrieve straight from merchant PC IndexedDB
            fileBlob = await getJobBlob(job.id, i);

            // Fallback to URL if blob was missing
            if (!fileBlob && file.fileUrl) {
              const res = await fetch(file.fileUrl);
              if (res.ok) fileBlob = await res.blob();
            }
          } else {
            // Mode 2: Download from Supabase Storage with retry logic (Issue 12)
            let response = null;
            let lastErr = null;
            for (let attempt = 1; attempt <= 3; attempt++) {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 15000);
              try {
                response = await fetch(file.fileUrl, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (response.ok) break;
                lastErr = new Error(`Download failed: HTTP ${response.status}`);
              } catch (fetchErr) {
                clearTimeout(timeoutId);
                lastErr = fetchErr;
              }
              if (attempt < 3) {
                await new Promise(r => setTimeout(r, attempt * 1000));
              }
            }

            if (!response || !response.ok) {
              throw (lastErr || new Error('Download failed after 3 attempts'));
            }
            fileBlob = await response.blob();
          }

          if (!fileBlob) {
            throw new Error('File data unavailable. Please ask customer to resend.');
          }

          // If page count wasn't detected earlier and it's a PDF, detect now
          if ((!file.pageCount || file.pageCount === 1) && (file.name.endsWith('.pdf') || file.type === 'application/pdf')) {
            try {
              const actualPages = await getPdfPageCount(fileBlob);
              if (actualPages > 1) {
                // Recompute cost with accurate pages (Issue 6)
                const oldBillable = calculateBillablePages(fileDetectedPages, file.specs?.pages);
                const newBillable = calculateBillablePages(actualPages, file.specs?.pages);
                const copies = parseInt(file.specs?.copies, 10) || 1;
                const pricePerPage = file.specs?.color === 'color' ? pricePerPageColor : pricePerPageBW;
                totalCost += (newBillable - oldBillable) * copies * pricePerPage;
                totalPages += (newBillable - oldBillable) * copies;
                fileDetectedPages = actualPages; // Maintain accurately detected pages
              }
            } catch {
              // ignore
            }
          }

          const copies = parseInt(file.specs?.copies, 10) || 1;

          setPrintProgress(prev => ({ ...prev, status: 'Printing...' }));

          // Execute secure printing using the pre-opened window or hidden iframe
          for (let c = 0; c < copies; c++) {
            if (copies > 1) {
              setPrintProgress(prev => ({
                ...prev,
                status: `Printing copy ${c + 1} of ${copies}...`,
              }));
            }
            await securePrint(
              fileBlob,
              file.name,
              file.specs,
              merchantName,
              (i === 0 && c === 0 && printWin && !printWin.closed) ? printWin : null
            );
          }

          // Note: Files are NOT deleted here; they are safely retained until job completion/deletion!

        } catch (fileError) {
          console.error(`Error processing file ${file.name}:`, fileError);
          // Deduct unprinted file from total bill so customer is only charged for printed documents
          // Uses fileDetectedPages to avoid overcharging when late detection succeeded (Issue 6)
          const billable = calculateBillablePages(fileDetectedPages, file.specs?.pages);
          const copies = parseInt(file.specs?.copies, 10) || 1;
          const pricePerPage = file.specs?.color === 'color' ? pricePerPageColor : pricePerPageBW;
          totalCost = Math.max(0, totalCost - (billable * copies * pricePerPage));
          totalPages = Math.max(0, totalPages - (billable * copies));
          failedFiles.push({ name: file.name, error: fileError.message });
        }
      }

      // Get UPI ID (must be configured by merchant; never fallback to sample address)
      const upiId = userData?.upiId || userData?.upi_id || '';

      // Check if all files failed or totalCost is 0 (Issue 7: prevent zero-cost awaitingPayment state)
      const allFilesFailed = failedFiles.length === job.files.length || totalPages === 0;
      const nextStatus = allFilesFailed ? 'cancelled' : 'awaitingPayment';

      // Update job with accurate bill
      const updateData = {
        status: nextStatus,
        cost: totalCost,
        totalPages,
        merchantUpiId: upiId,
        merchantName,
        processedAt: new Date().toISOString(),
      };

      if (failedFiles.length > 0) {
        updateData.failedFiles = failedFiles;
      }

      await updatePrintJob(job.id, updateData);

      if (allFilesFailed) {
        setSnackbar({
          open: true,
          message: `❌ Printing failed: All ${job.files.length} document(s) encountered errors.`,
          severity: 'error',
        });
      } else {
        setSnackbar({
          open: true,
          message: failedFiles.length === 0
            ? `✅ Printed ${totalPages} page(s). Total: ₹${totalCost.toFixed(2)}. Awaiting customer payment.`
            : `⚠️ Printed with ${failedFiles.length} issue(s). Total: ₹${totalCost.toFixed(2)}. Awaiting customer payment.`,
          severity: failedFiles.length === 0 ? 'success' : 'warning',
        });
      }

    } catch (e) {
      console.error('Job processing error:', e);
      if (printWin && !printWin.closed) printWin.close();

      if (isMountedRef.current) {
        setSnackbar({
          open: true,
          message: `Error: ${e.message}`,
          severity: 'error',
        });
      }

      try {
        await updatePrintJob(job.id, { status: 'pending' });
      } catch (revertErr) {
        console.error('Failed to revert job status to pending:', revertErr);
      }
    } finally {
      if (isMountedRef.current) {
        setProcessingJobId(null);
        setPrintProgress({ current: 0, total: 0, fileName: '', status: '' });
      }
    }
  };

  // 1-Click "Done (Paid)" workflow: confirms payment, increments stats, completes job, and purges IndexedDB blobs
  const handleDonePaid = async (job) => {
    if (!job) return;
    try {
      await confirmPaymentAndIncrementStats(job.id, merchantId, job.cost || 0, job.totalPages || 1);
      await completePrintJob(job.id);
      await cleanupJobFiles(job);
      setSnackbar({
        open: true,
        message: `Job ${job.id.slice(-6)} marked Done (Paid) & memory purged!`,
        severity: 'success',
      });
    } catch (e) {
      console.error('Done (Paid) workflow error:', e);
      setSnackbar({ open: true, message: 'Failed to complete job', severity: 'error' });
    }
  };

  // Merchant verifies customer's payment claim
  const handleConfirmPayment = async (jobId) => {
    const job = jobs?.find(j => j.id === jobId);
    try {
      if (job) {
        await confirmPaymentAndIncrementStats(jobId, merchantId, job.cost || 0, job.totalPages || 1);
      } else {
        await updatePrintJob(jobId, { status: 'paid', paidAt: new Date() });
      }

      setSnackbar({
        open: true,
        message: 'Payment confirmed! Ready for customer pickup.',
        severity: 'success',
      });
    } catch (e) {
      console.error('Payment confirmation error:', e);
      setSnackbar({ open: true, message: 'Failed to confirm payment', severity: 'error' });
    }
  };

  // Merchant marks job as completed -> Safe file purging happens in parallel!
  const handleCompleteJob = async (jobId) => {
    const job = jobs?.find(j => j.id === jobId);
    try {
      // Execute database update via atomic RPC and storage cleanup concurrently
      await Promise.all([
        completePrintJob(jobId, merchantId),
        cleanupJobFiles(job)
      ]);

      setSnackbar({ open: true, message: 'Job completed and files securely purged', severity: 'success' });
    } catch (e) {
      setSnackbar({ open: true, message: 'Failed to update job', severity: 'error' });
    }
  };

  // Delete job
  const handleDeleteJob = async (jobId) => {
    if (!window.confirm('Are you sure you want to delete this print job?')) return;
    const job = jobs?.find(j => j.id === jobId);

    try {
      await deletePrintJob(jobId);
      await cleanupJobFiles(job);
      setSnackbar({ open: true, message: 'Job and files deleted', severity: 'info' });
    } catch (e) {
      setSnackbar({ open: true, message: 'Failed to delete job', severity: 'error' });
    }
  };

  const getTabJobs = () => {
    switch (activeTab) {
      case 0: return [...pendingJobs, ...processingJobs];
      case 1: return awaitingPaymentJobs;
      case 2: return completedJobs;
      default: return [];
    }
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 3, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold">
            Print Jobs
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <SecurityIcon sx={{ fontSize: 16, color: 'success.main' }} />
              <Typography variant="body2" color="text.secondary">
                Zero Cloud Storage for files ≤ 25MB • Auto-purged on complete
              </Typography>
            </Box>
            <Chip
              icon={<BoltIcon sx={{ fontSize: 16 }} />}
              label={isRelayConnected ? 'Relay Fast Lane Online' : 'Connecting Relay...'}
              color={isRelayConnected ? 'success' : 'default'}
              size="small"
              variant="outlined"
            />
          </Stack>
        </Box>
        <Tooltip title="Refresh Print Jobs">
          <IconButton onClick={() => refreshJobs?.()} color="primary">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Quick Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <QuickStatCard
            title="Pending"
            value={pendingJobs.length}
            icon={<HourglassEmptyIcon />}
            color="warning"
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <QuickStatCard
            title="Payment"
            value={awaitingPaymentJobs.length}
            subtitle={paymentClaimedCount > 0 ? `${paymentClaimedCount} claimed` : undefined}
            icon={<PaymentIcon />}
            color={paymentClaimedCount > 0 ? 'error' : 'info'}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <QuickStatCard
            title="Today's Prints"
            value={userData?.stats?.todayPrints || 0}
            icon={<TodayIcon />}
            color="success"
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <QuickStatCard
            title="Today's Earnings"
            value={`₹${(userData?.stats?.todayEarnings || 0).toFixed(2)}`}
            icon={<AttachMoneyIcon />}
            color="primary"
          />
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          variant="fullWidth"
          sx={{ '& .MuiTab-root': { py: 2 } }}
        >
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PrintIcon fontSize="small" />
                <span>Pending</span>
                {pendingJobs.length > 0 && (
                  <Chip label={pendingJobs.length} size="small" color="warning" />
                )}
              </Box>
            }
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PaymentIcon fontSize="small" />
                <span>Awaiting Payment</span>
                {awaitingPaymentJobs.length > 0 && (
                  <Chip
                    label={awaitingPaymentJobs.length}
                    size="small"
                    color={paymentClaimedCount > 0 ? 'error' : 'info'}
                  />
                )}
              </Box>
            }
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleIcon fontSize="small" />
                <span>Completed</span>
                <Chip label={completedJobs.length} size="small" color="success" variant="outlined" />
              </Box>
            }
          />
        </Tabs>
      </Paper>

      {/* Error Alert */}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Print Queue */}
      <Fade in={true}>
        <Box>
          <PrintQueue
            jobs={getTabJobs()}
            onAcceptJob={handleAcceptJob}
            onCompleteJob={handleCompleteJob}
            onConfirmPayment={handleConfirmPayment}
            onDonePaid={handleDonePaid}
            onDeleteJob={handleDeleteJob}
            processingJobId={processingJobId}
          />
        </Box>
      </Fade>

      {/* Processing Dialog */}
      <Dialog open={!!processingJobId} maxWidth="sm" fullWidth>
        <DialogContent sx={{ textAlign: 'center', py: 4 }}>
          <SecurityIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
          <CircularProgress size={60} sx={{ mb: 2, display: 'block', mx: 'auto' }} />
          <Typography variant="h6" gutterBottom>
            Secure Print in Progress
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {printProgress.fileName}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            {printProgress.status}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            File {printProgress.current} of {printProgress.total}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={printProgress.total ? (printProgress.current / printProgress.total) * 100 : 0}
            sx={{ height: 8, borderRadius: 4 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            🔒 Safe transfer: files are kept locally and deleted on job completion
          </Typography>
        </DialogContent>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}