import { useContext } from 'react';
import { ThemeContext } from './ThemeContext';

/**
 * Hook to consume ThemeContext cleanly across components.
 * @returns {{ theme: 'light' | 'dark' | 'system', resolvedTheme: 'light' | 'dark', setTheme: Function, isDark: boolean }}
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default useTheme;
