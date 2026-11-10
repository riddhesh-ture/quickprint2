// src/pages/MerchantDashboardPage.jsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Container,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
  Button,
  Tooltip,
  Snackbar,
  Stack,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { useNavigate, useOutletContext } from 'react-router-dom';
import MerchantQueueList from '../components/MerchantView/MerchantQueueList';
import MerchantHistoryDrawer from '../components/MerchantView/MerchantHistoryDrawer';
import { StatsOverview } from '../components/MerchantView/QuickStatCard';
import ProcessingDialog from '../components/MerchantView/ProcessingDialog';
import ManualDuplexModal from '../components/MerchantView/ManualDuplexModal';

// Lazy-load heavy PDF Document Editor Modal (only loaded on demand when opened on desktop)
const DocumentEditorModal = React.lazy(() => import('../components/Editor/DocumentEditorModal'));
import { useAuth } from '../hooks/useAuth';
import { useCollection } from '../hooks/useSupabase';
import { useMerchantRelay, playChime } from '../hooks/useMerchantRelay';
import { usePrintJobManager } from '../hooks/usePrintJobManager';
import { cleanupStaleJobBlobs } from '../utils/localJobStorage';

import RefreshIcon from '@mui/icons-material/Refresh';
import HistoryIcon from '@mui/icons-material/History';
import SecurityIcon from '@mui/icons-material/Security';
import BoltIcon from '@mui/icons-material/Bolt';
import PrintIcon from '@mui/icons-material/Print';

