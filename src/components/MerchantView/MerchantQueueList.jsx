// src/components/MerchantView/MerchantQueueList.jsx
import React from 'react';
import { Box, Typography, Paper, List, CircularProgress } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import MerchantQueueRow from './MerchantQueueRow';

export default function MerchantQueueList({
  jobs,
  onPrint,
  onDone,
  onDelete,
  onEdit,
  processingJobId,
  isLoading,
}) {
  if (isLoading && (!jobs || jobs.length === 0)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (!jobs || jobs.length === 0) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 6,
          textAlign: 'center',
          borderRadius: 3,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <CheckCircleOutlineIcon sx={{ fontSize: 44, color: 'text.disabled', mb: 1.5 }} />
        <Typography variant="subtitle1" fontWeight={700} color="text.primary">
          Queue is clear
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Incoming customer print jobs will appear here in real time.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      variant="outlined"
      sx={{
        borderRadius: 2.5,
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      <List disablePadding>
        {jobs.map((job) => (
          <MerchantQueueRow
            key={job.id}
            job={job}
            onPrint={onPrint}
            onDone={onDone}
            onDelete={onDelete}
            onEdit={onEdit}
            isProcessing={processingJobId === job.id}
          />
        ))}
      </List>
    </Paper>
  );
}
