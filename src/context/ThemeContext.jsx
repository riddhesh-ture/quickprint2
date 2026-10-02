// src/context/ThemeContext.jsx
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

const ThemeContext = createContext(null);

export const THEME_STORAGE_KEY = 'quickprint_theme';

export const THEME_COLORS = {
  light: {
    bg: '#faf8ff',
    surface: '#ffffff',
    surfaceSecondary: '#f1f5f9',
    surfaceTertiary: '#eaedff',
    border: '#e2e8f0',
    borderSubtle: '#f1f5f9',
    text: '#131b2e',
    textSecondary: '#475569',
    textMuted: '#94a3b8',
    primary: '#2563eb',
    primaryHover: '#1d4ed8',
    primaryContainer: '#eff6ff',
    success: '#10b981',
    successContainer: '#ecfdf5',
    warning: '#f59e0b',
    warningContainer: '#fffbeb',
  },
  dark: {
    bg: '#0f172a',
    surface: '#1e293b',
    surfaceSecondary: '#0f172a',
    surfaceTertiary: '#1e293b',
    border: '#334155',
    borderSubtle: '#1e293b',
    text: '#f8fafc',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    primary: '#3b82f6',
    primaryHover: '#2563eb',
    primaryContainer: 'rgba(37, 99, 235, 0.12)',
    success: '#10b981',
    successContainer: 'rgba(16, 185, 129, 0.12)',
    warning: '#f59e0b',
    warningContainer: 'rgba(245, 158, 11, 0.12)',
  },
};

export function ThemeContextProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored !== null) return stored === 'dark';
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    } catch {
      return false;
    }
  });

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light');
      } catch (err) {
        console.warn('Failed to persist theme:', err);
      }
      return next;
    });
  };

  const setTheme = (mode) => {
    const nextDark = mode === 'dark';
    setIsDark(nextDark);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextDark ? 'dark' : 'light');
    } catch (err) {
      console.warn('Failed to persist theme:', err);
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const value = useMemo(() => ({
    isDark,
    toggleTheme,
    setTheme,
    mode: isDark ? 'dark' : 'light',
    colors: isDark ? THEME_COLORS.dark : THEME_COLORS.light,
  }), [isDark]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Graceful fallback for components tested or rendered outside provider
    return {
      isDark: false,
      toggleTheme: () => {},
      setTheme: () => {},
      mode: 'light',
      colors: THEME_COLORS.light,
    };
  }
  return ctx;
}
