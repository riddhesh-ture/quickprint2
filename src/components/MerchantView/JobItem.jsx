// src/components/MerchantView/JobItem.jsx
import React from 'react';
import {
  ListItem,
  ListItemText,
  Collapse,
  List,
  Box,
  Typography,
  IconButton,
  Button,
  Divider,
  Chip,
  CircularProgress,
  Stack,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PrintIcon from '@mui/icons-material/Print';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PaymentIcon from '@mui/icons-material/Payment';

const FileSpecDetail = ({ label, value }) => (
  <Typography variant="body2" component="span" sx={{ mr: 2 }}>
    <strong>{label}:</strong> {value}
  </Typography>
);

export default function JobItem({
  job,
  onAcceptJob,
  onCompleteJob,
  onConfirmPayment,
  onDeleteJob,
  isProcessing,
}) {
  const [open, setOpen] = React.useState(false);

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'processing': return 'info';
      case 'awaitingPayment': return 'secondary';
      case 'paymentClaimed': return 'error';
      case 'paid': return 'success';
      case 'completed': return 'default';
      default: return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'processing': return 'Printing...';
      case 'awaitingPayment': return 'Awaiting Payment';
      case 'paymentClaimed': return 'Payment Claimed';
      case 'paid': return 'Paid';
      case 'completed': return 'Completed';
      default: return status;
    }
  };

  const formattedDate = React.useMemo(() => {
    try {
      if (job.createdAt?.toDate) {
        return job.createdAt.toDate().toLocaleString();
      }
      if (job.createdAt) {
        return new Date(job.createdAt).toLocaleString();
      }
    } catch {
      // safe fallback
    }
    return new Date().toLocaleString();
  }, [job.createdAt]);

  const isRealtime = job.transport === 'realtime';

  return (
    <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', borderBottom: '1px solid #eee', py: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: 1 }}>
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="subtitle1" fontWeight="bold">
                🎭 {job.userName || 'Customer'}
              </Typography>
              {job.customerPhone && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`📞 ${job.customerPhone}`}
                  color="default"
                />
              )}
              <Chip
                size="small"
                variant="outlined"
                label={isRealtime ? '⚡ Real-Time P2P' : '☁️ Cloud Store'}
                color={isRealtime ? 'success' : 'info'}
              />
              {job.paymentMethod && job.paymentMethod !== 'none' && (
                <Chip
                  size="small"
                  variant="filled"
                  label={job.paymentMethod === 'cash' ? '💵 Cash' : '📱 UPI'}
                  color={job.paymentMethod === 'cash' ? 'success' : 'primary'}
                />
              )}
            </Box>
          }
          secondary={`Received: ${formattedDate} • ${job.files?.length || 0} file(s) • ${job.totalPages || 0} pgs (${job.bwPages || 0} B&W, ${job.colorPages || 0} Color) • ₹${Number(job.cost || job.estimatedCost || 0).toFixed(2)}`}
        />

        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            label={getStatusText(job.status)}
            color={getStatusColor(job.status)}
            size="small"
            sx={{ fontWeight: 'bold' }}
          />
          <IconButton onClick={() => setOpen(!open)} size="small">
            {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Stack>
      </Box>

      <Collapse in={open} timeout="auto" unmountOnExit>
        <List component="div" disablePadding sx={{ pl: 2, pr: 2, mt: 1, bgcolor: '#f9f9f9', borderRadius: 1.5 }}>
          <Typography variant="subtitle2" sx={{ pt: 1.5, pb: 0.5, fontWeight: 'bold' }}>
            Files to Print:
          </Typography>

          {job.files?.map((file, index) => (
            <React.Fragment key={index}>
              <ListItem sx={{ flexDirection: 'column', alignItems: 'flex-start', py: 1, px: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                  {index + 1}. {file.name}
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <FileSpecDetail label="Copies" value={file.specs?.copies || 1} />
                  <FileSpecDetail label="Pages" value={file.specs?.pages || 'All'} />
                  {file.specs?.pageCount && file.specs.pageCount > 1 && (
                    <FileSpecDetail label="Doc Pages" value={file.specs.pageCount} />
                  )}
                  <FileSpecDetail label="Color" value={file.specs?.color === 'color' ? 'Color' : 'B&W'} />
                  <FileSpecDetail label="Sides" value={file.specs?.sides === 'double' ? 'Double-Sided' : 'Single-Sided'} />
                </Box>
              </ListItem>
              {index < (job.files?.length || 0) - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, pt: 2, pb: 1 }}>
          {/* Status: Pending -> Accept & Print */}
          {job.status === 'pending' && (
            <Button
              size="small"
              variant="contained"
              color="primary"
              startIcon={isProcessing ? <CircularProgress size={16} color="inherit" /> : <PrintIcon />}
              onClick={() => onAcceptJob(job)}
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Accept & Print'}
            </Button>
          )}

          {/* Status: Awaiting Payment -> Can directly confirm payment */}
          {job.status === 'awaitingPayment' && (
            <Button
              size="small"
              variant="contained"
              color="warning"
              startIcon={<PaymentIcon />}
              onClick={() => onConfirmPayment ? onConfirmPayment(job.id) : onCompleteJob(job.id)}
            >
              Confirm Payment Received
            </Button>
          )}

          {/* Status: Payment Claimed -> Confirm Payment Received */}
          {job.status === 'paymentClaimed' && (
            <Button
              size="small"
              variant="contained"
              color={job.paymentMethod === 'cash' ? 'success' : 'warning'}
              startIcon={<PaymentIcon />}
              onClick={() => onConfirmPayment ? onConfirmPayment(job.id) : onCompleteJob(job.id)}
            >
              {job.paymentMethod === 'cash' ? 'Confirm Cash Received' : 'Confirm UPI Received'}
            </Button>
          )}

          {/* Status: Paid -> Mark Complete */}
          {job.status === 'paid' && (
            <Button
              size="small"
              variant="contained"
              color="success"
              startIcon={<CheckCircleIcon />}
              onClick={() => onCompleteJob(job.id)}
            >
              Mark Complete
            </Button>
          )}

          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => onDeleteJob(job.id)}
          >
            Delete
          </Button>
        </Box>
      </Collapse>
    </ListItem>
  );
}