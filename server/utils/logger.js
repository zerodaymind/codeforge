/**
 * Structured Logger for CodeForge
 * Provides level-based structured logging with automatic redaction of sensitive data.
 * Adheres to OWASP and production observability standards.
 */

const SENSITIVE_PATTERNS = [
  /password/i,
  /passwordHash/i,
  /token/i,
  /authorization/i,
  /secret/i,
  /apiKey/i,
  /creditCard/i,
  /privateKey/i
];

/**
 * Recursively deep-clones and redacts sensitive keys and values from objects.
 * @param {any} obj
 * @param {Set} [seen=new Set()]
 * @returns {any}
 */
export const sanitizeForLogging = (obj, seen = new Set()) => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  // Handle circular references
  if (seen.has(obj)) return '[Circular]';
  seen.add(obj);

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForLogging(item, seen));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    const isSensitiveKey = SENSITIVE_PATTERNS.some((pattern) => pattern.test(key));
    if (isSensitiveKey) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(value, seen);
    } else if (typeof value === 'string' && (value.startsWith('Bearer ') || value.startsWith('eyJh'))) {
      // Catch bare JWTs or bearer headers
      sanitized[key] = '[REDACTED_TOKEN]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

const formatLogMessage = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  const sanitizedMeta = sanitizeForLogging(meta);
  const logObject = {
    timestamp,
    level,
    message,
    ...sanitizedMeta
  };

  if (process.env.NODE_ENV === 'production') {
    return JSON.stringify(logObject);
  }

  // Readable format for development
  const metaStr = Object.keys(sanitizedMeta).length > 0 ? ` ${JSON.stringify(sanitizedMeta)}` : '';
  const reqIdStr = meta?.reqId ? ` [${meta.reqId}]` : '';
  return `[${timestamp}] [${level.toUpperCase()}]${reqIdStr} ${message}${metaStr}`;
};

export const logger = {
  info: (message, meta) => {
    console.log(formatLogMessage('info', message, meta));
  },
  warn: (message, meta) => {
    console.warn(formatLogMessage('warn', message, meta));
  },
  error: (message, meta) => {
    console.error(formatLogMessage('error', message, meta));
  },
  debug: (message, meta) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatLogMessage('debug', message, meta));
    }
  }
};

export default logger;
