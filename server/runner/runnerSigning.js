import crypto from 'crypto';

/**
 * ==============================================================================
 * CodeForge Service-to-Service Request Signing & Verification (REM-P0-03)
 *
 * Implements AWS SigV4-style canonical HMAC-SHA256 request signing with
 * strict timestamp bounding, nonce format enforcement, atomic replay prevention,
 * and support for distributed/multi-replica nonce stores.
 * ==============================================================================
 */

export const MAX_TIMESTAMP_SKEW_MS = 60 * 1000; // ±60-second validity window
export const NONCE_TTL_MS = 120 * 1000; // 120-second cache retention

/**
 * Abstract In-Memory Nonce Store for single-process runner instances.
 */
export class InMemoryNonceStore {
  constructor(ttlMs = NONCE_TTL_MS) {
    this.nonces = new Map();
    this.ttlMs = ttlMs;
    this.isShared = false;
  }

  /**
   * Atomically claims a nonce.
   * Returns true if successfully claimed, or false if already seen (replay).
   * @param {string} nonce
   * @param {number} timestamp
   * @returns {Promise<boolean>}
   */
  async claim(nonce, timestamp = Date.now()) {
    this.clean(timestamp);
    if (this.nonces.has(nonce)) {
      return false;
    }
    this.nonces.set(nonce, timestamp);
    return true;
  }

  /**
   * Checks if a nonce exists in the cache.
   * @param {string} nonce
   * @returns {boolean}
   */
  has(nonce) {
    return this.nonces.has(nonce);
  }

  /**
   * Purges expired nonces.
   * @param {number} now
   */
  clean(now = Date.now()) {
    for (const [nonce, ts] of this.nonces.entries()) {
      if (now - ts > this.ttlMs) {
        this.nonces.delete(nonce);
      }
    }
  }

  /**
   * Clears all stored nonces.
   */
  clear() {
    this.nonces.clear();
  }

  size() {
    return this.nonces.size;
  }
}

/**
 * Shared Nonce Store for multi-replica runner deployments.
 * Simulates a shared atomic datastore (e.g. Redis SET key 1 EX ttl NX or MongoDB TTL index).
 */
export class SharedNonceStore {
  constructor(ttlMs = NONCE_TTL_MS) {
    this.sharedNonces = new Map();
    this.ttlMs = ttlMs;
    this.isShared = true;
  }

  async claim(nonce, timestamp = Date.now()) {
    this.clean(timestamp);
    if (this.sharedNonces.has(nonce)) {
      return false;
    }
    this.sharedNonces.set(nonce, timestamp);
    return true;
  }

  has(nonce) {
    return this.sharedNonces.has(nonce);
  }

  clean(now = Date.now()) {
    for (const [nonce, ts] of this.sharedNonces.entries()) {
      if (now - ts > this.ttlMs) {
        this.sharedNonces.delete(nonce);
      }
    }
  }

  clear() {
    this.sharedNonces.clear();
  }
}

// Active singleton store instance
let currentNonceStore = new InMemoryNonceStore();

/**
 * Replaces the active nonce store (e.g. for multi-replica tests or Redis integration).
 * @param {object} store
 */
export const setNonceStore = (store) => {
  if (!store || typeof store.claim !== 'function') {
    throw new Error('Nonce store must implement an async claim(nonce, timestamp) method.');
  }
  currentNonceStore = store;
};

/**
 * Returns the currently active nonce store.
 * @returns {object}
 */
export const getNonceStore = () => currentNonceStore;

/**
 * Cleans expired nonces from the active store.
 * @param {number} now
 */
export const cleanExpiredNonces = (now = Date.now()) => {
  currentNonceStore.clean(now);
};

/**
 * Resets the active nonce store.
 */
export const resetNonceCache = () => {
  currentNonceStore.clear();
};

/**
 * Computes canonical request string for signing.
 * Format: METHOD\nPATH\nTIMESTAMP\nNONCE\nBODY_HASH
 *
 * @param {string} method
 * @param {string} path
 * @param {string} timestamp
 * @param {string} nonce
 * @param {string|object} body
 * @returns {string}
 */
export const buildCanonicalRequest = (method, path, timestamp, nonce, body) => {
  const normMethod = String(method || 'POST').toUpperCase().trim();
  const normPath = String(path || '/api/runner/execute').split('?')[0].trim();
  const normTimestamp = String(timestamp || '').trim();
  const normNonce = String(nonce || '').trim();
  const bodyString = typeof body === 'string' ? body : JSON.stringify(body || {});
  const bodyHash = crypto.createHash('sha256').update(bodyString, 'utf8').digest('hex');
  return `${normMethod}\n${normPath}\n${normTimestamp}\n${normNonce}\n${bodyHash}`;
};

/**
 * Generates authentication headers for an outgoing service request.
 *
 * @param {string} method - HTTP method (e.g. 'POST')
 * @param {string} path - Request path (e.g. '/api/runner/execute')
 * @param {string|object} body - Request payload
 * @param {string} secretKey - Shared secret key
 * @returns {{ 'x-codeforge-timestamp': string, 'x-codeforge-nonce': string, 'x-codeforge-signature': string }}
 */
