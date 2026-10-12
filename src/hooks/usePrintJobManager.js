// src/hooks/usePrintJobManager.js
import { useState, useCallback } from 'react';
import { updatePrintJob, deletePrintJob, confirmPaymentAndIncrementStats } from '../supabase/db';
import { securePrint, preOpenPrintWindow } from '../utils/securePrint';
import { calculateBillablePages, getPdfPageCount } from '../utils/fileValidation';
import {
  getJobBlob,
  deleteJobBlobs,
  saveEditedJobBlob,
  revertJobBlob,
} from '../utils/localJobStorage';

export function usePrintJobManager(merchantId, merchantName, pricePerPageBW = 2, pricePerPageColor = 5) {
  const [processingJobId, setProcessingJobId] = useState(null);
  const [printProgress, setPrintProgress] = useState({ current: 0, total: 0, fileName: '', status: '' });
  const [actionNotice, setActionNotice] = useState(null);

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

    // Pre-open popup synchronously to bypass popup blocker
    const printWin = preOpenPrintWindow(`Print Order #${job.pin || 'Job'}`);
    setProcessingJobId(job.id);
    setPrintProgress({ current: 0, total: job.files.length, fileName: '', status: 'Initializing' });

    let totalCost = 0;
    let totalPages = 0;

    for (const file of job.files) {
      const pageCount = file.pageCount || file.specs?.pageCount || 1;
      const isDuplex = Boolean(file.specs?.duplex || file.specs?.sides === 'double');
      const billable = calculateBillablePages(pageCount, file.specs?.pages, isDuplex);
      const copies = parseInt(file.specs?.copies, 10) || 1;
      const price = file.specs?.color === 'color' ? pricePerPageColor : pricePerPageBW;
      totalCost += billable * copies * price;
      totalPages += billable * copies;
    }

    try {
      await updatePrintJob(job.id, { status: 'printing' });
    } catch (e) {
      console.warn('Job status update notice:', e);
    }

    const failedFiles = [];

    try {
      for (let i = 0; i < job.files.length; i++) {
        const file = job.files[i];
        let filePages = file.pageCount || file.specs?.pageCount || 1;

        setPrintProgress({
          current: i + 1,
          total: job.files.length,
          fileName: file.name,
          status: 'Preparing file',
        });

        try {
          // Always check local storage first so edited documents are printed
          let fileBlob = await getJobBlob(job.id, i);

          if (!fileBlob && file.fileUrl) {
            setPrintProgress((prev) => ({ ...prev, status: 'Downloading' }));
            let res = null;
            let lastErr = null;
            for (let attempt = 1; attempt <= 3; attempt++) {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 15000);
              try {
                res = await fetch(file.fileUrl, { signal: controller.signal });
                clearTimeout(timeout);
                if (res.ok) break;
              } catch (err) {
                clearTimeout(timeout);
                lastErr = err;
              }
              if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 1000));
            }
            if (!res || !res.ok) throw (lastErr || new Error('Download failed'));
            fileBlob = await res.blob();
          }

          if (!fileBlob) throw new Error('File data unavailable');

          if ((!file.pageCount || file.pageCount === 1) && (file.name?.endsWith('.pdf') || file.type === 'application/pdf')) {
            try {
              const actualPages = await getPdfPageCount(fileBlob);
              if (actualPages > 1) {
                const isDuplex = Boolean(file.specs?.duplex || file.specs?.sides === 'double');
                const oldBillable = calculateBillablePages(filePages, file.specs?.pages, isDuplex);
                const newBillable = calculateBillablePages(actualPages, file.specs?.pages, isDuplex);
                const copies = parseInt(file.specs?.copies, 10) || 1;
                const price = file.specs?.color === 'color' ? pricePerPageColor : pricePerPageBW;
                totalCost += (newBillable - oldBillable) * copies * price;
                totalPages += (newBillable - oldBillable) * copies;
                filePages = actualPages;
              }
            } catch {
              // PDF detection fallback
            }
          }

          const copies = parseInt(file.specs?.copies, 10) || 1;
          setPrintProgress((prev) => ({ ...prev, status: 'Printing' }));

          for (let c = 0; c < copies; c++) {
            if (copies > 1) {
              setPrintProgress((prev) => ({
                ...prev,
                status: `Printing copy ${c + 1} of ${copies}`,
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
        } catch (err) {
          console.error(`Error printing ${file.name}:`, err);
          const isDuplex = Boolean(file.specs?.duplex || file.specs?.sides === 'double');
          const billable = calculateBillablePages(filePages, file.specs?.pages, isDuplex);
          const copies = parseInt(file.specs?.copies, 10) || 1;
          const price = file.specs?.color === 'color' ? pricePerPageColor : pricePerPageBW;
          totalCost = Math.max(0, totalCost - (billable * copies * price));
          totalPages = Math.max(0, totalPages - (billable * copies));
          failedFiles.push({ name: file.name, error: err.message });
        }
      }

      const allFailed = failedFiles.length === job.files.length || totalPages === 0;
      const nextStatus = allFailed ? 'cancelled' : 'printed';

      await updatePrintJob(job.id, {
        status: nextStatus,
        cost: totalCost,
        totalPages,
      });

      if (allFailed) {
        setActionNotice({
          message: `Printing failed for all ${job.files.length} document(s)`,
          severity: 'error',
        });
      } else {
        setActionNotice({
          message: failedFiles.length === 0
            ? `Printed ${totalPages} page(s). Total: ₹${totalCost.toFixed(2)}`
            : `Printed with ${failedFiles.length} issue(s). Total: ₹${totalCost.toFixed(2)}`,
          severity: failedFiles.length === 0 ? 'success' : 'warning',
        });
      }
    } catch (err) {
      if (printWin && !printWin.closed) printWin.close();
      setActionNotice({ message: `Print error: ${err.message}`, severity: 'error' });
      try {
        await updatePrintJob(job.id, { status: 'pending' });
      } catch {
        /* ignore status revert failure */
      }
    } finally {
      setProcessingJobId(null);
      setPrintProgress({ current: 0, total: 0, fileName: '', status: '' });
    }
  }, [merchantName, pricePerPageBW, pricePerPageColor]);

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
    async (job, fileIndex, updatedBlob, updatedSpecs, newPageCount) => {
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
          message: `Order #${pinDisplay} updated: ${totalPages} pgs (₹${totalCost.toFixed(2)})`,
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
    handlePrint,
    handleDone,
    handleDelete,
    handleSaveJobEdits,
    handleRevertJobEdits,
  };
}
