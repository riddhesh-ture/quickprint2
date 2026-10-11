import React, { createContext, useState, useEffect, useRef, useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { onIdTokenChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import { getMerchantProfile } from '../supabase/db';
import { Box, CircularProgress, Alert, Button, Typography } from '@mui/material';
import WifiOffIcon from '@mui/icons-material/WifiOff';

export const AuthContext = createContext();

const STORAGE_KEY = 'quickprint_merchant_session';

const getStoredSession = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(getStoredSession);
  // If we already have a cached merchant profile, don't block the UI with a full-page spinner
  const [loading, setLoading] = useState(() => !getStoredSession());
  const [authError, setAuthError] = useState(null);

  // Request sequence counter to discard stale out-of-order profile fetches
  const fetchSeqRef = useRef(0);

  const fetchProfile = async (uid, email, retries = 3) => {
    const currentSeq = ++fetchSeqRef.current;
    try {
      let profile = await getMerchantProfile(uid);

      // Race condition defense for merchant signup:
      if (!profile && retries > 0) {
        for (let i = 0; i < retries && !profile; i++) {
          await new Promise((res) => setTimeout(res, 350 * (i + 1)));
          if (currentSeq !== fetchSeqRef.current) return null;
          profile = await getMerchantProfile(uid);
        }
      }

      if (currentSeq !== fetchSeqRef.current) return null;

      if (profile) {
        setUserData(profile);
        setAuthError(null);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch {}
        return profile;
      } else {
        const fallback = { email, role: 'user' };
        setUserData((prev) => (prev?.role === 'merchant' ? prev : fallback));
        return fallback;
      }
    } catch (fetchErr) {
      console.warn("Could not fetch remote merchant profile, checking local session:", fetchErr);
      if (currentSeq === fetchSeqRef.current) {
        const cached = getStoredSession();
        if (cached && cached.role === 'merchant') {
          // Keep user logged in seamlessly with cached profile
          setUserData(cached);
          setAuthError(null);
          return cached;
        }
        setUserData((prev) => prev || null);
        setAuthError('Failed to load merchant profile. Please check your network connection.');
      }
      return null;
    }
  };

  useEffect(() => {
    // onIdTokenChanged fires on sign-in, sign-out, AND automatic token refresh (~every 1 hr)
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          setUser(firebaseUser);
          await fetchProfile(firebaseUser.uid, firebaseUser.email);
        } else {
          // User is signed out
          fetchSeqRef.current++;
          setUser(null);
          setUserData(null);
          setAuthError(null);
          try { localStorage.removeItem(STORAGE_KEY); } catch {}
        }
      } catch (err) {
        console.error("Auth state change error:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const refreshProfile = async (targetUid, targetEmail, directProfile = null) => {
    if (directProfile) {
      fetchSeqRef.current++;
      setUserData(directProfile);
      setAuthError(null);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(directProfile)); } catch {}
      return directProfile;
    }
    const currentUser = auth.currentUser;
    const uid = targetUid || user?.uid || currentUser?.uid;
    const email = targetEmail || user?.email || currentUser?.email;
    if (uid) {
      return await fetchProfile(uid, email, 1);
    }
    return null;
  };

  const setProfile = (profile) => {
    fetchSeqRef.current++;
    setUserData(profile);
    setAuthError(null);
    if (profile) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch {}
    } else {
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
    }
  };

  // The value includes user, userData, loading state, error state, refresh function, and direct setter
  const value = { user, userData, loading, authError, refreshProfile, setProfile };

  return (
    <AuthContext.Provider value={value}>
      {loading && !userData ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <CircularProgress />
        </Box>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export const MerchantAuthWrapper = () => (
  <AuthProvider>
    <Outlet />
  </AuthProvider>
);

export const MerchantProtectedRoute = () => {
  const context = useContext(AuthContext);
  const { user, userData, loading, authError, refreshProfile } = context || {};
  const [retrying, setRetrying] = useState(false);

  // If local merchant session exists, allow instant access without blocking
  if (userData?.role === 'merchant') {
    return <Outlet />;
  }

  if (loading && !userData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (user && authError && !userData) {
    const handleRetry = async () => {
      setRetrying(true);
      try {
        if (refreshProfile) await refreshProfile();
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
};