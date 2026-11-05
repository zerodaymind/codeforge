import { useContext } from 'react';
import { AuthContext } from './AuthContext';

/**
 * Hook to consume AuthContext cleanly across components.
 * @returns {{ user: object | null, token: string | null, isAuthenticated: boolean, isLoading: boolean, login: Function, logout: Function }}
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default useAuth;
