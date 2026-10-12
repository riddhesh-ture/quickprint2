// src/components/Editor/ImageEditorStudio.jsx
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  Chip,
  Slider,
  Paper,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
} from '@mui/material';
import Cropper from 'react-cropper';
import 'cropperjs/dist/cropper.css';

import {
  applyXeroxBinarization,
  applyColorAdjustments,
  getCssFilterPreview,
} from '../../utils/imageFilters';

// Standard print shop crop presets
export const CROP_PRESETS = [
  { id: 'free', label: 'Freeform', ratio: NaN },
  { id: 'passport', label: 'Passport (3.5 × 4.5 cm)', ratio: 7 / 9 },
  { id: 'stamp', label: 'Stamp (2.5 × 3 cm)', ratio: 5 / 6 },
  { id: 'idcard', label: 'ID Card / Aadhaar', ratio: 85 / 54 },
  { id: 'photo4x6', label: '4 × 6 Photo', ratio: 2 / 3 },
  { id: 'a4', label: 'A4 Sheet (1:1.414)', ratio: 1 / 1.4142 },
  { id: 'square', label: 'Square (1:1)', ratio: 1 },
];

export default function ImageEditorStudio({
  blob,
  fileName,
  onExportBlob,
  isExporting,
}) {
  const cropperRef = useRef(null);
  const [imageSrc, setImageSrc] = useState(null);

  // Crop & Transform state
  const [activePreset, setActivePreset] = useState('free');
  const [scaleX, setScaleX] = useState(1);
  const [scaleY, setScaleY] = useState(1);

  // Filter modes: 'standard', 'grayscale', 'xerox'
  const [filterMode, setFilterMode] = useState('standard');
  const [xeroxThreshold, setXeroxThreshold] = useState(145);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);

  // Convert Blob to Object URL
  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setImageSrc(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [blob]);

  const handlePresetChange = (preset) => {
    setActivePreset(preset.id);
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      cropper.setAspectRatio(preset.ratio);
    }
  };

  const handleRotate = (deg) => {
    const cropper = cropperRef.current?.cropper;
    if (cropper) cropper.rotate(deg);
  };

  const handleFlipHorizontal = () => {
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      const currentScaleX = cropper.getData().scaleX || scaleX;
      const nextScaleX = -currentScaleX;
      cropper.scaleX(nextScaleX);
      setScaleX(nextScaleX);
    }
  };

  const handleFlipVertical = () => {
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      const currentScaleY = cropper.getData().scaleY || scaleY;
      const nextScaleY = -currentScaleY;
      cropper.scaleY(nextScaleY);
      setScaleY(nextScaleY);
    }
  };

  const handleZoom = (ratio) => {
    const cropper = cropperRef.current?.cropper;
    if (cropper) cropper.zoom(ratio);
  };

  const handleResetAll = () => {
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      cropper.reset();
      cropper.setAspectRatio(NaN);
    }
    setActivePreset('free');
    setScaleX(1);
    setScaleY(1);
    setFilterMode('standard');
    setXeroxThreshold(145);
    setBrightness(0);
    setContrast(0);
  };

  // Compute CSS filter string for live preview on the cropper view container
  const liveFilterCss = useMemo(() => {
    return getCssFilterPreview(filterMode, brightness, contrast);
  }, [filterMode, brightness, contrast]);

  // Export processed canvas as high-resolution JPEG/PNG Blob
  const generateProcessedBlob = useCallback(async () => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) throw new Error('Cropper is not ready');

    // Get cropped canvas at high resolution with pure white background fill
    const rawCanvas = cropper.getCroppedCanvas({
      maxWidth: 4096,
      maxHeight: 4096,
      fillColor: '#ffffff',
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
    });

    if (!rawCanvas) throw new Error('Failed to generate cropped canvas');

    const ctx = rawCanvas.getContext('2d');
    const width = rawCanvas.width;
    const height = rawCanvas.height;

    // Apply color / binarization pixel processing
    if (filterMode === 'xerox') {
      applyXeroxBinarization(ctx, width, height, xeroxThreshold);
    } else if (filterMode === 'grayscale' || brightness !== 0 || contrast !== 0) {
      applyColorAdjustments(ctx, width, height, filterMode === 'grayscale', brightness, contrast);
    }

    return new Promise((resolve, reject) => {
      rawCanvas.toBlob(
        (b) => {
          if (b) {
            resolve(b);
          } else {
            reject(new Error('Failed to create image blob from canvas'));
          }
        },
        'image/jpeg',
        0.95
      );
    });
  }, [filterMode, xeroxThreshold, brightness, contrast]);

  // Register export callback with parent modal
  useEffect(() => {
    if (onExportBlob) {
      onExportBlob(generateProcessedBlob);
    }
  }, [onExportBlob, generateProcessedBlob]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 1.5 }}>
      {/* Top Presets Bar */}
      <Paper
        elevation={0}
        variant="outlined"
        sx={{
          p: 1.25,
          borderRadius: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexWrap: 'wrap',
          bgcolor: 'background.paper',
        }}
      >
        <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase">
          Aspect Ratio:
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {CROP_PRESETS.map((preset) => (
            <Chip
              key={preset.id}
              label={preset.label}
              size="small"
              clickable
              color={activePreset === preset.id ? 'primary' : 'default'}
              variant={activePreset === preset.id ? 'filled' : 'outlined'}
              onClick={() => handlePresetChange(preset)}
              sx={{ fontWeight: 600, fontSize: '0.75rem' }}
            />
          ))}
        </Stack>
      </Paper>

      {/* Main Workspace (Cropper + Controls Sidebar) */}
      <Box sx={{ display: 'flex', flex: 1, gap: 2, minHeight: 380, position: 'relative' }}>
        {/* Cropper Viewport Container */}
        <Box
          sx={{
            flex: 1,
            borderRadius: 1.5,
            overflow: 'hidden',
            bgcolor: '#121212',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            '& .cropper-view-box img, & .cropper-canvas img': {
              filter: liveFilterCss,
              transition: 'filter 0.15s ease',
            },
          }}
        >
          {imageSrc ? (
            <Cropper
              ref={cropperRef}
              src={imageSrc}
              style={{ height: '100%', width: '100%', maxHeight: 520 }}
              initialAspectRatio={NaN}
              guides={true}
              viewMode={1}
              autoCropArea={0.9}
              background={true}
              responsive={true}
              checkOrientation={false}
              ready={() => {
                const cropper = cropperRef.current?.cropper;
                if (cropper && activePreset !== 'free') {
                  const match = CROP_PRESETS.find((p) => p.id === activePreset);
                  if (match) cropper.setAspectRatio(match.ratio);
                }
              }}
            />
          ) : (
            <CircularProgress color="primary" />
          )}

          {/* Floating Transform Bar (Clean text buttons, no emojis, no icons) */}
          <Paper
            elevation={3}
            sx={{
              position: 'absolute',
              bottom: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.5,
              borderRadius: 2,
              bgcolor: 'rgba(25, 25, 25, 0.92)',
              backdropFilter: 'blur(8px)',
              zIndex: 10,
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <Button
              size="small"
              onClick={() => handleRotate(-90)}
              sx={{ color: '#fff', fontSize: '0.72rem', textTransform: 'none', px: 1, minWidth: 'auto', py: 0.25 }}
            >
              Rot -90°
            </Button>
            <Button
              size="small"
              onClick={() => handleRotate(90)}
              sx={{ color: '#fff', fontSize: '0.72rem', textTransform: 'none', px: 1, minWidth: 'auto', py: 0.25 }}
            >
              Rot +90°
            </Button>
            <Button
              size="small"
              onClick={() => handleRotate(180)}
              sx={{ color: '#fff', fontSize: '0.72rem', textTransform: 'none', px: 1, minWidth: 'auto', py: 0.25 }}
            >
              Rot 180°
            </Button>
            <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.2)', mx: 0.25 }} />
            <Button
              size="small"
              onClick={handleFlipHorizontal}
              sx={{ color: '#fff', fontSize: '0.72rem', textTransform: 'none', px: 1, minWidth: 'auto', py: 0.25 }}
            >
              Flip H
            </Button>
            <Button
              size="small"
              onClick={handleFlipVertical}
              sx={{ color: '#fff', fontSize: '0.72rem', textTransform: 'none', px: 1, minWidth: 'auto', py: 0.25 }}
            >
              Flip V
            </Button>
            <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.2)', mx: 0.25 }} />
            <Button
              size="small"
              onClick={() => handleZoom(0.1)}
              sx={{ color: '#fff', fontSize: '0.72rem', textTransform: 'none', px: 1, minWidth: 'auto', py: 0.25 }}
            >
              Zoom +
            </Button>
            <Button
              size="small"
              onClick={() => handleZoom(-0.1)}
              sx={{ color: '#fff', fontSize: '0.72rem', textTransform: 'none', px: 1, minWidth: 'auto', py: 0.25 }}
            >
              Zoom -
            </Button>
            <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.2)', mx: 0.25 }} />
            <Button
              size="small"
              onClick={handleResetAll}
              sx={{ color: '#ff8a80', fontSize: '0.72rem', textTransform: 'none', px: 1, minWidth: 'auto', py: 0.25 }}
            >
              Reset
            </Button>
          </Paper>
        </Box>

        {/* Right Settings Sidebar: Filters & Adjustments */}
        <Paper
          elevation={0}
          variant="outlined"
          sx={{
            width: { xs: 220, sm: 260 },
            p: 2,
            borderRadius: 1.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            bgcolor: 'background.paper',
            flexShrink: 0,
          }}
        >
          {/* Print Enhancement Filter Modes */}
          <Box>
            <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase" sx={{ mb: 1, display: 'block' }}>
              Filter Mode:
            </Typography>
            <ToggleButtonGroup
              value={filterMode}
              exclusive
              onChange={(_, next) => {
                if (next) setFilterMode(next);
              }}
              size="small"
              fullWidth
              orientation="vertical"
              sx={{ gap: 0.75 }}
            >
              <ToggleButton value="standard" sx={{ py: 0.75, justifyContent: 'flex-start', px: 1.5, borderRadius: '6px !important' }}>
                <Typography variant="body2" fontWeight={600}>
                  Standard Color
                </Typography>
              </ToggleButton>
              <ToggleButton value="grayscale" sx={{ py: 0.75, justifyContent: 'flex-start', px: 1.5, borderRadius: '6px !important' }}>
                <Typography variant="body2" fontWeight={600}>
                  Grayscale B&W
                </Typography>
              </ToggleButton>
              <ToggleButton
                value="xerox"
                sx={{
                  py: 0.75,
                  justifyContent: 'flex-start',
                  px: 1.5,
                  borderRadius: '6px !important',
                  bgcolor: filterMode === 'xerox' ? 'primary.light' : undefined,
                }}
              >
                <Box sx={{ textAlign: 'left' }}>
                  <Typography variant="body2" fontWeight={700} color="primary.main">
                    Xerox B&W Boost
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.68rem' }}>
                    Removes grey shadows & deepens text
                  </Typography>
                </Box>
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Divider />

          {/* Conditional Controls based on Filter */}
          {filterMode === 'xerox' && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary">
                  Darkness Threshold
                </Typography>
                <Typography variant="caption" fontWeight={700} color="primary.main">
                  {xeroxThreshold}
                </Typography>
              </Box>
              <Slider
                value={xeroxThreshold}
                min={80}
                max={220}
                step={2}
                onChange={(_, v) => setXeroxThreshold(v)}
                size="small"
              />
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem', display: 'block' }}>
                Higher = darker text, cleaner background
              </Typography>
            </Box>
          )}

          {filterMode !== 'xerox' && (
            <Stack spacing={2}>
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Typography variant="caption" fontWeight={700} color="text.secondary">
                    Brightness
                  </Typography>
                  <Typography variant="caption" fontWeight={700}>
                    {brightness > 0 ? `+${brightness}` : brightness}%
                  </Typography>
                </Box>
                <Slider
                  value={brightness}
                  min={-60}
                  max={60}
                  step={2}
                  onChange={(_, v) => setBrightness(v)}
                  size="small"
                />
              </Box>

              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Typography variant="caption" fontWeight={700} color="text.secondary">
                    Contrast
                  </Typography>
                  <Typography variant="caption" fontWeight={700}>
                    {contrast > 0 ? `+${contrast}` : contrast}%
                  </Typography>
                </Box>
                <Slider
                  value={contrast}
                  min={-60}
                  max={60}
                  step={2}
                  onChange={(_, v) => setContrast(v)}
                  size="small"
                />
              </Box>
            </Stack>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
