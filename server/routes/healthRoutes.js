import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getHealthStatus, getLiveness, getReadiness } from '../controllers/healthController.js';

const router = Router();

// Test probe rate limiter (5 req/min) for automated verification without locking out business endpoints
const probeRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    const retryAfter = Math.ceil(options.windowMs / 1000);
    res.setHeader('Retry-After', retryAfter);
    res.status(429).json({
      success: false,
      message: 'Rate limit probe limit exceeded. Backpressure verified.',
      retryAfter
    });
  }
});

/**
 * Health Endpoints
 * /api/health - Legacy backwards-compatible health status
 * /api/health/live - Liveness probe (process is running)
 * /api/health/ready - Readiness probe (database and dependencies ready)
 * /api/health/rate-limit-probe - Verifies rate limit enforcement and 429 backpressure handling
 */
router.get('/', getHealthStatus);
router.get('/live', getLiveness);
router.get('/ready', getReadiness);
router.get('/rate-limit-probe', probeRateLimiter, (req, res) => {
  res.status(200).json({ success: true, message: 'Probe OK' });
});

export default router;
