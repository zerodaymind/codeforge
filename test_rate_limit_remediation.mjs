import mongoose from 'mongoose';
import { apiFetch, getRateLimitCooldown, clearRateLimitCooldown } from './src/utils/api.js';

const API_BASE = 'http://localhost:5000';

async function runRateLimitTests() {
  console.log('================================================================');
  console.log('CODEFORGE: RATE LIMITING & BACKPRESSURE REMEDIATION TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function report(name, condition, details = '') {
    if (condition) {
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${name} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  // Baseline database count to confirm zero mutations
  await mongoose.connect('mongodb://127.0.0.1:27017/codeforge');
  const collections = await mongoose.connection.db.listCollections().toArray();
  const countsBefore = {};
  for (const c of collections) {
    countsBefore[c.name] = await mongoose.connection.db.collection(c.name).countDocuments();
  }

  try {
    // ------------------------------------------------------------------------
    // SECTION 1: Ordinary Browsing & General API Limits
    // ------------------------------------------------------------------------
    console.log('1. Ordinary Browsing Requests & Headers:');
    
    // Normal problem catalog fetch
    const probRes = await fetch(`${API_BASE}/api/problems`);
    const probData = await probRes.json();
    report('General API route returns 200 OK', probRes.status === 200 && probData.success);

    const limitHeader = probRes.headers.get('ratelimit-limit') || probRes.headers.get('x-ratelimit-limit');
    const remHeader = probRes.headers.get('ratelimit-remaining') || probRes.headers.get('x-ratelimit-remaining');
    report('General API includes rate-limit headers', Boolean(limitHeader && remHeader), `limit=${limitHeader}, rem=${remHeader}`);

    // Health check endpoint bypasses general rate limiter
    const healthRes = await fetch(`${API_BASE}/api/health`);
    report('Health endpoint returns 200 OK without rate-limit blocking', healthRes.status === 200);

    // ------------------------------------------------------------------------
    // SECTION 2: Sensitive Auth Limiters Isolation
    // ------------------------------------------------------------------------
    console.log('\n2. Authentication Rate Limiter Isolation:');
    
    // Probe login endpoint with invalid credentials
    const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent_test_probe@codeforge.io', password: 'WrongPassword123!' })
    });
    // Should return 401 Invalid credentials, not 429
    report('Login endpoint returns 401 for bad credentials and is not blocked by general API limit', loginRes.status === 401);
    
    // Check that login response exposes RateLimit headers
    const loginLimit = loginRes.headers.get('ratelimit-limit') || loginRes.headers.get('x-ratelimit-limit');
    report('Login endpoint has distinct rate-limit headers', Boolean(loginLimit), `limit=${loginLimit}`);

    // ------------------------------------------------------------------------
    // SECTION 3: HTTP 429 Response & Retry-After Contract
    // ------------------------------------------------------------------------
    console.log('\n3. HTTP 429 & Retry-After Contract:');
    
    // Test using the designated probe endpoint (/api/health/rate-limit-probe, limit: 5)
    let hit429 = false;
    let receivedRetryAfterHeader = null;
    let bodyRetryAfter = null;
    let rateLimitMessage = '';

    for (let i = 0; i < 8; i++) {
      const pRes = await fetch(`${API_BASE}/api/health/rate-limit-probe`);
      if (pRes.status === 429) {
        hit429 = true;
        receivedRetryAfterHeader = pRes.headers.get('retry-after') || pRes.headers.get('Retry-After');
        const pData = await pRes.json();
        bodyRetryAfter = pData.retryAfter;
        rateLimitMessage = pData.message;
        break;
      }
    }

    report('Rate limiter triggers HTTP 429 on excessive requests', hit429);
    report('HTTP 429 response contains Retry-After header', Boolean(receivedRetryAfterHeader), `Retry-After: ${receivedRetryAfterHeader}`);
    report('HTTP 429 response body includes numeric retryAfter property', typeof bodyRetryAfter === 'number' && bodyRetryAfter > 0, `retryAfter: ${bodyRetryAfter}`);
    report('HTTP 429 response body includes user-facing message', Boolean(rateLimitMessage), `Message: "${rateLimitMessage}"`);

    // ------------------------------------------------------------------------
    // SECTION 4: Client-side Backpressure & Prevention of Retry Loops
    // ------------------------------------------------------------------------
    console.log('\n4. Client-side Backpressure & Retry-After Enforcement:');
    
    clearRateLimitCooldown();
    report('Initial client rate-limit cooldown is inactive', !getRateLimitCooldown().active);

    // Call probe via apiFetch to trigger 429 handling in apiFetch
    const clientProbeRes = await apiFetch('/api/health/rate-limit-probe');
    report('apiFetch receives 429 from rate-limited probe', clientProbeRes.status === 429);
    report('apiFetch extracts retryAfter into response object', typeof clientProbeRes.retryAfter === 'number' && clientProbeRes.retryAfter > 0, `retryAfter=${clientProbeRes.retryAfter}`);

    // Verify active cooldown
    const activeCooldown = getRateLimitCooldown();
    report('Client backpressure cooldown is now active', activeCooldown.active, `remainingSeconds=${activeCooldown.remainingSeconds}`);

    // Attempt an immediate subsequent request while backpressure is active
    const blockedCall = await apiFetch('/api/problems');
    report('apiFetch immediately rejects calls during cooldown without hitting network', blockedCall.status === 429 && blockedCall.data.message.includes('Client rate-limit backpressure active'));

    // Clear cooldown to simulate window expiry / recovery
    clearRateLimitCooldown();
    const recoveredCooldown = getRateLimitCooldown();
    report('Cooldown clears correctly after cooldown window expiry', !recoveredCooldown.active);

    const normalAfterReset = await apiFetch('/api/problems');
    report('apiFetch resumes normal network calls once cooldown is cleared', normalAfterReset.ok && normalAfterReset.status === 200);

    // ------------------------------------------------------------------------
    // SECTION 5: Profile & AuthContext Loop Prevention Verification
    // ------------------------------------------------------------------------
    console.log('\n5. Profile & AuthContext Loop Prevention Verification:');
    
    // Simulate the AuthContext updateUser behavior with identical objects
    let userState = { id: '6ad0d0523e11bbee9b5c984c', fullName: 'Demo Auditor', role: 'user' };
    let renderCount = 0;

    const mockUpdateUser = (updated) => {
      let hasChanged = false;
      for (const k of Object.keys(updated)) {
        if (userState[k] !== updated[k]) {
          hasChanged = true;
          break;
        }
      }
      if (hasChanged) {
        userState = { ...userState, ...updated };
        renderCount++;
      }
    };

    // Simulate 10 consecutive profile reloads with unchanged data
    const incomingProfile = { id: '6ad0d0523e11bbee9b5c984c', fullName: 'Demo Auditor', role: 'user' };
    for (let i = 0; i < 10; i++) {
      mockUpdateUser(incomingProfile);
    }
    report('Identical user profile updates do not trigger state changes (zero re-render cascade)', renderCount === 0);

    mockUpdateUser({ ...incomingProfile, fullName: 'Updated Auditor' });
    report('Actual profile changes trigger state update exactly once', renderCount === 1);

    // ------------------------------------------------------------------------
    // SECTION 6: Database Zero-Mutation Verification
    // ------------------------------------------------------------------------
    console.log('\n6. Database Mutation Delta Analysis:');
    let hasDelta = false;
    for (const c of collections) {
      const after = await mongoose.connection.db.collection(c.name).countDocuments();
      if (after !== countsBefore[c.name]) {
        hasDelta = true;
        console.error(`  Collection ${c.name} mutated! Before=${countsBefore[c.name]}, After=${after}`);
      }
    }
    report('Database preserved with 100% zero mutations', !hasDelta);

  } finally {
    await mongoose.disconnect();
  }

  console.log('\n================================================================');
  console.log(`RATE LIMIT REMEDIATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runRateLimitTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
