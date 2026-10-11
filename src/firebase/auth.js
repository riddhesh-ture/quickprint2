import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from './config';
import { upsertMerchantProfile, getMerchantProfile } from '../supabase/db';

// --- Merchant Authentication ---
export const signUpMerchant = async (email, password, profileData = {}) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  try {
    const profile = await upsertMerchantProfile(userCredential.user.uid, {
      email: userCredential.user.email,
      role: 'merchant',
      ...profileData,
    });
    return { userCredential, user: userCredential.user, profile };
  } catch (err) {
    try {
      await userCredential.user.delete();
    } catch (delErr) {
      console.error("Failed to delete orphaned Firebase merchant on signup failure:", delErr);
    }
    throw err;
  }
};

export const signInMerchant = (email, password) => {
  return signInWithEmailAndPassword(auth, email, password);
};

// --- Google Merchant Authentication ---
const createGoogleProvider = () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
};

export const signInWithGoogle = () => {
  const provider = createGoogleProvider();
  return signInWithPopup(auth, provider);
};

export const signInWithGoogleMerchant = async () => {
  const provider = createGoogleProvider();
  const userCredential = await signInWithPopup(auth, provider);
  const user = userCredential.user;
  let profile = null;
  try {
    profile = await getMerchantProfile(user.uid);
  } catch (err) {
    console.warn("Could not check merchant profile on Google sign-in:", err);
  }
  return { userCredential, user, profile };
};

export const completeGoogleMerchantSignup = async (profileData = {}, userOverride = null) => {
  const currentUser = userOverride || auth.currentUser;
  if (!currentUser) {
    throw new Error('No authenticated user found. Please authenticate with Google first.');
  }

  const profile = await upsertMerchantProfile(currentUser.uid, {
    email: currentUser.email,
    role: 'merchant',
    ...profileData,
  });

  return { user: currentUser, profile };
};

// --- General Sign Out ---
export const signOutUser = () => {
  return signOut(auth);
};