export default function MerchantDashboardPage() {
  const { user, userData, loading } = useAuth();
  const navigate = useNavigate();
  const outletCtx = useOutletContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isDesktopApp = typeof window !== 'undefined' && Boolean(window.quickprintDesktop?.isDesktop);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null); // { job, fileIndex }
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  // Guard merchant authentication & purge stale local blobs older than 24h
  useEffect(() => {
    cleanupStaleJobBlobs().catch(() => {});
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

  // Supabase live collection query
  const { documents: jobs, error, refetch: refreshJobs } = useCollection(
    'printJobs',
    {
      fieldName: 'merchantId',
      operator: '==',
      value: merchantId,
    },
    100
  );

  // Relay connection & presence
  const { isRelayConnected, relayNotice, clearRelayNotice } = useMerchantRelay(
    merchantId,
    user,
    () => refreshJobs?.()
  );

  // Print execution & job management
  const {
    processingJobId,
    printProgress,
    actionNotice,
    clearActionNotice,
    manualDuplexPrompt,
    closeManualDuplexPrompt,
    cancelProcessing,
    handlePrint,
    handleDone,
    handleDelete,
    handleSaveJobEdits,
    handleRevertJobEdits,
    daemonState,
    refreshDaemonStatus,
    selectPrinter,
  } = usePrintJobManager(merchantId, merchantName, pricePerPageBW, pricePerPageColor);

  // Optimistic tracking for instant queue removal upon Done / Delete
  const [removedJobIds, setRemovedJobIds] = useState(() => new Set());

  const onDoneJob = useCallback((job) => {
    if (!job?.id) return;
    setRemovedJobIds((prev) => new Set(prev).add(job.id));
    handleDone(job);
  }, [handleDone]);

  const onDeleteJob = useCallback((jobId) => {
    if (!jobId) return;
    setRemovedJobIds((prev) => new Set(prev).add(jobId));
    handleDelete(jobId);
  }, [handleDelete]);

  // Separate active queue vs completed history
  const { activeJobs, completedJobs } = useMemo(() => {
    const list = jobs || [];
    const active = [];
    const completed = [];

    for (const j of list) {
      if (removedJobIds.has(j.id) || j.status === 'completed' || j.status === 'paid') {
        completed.push(j);
      } else if (j.status !== 'cancelled') {
        active.push(j);
      }
    }

    return { activeJobs: active, completedJobs: completed };
  }, [jobs, removedJobIds]);

  // Audio chime on new incoming job in queue
  const prevCountRef = useRef(null);
  useEffect(() => {
    if (prevCountRef.current !== null && activeJobs.length > prevCountRef.current) {
      playChime();
    }
    prevCountRef.current = activeJobs.length;
  }, [activeJobs.length]);

  // Sync layout drawer badge with active queue count
  useEffect(() => {
    if (outletCtx?.setPendingCount) {
      outletCtx.setPendingCount(activeJobs.length);
    }
  }, [activeJobs.length, outletCtx]);

  // Sync notices to snackbar
  useEffect(() => {
    if (relayNotice) {
      setSnackbar({ open: true, message: relayNotice.message, severity: relayNotice.severity });
      clearRelayNotice();
    }
  }, [relayNotice, clearRelayNotice]);

  useEffect(() => {
    if (actionNotice) {
      setSnackbar({ open: true, message: actionNotice.message, severity: actionNotice.severity });
      clearActionNotice();
    }
  }, [actionNotice, clearActionNotice]);

  // Spacebar quick shortcut: prints first pending or completes first printed job
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (e.code === 'Space') {
        if (processingJobId || activeJobs.length === 0) return;
        e.preventDefault();
        const topJob = activeJobs[0];
        if (topJob.status === 'printed' || topJob.status === 'awaitingPayment') {
          onDoneJob(topJob);
        } else {
          handlePrint(topJob);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeJobs, processingJobId, onDoneJob, handlePrint]);

  if (loading || !userData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (userData.role !== 'merchant') return null;

  return (
    <Container maxWidth="xl" sx={{ mt: { xs: 2, sm: 3 }, mb: 4, px: { xs: 1.5, sm: 3 } }}>
      {/* Top Header Bar */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            fontWeight={800}
            letterSpacing="-0.02em"
            sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}
          >
            Print Queue
          </Typography>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mt: 0.5, flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <SecurityIcon sx={{ fontSize: 15, color: 'success.main' }} />
              <Typography variant="caption" color="text.secondary">
                Zero Document Retention
              </Typography>
            </Box>
            <Chip
              icon={<BoltIcon sx={{ fontSize: 14 }} />}
              label={isRelayConnected ? 'Direct Transfer Online' : 'Connecting'}
              color={isRelayConnected ? 'success' : 'default'}
              size="small"
              variant="outlined"
              sx={{ fontWeight: 600, height: 22 }}
            />
            <Tooltip
              title={
                isDesktopApp
                  ? `QuickPrint Desktop active. Direct hardware link to: ${daemonState.selectedPrinter || 'Default Printer'}. Click to configure.`
                  : daemonState.isOnline
                  ? `Hardware driver active on localhost:9123. Target: ${daemonState.selectedPrinter || 'Default'}. Click to configure.`
                  : 'Local print driver is offline. Printing uses browser dialog. Click to view instructions in Settings.'
              }
            >
              <Chip
                icon={<PrintIcon sx={{ fontSize: 14 }} />}
                label={
                  isDesktopApp
                    ? `QuickPrint: ${daemonState.selectedPrinter || 'Ready'}`
                    : daemonState.checking
                    ? 'Driver...'
                    : daemonState.isOnline
                    ? `Driver: ${daemonState.selectedPrinter || 'Connected'}`
                    : 'Driver: Offline'
                }
                color={daemonState.isOnline || isDesktopApp ? 'success' : 'default'}
                size="small"
                variant={daemonState.isOnline || isDesktopApp ? 'filled' : 'outlined'}
                onClick={() => navigate('/merchant/settings')}
                sx={{
                  fontWeight: 600,
                  height: 22,
                  cursor: 'pointer',
                  maxWidth: { xs: 160, sm: 260 },
                  '& .MuiChip-label': {
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  },
                }}
              />
            </Tooltip>
          </Stack>
        </Box>

        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<HistoryIcon />}
            onClick={() => setHistoryOpen(true)}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            History ({completedJobs.length})
          </Button>
          <Tooltip title="Refresh queue">
            <IconButton onClick={() => refreshJobs?.()} color="primary" size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Overview Stats */}
      <StatsOverview
        activeCount={activeJobs.length}
        todayPrints={userData?.stats?.todayPrints || 0}
        todayEarnings={userData?.stats?.todayEarnings || 0}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Main Single Active Print Queue */}
      <MerchantQueueList
        jobs={activeJobs}
        onPrint={handlePrint}
        onDone={onDoneJob}
        onDelete={onDeleteJob}
        onEdit={(job, fileIndex = 0) => {
          if (!isMobile) {
            setEditingDoc({ job, fileIndex });
          }
        }}
        processingJobId={processingJobId}
        isLoading={!jobs}
      />

      {/* History Slide-out Drawer */}
      <MerchantHistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        completedJobs={completedJobs}
        onReprint={handlePrint}
        onDelete={onDeleteJob}
      />

      {/* Document Editor Studio Modal - Desktop Only */}
      {!isMobile && Boolean(editingDoc) && (
        <React.Suspense fallback={null}>
          <DocumentEditorModal
            open={true}
            onClose={() => setEditingDoc(null)}
            job={editingDoc?.job}
            fileIndex={editingDoc?.fileIndex || 0}
            onSaveEdits={handleSaveJobEdits}
            onRevertEdits={handleRevertJobEdits}
            onPrintJob={handlePrint}
            pricePerPageBW={pricePerPageBW}
            pricePerPageColor={pricePerPageColor}
          />
        </React.Suspense>
      )}

      {/* Secure Processing Dialog */}
      <ProcessingDialog
        open={Boolean(processingJobId)}
        printProgress={printProgress}
        onCancel={cancelProcessing}
      />

      {/* Manual Duplex Paper Reload Modal (Canon G3030 / G3730 single-sided support) */}
      <ManualDuplexModal
        open={Boolean(manualDuplexPrompt)}
        onClose={closeManualDuplexPrompt}
        onContinue={manualDuplexPrompt?.onContinue}
        jobPin={manualDuplexPrompt?.jobPin}
        fileName={manualDuplexPrompt?.fileName}
        printerName={manualDuplexPrompt?.printerName}
        totalPages={manualDuplexPrompt?.totalPages}
      />

      {/* Feedback Toast */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}