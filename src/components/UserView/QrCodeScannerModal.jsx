// src/components/UserView/QrCodeScannerModal.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Button,
  CircularProgress,
  Alert,
  Stack,
} from '@mui/material';
import RawCloseIcon from '@mui/icons-material/Close';
import RawCameraAltIcon from '@mui/icons-material/CameraAlt';
import RawQrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import { unwrapIcon } from '../../utils/iconHelper';
import { useThemeMode } from '../../context/ThemeContext';
import { Html5Qrcode } from 'html5-qrcode';

const CloseIcon = unwrapIcon(RawCloseIcon);
const CameraAltIcon = unwrapIcon(RawCameraAltIcon);
const QrCodeScannerIcon = unwrapIcon(RawQrCodeScannerIcon);

const READER_ELEMENT_ID = 'quickprint-qr-reader';

export default function QrCodeScannerModal({ open, onClose, onScanSuccess, onSimulateScan }) {
  const { isDark, colors } = useThemeMode();
  const [cameraLoading, setCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const scannerRef = useRef(null);
  const isStoppingRef = useRef(false);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current && !isStoppingRef.current) {
      isStoppingRef.current = true;
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.warn('[QrCodeScanner] Error stopping scanner:', err);
      } finally {
        scannerRef.current = null;
        isStoppingRef.current = false;
      }
    }
  }, []);

  const handleSuccess = useCallback(
    async (decodedText) => {
      await stopScanner();
      if (onScanSuccess) {
        onScanSuccess(decodedText);
      }
    },
    [stopScanner, onScanSuccess]
  );

  useEffect(() => {
    let isCancelled = false;

    if (!open) {
      stopScanner();
      return;
    }

    setCameraLoading(true);
    setCameraError(null);

    // Allow DOM dialog transition to finish before initializing HTML5 QR Code
    const timer = setTimeout(async () => {
      if (isCancelled) return;

      const container = document.getElementById(READER_ELEMENT_ID);
      if (!container) {
        setCameraLoading(false);
        return;
      }

      try {
        const scanner = new Html5Qrcode(READER_ELEMENT_ID);
        scannerRef.current = scanner;

        const scanConfig = {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1.0,
        };

        const onScan = (decodedText) => {
          if (!isCancelled) {
            handleSuccess(decodedText);
          }
        };

        const onFrameError = () => {
          // Frame scan failure, safe to ignore
        };

        try {
          await scanner.start(
            { facingMode: 'environment' },
            scanConfig,
            onScan,
            onFrameError
          );
        } catch (envErr) {
          // Fallback to front/any camera if environment camera is not available or overconstrained
          console.warn('[QrCodeScanner] Environment camera unavailable, trying user camera:', envErr);
          await scanner.start(
            { facingMode: 'user' },
            scanConfig,
            onScan,
            onFrameError
          );
        }

        if (isCancelled) {
          try {
            if (scanner.isScanning) await scanner.stop();
            scanner.clear();
          } catch {}
          return;
        }

        setCameraLoading(false);
      } catch (err) {
        console.warn('[QrCodeScanner] Camera start failed:', err);
        if (!isCancelled) {
          setCameraLoading(false);
          const msg = err?.message || '';
          if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
            setCameraError('Camera access was denied. Please allow camera permissions in your browser settings.');
          } else if (msg.includes('NotFoundError') || msg.includes('DevicesNotFoundError')) {
            setCameraError('No camera was detected on this device.');
          } else {
            setCameraError('Unable to open camera on this device. You can enter the 4-digit code manually or simulate below.');
          }
        }
      }
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      stopScanner();
    };
  }, [open, handleSuccess, stopScanner]);

  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  const handleSimulate = async () => {
    await stopScanner();
    if (onSimulateScan) {
      onSimulateScan();
    } else {
      onScanSuccess('QP-8421');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '20px',
          bgcolor: isDark ? colors.surface : '#ffffff',
          overflow: 'hidden',
          p: 0.5,
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <QrCodeScannerIcon sx={{ color: colors.primary, fontSize: 24 }} />
          <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1.1rem' }}>
            Scan Station QR
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small" aria-label="Close scanner">
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ textAlign: 'center', pt: 1, pb: 3 }}>
        <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2, fontSize: '0.85rem' }}>
          Point your camera at the QuickPrint counter QR code
        </Typography>

        {cameraError && (
          <Alert severity="warning" sx={{ mb: 2, borderRadius: '12px', textAlign: 'left' }}>
            {cameraError}
          </Alert>
        )}

        {/* Video stream container */}
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            minHeight: cameraError ? 80 : 250,
            borderRadius: '16px',
            overflow: 'hidden',
            bgcolor: isDark ? '#000000' : '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `2px dashed ${colors.border}`,
            mb: 2,
          }}
        >
          {cameraLoading && !cameraError && (
            <Box
              sx={{
                position: 'absolute',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1.5,
                zIndex: 2,
              }}
            >
              <CircularProgress size={36} sx={{ color: colors.primary }} />
              <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 600 }}>
                Starting camera...
              </Typography>
            </Box>
          )}

          <div
            id={READER_ELEMENT_ID}
            style={{
              width: '100%',
              display: cameraError ? 'none' : 'block',
            }}
          />
        </Box>

        <Stack spacing={1}>
          <Button
            variant="contained"
            onClick={handleSimulate}
            startIcon={<CameraAltIcon />}
            sx={{
              py: 1.2,
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 800,
              bgcolor: colors.primary,
              '&:hover': { bgcolor: colors.primaryHover },
            }}
          >
            Simulate Counter QR Scan (QP-8421)
          </Button>

          <Button
            variant="text"
            onClick={handleClose}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              color: colors.textSecondary,
              fontSize: '0.85rem',
            }}
          >
            Enter 4-Digit Code Manually
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
