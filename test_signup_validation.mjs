/**
 * ==============================================================================
 * CODEFORGE SIGNUP VALIDATION & AUTHENTICATION HARDENING TEST SUITE
 * Comprehensive verification of frontend & backend validation, security controls,
 * database persistence, and regression integrity.
 * ==============================================================================
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import * as serverValidation from './server/utils/validation.js';
import * as clientValidation from './src/utils/validation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, 'server', '.env') });

const API_BASE = 'http://localhost:5000';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/codeforge';

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
  console.log('  CODEFORGE SIGNUP VALIDATION & AUTH HARDENING');
  console.log('  Automated Verification Test Suite');
  console.log('==================================================\n');

  // Connect to DB directly for state verification and cleanup
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  const testSuffix = Date.now().toString(36);

  try {
    // --------------------------------------------------------------------------
    // PART 1: VALIDATION RULE PARITY (Frontend & Server Utilities)
    // --------------------------------------------------------------------------
    console.log('--------------------------------------------------');
    console.log('PART 1: Validation Rule Parity (Frontend & Server)');
    console.log('--------------------------------------------------');

    // 1.1 Full Name Validation Tests
    const invalidNames = [
      { val: '', desc: 'empty string' },
      { val: '   ', desc: 'whitespace-only' },
      { val: '123456', desc: 'numeric-only' },
      { val: '---', desc: 'symbols-only' },
      { val: 'A', desc: 'single character' },
      { val: 'A.', desc: 'less than 2 letters' },
      { val: 'A'.repeat(71), desc: 'exceeds 70 characters' },
      { val: 'Alan\u0000Turing', desc: 'control character U+0000' },
      { val: 'Alan\u001fTuring', desc: 'control character U+001F' },
      { val: 'Alan\u007fTuring', desc: 'control character U+007F' },
      { val: 'Alan<script>', desc: 'HTML angle bracket <' },
      { val: 'Alan>Turing', desc: 'HTML angle bracket >' },
      { val: 'John@Doe', desc: 'at-symbol in name' }
    ];

    for (const testCase of invalidNames) {
      const sRes = serverValidation.validateName(testCase.val);
      const cRes = clientValidation.validateName(testCase.val);
      assert(!sRes.isValid && !cRes.isValid, `Name rejected (${testCase.desc}): server & client`);
    }

    const validNames = [
      { val: 'Alan Turing', expected: 'Alan Turing', desc: 'standard name' },
      { val: '  Ada   Lovelace  ', expected: 'Ada Lovelace', desc: 'whitespace collapse and trim' },
      { val: 'Mary-Jane', expected: 'Mary-Jane', desc: 'hyphenated name' },
      { val: "O'Connor", expected: "O'Connor", desc: 'apostrophe name' },
      { val: 'D’Angelo', expected: 'D’Angelo', desc: 'curly apostrophe' },
      { val: 'Dr. John Watson', expected: 'Dr. John Watson', desc: 'periods and titles' },
      { val: 'José García', expected: 'José García', desc: 'Latin accented letters' },
      { val: 'François', expected: 'François', desc: 'cedilla accented name' },
      { val: '李小龙', expected: '李小龙', desc: 'Chinese characters' },
      { val: 'Иван Петров', expected: 'Иван Петров', desc: 'Cyrillic characters' },
      { val: 'أحمد', expected: 'أحمد', desc: 'Arabic characters' }
    ];

    for (const testCase of validNames) {
      const sRes = serverValidation.validateName(testCase.val);
      const cRes = clientValidation.validateName(testCase.val);
      assert(sRes.isValid && cRes.isValid, `Name accepted (${testCase.desc})`);
      assert(sRes.normalized === testCase.expected, `Server normalized "${testCase.val}" -> "${testCase.expected}"`);
    }

    // 1.2 Email Validation Tests
    const invalidEmails = [
      { val: '', desc: 'empty email' },
      { val: '   ', desc: 'whitespace-only' },
      { val: 'userexample.com', desc: 'missing @' },
      { val: 'user@example@com', desc: 'multiple @' },
      { val: '@example.com', desc: 'missing local part' },
      { val: 'user@', desc: 'missing domain part' },
      { val: 'example@abc', desc: 'missing TLD (no dot in domain)' },
      { val: 'user..name@example.com', desc: 'consecutive dots in local part' },
      { val: '.user@example.com', desc: 'leading dot in local part' },
      { val: 'user.@example.com', desc: 'trailing dot in local part' },
      { val: 'user@example..com', desc: 'consecutive dots in domain' },
      { val: 'user@.example.com', desc: 'leading dot in domain' },
      { val: 'user@example.com.', desc: 'trailing dot in domain' },
      { val: 'user@-example.com', desc: 'domain label starting with hyphen' },
      { val: 'user@example-.com', desc: 'domain label ending with hyphen' },
      { val: 'user name@example.com', desc: 'space in local part' },
      { val: 'user@ example.com', desc: 'space in domain part' },
      { val: 'user\u0000@example.com', desc: 'control character in email' },
      { val: 'user@example.c', desc: 'single character TLD' }
    ];

    for (const testCase of invalidEmails) {
      const sRes = serverValidation.validateEmail(testCase.val);
      const cRes = clientValidation.validateEmail(testCase.val);
      assert(!sRes.isValid && !cRes.isValid, `Email rejected (${testCase.desc}): server & client`);
    }

    const validEmails = [
      { val: 'user@example.com', expected: 'user@example.com', desc: 'standard email' },
      { val: '  User.Name@Example.COM  ', expected: 'user.name@example.com', desc: 'trim and lowercase' },
      { val: 'user+tag@domain.co.uk', expected: 'user+tag@domain.co.uk', desc: 'plus-addressing and multi-part TLD' },
      { val: 'first_last-123@sub.domain.org', expected: 'first_last-123@sub.domain.org', desc: 'underscores, hyphens, subdomains' }
    ];

    for (const testCase of validEmails) {
      const sRes = serverValidation.validateEmail(testCase.val);
      const cRes = clientValidation.validateEmail(testCase.val);
      assert(sRes.isValid && cRes.isValid, `Email accepted (${testCase.desc})`);
      assert(sRes.normalized === testCase.expected, `Server normalized email -> "${testCase.expected}"`);
    }

    // 1.3 Password Validation Tests
    assert(!serverValidation.validatePassword('').isValid, 'Server rejects empty password');
    assert(!clientValidation.validatePassword('').isValid, 'Client rejects empty password');
    assert(!serverValidation.validatePassword('Short1!').isValid, 'Server rejects password < 8 chars');
    assert(!clientValidation.validatePassword('Short1!').isValid, 'Client rejects password < 8 chars');
    assert(!serverValidation.validatePassword('nouppernodigits').isValid, 'Server rejects password with no digits');
    assert(!serverValidation.validatePassword('1234567890').isValid, 'Server rejects password with no letters');

    // Bcrypt 72-byte limit enforcement
    const pass72 = 'A1' + 'a'.repeat(70); // exactly 72 bytes
    const pass73 = 'A1' + 'a'.repeat(71); // exactly 73 bytes
    assert(serverValidation.validatePassword(pass72).isValid, 'Password with exactly 72 bytes is valid');
    assert(!serverValidation.validatePassword(pass73).isValid, 'Password with 73 bytes is rejected (Bcrypt boundary)');
    assert(!clientValidation.validatePassword(pass73).isValid, 'Client also rejects password exceeding 72 bytes');

    // --------------------------------------------------------------------------
    // PART 2: REGISTRATION API HARDENING & PERSISTENCE
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 2: Registration API Hardening & Persistence');
    console.log('--------------------------------------------------');

    const defaultPayload = {
      fullName: 'Valid User',
      email: `valid_${testSuffix}@codeforge.dev`,
      password: 'Password123!',
      gender: 'Other',
      experience: 'Intermediate',
      interests: ['Web Development']
    };

    // Helper for POST /api/auth/register
    async function postRegister(payload) {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      return { status: res.status, data };
    }

    // 2.1 Invalid Name rejections on API
    const apiNameTests = [
      { name: '', label: 'empty name' },
      { name: '   ', label: 'spaces-only name' },
      { name: '12345', label: 'numbers-only name' },
      { name: '---', label: 'hyphens-only name' },
      { name: '<script>alert(1)</script>', label: 'HTML name' },
      { name: 'A'.repeat(71), label: 'name > 70 chars' }
    ];

    for (const test of apiNameTests) {
      const res = await postRegister({ ...defaultPayload, fullName: test.name, email: `t_${Math.random()}@test.com` });
      assert(res.status === 400 && res.data.success === false, `API rejects ${test.label} with 400`);
      assert(Boolean(res.data.errors?.fullName), `API returns errors.fullName field for ${test.label}`);
    }

    // 2.2 Invalid Email rejections on API
    const apiEmailTests = [
      { email: 'bademail', label: 'no @' },
      { email: 'example@abc', label: 'missing TLD' },
      { email: 'user@domain..com', label: 'consecutive dots' },
      { email: 'user@-domain.com', label: 'hyphen start in domain' },
      { email: 'user name@domain.com', label: 'spaces in email' }
    ];

    for (const test of apiEmailTests) {
      const res = await postRegister({ ...defaultPayload, email: test.email });
      assert(res.status === 400 && res.data.success === false, `API rejects ${test.label} with 400`);
      assert(Boolean(res.data.errors?.email), `API returns errors.email field for ${test.label}`);
    }

    // 2.3 Password length boundary on API (> 72 bytes)
    const longPassRes = await postRegister({
      ...defaultPayload,
      email: `longpass_${testSuffix}@codeforge.dev`,
      password: 'A1' + 'a'.repeat(75)
    });
    assert(longPassRes.status === 400, 'API rejects password > 72 bytes with 400 (Bcrypt protection)');
    assert(Boolean(longPassRes.data.errors?.password), 'API provides errors.password explanation');

    // 2.4 Name whitespace normalization & international character storage
    const normNameEmail = `norm_${testSuffix}@codeforge.dev`;
    const normRes = await postRegister({
      ...defaultPayload,
      fullName: '   Dr.   Jane    Watson-Smith   ',
      email: normNameEmail
    });
    assert(normRes.status === 201, 'API accepts name with internal repeated whitespace');
    assert(normRes.data.user.fullName === 'Dr. Jane Watson-Smith', 'API returns normalized name in user payload');

    // Verify directly in MongoDB
    const storedUser = await db.collection('users').findOne({ email: normNameEmail });
    assert(storedUser !== null, 'User document genuinely created in MongoDB');
    assert(storedUser.fullName === 'Dr. Jane Watson-Smith', 'MongoDB stores normalized name without redundant spaces');

    // 2.5 International Unicode name registration
    const intlEmail = `intl_${testSuffix}@codeforge.dev`;
    const intlRes = await postRegister({
      ...defaultPayload,
      fullName: 'José Müller 李小龙',
      email: intlEmail
    });
    assert(intlRes.status === 201, 'API accepts international Unicode name (José Müller 李小龙)');
    assert(intlRes.data.user.fullName === 'José Müller 李小龙', 'API returns correct Unicode name');

    // 2.6 Email case normalization in database
    const upperEmail = `UPPERCASE_${testSuffix}@CODEFORGE.DEV`;
    const lowerExpected = upperEmail.toLowerCase();
    const caseRes = await postRegister({
      ...defaultPayload,
      fullName: 'Case Test',
      email: upperEmail
    });
    assert(caseRes.status === 201, 'API accepts uppercase email');
    assert(caseRes.data.user.email === lowerExpected, 'API response returns lowercased email');

    const dbCaseUser = await db.collection('users').findOne({ email: lowerExpected });
    assert(dbCaseUser !== null, 'MongoDB stores lowercased normalized email');

    // 2.7 Plus-addressing support
    const plusEmail = `user+tag_${testSuffix}@codeforge.dev`;
    const plusRes = await postRegister({
      ...defaultPayload,
      fullName: 'Plus Tag User',
      email: plusEmail
    });
    assert(plusRes.status === 201, 'API accepts valid plus-addressing (user+tag@domain.com)');

    // 2.8 Duplicate email rejection
    const dupRes = await postRegister({
      ...defaultPayload,
      fullName: 'Duplicate User',
      email: plusEmail
    });
    assert(dupRes.status === 409, 'API returns 409 Conflict on duplicate email registration');
    assert(dupRes.data.message.includes('already exists'), 'API informs that account with email already exists');

    // 2.9 Privilege escalation protection (Role hardening)
    const adminAttemptEmail = `priv_esc_${testSuffix}@codeforge.dev`;
    const privRes = await postRegister({
      ...defaultPayload,
      fullName: 'Hacker Attempt',
      email: adminAttemptEmail,
      role: 'admin',
      isAdmin: true,
      extraField: 'malicious'
    });
    assert(privRes.status === 201, 'Registration completes ignoring injected privilege fields');
    assert(privRes.data.user.role === 'user', 'Client cannot elevate role: response user.role is "user"');

    const dbPrivUser = await db.collection('users').findOne({ email: adminAttemptEmail });
    assert(dbPrivUser.role === 'user', 'MongoDB document strictly enforces role: "user"');
    assert(dbPrivUser.isAdmin === undefined, 'MongoDB document omits non-whitelisted fields');

    // 2.10 Password hash safety (Never expose passwordHash)
    assert(privRes.data.user.passwordHash === undefined, 'Registration response NEVER exposes passwordHash');
    assert(privRes.data.user.password === undefined, 'Registration response NEVER exposes plaintext password');

    // --------------------------------------------------------------------------
    // PART 3: LOGIN COMPATIBILITY & JWT TOKEN ISSUANCE
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 3: Login Compatibility & Profile Verification');
    console.log('--------------------------------------------------');

    // Login with the uppercase-registered account using lowercase credentials
    const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: lowerExpected,
        password: 'Password123!'
      })
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200 && loginData.success === true, 'User registered can log in successfully');
    assert(Boolean(loginData.token), 'Login returns valid JWT token');

    // Verify GET /api/auth/me with JWT token
    const meRes = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${loginData.token}` }
    });
    const meData = await meRes.json();
    assert(meRes.status === 200 && meData.success === true, 'GET /api/auth/me succeeds with issued JWT');
    assert(meData.user.email === lowerExpected, 'Profile returns authenticated user email');
    assert(meData.user.passwordHash === undefined, 'Profile response NEVER contains passwordHash');

    // --------------------------------------------------------------------------
    // CLEANUP
    // --------------------------------------------------------------------------
    await db.collection('users').deleteMany({
      email: { $regex: testSuffix }
    });
    console.log('\n✓ Cleaned up test accounts from database.');

  } finally {
    await mongoose.disconnect();
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
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
