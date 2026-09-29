import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      user: null,
      userData: null,
      loading: false,
      authError: null,
      refreshProfile: async () => {},
    };
  }
  return context;
};