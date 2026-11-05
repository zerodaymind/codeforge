import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { getConfig } from '../config/env.js';

/**
 * Helmet Security Headers configured for CodeForge
 * Provides robust protections while remaining compatible with Monaco Editor and React Vite assets.
 */
export const configureHelmet = () => {
  const config = getConfig();

  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // Needed for Monaco loader and Vite development
          'https://cdn.jsdelivr.net',
          'https://cdnjs.cloudflare.com'
        ],
        scriptSrcAttr: ["'none'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'", // Needed for Bootstrap and Monaco syntax styling
          'https://cdn.jsdelivr.net',
          'https://cdnjs.cloudflare.com'
        ],
        fontSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        connectSrc: [
          "'self'",
          ...(config.corsOrigins || []),
          'ws:', // Vite HMR in development
          'wss:'
        ],
        workerSrc: ["'self'", 'blob:'], // Required for Monaco Web Workers
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
        upgradeInsecureRequests: config.isProduction ? [] : null
      }
    },
    crossOriginEmbedderPolicy: false, // Prevents blocking Monaco web workers
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: config.isProduction ? { maxAge: 31536000, includeSubDomains: true } : false
  });
};

/**
 * Dynamic, secure CORS middleware based on validated configuration
 */
export const configureCors = () => {
  const config = getConfig();

  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin server requests)
      if (!origin) return callback(null, true);

      if (config.corsOrigins.includes(origin) || !config.isProduction) {
        return callback(null, true);
      }

      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After']
  });
};

/**
 * General API Rate Limiter
 * Defaults to 1000 requests per 15 minutes per IP in production (configurable via API_RATE_LIMIT_MAX),
 * 5000 in development/test.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.API_RATE_LIMIT_MAX || (process.env.NODE_ENV === 'production' ? '1000' : '5000'), 10),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    const retryAfter = Math.ceil(options.windowMs / 1000);
    res.setHeader('Retry-After', retryAfter);
    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again after 15 minutes.',
      retryAfter
    });
  }
});

/**
 * Strict Rate Limiter for Login endpoint (/api/auth/login)
 * 15 attempts per 15 minutes per IP in production to mitigate brute force & credential stuffing
 */
export const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 15 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    const retryAfter = Math.ceil(options.windowMs / 1000);
    res.setHeader('Retry-After', retryAfter);
    res.status(429).json({
      success: false,
      message: 'Too many login attempts. Please try again after 15 minutes.',
      retryAfter
    });
  }
});

/**
 * Strict Rate Limiter for Registration endpoint (/api/auth/register)
 * 15 attempts per 15 minutes per IP in production to mitigate automated bot registrations
 */
export const authRegisterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 15 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    const retryAfter = Math.ceil(options.windowMs / 1000);
    res.setHeader('Retry-After', retryAfter);
    res.status(429).json({
      success: false,
      message: 'Too many registration attempts. Please try again after 15 minutes.',
      retryAfter
    });
  }
});

// Alias for backwards compatibility
export const authRateLimiter = authLoginLimiter;

/**
 * Strict Rate Limiter for Code Execution (/api/code/run, /api/code/submit)
 * 20 executions per minute per IP in production to protect host and container resources
 */
export const codeExecutionRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    const retryAfter = Math.ceil(options.windowMs / 1000);
    res.setHeader('Retry-After', retryAfter);
    res.status(429).json({
      success: false,
      message: 'Code execution rate limit exceeded. Please wait a minute before submitting again.',
      retryAfter
    });
  }
});

/**
 * NoSQL Operator Injection Sanitizer
 * Recursively inspects request bodies, queries, and params to strip keys starting with '$' or containing '.'
 * Mutates in-place to support Express 5 where req.query is a getter.
 */
const sanitizeInPlace = (obj) => {
  if (!obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      if (obj[i] && typeof obj[i] === 'object') {
        sanitizeInPlace(obj[i]);
      }
    }
    return;
  }

  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
    } else if (obj[key] && typeof obj[key] === 'object') {
      sanitizeInPlace(obj[key]);
    }
  }
};

export const sanitizeMongoInput = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    sanitizeInPlace(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    sanitizeInPlace(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    sanitizeInPlace(req.params);
  }
  next();
};