export const createSignedHeaders = (method, path, body, secretKey) => {
  if (!secretKey || typeof secretKey !== 'string') {
    throw new Error('Signing secret key is required.');
  }

  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID().replace(/-/g, '') + crypto.randomBytes(8).toString('hex');
  const canonical = buildCanonicalRequest(method, path, timestamp, nonce, body);
  const signature = crypto.createHmac('sha256', secretKey).update(canonical, 'utf8').digest('hex');

  return {
    'x-codeforge-timestamp': timestamp,
    'x-codeforge-nonce': nonce,
    'x-codeforge-signature': signature
  };
};

/**
 * Verifies incoming service-to-service signed request.
 * Checks timestamp freshness, nonce format & uniqueness (replay prevention), and constant-time HMAC signature.
 *
 * @param {object} req - Express request object
 * @param {string} secretKey - Expected secret key
 * @param {object} [options={}]
 * @returns {Promise<{ valid: boolean, code?: string, message?: string }>}
 */
export const verifySignedRequest = async (req, secretKey, options = {}) => {
  if (!secretKey || typeof secretKey !== 'string') {
    return {
      valid: false,
      code: 'RUNNER_SECRET_UNCONFIGURED',
      message: 'Runner shared secret is not configured on this server.'
    };
  }

  const timestamp = req.headers?.['x-codeforge-timestamp'];
  const nonce = req.headers?.['x-codeforge-nonce'];
  const signature = req.headers?.['x-codeforge-signature'];

  if (!timestamp || !nonce || !signature) {
    return {
      valid: false,
      code: 'MISSING_SIGNATURE_HEADERS',
      message: 'Request missing required authentication headers (timestamp, nonce, or signature).'
    };
  }

  // 1. Strict Timestamp Validation
  if (typeof timestamp !== 'string' || !/^\d{10,14}$/.test(timestamp.trim())) {
    return {
      valid: false,
      code: 'INVALID_TIMESTAMP_FORMAT',
      message: 'Timestamp header is not a valid epoch timestamp.'
    };
  }

  const reqTime = parseInt(timestamp.trim(), 10);
  if (!Number.isSafeInteger(reqTime)) {
    return {
      valid: false,
      code: 'INVALID_TIMESTAMP_FORMAT',
      message: 'Timestamp header is outside safe integer range.'
    };
  }

  const now = Date.now();
  const maxSkew = options.maxSkewMs || MAX_TIMESTAMP_SKEW_MS;
  const skew = now - reqTime;
  if (Math.abs(skew) > maxSkew) {
    return {
      valid: false,
      code: 'EXPIRED_REQUEST_TIMESTAMP',
      message: `Request timestamp is outside the allowed ±${maxSkew / 1000}s acceptance window.`
    };
  }

  // 2. Strict Nonce Format Validation
  if (typeof nonce !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(nonce.trim())) {
    return {
      valid: false,
      code: 'INVALID_NONCE_FORMAT',
      message: 'Nonce must be a 16-128 character alphanumeric string.'
    };
  }

  // 3. Strict Signature Format Validation
  if (typeof signature !== 'string' || !/^[a-fA-F0-9]{64}$/.test(signature.trim())) {
    return {
      valid: false,
      code: 'INVALID_SIGNATURE_FORMAT',
      message: 'Signature must be a 64-character hexadecimal digest.'
    };
  }

  // 4. Constant-Time Signature Comparison
  const targetPath = req.path || req.originalUrl || '/api/runner/execute';
  const canonical = buildCanonicalRequest(req.method, targetPath, timestamp.trim(), nonce.trim(), req.body);
  const expectedSignature = crypto.createHmac('sha256', secretKey).update(canonical, 'utf8').digest('hex');

  const sigBuf = Buffer.from(signature.trim().toLowerCase(), 'hex');
  const expBuf = Buffer.from(expectedSignature, 'hex');

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return {
      valid: false,
      code: 'INVALID_REQUEST_SIGNATURE',
      message: 'HMAC signature verification failed. Request may be tampered or secret incorrect.'
    };
  }

  // 5. Atomic Nonce Claim (Replay Prevention)
  const store = options.nonceStore || currentNonceStore;

  if ((process.env.REQUIRE_SHARED_NONCE_STORE === 'true' || options.requireSharedStore) && !store.isShared) {
    return {
      valid: false,
      code: 'SHARED_NONCE_STORE_REQUIRED',
      message: 'Production configuration requires an atomic shared nonce store, but local memory store was provided.'
    };
  }

  let claimed = false;
  try {
    claimed = await store.claim(nonce.trim(), now);
  } catch (err) {
    return {
      valid: false,
      code: 'NONCE_STORE_UNAVAILABLE',
      message: `Nonce store failure: ${err?.message || 'store unavailable'}`
    };
  }

  if (!claimed) {
    return {
      valid: false,
      code: 'REPLAYED_REQUEST_NONCE',
      message: 'Request nonce has already been processed within the validity window (replay detected).'
    };
  }

  return { valid: true };
};
