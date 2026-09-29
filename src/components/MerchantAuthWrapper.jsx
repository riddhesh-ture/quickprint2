import React, { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Box, CircularProgress, Alert, Button, Typography } from '@mui/material';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import { AuthProvider } from '../context/AuthContext';
import { useAuth } from '../hooks/useAuth';

/**
 * Wraps all merchant portal routes with AuthProvider.
 * This ensures Firebase Auth is only initialized when visiting merchant routes (/merchant/*),
 * leaving public routes (/, /print) 100% free of Firebase network calls and loading blockers.
 */
export function MerchantAuthWrapper() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

/**
 * Protected route wrapper requiring authenticated merchant role.
 */
export function MerchantProtectedRoute() {
  const { user, userData, loading, authError, refreshProfile } = useAuth();
  const [retrying, setRetrying] = useState(false);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // If user is authenticated in Firebase but profile failed to load due to network error,
  // do NOT log them out. Show a retryable screen instead.
  if (user && authError && !userData) {
    const handleRetry = async () => {
      setRetrying(true);
      try {
        await refreshProfile();
      } finally {
        setRetrying(false);
      }
    };

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', p: 3, textAlign: 'center' }}>
        <WifiOffIcon sx={{ fontSize: 56, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          Unable to Load Merchant Profile
        </Typography>
        <Alert severity="error" sx={{ mb: 3, maxWidth: 440 }}>
          {authError}
        </Alert>
        <Button variant="contained" disabled={retrying} onClick={handleRetry}>
          {retrying ? <CircularProgress size={24} color="inherit" /> : 'Retry Connection'}
        </Button>
      </Box>
    );
  }

  if (!user || userData?.role !== 'merchant') {
    return <Navigate to="/merchant/login" replace />;
  }

  return <Outlet />;
}

export default MerchantAuthWrapper;
