// src/pages/LoginPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Link as MuiLink,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import { signInMerchant, signInWithGoogleMerchant } from '../firebase/auth';
import { useAuth } from '../hooks/useAuth';
import GoogleIcon from '../components/GoogleIcon';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userData, loading, authError, refreshProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(location.state?.notice || null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGoogleProcessing, setIsGoogleProcessing] = useState(false);

  // If a merchant is already logged in, redirect them immediately.
  useEffect(() => {
    if (!loading && user && userData?.role === 'merchant') {
      navigate('/merchant/dashboard', { replace: true });
    }
  }, [user, userData, loading, navigate]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsProcessing(true);
    try {
      await signInMerchant(email, password);
      // On success, the AuthContext will update, and the useEffect above will trigger the redirect.
    } catch (err) {
      setError(err.message || 'Failed to log in. Please check your credentials.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setNotice(null);
    setIsProcessing(true);
    setIsGoogleProcessing(true);

    try {
      const { user: googleUser, profile } = await signInWithGoogleMerchant();

      if (profile && profile.role === 'merchant') {
        // Existing merchant profile found: update auth context and redirect to dashboard
        if (refreshProfile) {
          await refreshProfile(googleUser.uid, googleUser.email, profile);
        }
        navigate('/merchant/dashboard', { replace: true });
      } else {
        // No merchant profile exists for that Google account:
        // Redirect to complete shop registration
        navigate('/merchant/signup', {
          state: {
            fromGoogleLogin: true,
            email: googleUser.email,
            displayName: googleUser.displayName,
            notice: `No merchant profile found for ${googleUser.email}. Please complete your shop registration below to start accepting orders.`,
          },
          replace: true,
        });
      }
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') {
        // User closed the popup, do not show error
        return;
      }
      if (err.code === 'auth/popup-blocked') {
        setError('Popup was blocked by your browser. Please allow popups for this site and try again.');
        return;
      }
      if (err.code === 'auth/unauthorized-domain') {
        setError('This domain is not authorized for Google sign-in in Firebase Console. Please add it to your Authorized Domains list.');
        return;
      }
      if (err.code === 'auth/operation-not-allowed') {
        setError('Google Sign-In is not enabled in your Firebase project. Please enable it in Firebase Console.');
        return;
      }
      setError(err.message || 'Failed to sign in with Google. Please try again.');
    } finally {
      setIsProcessing(false);
      setIsGoogleProcessing(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Typography component="h1" variant="h5" fontWeight="bold">
          Merchant Login
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1 }}>
          Sign in to manage your QuickPrint print station
        </Typography>

        {notice && (
          <Alert severity="info" sx={{ mt: 2, width: '100%' }}>
            {notice}
          </Alert>
        )}

        {(error || (!userData && authError)) && (
          <Alert severity="error" sx={{ mt: 2, width: '100%' }}>
            {error || authError}
          </Alert>
        )}

        <Box component="form" onSubmit={handleLogin} noValidate sx={{ mt: 1, width: '100%' }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email Address"
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isProcessing}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isProcessing}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 2.5, mb: 2, py: 1.2, fontWeight: 600 }}
            disabled={isProcessing}
          >
            {isProcessing && !isGoogleProcessing ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
          </Button>

          <Divider sx={{ my: 2 }}>
            <Typography variant="body2" color="text.secondary">
              OR
            </Typography>
          </Divider>

          <Button
            fullWidth
            variant="outlined"
            onClick={handleGoogleLogin}
            disabled={isProcessing}
            startIcon={isGoogleProcessing ? null : <GoogleIcon />}
            sx={{
              py: 1.2,
              borderColor: '#dadce0',
              color: '#3c4043',
              backgroundColor: '#fff',
              textTransform: 'none',
              fontSize: '0.95rem',
              fontWeight: 500,
              boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
              '&:hover': {
                backgroundColor: '#f8f9fa',
                borderColor: '#dadce0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              },
            }}
          >
            {isGoogleProcessing ? <CircularProgress size={24} color="inherit" /> : 'Continue with Google'}
          </Button>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mt: 3 }}>
            <MuiLink
              component="button"
              type="button"
              variant="body2"
              onClick={() => navigate('/merchant/signup')}
              disabled={isProcessing}
            >
              Don't have an account? Sign Up
            </MuiLink>
            <MuiLink
              component="button"
              type="button"
              variant="body2"
              onClick={() => navigate('/')}
              disabled={isProcessing}
            >
              Go to User Area
            </MuiLink>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
}