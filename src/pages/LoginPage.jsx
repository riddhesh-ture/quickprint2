// src/pages/LoginPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Paper, Typography, TextField, Button, Box, Link as MuiLink, Alert } from '@mui/material';
import { signInMerchant } from '../firebase/auth'; // Import our auth function

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInMerchant(email, password); // Call the simulated login
      navigate('/merchant/dashboard'); // Redirect on success
    } catch (err) {
      setError(err.message || 'Failed to log in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Typography component="h1" variant="h5">
          Merchant Login
        </Typography>
        <Box component="form" onSubmit={handleLogin} noValidate sx={{ mt: 1 }}>
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
          />
          {error && <Alert severity="error" sx={{ mt: 2, width: '100%' }}>{error}</Alert>}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Sign In'}
          </Button>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mt: 1 }}>
            <MuiLink component="button" variant="body2" onClick={() => navigate('/merchant/signup')}>
              Don't have an account? Sign Up
            </MuiLink>
            <MuiLink component="button" variant="body2" onClick={() => navigate('/')}>
              Scan QR (User)
            </MuiLink>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
}