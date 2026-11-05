import logger from '../utils/logger.js';

/**
 * 404 Unknown route handler middleware.
 */
export const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  res.status(404);
  next(error);
};

/**
 * Centralized Express error-handling middleware.
 * Ensures consistent JSON error responses without leaking sensitive internals in production.
 */
export const errorHandler = (err, req, res, _next) => {
  // Handle JSON parse errors from body-parser
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Malformed JSON payload in request body.'
    });
  }

  // Handle CORS origin rejection
  if (err.message && err.message.includes('CORS policy')) {
    return res.status(403).json({
      success: false,
      message: 'Cross-Origin Request Blocked: Origin not permitted.'
    });
  }

  const statusCode = err.statusCode || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);

  // Safe logging
  logger.error(err.message, {
    reqId: req.id,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    url: req.originalUrl,
    method: req.method
  });

  // In production, mask internal server error details to prevent reconnaissance
  const clientMessage = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'An unexpected internal error occurred. Please try again later.'
    : (err.message || 'Internal Server Error');

  res.status(statusCode).json({
    success: false,
    message: clientMessage,
    ...(req.id ? { reqId: req.id } : {})
  });
};
