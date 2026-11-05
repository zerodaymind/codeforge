import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import { getStoredAuth, setAuth as persistAuth, clearAuth as removePersistedAuth } from '../utils/auth';
import { apiFetch } from '../utils/api';

const AuthContext = createContext(null);

/**
 * AuthProvider component to wrap the React application.
 * Manages JWT authentication state, persistent sessions, and server synchronization.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize and verify authentication on application mount
  useEffect(() => {
    const initAuth = async () => {
      const stored = getStoredAuth();

      if (!stored || !stored.token) {
        setUser(null);
        setToken(null);
        setIsLoading(false);
        return;
      }

      try {
        // Verify token with backend /api/auth/me via centralized relative-aware API client
        const result = await apiFetch('/api/auth/me');

        if (result.ok && result.data && result.data.success && result.data.user) {
          setUser(result.data.user);
          setToken(stored.token);
          // Refresh storage with latest server user details
          persistAuth(stored.token, result.data.user);
        } else if (result.status === 401 || (result.status >= 400 && result.status < 500)) {
          // Token invalid, expired, or forbidden (401/403)
          removePersistedAuth();
          setUser(null);
          setToken(null);
        } else if (stored.user) {
          // Server unreachable or temporary network disruption; fall back gracefully to stored safe user
          setUser(stored.user);
          setToken(stored.token);
        } else {
          removePersistedAuth();
          setUser(null);
          setToken(null);
        }
      } catch {
        // If unexpected client error occurs, fall back gracefully to stored safe user
        if (stored.user) {
          setUser(stored.user);
          setToken(stored.token);
        } else {
          removePersistedAuth();
          setUser(null);
          setToken(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // Listen for unauthorized events to automatically reset state
  useEffect(() => {
    const handleUnauthorized = () => {
      setToken(null);
      setUser(null);
      removePersistedAuth();
    };

    window.addEventListener('codeforge:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('codeforge:unauthorized', handleUnauthorized);
    };
  }, []);

  /**
   * Log in user: updates React state and persists token + safe user profile.
   * @param {string} newToken
   * @param {object} newUser
   */
  const login = useCallback((newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    persistAuth(newToken, newUser);
  }, []);

  /**
   * Log out user: clears state and removes stored credentials.
   */
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    removePersistedAuth();
  }, []);

  /**
   * Update current user profile without altering or invalidating the active JWT token.
   * Avoids unnecessary state updates if attributes are unchanged.
   * @param {object} updatedUser
   */
  const updateUser = useCallback((updatedUser) => {
    if (!updatedUser || typeof updatedUser !== 'object') return;
    setUser((prev) => {
      let hasChanged = false;
      if (!prev) {
        hasChanged = true;
      } else {
        for (const key of Object.keys(updatedUser)) {
          if (prev[key] !== updatedUser[key]) {
            hasChanged = true;
            break;
          }
        }
      }
      if (!hasChanged) return prev;

      const merged = { ...prev, ...updatedUser };
      const currentToken = getStoredAuth()?.token || null;
      if (currentToken) {
        persistAuth(currentToken, merged);
      }
      return merged;
    });
  }, []);

  const value = useMemo(() => ({
    user,
    token,
    isAuthenticated: Boolean(token && user),
    isLoading,
    login,
    logout,
    updateUser
  }), [user, token, isLoading, login, logout, updateUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
export { AuthContext };
