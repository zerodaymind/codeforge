import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';

const ThemeContext = createContext(null);
const THEME_STORAGE_KEY = 'codeforge-theme';

function getSystemPreference() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme() {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // Graceful fallback if localStorage is blocked
  }
  return 'system';
}

/**
 * ThemeProvider component that wraps the application.
 * Manages theme state ('light', 'dark', 'system'), resolves effective theme,
 * persists user choice in localStorage, synchronizes across browser tabs,
 * listens to OS preference changes, and updates data-bs-theme on document root.
 */
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getStoredTheme);
  const [systemTheme, setSystemTheme] = useState(getSystemPreference);

  // Compute resolved active theme ('light' | 'dark')
  const resolvedTheme = useMemo(() => {
    if (theme === 'dark') return 'dark';
    if (theme === 'light') return 'light';
    return systemTheme;
  }, [theme, systemTheme]);

  // Apply theme attributes to document element
  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', resolvedTheme);
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  // Theme updater with localStorage persistence
  const setTheme = useCallback((newTheme) => {
    if (newTheme !== 'light' && newTheme !== 'dark' && newTheme !== 'system') {
      return;
    }
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // Storage unavailable fallback
    }
  }, []);

  // Listen to OS system preference changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = (e) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleMediaChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMediaChange);
      } else if (mediaQuery.removeListener) {
        mediaQuery.removeListener(handleMediaChange);
      }
    };
  }, []);

  // Listen to cross-tab storage changes
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === THEME_STORAGE_KEY && e.newValue) {
        if (e.newValue === 'light' || e.newValue === 'dark' || e.newValue === 'system') {
          setThemeState(e.newValue);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      isDark: resolvedTheme === 'dark'
    }),
    [theme, resolvedTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export default ThemeContext;
export { ThemeContext };
