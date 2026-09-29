import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth } from './config';
import { upsertMerchantProfile } from '../supabase/db';

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

// --- General Sign Out ---
export const signOutUser = () => {
  return signOut(auth);
};