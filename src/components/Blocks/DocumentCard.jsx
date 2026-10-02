// src/components/Blocks/DocumentCard.jsx
import React from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import RawDescriptionIcon from '@mui/icons-material/Description';
import RawDeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RawAutoStoriesIcon from '@mui/icons-material/AutoStories';
import RawWaterDropIcon from '@mui/icons-material/WaterDrop';
import RawContentCopyIcon from '@mui/icons-material/ContentCopy';
import { unwrapIcon } from '../../utils/iconHelper';
import { useThemeMode } from '../../context/ThemeContext';

const DescriptionIcon = unwrapIcon(RawDescriptionIcon);
const DeleteOutlineIcon = unwrapIcon(RawDeleteOutlineIcon);
const AutoStoriesIcon = unwrapIcon(RawAutoStoriesIcon);
const WaterDropIcon = unwrapIcon(RawWaterDropIcon);
const ContentCopyIcon = unwrapIcon(RawContentCopyIcon);

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentCard({
  fileName = 'document.pdf',
  fileSize,
  pageCount = 1,
  colorMode = 'bw',
  copies = 1,
  duplex = true,
  isDemo = false,
  isAnalyzing = false,
  error = null,
  pageRange,
  onRemove,
  action,
}) {
  const { isDark, colors } = useThemeMode();

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: '14px',
        bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#f8faff',
        border: `1px solid ${colors.border}`,
        transition: 'all 0.2s ease',
      }}
    >
      {/* Top Row: Icon, Filename, Size, Actions */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0, flex: 1 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: '10px',
              bgcolor: isDark ? 'rgba(37,99,235,0.15)' : '#eff6ff',
              color: colors.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <DescriptionIcon sx={{ fontSize: 20 }} />
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Typography
                variant="subtitle2"
                noWrap
                sx={{
                  fontWeight: 700,
                  fontSize: '0.94rem',
                  color: colors.text,
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                }}
              >
                {fileName}
              </Typography>
              {isDemo && (
                <Box
                  sx={{
                    px: 0.7,
                    py: 0.15,
                    borderRadius: '4px',
                    bgcolor: isDark ? 'rgba(245,158,11,0.2)' : '#fef3c7',
                    color: isDark ? '#fbbf24' : '#b45309',
                    fontSize: '10px',
                    fontWeight: 700,
                  }}
                >
                  DEMO
                </Box>
              )}
            </Box>

            {fileSize && (
              <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '0.74rem' }}>
                {formatFileSize(fileSize)}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Action: Delete / Custom action */}
        {action || (onRemove && (
          <Tooltip title="Remove file" arrow>
            <IconButton
              size="small"
              onClick={onRemove}
              aria-label="Remove file"
              sx={{
                color: colors.textSecondary,
                '&:hover': { color: '#ef4444', bgcolor: 'rgba(239,68,68,0.1)' },
              }}
            >
              <DeleteOutlineIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        ))}
      </Box>

      {/* Badges Row */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {error ? (
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.3,
              borderRadius: '6px',
              bgcolor: isDark ? 'rgba(239,68,68,0.18)' : '#fee2e2',
              border: '1px solid #fca5a5',
              color: isDark ? '#fca5a5' : '#b91c1c',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
          >
            <span>⚠️ {error}</span>
          </Box>
        ) : isAnalyzing ? (
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.3,
              borderRadius: '6px',
              bgcolor: isDark ? 'rgba(37,99,235,0.15)' : '#eff6ff',
              border: `1px solid ${colors.border}`,
              color: colors.primary,
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
          >
            <span>⏳ Counting pages...</span>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.3,
              borderRadius: '6px',
              bgcolor: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
              border: `1px solid ${colors.border}`,
              color: colors.textSecondary,
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            <AutoStoriesIcon sx={{ fontSize: 13, color: colors.primary }} />
            <span>
              {pageRange && pageRange !== 'all'
                ? `Pages: ${pageRange} (${pageCount} total)`
                : `${pageCount} ${pageCount === 1 ? 'Page' : 'Pages'}`}
            </span>
          </Box>
        )}

        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1,
            py: 0.3,
            borderRadius: '6px',
            bgcolor: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
            border: `1px solid ${colors.border}`,
            color: colors.textSecondary,
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
        >
          <WaterDropIcon sx={{ fontSize: 13, color: colorMode === 'color' ? '#2563eb' : colors.textSecondary }} />
          <span>{colorMode === 'color' ? 'Color' : 'B&W'} {duplex ? '(Double)' : '(Single)'}</span>
        </Box>

        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1,
            py: 0.3,
            borderRadius: '6px',
            bgcolor: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
            border: `1px solid ${colors.border}`,
            color: colors.textSecondary,
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
        >
          <ContentCopyIcon sx={{ fontSize: 13, color: colors.primary }} />
          <span>{copies} {copies === 1 ? 'Copy' : 'Copies'}</span>
        </Box>
      </Box>
    </Box>
  );
}
