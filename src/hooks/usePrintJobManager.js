// src/hooks/usePrintJobManager.js
import { useState, useCallback } from 'react';
import { updatePrintJob, deletePrintJob, confirmPaymentAndIncrementStats } from '../supabase/db';
import { calculateBillablePages, getPdfPageCount } from '../utils/fileValidation';
import {
  deleteJobBlobs,
  saveEditedJobBlob,
  revertJobBlob,
  getJobBlob,
} from '../utils/localJobStorage';
import { securePrint } from '../utils/securePrint';

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
      // Direct system print: open browser/OS print dialogue for the files
      for (let i = 0; i < job.files.length; i++) {
        const file = job.files[i];
        setPrintProgress({
          current: i + 1,
          total: job.files.length,
          fileName: file.name || `Document ${i + 1}`,
          status: 'Opening system print dialog...',
        });

        let blob = await getJobBlob(job.id, i);
        if (!blob && file.blob instanceof Blob) blob = file.blob;
        if (!blob && file.file instanceof Blob) blob = file.file;

        if (blob) {
          try {
            await securePrint(blob, file.name || 'document', file.specs || {}, merchantName);
          } catch (printErr) {
            console.warn('System print invocation note:', printErr);
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

      setActionNotice({
        message: `Order #${pinDisplay} printed: ${totalPages} page(s) (₹${totalCost.toFixed(2)})`,
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
  }, [pricePerPageBW, pricePerPageColor, merchantName]);

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
    handlePrint,
    handleDone,
    handleDelete,
    handleSaveJobEdits,
    handleRevertJobEdits,
  };
}
