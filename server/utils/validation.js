/**
 * Server-Side Validation Utilities
 * Authoritative input validation for CodeForge user registration and authentication.
 */

const hasControlChars = (str) => {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if ((code >= 0 && code <= 31) || (code >= 127 && code <= 159)) {
      return true;
    }
  }
  return false;
};

/**
 * Validates full name:
 * - String type, non-empty, non-whitespace
 * - Normalized length: 2 to 70 characters
 * - No control characters or HTML markup (<, >)
 * - Allows Unicode letters (\p{L}), marks (\p{M}), spaces, hyphens, periods, apostrophes
 * - Must contain at least 2 Unicode letters
 */
export const validateName = (name) => {
  if (name === null || name === undefined || typeof name !== 'string') {
    return { isValid: false, message: 'Full name is required.' };
  }

  // Reject control characters
  if (hasControlChars(name)) {
    return { isValid: false, message: 'Full name cannot contain control characters.' };
  }

  // Reject HTML tags / markup
  if (/[<>]/.test(name)) {
    return { isValid: false, message: 'Full name cannot contain HTML or angle brackets.' };
  }

  // Normalize whitespace: trim and collapse multiple internal spaces
  const normalized = name.trim().replace(/\s+/g, ' ');

  if (normalized.length === 0) {
    return { isValid: false, message: 'Full name is required.' };
  }

  if (normalized.length < 2) {
    return { isValid: false, message: 'Full name must be at least 2 characters long.' };
  }

  if (normalized.length > 70) {
    return { isValid: false, message: 'Full name cannot exceed 70 characters.' };
  }

  // Character allowlist: Unicode letters, marks, numbers, spaces, periods, apostrophes, hyphens
  const validCharsRegex = /^[\p{L}\p{M}0-9\s.'’-]+$/u;
  if (!validCharsRegex.test(normalized)) {
    return { isValid: false, message: 'Full name can only contain letters, numbers, spaces, hyphens, periods, and apostrophes.' };
  }

  // Require at least two Unicode letters (strictly rejects numeric-only and symbols-only)
  const letters = normalized.match(/[\p{L}\p{M}]/gu) || [];
  if (letters.length < 2) {
    return { isValid: false, message: 'Full name must contain at least 2 letters.' };
  }

  return { isValid: true, message: 'Looks good!', normalized };
};

/**
 * Validates email address:
 * - String type, non-empty, non-whitespace
 * - Max total length 254
 * - No embedded spaces or control characters
 * - Exactly one '@'
 * - Local part: 1-64 chars, no consecutive dots, no leading/trailing dot, valid chars (supports plus-addressing)
 * - Domain part: 1-253 chars, at least two labels, no consecutive dots, no leading/trailing dot
 * - Domain labels: 1-63 chars, alphanumeric/hyphen, no leading/trailing hyphens
 * - TLD: at least 2 letters
 */
export const validateEmail = (email) => {
  if (email === null || email === undefined || typeof email !== 'string') {
    return { isValid: false, message: 'Email address is required.' };
  }

  const trimmed = email.trim();
  if (trimmed.length === 0) {
    return { isValid: false, message: 'Email address is required.' };
  }

  if (trimmed.length > 254) {
    return { isValid: false, message: 'Email address cannot exceed 254 characters.' };
  }

  if (/\s/.test(trimmed)) {
    return { isValid: false, message: 'Email address cannot contain spaces.' };
  }

  if (hasControlChars(trimmed)) {
    return { isValid: false, message: 'Email address cannot contain control characters.' };
  }

  const parts = trimmed.split('@');
  if (parts.length !== 2) {
    return { isValid: false, message: 'Please enter a valid email address with a single "@".' };
  }

  const [localPart, domainPart] = parts;

  if (localPart.length === 0) {
    return { isValid: false, message: 'Email address is missing a username before the "@".' };
  }

  if (localPart.length > 64) {
    return { isValid: false, message: 'Email username part cannot exceed 64 characters.' };
  }

  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    return { isValid: false, message: 'Email username cannot start or end with a period.' };
  }

  if (localPart.includes('..')) {
    return { isValid: false, message: 'Email username cannot contain consecutive periods.' };
  }

  const localRegex = /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
  if (!localRegex.test(localPart)) {
    return { isValid: false, message: 'Email username contains invalid characters.' };
  }

  if (domainPart.length === 0) {
    return { isValid: false, message: 'Email address is missing a domain after the "@".' };
  }

  if (domainPart.length > 253) {
    return { isValid: false, message: 'Email domain part cannot exceed 253 characters.' };
  }

  if (domainPart.startsWith('.') || domainPart.endsWith('.')) {
    return { isValid: false, message: 'Email domain cannot start or end with a period.' };
  }

  if (domainPart.includes('..')) {
    return { isValid: false, message: 'Email domain cannot contain consecutive periods.' };
  }

  const labels = domainPart.split('.');
  if (labels.length < 2) {
    return { isValid: false, message: 'Email address must include a valid top-level domain (e.g., .com).' };
  }

  for (const label of labels) {
    if (label.length === 0 || label.length > 63) {
      return { isValid: false, message: 'Domain labels must be between 1 and 63 characters.' };
    }
    if (label.startsWith('-') || label.endsWith('-')) {
      return { isValid: false, message: 'Domain labels cannot start or end with a hyphen.' };
    }
    if (!/^[a-zA-Z0-9-]+$/.test(label)) {
      return { isValid: false, message: 'Email domain contains invalid characters.' };
    }
  }

  const tld = labels[labels.length - 1];
  if (!/^[a-zA-Z]{2,}$/.test(tld)) {
    return { isValid: false, message: 'Email top-level domain must contain at least 2 letters.' };
  }

  return { isValid: true, message: 'Email address looks good.', normalized: trimmed.toLowerCase() };
};

/**
 * Validates password:
 * - String type, min 8 characters
 * - Max 72 bytes (Bcrypt 72-byte limit to prevent silent truncation)
 * - Must contain at least one letter and at least one number
 */
export const validatePassword = (password) => {
  if (password === null || password === undefined || password === '') {
    return { isValid: false, message: 'Password is required.' };
  }

  if (typeof password !== 'string') {
    return { isValid: false, message: 'Password must be a string.' };
  }

  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long.' };
  }

  const byteLength = typeof Buffer !== 'undefined' && typeof Buffer.byteLength === 'function'
    ? Buffer.byteLength(password, 'utf8')
    : new TextEncoder().encode(password).length;

  if (byteLength > 72) {
    return { isValid: false, message: 'Password cannot exceed 72 bytes.' };
  }

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (!hasLetter || !hasNumber) {
    return { isValid: false, message: 'Password must contain at least one letter and one number.' };
  }

  return { isValid: true, message: 'Password meets all security criteria.' };
};

export const isValidEmail = (email) => {
  return validateEmail(email).isValid;
};

export const isValidPassword = (password) => {
  return validatePassword(password).isValid;
};
