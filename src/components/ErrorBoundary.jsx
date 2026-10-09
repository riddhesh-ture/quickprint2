// src/components/ErrorBoundary.jsx
import React from 'react';
import { Box, Typography, Button, Container, Paper } from '@mui/material';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught render error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <Container maxWidth="xs" sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
          <Paper
            elevation={0}
            sx={{
              p: 3.5,
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              textAlign: 'center',
              bgcolor: '#ffffff',
            }}
          >
            <Typography variant="h3" sx={{ mb: 1 }}>⚠️</Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1, color: '#0f172a' }}>
              Something went wrong
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mb: 3, fontSize: '0.85rem' }}>
              We encountered an unexpected display issue. Your documents and data are safe.
            </Typography>
            <Button
              variant="contained"
              fullWidth
              onClick={this.handleReset}
              sx={{
                bgcolor: '#2563eb',
                py: 1.25,
                borderRadius: '12px',
                fontWeight: 700,
                textTransform: 'none',
              }}
            >
              Return to Home
            </Button>
          </Paper>
        </Container>
      );
    }

    return this.props.children;
  }
}
