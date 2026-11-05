import { verifySignedRequest } from './runnerSigning.js';
import crypto from 'crypto';

/**
 * ==============================================================================
 * CodeForge Hardened Runner Authentication Middleware (REM-P0-03)
 *
 * Implements:
 * 1. Zero production hardcoded secrets (fails startup/request if unconfigured).
 * 2. Mandatory canonical HMAC-SHA256 request signing in production.
 * 3. Bounded timestamp acceptance window (±60 seconds).
 * 4. Nonce-based atomic replay attack prevention.
 * 5. Dual-key rotation support (RUNNER_SHARED_SECRET + RUNNER_PREVIOUS_SECRET).
 * 6. Zero logging of secrets or sensitive cryptographic tokens.
 * ==============================================================================
 */

export const getExpectedRunnerSecret = () => {
  const secret = process.env.RUNNER_SHARED_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[Security Error] RUNNER_SHARED_SECRET environment variable is missing in production.'
      );
    }
    // In dev/test mode without an explicit secret, align with backend dev fallback
    return 'dev-runner-secret-for-local-testing-only-32chars';
  }
  return secret;
};

/**
 * Timing-safe string comparison using crypto.timingSafeEqual.
 * Pads inputs to identical byte lengths to avoid length-leak timing variations.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export const timingSafeCompare = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;

  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');

  const hmacA = crypto.createHmac('sha256', 'cf-timing-pad').update(bufA).digest();
  const hmacB = crypto.createHmac('sha256', 'cf-timing-pad').update(bufB).digest();

  const digestsMatch = crypto.timingSafeEqual(hmacA, hmacB);
  return digestsMatch && bufA.length === bufB.length;
};

/**
 * Express middleware for runner service authentication with replay prevention.
 */
export const authenticateRunnerRequest = async (req, res, next) => {
  let expectedSecret;
  try {
    expectedSecret = getExpectedRunnerSecret();
  } catch {
    return res.status(500).json({
      success: false,
      code: 'SERVER_CONFIGURATION_ERROR',
      error: 'SERVER_CONFIGURATION_ERROR',
      message: 'Runner secret configuration is invalid or missing in production.'
    });
  }

  if (!expectedSecret) {
    return res.status(500).json({
      success: false,
      code: 'RUNNER_SECRET_UNCONFIGURED',
      error: 'RUNNER_SECRET_UNCONFIGURED',
      message: 'Runner service is not configured with a valid secret.'
    });
  }

  const hasSignature = Boolean(req.headers?.['x-codeforge-signature']);
  const secretHeader = req.headers?.['x-runner-secret'];
  const authHeader = req.headers?.['authorization'];

  // In production, signed requests are strictly mandatory
  if (process.env.NODE_ENV === 'production' && !hasSignature) {
    return res.status(401).json({
      success: false,
      code: 'UNSIGNED_REQUEST_FORBIDDEN',
      error: 'UNSIGNED_REQUEST_FORBIDDEN',
      message: 'Signed requests are mandatory in production. Static secret header alone is forbidden.'
    });
  }

  // 1. Signed Request Verification (Primary Authenticated Protocol)
  if (hasSignature) {
    // Check primary secret
    let result = await verifySignedRequest(req, expectedSecret);

    // If primary secret fails and a previous secret is provided for rotation, try previous
    if (!result.valid && process.env.RUNNER_PREVIOUS_SECRET) {
      const prevResult = await verifySignedRequest(req, process.env.RUNNER_PREVIOUS_SECRET);
      if (prevResult.valid) {
        result = prevResult;
      }
    }

    if (!result.valid) {
      const statusCode =
        result.code === 'NONCE_STORE_UNAVAILABLE' || result.code === 'SHARED_NONCE_STORE_REQUIRED'
          ? 503
          : 401;
      return res.status(statusCode).json({
        success: false,
        code: result.code || 'UNAUTHORIZED_RUNNER_REQUEST',
        error: result.code || 'UNAUTHORIZED_RUNNER_REQUEST',
        message: result.message || 'Signature authentication failed.'
      });
    }

    return next();
  }

  // 2. Static Header Verification (Accepts X-Runner-Secret in development/test environments)
  let candidateSecret = null;
  if (secretHeader && typeof secretHeader === 'string') {
    candidateSecret = secretHeader.trim();
  } else if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    candidateSecret = authHeader.substring(7).trim();
  }

  if (!candidateSecret) {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED_RUNNER_REQUEST',
      error: 'UNAUTHORIZED_RUNNER_REQUEST',
      message: 'Access denied. Valid runner authentication is required.'
    });
  }

  // Verify candidate secret against expected primary or rotation secret
  const matchesPrimary = timingSafeCompare(candidateSecret, expectedSecret);
  const matchesPrevious =
    process.env.RUNNER_PREVIOUS_SECRET &&
    timingSafeCompare(candidateSecret, process.env.RUNNER_PREVIOUS_SECRET);

  if (!matchesPrimary && !matchesPrevious) {
    return res.status(401).json({
      success: false,
      code: 'INVALID_RUNNER_SECRET',
      error: 'INVALID_RUNNER_SECRET',
      message: 'Access denied. Invalid runner service secret.'
    });
  }

  next();
};

export default authenticateRunnerRequest;
