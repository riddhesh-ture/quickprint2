// src/context/CustomerAuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import { setSupabaseAuthToken, setSupabaseAuthTokenProvider } from '../supabase/client';
import { upsertCustomerProfile, getCustomerProfile } from '../supabase/db';
import { signInCustomerWithGoogle, signOutUser } from '../firebase/auth';

export const CustomerAuthContext = createContext(null);

export const CustomerAuthProvider = ({ children }) => {
  const [customer, setCustomer] = useState(null);
  const [customerProfile, setCustomerProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const fetchSeqRef = useRef(0);

  // Register dynamic token provider for auto-refreshing expired customer Supabase requests
  useEffect(() => {
    setSupabaseAuthTokenProvider(async () => {
      const currentUser = auth.currentUser;
      if (currentUser && typeof currentUser.getIdToken === 'function') {
        try {
          return await currentUser.getIdToken(true);
        } catch (e) {
          console.warn('Could not refresh customer Firebase ID token:', e);
        }
      }
      return null;
    });
  }, []);

  useEffect(() => {
    // onIdTokenChanged fires on sign-in, sign-out, and token auto-refresh (~every 1 hr).
    // Note: This context NEVER queries public.merchants.
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      const currentSeq = ++fetchSeqRef.current;
      try {
        if (firebaseUser) {
          setCustomer(firebaseUser);
          try {
            const token = await firebaseUser.getIdToken();
            setSupabaseAuthToken(token);
          } catch (tokenErr) {
            console.warn('Could not forward customer ID token to Supabase client:', tokenErr);
          }

          // Fetch or resolve customer profile strictly from public.customers (never merchants)
          try {
            const profile = await getCustomerProfile(firebaseUser.uid);
            if (currentSeq === fetchSeqRef.current) {
              if (profile) {
                setCustomerProfile(profile);
              } else {
                setCustomerProfile({
                  id: firebaseUser.uid,
                  uid: firebaseUser.uid,
                  email: firebaseUser.email,
                  displayName: firebaseUser.displayName,
                  photoUrl: firebaseUser.photoURL,
                  photoURL: firebaseUser.photoURL,
                });
              }
            }
          } catch (profErr) {
            console.warn('Could not fetch customer profile:', profErr);
            if (currentSeq === fetchSeqRef.current) {
              setCustomerProfile({
                id: firebaseUser.uid,
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                photoUrl: firebaseUser.photoURL,
                photoURL: firebaseUser.photoURL,
              });
            }
          }
          if (currentSeq === fetchSeqRef.current) {
            setAuthError(null);
          }
        } else {
          if (currentSeq === fetchSeqRef.current) {
            setCustomer(null);
            setCustomerProfile(null);
            setAuthError(null);
          }
        }
      } catch (err) {
        console.error('Customer auth state change error:', err);
        if (currentSeq === fetchSeqRef.current) {
          setAuthError(err.message || 'Authentication error');
        }
      } finally {
        if (currentSeq === fetchSeqRef.current) {
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const { user } = await signInCustomerWithGoogle();
      // Advance fetch sequence to invalidate any racing background onIdTokenChanged callback
      fetchSeqRef.current++;
      setCustomer(user);

      const profilePayload = {
        id: user.uid,
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoUrl: user.photoURL,
        photoURL: user.photoURL,
      };

      try {
        const savedProfile = await upsertCustomerProfile(profilePayload);
        fetchSeqRef.current++;
        setCustomerProfile(savedProfile || profilePayload);
      } catch (upsertErr) {
        console.warn('Could not upsert customer profile on Google sign-in:', upsertErr);
        setCustomerProfile(profilePayload);
      }

      return user;
    } catch (err) {
      console.error('Customer Google sign-in failed:', err);
      if (err?.code === 'auth/popup-blocked') {
        setAuthError('Sign-in popup was blocked by your browser. Please allow popups for this site and try again.');
      } else if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        setAuthError(err.message || 'Google sign-in failed');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await signOutUser();
      fetchSeqRef.current++;
      setCustomer(null);
      setCustomerProfile(null);
      setAuthError(null);
      setSupabaseAuthToken(null);
    } catch (err) {
      console.error('Customer sign out failed:', err);
      setAuthError(err.message || 'Sign out failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshCustomerProfile = useCallback(async () => {
    if (!customer?.uid) return null;
    try {
      const profile = await getCustomerProfile(customer.uid);
      if (profile) {
        fetchSeqRef.current++;
        setCustomerProfile(profile);
      }
      return profile;
    } catch (err) {
      console.warn('Error refreshing customer profile:', err);
      return null;
    }
  }, [customer?.uid]);

  const value = useMemo(() => ({
    customer,
    user: customer,
    customerProfile,
    isAuthenticated: Boolean(customer),
    loading,
    authError,
    signInWithGoogle: loginWithGoogle,
    signOut: logout,
    refreshCustomerProfile,
  }), [customer, customerProfile, loading, authError, loginWithGoogle, logout, refreshCustomerProfile]);

  return (
    <CustomerAuthContext.Provider value={value}>
      {children}
    </CustomerAuthContext.Provider>
  );
};

export const useCustomerAuth = () => {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    return {
      customer: null,
      user: null,
      customerProfile: null,
      isAuthenticated: false,
      loading: false,
      authError: null,
      signInWithGoogle: async () => null,
      signOut: async () => {},
      refreshCustomerProfile: async () => null,
    };
  }
  return context;
};
