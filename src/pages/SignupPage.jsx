// src/pages/SignupPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Container, Paper, Typography, TextField, Button, Box, Alert,
  Stepper, Step, StepLabel, InputAdornment, Divider, Chip, CircularProgress
} from '@mui/material';
import StorefrontIcon from '@mui/icons-material/Storefront';
import PersonIcon from '@mui/icons-material/Person';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PaymentIcon from '@mui/icons-material/Payment';
import {
  signUpMerchant,
  signInWithGoogleMerchant,
  completeGoogleMerchantSignup,
  signOutUser,
} from '../firebase/auth';
import { useAuth } from '../hooks/useAuth';
import GoogleIcon from '../components/GoogleIcon';

const steps = ['Account', 'Shop Details', 'Payment'];

export default function SignupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userData, loading: authLoading, refreshProfile } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(location.state?.notice || null);
  const [loading, setLoading] = useState(false);
  const [isGoogleProcessing, setIsGoogleProcessing] = useState(false);

  // Authentication method state: true when merchant authenticated with Google
  const [isGoogleAuth, setIsGoogleAuth] = useState(false);

  // Step 1: Account
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2: Shop Details
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');

  // Step 3: Payment & Pricing
  const [upiId, setUpiId] = useState('');
  const [pricePerPageBW, setPricePerPageBW] = useState('2');
  const [pricePerPageColor, setPricePerPageColor] = useState('5');

  // Handle existing logged-in merchant or Google user redirect
  useEffect(() => {
    // If user is already a registered merchant, redirect to dashboard
    if (!authLoading && user && userData?.role === 'merchant') {
      navigate('/merchant/dashboard', { replace: true });
      return;
    }

    // Check if user is authenticated via Google (e.g. redirected from LoginPage or refreshed page)
    const isGoogleUser = user?.providerData?.some((p) => p.providerId === 'google.com');
    if ((location.state?.fromGoogleLogin || isGoogleUser) && user) {
      setIsGoogleAuth(true);
      if (user.email) setEmail(user.email);
      if (user.displayName) {
        setOwnerName((prev) => prev || user.displayName);
      }
      if (location.state?.fromGoogleLogin) {
        setActiveStep(1); // Auto-advance to Shop Details
      }
    } else if (location.state?.email) {
      if (location.state.email) setEmail(location.state.email);
      if (location.state.displayName) {
        setOwnerName((prev) => prev || location.state.displayName);
      }
    }
  }, [user, userData, authLoading, navigate, location.state]);

  const handleGoogleSignup = async () => {
    setError(null);
    setNotice(null);
    setIsGoogleProcessing(true);

    try {
      const { user: googleUser, profile } = await signInWithGoogleMerchant();

      if (profile && profile.role === 'merchant') {
        // Merchant profile already exists!
        setNotice('Merchant profile already exists for this Google account. Redirecting to your dashboard...');
        if (refreshProfile) {
          await refreshProfile(googleUser.uid, googleUser.email, profile);
        }
        setTimeout(() => {
          navigate('/merchant/dashboard', { replace: true });
        }, 1200);
        return;
      }

      // New merchant with Google
      setIsGoogleAuth(true);
      setEmail(googleUser.email || '');
      if (googleUser.displayName) {
        setOwnerName((prev) => prev || googleUser.displayName);
      }
      setActiveStep(1); // Advance to Shop Details!
      setNotice(`Signed in with Google as ${googleUser.email}. Please fill in your shop details below.`);
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') {
        return;
      }
      if (err.code === 'auth/popup-blocked') {
        setError('Popup was blocked by your browser. Please allow popups for this site and try again.');
        return;
      }
      if (err.code === 'auth/unauthorized-domain') {
        setError('This domain is not authorized for Google sign-in in Firebase Console. Please add it to Authorized Domains.');
        return;
      }
      if (err.code === 'auth/operation-not-allowed') {
        setError('Google Sign-In is not enabled in your Firebase project. Please enable it in Firebase Console.');
        return;
      }
      setError(err.message || 'Failed to authenticate with Google.');
    } finally {
      setIsGoogleProcessing(false);
    }
  };

  const handleSwitchAccount = async () => {
    try {
      await signOutUser();
    } catch (err) {
      console.warn('Sign out error:', err);
    }
    setIsGoogleAuth(false);
    setEmail('');
    setOwnerName('');
    setPassword('');
    setConfirmPassword('');
    setNotice(null);
    setError(null);
    setActiveStep(0);
  };

  const handleNext = () => {
    setError(null);
    
    // Validate current step
    if (activeStep === 0) {
      if (isGoogleAuth) {
        if (!email) {
          setError('Google account email is missing. Please sign in with Google again.');
          return;
        }
      } else {
        if (!email || !password || !confirmPassword) {
          setError('Please fill all fields');
          return;
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          return;
        }
      }
    } else if (activeStep === 1) {
      if (!shopName.trim() || !ownerName.trim() || !phone.trim() || !address.trim() || !city.trim() || !pincode.trim()) {
        setError('Please fill all shop details');
        return;
      }
      if (phone.trim().length !== 10) {
        setError('Please enter a valid 10-digit phone number');
        return;
      }
      if (pincode.trim().length !== 6) {
        setError('Please enter a valid 6-digit pincode');
        return;
      }
    }
    
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanUpi = upiId ? upiId.trim().toLowerCase() : '';
    if (!cleanUpi) {
      setError('Please enter your UPI ID for receiving payments');
      return;
    }

    if (!cleanUpi.includes('@')) {
      setError('Please enter a valid UPI ID (e.g., yourname@upi)');
      return;
    }

    setLoading(true);

    try {
      const profilePayload = {
        shopName: shopName.trim(),
        ownerName: ownerName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        pincode: pincode.trim(),
        upiId: cleanUpi,
        pricePerPageBW: parseFloat(pricePerPageBW) || 2,
        pricePerPageColor: parseFloat(pricePerPageColor) || 5,
        stats: {
          totalPrints: 0,
          totalEarnings: 0,
          todayPrints: 0,
          todayEarnings: 0,
          monthPrints: 0,
          monthEarnings: 0,
          lastResetDate: new Date().toISOString().split('T')[0],
          lastResetMonth: new Date().toISOString().slice(0, 7),
        },
      };

      let profile;
      let uid;

      if (isGoogleAuth) {
        // Authenticated with Google: upsert profile directly for the Google user
        const res = await completeGoogleMerchantSignup(profilePayload);
        profile = res.profile;
        uid = res.user.uid;
      } else {
        // Standard email/password signup
        const signupRes = await signUpMerchant(email, password, profilePayload);
        uid = signupRes?.user?.uid || signupRes?.userCredential?.user?.uid;
        profile = signupRes?.profile;
      }

      // Ensure AuthContext profile is populated with merchant role before navigating
      if (refreshProfile) {
        await refreshProfile(uid, email, profile);
      }

      navigate('/merchant/dashboard');
    } catch (err) {
      console.error('Signup error:', err);
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        if (isGoogleAuth) {
          return (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="h6" gutterBottom>
                <PersonIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Your Account
              </Typography>
              <Paper variant="outlined" sx={{ p: 2.5, bgcolor: 'background.default', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                  <GoogleIcon />
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Signed in with Google
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {email}
                    </Typography>
                  </Box>
                  <Chip label="Verified" color="success" size="small" />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Your account is securely authenticated with Google. No separate password needed.
                </Typography>
                <Button
                  size="small"
                  variant="text"
                  color="secondary"
                  onClick={handleSwitchAccount}
                  disabled={loading}
                >
                  Use a different account / Email
                </Button>
              </Paper>
            </Box>
          );
        }

        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6" gutterBottom>
              <PersonIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Create Your Account
            </Typography>

            <Button
              fullWidth
              variant="outlined"
              onClick={handleGoogleSignup}
              disabled={loading || isGoogleProcessing}
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
              {isGoogleProcessing ? <CircularProgress size={24} color="inherit" /> : 'Sign up with Google'}
            </Button>

            <Divider sx={{ my: 1 }}>
              <Typography variant="caption" color="text.secondary">
                OR SIGN UP WITH EMAIL
              </Typography>
            </Divider>

            <TextField
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              required
              helperText="At least 6 characters"
            />
            <TextField
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              fullWidth
              required
            />
          </Box>
        );
      case 1:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6" gutterBottom>
              <StorefrontIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Shop Details
            </Typography>
            <TextField
              label="Shop Name"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              fullWidth
              required
              placeholder="e.g., Krishna Xerox & Printing"
            />
            <TextField
              label="Owner Name"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              fullWidth
              required
              placeholder="e.g., Ramesh Kumar"
            />
            <TextField
              label="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              fullWidth
              required
              InputProps={{
                startAdornment: <InputAdornment position="start">+91</InputAdornment>,
              }}
            />
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2" color="text.secondary">
              <LocationOnIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 18 }} />
              Shop Address
            </Typography>
            <TextField
              label="Street Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              fullWidth
              required
              multiline
              rows={2}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                fullWidth
                required
              />
              <TextField
                label="Pincode"
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                fullWidth
                required
              />
            </Box>
          </Box>
        );
      case 2:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6" gutterBottom>
              <PaymentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Payment & Pricing
            </Typography>
            <Alert severity="info" sx={{ mb: 1 }}>
              Customers will pay directly to your UPI ID. We don't charge any commission!
            </Alert>
            <TextField
              label="Your UPI ID"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value.toLowerCase())}
              fullWidth
              required
              placeholder="yourname@upi"
              helperText="This is where customers will send payments"
            />
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2" color="text.secondary">
              Set Your Printing Prices
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Price per page (B&W)"
                value={pricePerPageBW}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                    setPricePerPageBW(val);
                  }
                }}
                fullWidth
                InputProps={{
                  startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                }}
              />
              <TextField
                label="Price per page (Color)"
                value={pricePerPageColor}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                    setPricePerPageColor(val);
                  }
                }}
                fullWidth
                InputProps={{
                  startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                }}
              />
            </Box>
          </Box>
        );
      default:
        return null;
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <StorefrontIcon sx={{ fontSize: 50, color: 'primary.main' }} />
          <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
            Merchant Signup
          </Typography>
          <Typography color="text.secondary">
            Join QuickPrint and start receiving print orders
          </Typography>
        </Box>

        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {notice && <Alert severity="info" sx={{ mb: 2 }}>{notice}</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <form onSubmit={handleSubmit}>
          {renderStepContent(activeStep)}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
            <Button
              disabled={activeStep === 0 || loading || isGoogleProcessing}
              onClick={handleBack}
            >
              Back
            </Button>
            {activeStep === steps.length - 1 ? (
              <Button
                type="submit"
                variant="contained"
                disabled={loading || isGoogleProcessing}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Create Account'}
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={loading || isGoogleProcessing}
              >
                Next
              </Button>
            )}
          </Box>
        </form>

        <Divider sx={{ my: 3 }} />

        <Typography variant="body2" align="center" color="text.secondary">
          Already have an account?{' '}
          <Link to="/merchant/login" style={{ color: 'inherit', fontWeight: 600 }}>
            Login here
          </Link>
        </Typography>
      </Paper>
    </Container>
  );
}