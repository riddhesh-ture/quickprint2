// src/components/MerchantView/PrintQueue.jsx
import React from 'react';
import { Box, Typography, Paper, List, CircularProgress } from '@mui/material';
import JobItem from './JobItem';

export default function PrintQueue({
  jobs,
  onAcceptJob,
  onCompleteJob,
  onConfirmPayment,
  onDonePaid,
  onDeleteJob,
  processingJobId,
}) {
  if (!jobs) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (jobs.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
        <Typography color="text.secondary">No print jobs in this category.</Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={1} sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <List sx={{ p: 0 }}>
        {jobs.map((job) => (
          <JobItem
            key={job.id}
            job={job}
            onAcceptJob={onAcceptJob}
            onCompleteJob={onCompleteJob}
            onConfirmPayment={onConfirmPayment}
            onDonePaid={onDonePaid}
            onDeleteJob={onDeleteJob}
            isProcessing={processingJobId === job.id}
          />
        ))}
      </List>
    </Paper>
  );
}