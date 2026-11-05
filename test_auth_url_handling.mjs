/**
 * ==============================================================================
 * CODEFORGE AUTHENTICATION URL RESOLUTION & REGRESSION TEST SUITE
 * Verifies relative URL handling, configuration sanitization, origin safety,
 * and AuthContext / Login integration without hardcoded localhost URLs.
 * ==============================================================================
 */

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveApiUrl } from './src/utils/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runTests() {
  console.log('\n==================================================');
  console.log('  CODEFORGE AUTHENTICATION URL HANDLING TEST SUITE');
  console.log('==================================================\n');

  // ----------------------------------------------------------------------------
  // PART 1: resolveApiUrl Configuration & Safety Unit Tests
  // ----------------------------------------------------------------------------
  console.log('--------------------------------------------------');
  console.log('PART 1: resolveApiUrl Configuration & Safety Rules');
  console.log('--------------------------------------------------');

  // 1.1 Empty base URL (Production Nginx relative mode)
  const relativeUrl = resolveApiUrl('/api/auth/me', { VITE_API_BASE_URL: '' });
  assert(relativeUrl === '/api/auth/me', `VITE_API_BASE_URL="" yields relative URL: "${relativeUrl}"`);

  // 1.2 Base URL with trailing slash (avoids double slashes)
  const trailingSlashUrl = resolveApiUrl('/api/auth/me', { VITE_API_BASE_URL: 'https://codeforge.dev/' });
  assert(
    trailingSlashUrl === 'https://codeforge.dev/api/auth/me',
    `Trailing slash normalized correctly without double slashes: "${trailingSlashUrl}"`
  );

  // 1.3 Missing endpoint leading slash is normalized
  const missingSlashUrl = resolveApiUrl('api/auth/login', { VITE_API_BASE_URL: '' });
  assert(missingSlashUrl === '/api/auth/login', `Missing leading slash normalized: "${missingSlashUrl}"`);

  // 1.4 Protocol-relative URL hijacking prevention (//attacker.com -> /attacker.com)
  const hijackedUrl = resolveApiUrl('//attacker.com/api/steal', { VITE_API_BASE_URL: '' });
  assert(
    hijackedUrl === '/attacker.com/api/steal' && !hijackedUrl.startsWith('//'),
    `Protocol-relative endpoint sanitized to prevent unintended origin redirection: "${hijackedUrl}"`
  );

  // 1.5 Malformed/dangerous protocol rejection (javascript: scheme)
  const dangerousSchemeUrl = resolveApiUrl('/api/auth/me', { VITE_API_BASE_URL: 'javascript:alert(1)', PROD: true });
  assert(
    dangerousSchemeUrl === '/api/auth/me',
    `Dangerous javascript: scheme rejected, falls back to safe relative path in production: "${dangerousSchemeUrl}"`
  );

  // 1.6 Production default when VITE_API_BASE_URL is undefined
  const prodDefaultUrl = resolveApiUrl('/api/auth/me', { PROD: true });
  assert(
    prodDefaultUrl === '/api/auth/me',
    `Undefined VITE_API_BASE_URL in production defaults to relative URL: "${prodDefaultUrl}"`
  );

  // 1.7 Development default when VITE_API_BASE_URL is undefined
  const devDefaultUrl = resolveApiUrl('/api/auth/me', { PROD: false, DEV: true });
  assert(
    devDefaultUrl === 'http://localhost:5000/api/auth/me',
    `Undefined VITE_API_BASE_URL in development defaults to http://localhost:5000: "${devDefaultUrl}"`
  );

  // 1.8 Null or non-string endpoint safely handled
  const nullEndpointUrl = resolveApiUrl(null, { VITE_API_BASE_URL: '' });
  assert(nullEndpointUrl === '/', `Null endpoint handled safely: "${nullEndpointUrl}"`);

  // ----------------------------------------------------------------------------
  // PART 2: Static Source Code Audit for Hardcoded Localhost URLs
  // ----------------------------------------------------------------------------
  console.log('\n--------------------------------------------------');
  console.log('PART 2: Static Source Audit of Auth Components');
  console.log('--------------------------------------------------');

  const authContextCode = readFileSync(path.resolve(__dirname, 'src', 'context', 'AuthContext.jsx'), 'utf-8');
  assert(
    !authContextCode.includes('http://localhost:5000'),
    'AuthContext.jsx contains NO hardcoded "http://localhost:5000"'
  );
  assert(
    authContextCode.includes('apiFetch'),
    'AuthContext.jsx imports and utilizes apiFetch'
  );
  assert(
    authContextCode.includes("apiFetch('/api/auth/me')"),
    "AuthContext.jsx queries '/api/auth/me' via relative apiFetch"
  );

  const loginPageCode = readFileSync(path.resolve(__dirname, 'src', 'pages', 'Login.jsx'), 'utf-8');
  assert(
    !loginPageCode.includes('http://localhost:5000'),
    'Login.jsx contains NO hardcoded "http://localhost:5000"'
  );
  assert(
    loginPageCode.includes('apiFetch'),
    'Login.jsx imports and utilizes apiFetch'
  );
  assert(
    loginPageCode.includes("apiFetch('/api/auth/login'"),
    "Login.jsx submits to '/api/auth/login' via apiFetch"
  );

  // ----------------------------------------------------------------------------
  // PART 3: Live Backend Authentication Verification
  // ----------------------------------------------------------------------------
  console.log('\n--------------------------------------------------');
  console.log('PART 3: Live Backend Authentication Integration');
  console.log('--------------------------------------------------');

  const liveBase = 'http://localhost:5000';
  const testEmail = `url_test_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  try {
    // 3.1 Register test account with schema-compliant payload
    const regRes = await fetch(`${liveBase}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'URL Test Learner',
        email: testEmail,
        password: testPassword,
        gender: 'Other',
        experience: 'Beginner',
        interests: ['Web Development']
      })
    });
    const regData = await regRes.json();
    assert(regRes.status === 201 && regData.success === true, 'Registered temporary user for auth flow test');

    // 3.2 Verify /api/auth/login endpoint responds to credentials and issues JWT
    const loginRes = await fetch(`${liveBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword
      })
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200 && loginData.success === true, 'Live /api/auth/login succeeds with credentials');
    const token = loginData.token;
    assert(Boolean(token), 'Login returned valid JWT token');

    // 3.3 Verify /api/auth/me endpoint responds to issued token
    const meRes = await fetch(`${liveBase}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const meData = await meRes.json();
    assert(meRes.status === 200 && meData.success === true, 'Live /api/auth/me returns 200 with user data');
    assert(meData.user.email === testEmail.toLowerCase(), 'Profile matches authenticated user email');
  } catch (err) {
    console.error('  Live backend verification error:', err.message);
  }

  // ----------------------------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------------------------
  console.log('\n==================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled error in test_auth_url_handling.mjs:', err);
  process.exit(1);
});
