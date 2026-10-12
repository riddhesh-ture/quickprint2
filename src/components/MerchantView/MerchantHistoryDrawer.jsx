// src/components/MerchantView/MerchantHistoryDrawer.jsx
import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  Chip,
  Divider,
  Stack,
  Button,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import HistoryIcon from '@mui/icons-material/History';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import PrintIcon from '@mui/icons-material/Print';

export default function MerchantHistoryDrawer({
  open,
  onClose,
  completedJobs = [],
  onReprint,
  onDelete,
}) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 500 },
          p: 0,
          bgcolor: 'background.default',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <HistoryIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>
            Order History
          </Typography>
          <Chip
            label={completedJobs.length}
            size="small"
            color="default"
            variant="outlined"
            sx={{ fontWeight: 700 }}
          />
        </Stack>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* History Items */}
      {completedJobs.length === 0 ? (
        <Box sx={{ p: 6, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No completed print jobs recorded today.
          </Typography>
        </Box>
      ) : (
        <List disablePadding sx={{ overflowY: 'auto', flex: 1 }}>
          {completedJobs.map((job) => {
            const cleanPin = job.pin || (job.tokenNumber ? String(job.tokenNumber).replace(/\D/g, '').slice(-4) : (String(job.id).replace(/\D/g, '').slice(-4) || '0000'));
            const token = `#${cleanPin}`;
            const timeStr = job.completedAt
              ? new Date(job.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : (job.createdAt ? new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');

            const fileSummary = job.files?.[0]?.name || 'Document';
            const extraFiles = (job.files?.length || 1) - 1;
            const docLabel = extraFiles > 0 ? `${fileSummary} (+${extraFiles})` : fileSummary;

            return (
              <ListItem
                key={job.id}
                sx={{
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  p: 2,
                  bgcolor: 'background.paper',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Chip
                      label={token}
                      size="small"
                      color="success"
                      variant="outlined"
                      sx={{ fontFamily: 'monospace', fontWeight: 800 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {timeStr}
                    </Typography>
                  </Stack>
                  <Typography variant="subtitle2" fontWeight={800} color="text.primary">
                    ₹{Number(job.cost || 0).toFixed(2)}
                  </Typography>
                </Box>

                <Typography variant="body2" fontWeight={600} noWrap sx={{ mt: 0.5 }}>
                  {docLabel}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {job.totalPages || 1} pages ({job.bwPages || 0} B&W, {job.colorPages || 0} Color)
                </Typography>

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
                  {onReprint && (
                    <Button
                      size="small"
                      variant="text"
                      startIcon={<PrintIcon fontSize="small" />}
                      onClick={() => onReprint(job)}
                    >
                      Reprint
                    </Button>
                  )}
                  {onDelete && (
                    <IconButton size="small" onClick={() => onDelete(job.id)} sx={{ color: 'text.secondary' }}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              </ListItem>
            );
          })}
        </List>
      )}
    </Drawer>
  );
}
