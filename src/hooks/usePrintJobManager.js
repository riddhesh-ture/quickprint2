import { useState, useCallback, useEffect } from 'react';
import { updatePrintJob, deletePrintJob, confirmPaymentAndIncrementStats } from '../supabase/db';
import { calculateBillablePages, getPdfPageCount } from '../utils/fileValidation';
import {
  deleteJobBlobs,
  saveEditedJobBlob,
  revertJobBlob,
  getJobBlob,
} from '../utils/localJobStorage';
import { securePrint } from '../utils/securePrint';
import { slicePdfPages } from '../utils/pdfSlicer';
import {
  checkDaemonHealth,
  fetchInstalledPrinters,
  sendSilentPrintJob,
  getStoredPrinter,
  setStoredPrinter,
} from '../utils/printDaemonClient';

export function usePrintJobManager(merchantId, merchantName, pricePerPageBW = 2, pricePerPageColor = 5) {
  const [processingJobId, setProcessingJobId] = useState(null);
  const [printProgress, setPrintProgress] = useState({ current: 0, total: 0, fileName: '', status: '' });
  const [actionNotice, setActionNotice] = useState(null);
  const [manualDuplexPrompt, setManualDuplexPrompt] = useState(null);

  // Local hardware print daemon state
  const [daemonState, setDaemonState] = useState({
    isOnline: false,
    checking: true,
    printers: [],
    selectedPrinter: getStoredPrinter() || null,
  });

  const refreshDaemonStatus = useCallback(async () => {
    setDaemonState((prev) => ({ ...prev, checking: true }));
    const health = await checkDaemonHealth();
    if (health.online) {
      try {
        const { printers, defaultPrinter } = await fetchInstalledPrinters();
        const stored = getStoredPrinter();
        const effectivePrinter = stored || defaultPrinter || (printers[0]?.name ?? null);
        setDaemonState({
          isOnline: true,
          checking: false,
          printers,
          selectedPrinter: effectivePrinter,
        });
        return;
      } catch (_e) {
        setDaemonState((prev) => ({ ...prev, isOnline: true, checking: false }));
        return;
      }
    }
    setDaemonState((prev) => ({ ...prev, isOnline: false, checking: false }));
  }, []);

  useEffect(() => {
    refreshDaemonStatus();
    const interval = setInterval(refreshDaemonStatus, 25000);
    return () => clearInterval(interval);
  }, [refreshDaemonStatus]);

  const selectPrinter = useCallback((printerName) => {
    setStoredPrinter(printerName);
    setDaemonState((prev) => ({ ...prev, selectedPrinter: printerName }));
  }, []);

  const cleanupFiles = async (jobId) => {
    if (!jobId) return;
    try {
      await deleteJobBlobs(jobId);
    } catch (err) {
      console.warn('Storage cleanup notice:', err);
    }
  };

  const handlePrint = useCallback(async (job) => {
    if (!job?.files?.length) return;

    setProcessingJobId(job.id);
    setPrintProgress({ current: 0, total: job.files.length, fileName: '', status: 'Processing' });

    let totalCost = 0;
    let totalPages = 0;

    for (const file of job.files) {
      const pageCount = file.pageCount || file.specs?.pageCount || 1;
      const isDuplex = Boolean(file.specs?.duplex || file.specs?.sides === 'double');
      const nUp = parseInt(file.specs?.pagesPerSheet, 10) || 1;
      const billable = calculateBillablePages(pageCount, file.specs?.pages, isDuplex, nUp);
      const copies = parseInt(file.specs?.copies, 10) || 1;
      const price = file.specs?.color === 'color' ? pricePerPageColor : pricePerPageBW;
      totalCost += billable * copies * price;
      totalPages += billable * copies;
    }

    try {
      const isDaemonActive = daemonState.isOnline;

      // Direct system print: send to local daemon for silent spool or fallback to browser dialog
      for (let i = 0; i < job.files.length; i++) {
        const file = job.files[i];
        let blob = await getJobBlob(job.id, i);
        if (!blob && file.blob instanceof Blob) blob = file.blob;
        if (!blob && file.file instanceof Blob) blob = file.file;

        if (blob) {
          const isDuplex = Boolean(file.specs?.duplex || file.specs?.sides === 'double' || file.specs?.manualDuplex);
          const pageCount = file.pageCount || file.specs?.pageCount || 1;

          if (isDaemonActive) {
            // Manual Duplex Workflow: If duplex requested on a multi-page document
            if (isDuplex && pageCount > 1) {
              setPrintProgress({
                current: i + 1,
                total: job.files.length,
                fileName: file.name || `Document ${i + 1}`,
                status: `Manual Duplex Pass 1: Spooling odd pages (1, 3, 5...) to ${daemonState.selectedPrinter || 'counter printer'}...`,
              });

              // Pass 1: Spool Odd Pages
              await sendSilentPrintJob({
                jobId: `${job.id}_${i}_odd`,
                token: job.pin || job.tokenNumber,
                fileBlob: blob,
                fileName: file.name || `document_${i + 1}.pdf`,
                specs: { ...file.specs, pages: 'odd' },
                printerName: daemonState.selectedPrinter,
              });

              // Close progress modal and prompt attendant to reload paper
              setProcessingJobId(null);
              setPrintProgress({ current: 0, total: 0, fileName: '', status: '' });

              setManualDuplexPrompt({
                jobPin: job.pin || (job.tokenNumber ? String(job.tokenNumber).replace(/\D/g, '').slice(-4) : '----'),
                fileName: file.name || `Document ${i + 1}`,
                printerName: daemonState.selectedPrinter,
                totalPages: pageCount,
                onClose: () => setManualDuplexPrompt(null),
                onContinue: async () => {
                  setManualDuplexPrompt(null);
                  setProcessingJobId(job.id);
                  setPrintProgress({
                    current: i + 1,
                    total: job.files.length,
                    fileName: file.name || `Document ${i + 1}`,
                    status: `Manual Duplex Pass 2: Spooling even pages (2, 4, 6...) to ${daemonState.selectedPrinter || 'counter printer'}...`,
                  });

                  try {
                    // Pass 2: Spool Even Pages on reverse side
                    await sendSilentPrintJob({
                      jobId: `${job.id}_${i}_even`,
                      token: job.pin || job.tokenNumber,
                      fileBlob: blob,
                      fileName: file.name || `document_${i + 1}.pdf`,
                      specs: { ...file.specs, pages: 'even' },
                      printerName: daemonState.selectedPrinter,
                    });

                    await updatePrintJob(job.id, {
                      status: 'printed',
                      cost: totalCost,
                      totalPages,
                    });

                    const pinDisplay = job.pin || (job.tokenNumber ? String(job.tokenNumber).replace(/\D/g, '').slice(-4) : '----');
                    setActionNotice({
                      message: `Order #${pinDisplay} manual duplex printed: ${totalPages} page(s) (₹${totalCost.toFixed(2)})`,
                      severity: 'success',
                    });
                  } catch (evenErr) {
                    console.error('Manual duplex second pass error:', evenErr);
                    setActionNotice({
                      message: `Failed to print even pages: ${evenErr.message}`,
                      severity: 'error',
                    });
                  } finally {
                    setProcessingJobId(null);
                    setPrintProgress({ current: 0, total: 0, fileName: '', status: '' });
                  }
                },
              });

              return; // Pause execution for attendant prompt
            }

            setPrintProgress({
              current: i + 1,
              total: job.files.length,
              fileName: file.name || `Document ${i + 1}`,
              status: `Spooling silently to ${daemonState.selectedPrinter || 'counter printer'}...`,
            });
            try {
              await sendSilentPrintJob({
                jobId: `${job.id}_${i}`,
                token: job.pin || job.tokenNumber,
                fileBlob: blob,
                fileName: file.name || `document_${i + 1}.pdf`,
                specs: file.specs || {},
                printerName: daemonState.selectedPrinter,
              });
            } catch (daemonErr) {
              console.warn('Local daemon spooling failed, falling back to browser print:', daemonErr);
              await securePrint(blob, file.name || 'document', file.specs || {}, merchantName);
            }
          } else {
            // Mobile Browser / Android Print Spooler Flow
            if (isDuplex && pageCount > 1) {
              setPrintProgress({
                current: i + 1,
                total: job.files.length,
                fileName: file.name || `Document ${i + 1}`,
                status: 'Manual Duplex: Slicing odd pages (1, 3, 5...)...',
              });

              // Pass 1: Slice into pure Odd pages PDF
              const oddBlob = await slicePdfPages(blob, 'odd');
              await securePrint(oddBlob, `${file.name || 'document'}_odd.pdf`, { ...file.specs, duplex: false }, merchantName);

              // Pause execution and prompt attendant/parents to reload paper
              setProcessingJobId(null);
              setPrintProgress({ current: 0, total: 0, fileName: '', status: '' });

              setManualDuplexPrompt({
                jobPin: job.pin || (job.tokenNumber ? String(job.tokenNumber).replace(/\D/g, '').slice(-4) : '----'),
                fileName: file.name || `Document ${i + 1}`,
                printerName: 'Mobile Printer',
                totalPages: pageCount,
                onClose: () => setManualDuplexPrompt(null),
                onContinue: async () => {
                  setManualDuplexPrompt(null);
                  setProcessingJobId(job.id);
                  setPrintProgress({
                    current: i + 1,
                    total: job.files.length,
                    fileName: file.name || `Document ${i + 1}`,
                    status: 'Manual Duplex: Slicing even pages (2, 4, 6...)...',
                  });

                  try {
                    // Pass 2: Slice into pure Even pages PDF
                    const evenBlob = await slicePdfPages(blob, 'even');
                    await securePrint(evenBlob, `${file.name || 'document'}_even.pdf`, { ...file.specs, duplex: false }, merchantName);

                    await updatePrintJob(job.id, {
                      status: 'printed',
                      cost: totalCost,
                      totalPages,
                    });

                    const pinDisplay = job.pin || (job.tokenNumber ? String(job.tokenNumber).replace(/\D/g, '').slice(-4) : '----');
                    setActionNotice({
                      message: `Order #${pinDisplay} manual duplex printed: ${totalPages} page(s) (₹${totalCost.toFixed(2)})`,
                      severity: 'success',
                    });
                  } catch (evenErr) {
                    console.error('Mobile manual duplex pass 2 error:', evenErr);
                    setActionNotice({
                      message: `Failed to print even pages: ${evenErr.message}`,
                      severity: 'error',
                    });
                  } finally {
                    setProcessingJobId(null);
                    setPrintProgress({ current: 0, total: 0, fileName: '', status: '' });
                  }
                },
              });

              return; // Pause for paper reload
            }

            // Normal single-page or single-sided print on mobile
            setPrintProgress({
              current: i + 1,
              total: job.files.length,
              fileName: file.name || `Document ${i + 1}`,
              status: 'Opening system print dialog...',
            });
            try {
              await securePrint(blob, file.name || 'document', file.specs || {}, merchantName);
            } catch (printErr) {
              console.warn('System print invocation note:', printErr);
            }
          }
        }
      }

      // Mark job as printed (ready for counter pickup / completed print spool)
      await updatePrintJob(job.id, {
        status: 'printed',
        cost: totalCost,
        totalPages,
      });

      const pinDisplay =
        job.pin ||
        (job.tokenNumber
          ? String(job.tokenNumber).replace(/\D/g, '').slice(-4)
          : String(job.id).replace(/\D/g, '').slice(-4) || '----');

      const printModeLabel = isDaemonActive ? 'spooled to printer' : 'printed';
      setActionNotice({
        message: `Order #${pinDisplay} ${printModeLabel}: ${totalPages} page(s) (₹${totalCost.toFixed(2)})`,
        severity: 'success',
      });
    } catch (err) {
      console.error('Error updating print status:', err);
      setActionNotice({
        message: `Failed to print order: ${err.message}`,
        severity: 'error',
      });
    } finally {
      setProcessingJobId(null);
      setPrintProgress({ current: 0, total: 0, fileName: '', status: '' });
    }
  }, [pricePerPageBW, pricePerPageColor, merchantName, daemonState]);

  const handleDone = useCallback(async (job) => {
    if (!job) return;
    try {
      await confirmPaymentAndIncrementStats(job.id, merchantId, job.cost || 0, job.totalPages || 1);
      await cleanupFiles(job.id);
      const pinDisplay = job.pin || (job.tokenNumber ? String(job.tokenNumber).replace(/\D/g, '').slice(-4) : (String(job.id).replace(/\D/g, '').slice(-4) || '----'));
      setActionNotice({
        message: `Order #${pinDisplay} completed`,
        severity: 'success',
      });
    } catch (e) {
      console.error('Completion error:', e);
      setActionNotice({ message: 'Failed to complete order', severity: 'error' });
    }
  }, [merchantId]);

  const handleDelete = useCallback(async (jobId) => {
    if (!window.confirm('Delete this print job?')) return;
    try {
      await deletePrintJob(jobId);
      await cleanupFiles(jobId);
      setActionNotice({ message: 'Order removed from queue', severity: 'info' });
    } catch (e) {
      setActionNotice({ message: 'Failed to delete order', severity: 'error' });
    }
  }, []);

  const handleSaveJobEdits = useCallback(
    async (job, fileIndex, updatedBlob, updatedSpecs, newPageCount, markAsPrinted = false) => {
      if (!job || !job.files || fileIndex < 0 || fileIndex >= job.files.length) return false;

      try {
        if (updatedBlob) {
          await saveEditedJobBlob(job.id, fileIndex, updatedBlob);
        }

        const updatedFiles = [...job.files];
        const currentFile = updatedFiles[fileIndex] || {};
        const currentSpecs = currentFile.specs || {};
        const mergedSpecs = {
          ...currentSpecs,
          ...(updatedSpecs || {}),
        };
        const pageCount =
          newPageCount ??
          mergedSpecs.pageCount ??
          currentSpecs.pageCount ??
          currentFile.pageCount ??
          1;
        mergedSpecs.pageCount = pageCount;
        if (updatedBlob) {
          mergedSpecs.pages = 'all';
        }

        updatedFiles[fileIndex] = {
          ...currentFile,
          pageCount,
          specs: mergedSpecs,
          isEdited: true,
        };

        let totalCost = 0;
        let totalPages = 0;

        for (const file of updatedFiles) {
          const pCount = file.pageCount || file.specs?.pageCount || 1;
          const isDuplex = Boolean(file.specs?.duplex || file.specs?.sides === 'double');
          const nUp = parseInt(file.specs?.pagesPerSheet, 10) || 1;
          const billable = calculateBillablePages(pCount, file.specs?.pages, isDuplex, nUp);
          const copies = parseInt(file.specs?.copies, 10) || 1;
          const price = file.specs?.color === 'color' ? pricePerPageColor : pricePerPageBW;
          totalCost += billable * copies * price;
          totalPages += billable * copies;
        }

        const updates = {
          files: updatedFiles,
          totalPages,
          cost: totalCost,
        };
        if (markAsPrinted) {
          updates.status = 'printed';
          if (daemonState.isOnline && updatedBlob) {
            try {
              await sendSilentPrintJob({
                jobId: `${job.id}_${fileIndex}_direct`,
                token: job.pin || job.tokenNumber,
                fileBlob: updatedBlob,
                fileName: currentFile.name || 'document.pdf',
                specs: mergedSpecs,
                printerName: daemonState.selectedPrinter,
              });
            } catch (spoolErr) {
              console.warn('Direct print after edits spooling notice:', spoolErr);
            }
          }
        }

        await updatePrintJob(job.id, updates);

        const pinDisplay =
          job.pin ||
          (job.tokenNumber
            ? String(job.tokenNumber).replace(/\D/g, '').slice(-4)
            : String(job.id).replace(/\D/g, '').slice(-4) || '----');
        setActionNotice({
          message: markAsPrinted
            ? `Order #${pinDisplay} saved and marked as printed (${totalPages} pgs, ₹${totalCost.toFixed(2)})`
            : `Order #${pinDisplay} updated: ${totalPages} pgs (₹${totalCost.toFixed(2)})`,
          severity: 'success',
        });

        const updatedJob = {
          ...job,
          files: updatedFiles,
          totalPages,
          cost: totalCost,
        };

        return updatedJob;
      } catch (err) {
        console.error('Failed to save document edits:', err);
        setActionNotice({
          message: `Failed to save changes: ${err.message}`,
          severity: 'error',
        });
        throw err;
      }
    },
    [pricePerPageBW, pricePerPageColor]
  );

  const handleRevertJobEdits = useCallback(
    async (job, fileIndex) => {
      if (!job || !job.files || fileIndex < 0 || fileIndex >= job.files.length) return false;

      try {
        const restoredBlob = await revertJobBlob(job.id, fileIndex);
        if (!restoredBlob) {
          setActionNotice({ message: 'No original version found to revert to', severity: 'warning' });
          return false;
        }

        let origPageCount = 1;
        const currentFile = job.files[fileIndex];
        if (currentFile.name?.endsWith('.pdf') || currentFile.type === 'application/pdf') {
          origPageCount = await getPdfPageCount(restoredBlob);
        }

        const updatedFiles = [...job.files];
        const currentSpecs = currentFile.specs || {};
        const resetSpecs = {
          ...currentSpecs,
          pageCount: origPageCount,
          pages: 'all',
        };

        updatedFiles[fileIndex] = {
          ...currentFile,
          pageCount: origPageCount,
          specs: resetSpecs,
          isEdited: false,
        };

        let totalCost = 0;
        let totalPages = 0;

        for (const file of updatedFiles) {
          const pCount = file.pageCount || file.specs?.pageCount || 1;
          const isDuplex = Boolean(file.specs?.duplex || file.specs?.sides === 'double');
          const billable = calculateBillablePages(pCount, file.specs?.pages, isDuplex);
          const copies = parseInt(file.specs?.copies, 10) || 1;
          const price = file.specs?.color === 'color' ? pricePerPageColor : pricePerPageBW;
          totalCost += billable * copies * price;
          totalPages += billable * copies;
        }

        await updatePrintJob(job.id, {
          files: updatedFiles,
          totalPages,
          cost: totalCost,
        });

        const pinDisplay =
          job.pin ||
          (job.tokenNumber
            ? String(job.tokenNumber).replace(/\D/g, '').slice(-4)
            : String(job.id).replace(/\D/g, '').slice(-4) || '----');
        setActionNotice({
          message: `Order #${pinDisplay} reverted to original`,
          severity: 'info',
        });

        const updatedJob = {
          ...job,
          files: updatedFiles,
          totalPages,
          cost: totalCost,
        };

        return updatedJob;
      } catch (err) {
        console.error('Failed to revert document edits:', err);
        setActionNotice({
          message: `Failed to revert: ${err.message}`,
          severity: 'error',
        });
        throw err;
      }
    },
    [pricePerPageBW, pricePerPageColor]
  );

  return {
    processingJobId,
    printProgress,
    actionNotice,
    clearActionNotice: () => setActionNotice(null),
    manualDuplexPrompt,
    closeManualDuplexPrompt: () => setManualDuplexPrompt(null),
    handlePrint,
    handleDone,
    handleDelete,
    handleSaveJobEdits,
    handleRevertJobEdits,
    daemonState,
    refreshDaemonStatus,
    selectPrinter,
  };
}
