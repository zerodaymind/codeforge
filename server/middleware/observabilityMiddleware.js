import crypto from 'crypto';
import logger from '../utils/logger.js';

// In-memory operational metrics
export const metrics = {
  startTime: Date.now(),
  totalRequests: 0,
  statusCodes: {
    '2xx': 0,
    '3xx': 0,
    '4xx': 0,
    '5xx': 0
  },
  executions: {
    total: 0,
    success: 0,
    failed: 0,
    timeouts: 0
  }
};

/**
 * Middleware that attaches a unique correlation ID and logs incoming HTTP requests.
 */
export const correlationAndLoggingMiddleware = (req, res, next) => {
  // 1. Assign or propagate correlation ID
  const incomingReqId = req.headers['x-request-id'];
  const reqId = typeof incomingReqId === 'string' && incomingReqId.length > 0 && incomingReqId.length <= 64
    ? incomingReqId
    : crypto.randomUUID();

  req.id = reqId;
  res.setHeader('X-Request-Id', reqId);

  const startTime = Date.now();
  metrics.totalRequests += 1;

  // 2. Intercept response completion for logging and metrics
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Track status code metrics
    if (statusCode >= 200 && statusCode < 300) metrics.statusCodes['2xx'] += 1;
    else if (statusCode >= 300 && statusCode < 400) metrics.statusCodes['3xx'] += 1;
    else if (statusCode >= 400 && statusCode < 500) metrics.statusCodes['4xx'] += 1;
    else if (statusCode >= 500) metrics.statusCodes['5xx'] += 1;

    // Do not log health-check spam in production unless it fails
    if (req.originalUrl.startsWith('/api/health') && statusCode < 400 && process.env.NODE_ENV === 'production') {
      return;
    }

    const logMeta = {
      reqId,
      method: req.method,
      url: req.originalUrl,
      status: statusCode,
      durationMs: duration,
      ip: req.ip || req.socket?.remoteAddress
    };

    if (statusCode >= 500) {
      logger.error(`HTTP ${req.method} ${req.originalUrl} ${statusCode} (${duration}ms)`, logMeta);
    } else if (statusCode >= 400) {
      logger.warn(`HTTP ${req.method} ${req.originalUrl} ${statusCode} (${duration}ms)`, logMeta);
    } else {
      logger.info(`HTTP ${req.method} ${req.originalUrl} ${statusCode} (${duration}ms)`, logMeta);
    }
  });

  next();
};

export default correlationAndLoggingMiddleware;
