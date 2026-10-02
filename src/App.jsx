// src/App.jsx
import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';

// Lazy-loaded Pages for code-splitting
const HomePage = lazy(() => import('./pages/HomePage'));
const UserPrintPage = lazy(() => import('./pages/UserPrintPage'));
const PaymentSelectionPage = lazy(() => import('./pages/PaymentSelectionPage'));
const OrderReceiptPendingPage = lazy(() => import('./pages/OrderReceiptPendingPage'));
const OrderReceiptCompletedPage = lazy(() => import('./pages/OrderReceiptCompletedPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const MerchantDashboardPage = lazy(() => import('./pages/MerchantDashboardPage'));
const MerchantAnalyticsPage = lazy(() => import('./pages/MerchantAnalyticsPage'));
const MerchantSettingsPage = lazy(() => import('./pages/MerchantSettingsPage'));

// Merchant Auth Wrapper & Protected Route (Lazy-loaded to isolate Firebase from public entry)
const MerchantAuthWrapper = lazy(() => import('./components/MerchantAuthWrapper'));
const MerchantProtectedRoute = lazy(() => import('./components/MerchantAuthWrapper').then(m => ({ default: m.MerchantProtectedRoute })));

// Layout
const MerchantLayout = lazy(() => import('./components/Layout/MerchantLayout'));

const RouteLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
    <CircularProgress />
  </Box>
);

export default function App() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        {/* Public Routes - Zero Firebase / Zero Blocking Spinners */}
        <Route path="/" element={<HomePage />} />
        <Route path="/print" element={<UserPrintPage />} />
        <Route path="/payment" element={<PaymentSelectionPage />} />
        <Route path="/receipt/pending" element={<OrderReceiptPendingPage />} />
        <Route path="/receipt/completed" element={<OrderReceiptCompletedPage />} />

        {/* Merchant Routes wrapped in AuthProvider */}
        <Route element={<MerchantAuthWrapper />}>
          <Route path="/merchant/login" element={<LoginPage />} />
          <Route path="/merchant/signup" element={<SignupPage />} />
          <Route element={<MerchantProtectedRoute />}>
            <Route element={<MerchantLayout />}>
              <Route path="/merchant/dashboard" element={<MerchantDashboardPage />} />
              <Route path="/merchant/analytics" element={<MerchantAnalyticsPage />} />
              <Route path="/merchant/settings" element={<MerchantSettingsPage />} />
            </Route>
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}