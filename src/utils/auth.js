/**
 * Authentication Storage Utility for CodeForge
 * Provides centralized management of JWT tokens and safe user profiles in browser storage.
 *
 * IMPORTANT SECURITY NOTE:
 * For this student project, JWT is stored in localStorage as required for the milestone.
 * In production systems, HttpOnly + Secure + SameSite cookies are generally preferred to
 * reduce token exposure to XSS.
 *
 * NEVER store passwords or passwordHash in storage.
 */

export const STORAGE_KEY_AUTH = 'codeforge_auth';

/**
 * Safely retrieves and parses stored authentication data.
 * If data is corrupted or invalid, cleans storage and returns null.
 * @returns {{ token: string, user: object } | null}
 */
export const getStoredAuth = () => {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUTH);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.token && parsed.user) {
      return parsed;
    }

    // Invalid format, clean storage
    localStorage.removeItem(STORAGE_KEY_AUTH);
    return null;
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEY_AUTH);
    } catch {
      // ignore
    }
    return null;
  }
};

/**
 * Returns the current JWT token string or null.
 * @returns {string | null}
 */
export const getToken = () => {
  const auth = getStoredAuth();
  return auth ? auth.token : null;
};

/**
 * Returns the stored safe user object or null.
 * @returns {object | null}
 */
export const getStoredUser = () => {
  const auth = getStoredAuth();
  return auth ? auth.user : null;
};

/**
 * Stores token and safe user profile in localStorage under single key.
 * @param {string} token
 * @param {object} user
 */
export const setAuth = (token, user) => {
  if (typeof localStorage === 'undefined') return false;
  try {
    // Only persist non-sensitive user attributes
    const safeUser = {
      id: user.id || user._id,
      fullName: user.fullName,
      email: user.email,
      gender: user.gender,
      experience: user.experience,
      interests: user.interests || []
    };

    localStorage.setItem(
      STORAGE_KEY_AUTH,
      JSON.stringify({ token, user: safeUser })
    );
    return true;
  } catch {
    return false;
  }
};

/**
 * Clears authentication credentials from storage.
 */
export const clearAuth = () => {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.removeItem(STORAGE_KEY_AUTH);
    return true;
  } catch {
    return false;
  }
};

/**
 * Checks whether an authentication token is present in storage.
 * @returns {boolean}
 */
export const isAuthenticated = () => {
  return Boolean(getToken());
};
