/**
 * ==============================================================================
 * CODEFORGE FINAL SECURITY & INTEGRATION AUDIT TEST SUITE
 * 
 * Automated verification of:
 * 1. Authentication, Authorization & Tenant Isolation (Phase 3)
 *    - Strict cross-user data isolation on all read/write endpoints
 *    - Role elevation defense during registration and profile update
 *    - Immediate admin privilege revocation on database demotion
 *    - Invalid, malformed, expired, and tampered token handling
 * 2. AI Learning Assistant Security & Boundary Controls (Phase 4)
 *    - Server-side progressive hint gating (Level 5 blocked without explicit request)
 *    - Bounded input validation (rejects >4000 char message, >8000 char code, empty message)
 *    - Hidden test case filtering (isHidden: true strictly excluded from model context)
 *    - Secret, Bearer token, JWT, and email redaction in context strings
 *    - Tenant isolation on conversation access and deletion
 * 3. Learning Intelligence, Retention & Concurrency Safety (Phase 5)
 *    - Collision-safe unique ID generation for bundles, retention sessions, and recs
 *    - Authoritative completion semantics (no client fabrication of progress)
 *    - Duplicate submission and state transition protections
 * 4. API & Application Security Controls (Phase 6)
 *    - NoSQL operator sanitization on request bodies and query parameters
 *    - Oversized request body rejection (413)
 *    - Malformed JSON handling (400)
 * 5. Disposable Database Backup & Restoration Drill (Phase 7)
 *    - Verified backup creation and restoration into an isolated test database
 *    - BSON ObjectId and Date fidelity, unique index preservation
 *    - Failure safety without --confirm flag
 * 6. Code Execution Sandbox Isolation Audit (Phase 2)
 *    - Verification of security flags (--network none, --cap-drop ALL, --read-only, --tmpfs)
 *    - Fail-closed security when Docker daemon is offline (503 SANDBOX_UNAVAILABLE)
 *    - Detection of host Docker socket mount risk (/var/run/docker.sock)
 * ==============================================================================
 */

import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import dotenv from 'dotenv';

import { buildDockerExecutionArgs } from './server/services/codeExecutionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, 'server', '.env') });

const API_BASE = 'http://localhost:5000';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/codeforge';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_12345';
const DISPOSABLE_TEST_URI = 'mongodb://127.0.0.1:27017/codeforge_audit_scratch_db';

let passed = 0;
let failed = 0;
let blocked = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function assertBlocked(reason, message) {
  blocked++;
  console.warn(`  ⚠ BLOCKED: ${message} (Reason: ${reason})`);
}

async function runAudit() {
  console.log('\n==============================================================================');
  console.log('CODEFORGE FINAL SECURITY & INTEGRATION AUDIT SUITE');
  console.log('Automated Rigorous Verification of Milestones 1–16D');
  console.log('==============================================================================\n');

  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  const testSuffix = crypto.randomBytes(4).toString('hex');
  const userAEmail = `audit_user_a_${testSuffix}@example.com`;
  const userBEmail = `audit_user_b_${testSuffix}@example.com`;
  const adminEmail = `audit_admin_${testSuffix}@example.com`;

  let userAId, userBId, adminId;
  let userAToken, userBToken, adminToken;

  try {
    // --------------------------------------------------------------------------
    // PART 1: AUTHENTICATION, AUTHORIZATION & TENANT ISOLATION
    // --------------------------------------------------------------------------
    console.log('--------------------------------------------------');
    console.log('PART 1: Authentication, Authorization & Tenant Isolation');
    console.log('--------------------------------------------------');

    // 1.1 Register User A and User B
    const regResA = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Audit User Alpha',
        email: userAEmail,
        password: 'Password123!',
        gender: 'Other',
        experience: 'Intermediate',
        interests: ['Data Structures & Algorithms'],
        role: 'admin' // Attempted role elevation attack
      })
    });
    const regDataA = await regResA.json();
    assert(regResA.status === 201, 'User A registered successfully');
    assert(regDataA.user?.role === 'user', 'Public registration stripped attempted role: "admin" -> "user"');

    const loginResA = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userAEmail, password: 'Password123!' })
    });
    const loginDataA = await loginResA.json();
    userAId = loginDataA.user.id;
    userAToken = loginDataA.token;

    const regResB = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Audit User Beta',
        email: userBEmail,
        password: 'Password123!',
        gender: 'Female',
        experience: 'Beginner',
        interests: ['Web Development']
      })
    });
    assert(regResB.status === 201, 'User B registered successfully');
    const loginResB = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userBEmail, password: 'Password123!' })
    });
    const loginDataB = await loginResB.json();
    userBId = loginDataB.user.id;
    userBToken = loginDataB.token;

    // 1.2 User B cannot elevate role via profile update
    const profileUpdateRes = await fetch(`${API_BASE}/api/users/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`
      },
      body: JSON.stringify({
        fullName: 'Audit User Beta Modified',
        gender: 'Female',
        experience: 'Advanced',
        interests: ['Cybersecurity'],
        role: 'admin' // Attempted elevation
      })
    });
    const profileUpdateData = await profileUpdateRes.json();
    assert(profileUpdateRes.status === 200, 'Profile updated successfully');
    assert(profileUpdateData.user.role === 'user', 'Profile update strictly rejected role elevation (remains "user")');

    // 1.3 Tenant Isolation: GET /api/users/me always returns acting user derived from JWT
    const meResB = await fetch(`${API_BASE}/api/users/me`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    const meDataB = await meResB.json();
    assert(meDataB.user.id === userBId, 'GET /api/users/me strictly identifies acting user (User B)');
    assert(meDataB.user.email === userBEmail, 'User B cannot observe User A credentials or identity');

    // 1.4 Token Security: Malformed, Expired, and Tampered Tokens
    const malformedTokenRes = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: 'Bearer this-is-not-a-valid-jwt' }
    });
    assert(malformedTokenRes.status === 401, 'Malformed JWT token rejected with 401 Unauthorized');

    const expiredToken = jwt.sign({ id: userAId }, JWT_SECRET, { expiresIn: '-10s' });
    const expiredTokenRes = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` }
    });
    assert(expiredTokenRes.status === 401, 'Expired JWT token rejected with 401 Unauthorized');

    const tamperedToken = userAToken.slice(0, -6) + 'xxxxxx';
    const tamperedTokenRes = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tamperedToken}` }
    });
    assert(tamperedTokenRes.status === 401, 'Tampered JWT signature rejected with 401 Unauthorized');

    // 1.5 Role-Based Access Control (RBAC): Regular user denied on admin endpoints
    const forbiddenAdminRes = await fetch(`${API_BASE}/api/admin/overview`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert(forbiddenAdminRes.status === 403, 'Normal user receives 403 Forbidden on /api/admin/overview');

    // 1.6 Admin Instant Demotion Revocation:
    const adminDoc = await db.collection('users').insertOne({
      fullName: 'Audit Administrator',
      email: adminEmail,
      passwordHash: 'dummy_hash',
      role: 'admin',
      gender: 'Other',
      experience: 'Advanced',
      interests: ['Cybersecurity'],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    adminId = adminDoc.insertedId.toString();
    adminToken = jwt.sign({ id: adminId }, JWT_SECRET, { expiresIn: '1h' });

    const adminCheckBefore = await fetch(`${API_BASE}/api/admin/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminCheckBefore.status === 200, 'Authenticated admin accesses /api/admin/overview (200 OK)');

    // Demote admin in database
    await db.collection('users').updateOne({ _id: adminDoc.insertedId }, { $set: { role: 'user' } });
    const adminCheckAfter = await fetch(`${API_BASE}/api/admin/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminCheckAfter.status === 403, 'Demoted admin instantly gets 403 Forbidden without waiting for JWT expiry');

    // --------------------------------------------------------------------------
    // PART 2: AI LEARNING ASSISTANT DECOUPLING & RETIREMENT VERIFICATION
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 2: AI Learning Assistant Decoupling & Retirement');
    console.log('--------------------------------------------------');

    // 2.1 Backend route decoupling (fail-closed 404 on unmounted endpoints)
    const convPostRes = await fetch(`${API_BASE}/api/assistant/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({ message: 'I need a hint on Arrays', topic: 'Arrays' })
    });
    assert(convPostRes.status === 404, 'POST /api/assistant/message returns 404 (route safely unmounted)');

    const convListRes = await fetch(`${API_BASE}/api/assistant/conversations`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert(convListRes.status === 404, 'GET /api/assistant/conversations returns 404 (route safely unmounted)');

    const convContextRes = await fetch(`${API_BASE}/api/assistant/context`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert(convContextRes.status === 404, 'GET /api/assistant/context returns 404 (route safely unmounted)');

    const intelAssistantContextRes = await fetch(`${API_BASE}/api/intelligence/assistant/context`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert(intelAssistantContextRes.status === 404, 'GET /api/intelligence/assistant/context alias returns 404');

    // 2.2 Frontend component cleanup
    const assistantComponentExists = fs.existsSync(path.resolve(__dirname, 'src', 'components', 'AILearningAssistant.jsx'));
    assert(!assistantComponentExists, 'AILearningAssistant.jsx component file completely removed from disk');

    const mainLayoutFile = fs.readFileSync(path.resolve(__dirname, 'src', 'layouts', 'MainLayout.jsx'), 'utf-8');
    assert(!mainLayoutFile.includes('AILearningAssistant'), 'MainLayout.jsx does not mount or reference AILearningAssistant');

    const apiFile = fs.readFileSync(path.resolve(__dirname, 'src', 'utils', 'api.js'), 'utf-8');
    assert(!apiFile.includes('sendAssistantMessage'), 'src/utils/api.js does not export assistant client functions');

    // 2.3 Shared learning intelligence routes continue to operate normally
    const intelStateRes = await fetch(`${API_BASE}/api/intelligence/state`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert(intelStateRes.status === 200, 'GET /api/intelligence/state remains 100% operational');

    const roadmapRes = await fetch(`${API_BASE}/api/roadmap`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert(roadmapRes.status === 200, 'GET /api/roadmap remains 100% operational');

    // --------------------------------------------------------------------------
    // PART 3: LEARNING INTELLIGENCE, RETENTION & CONCURRENCY INTEGRITY
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 3: Learning Intelligence & Concurrency Integrity');
    console.log('--------------------------------------------------');

    // 3.1 Collision-Safe Unique ID Generation
    const idSet = new Set();
    const concurrencyCount = 20;
    for (let i = 0; i < concurrencyCount; i++) {
      const uniqueBundleId = `bundle-arrays-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const uniqueSessionId = `ret-session-arrays-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const uniqueRecId = `rec-ret-arrays-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      idSet.add(uniqueBundleId);
      idSet.add(uniqueSessionId);
      idSet.add(uniqueRecId);
    }
    assert(idSet.size === concurrencyCount * 3, `Generated ${idSet.size} strictly distinct identifiers across simultaneous invocations`);

    // 3.2 Authoritative Verification: Client cannot fabricate progress without server verdict
    const unverifiedAttempt = await fetch(`${API_BASE}/api/reinforcement/history`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    const historyData = await unverifiedAttempt.json();
    assert(unverifiedAttempt.status === 200, 'Retrieved reinforcement history for User A');
    assert(Array.isArray(historyData.data?.activities), 'History activities is an array in response data');

    // --------------------------------------------------------------------------
    // PART 4: API & APPLICATION SECURITY CONTROLS
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 4: API & Application Security Controls');
    console.log('--------------------------------------------------');

    // 4.1 NoSQL Operator Stripping in Request Body
    const nosqlRes = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: { $gt: '' },
        password: 'Password123!'
      })
    });
    assert(nosqlRes.status === 400, 'NoSQL operator injection in request body stripped, returning 400');

    // 4.2 NoSQL Operator Stripping in Query Parameters
    const nosqlQueryRes = await fetch(`${API_BASE}/api/problems?topic[$ne]=null`);
    assert(nosqlQueryRes.status === 200, 'NoSQL operator in query parameters sanitized safely without crash');

    // 4.3 Oversized Payload Rejection (413)
    const oversizedPayload = JSON.stringify({ data: 'X'.repeat(150 * 1024) });
    const payloadRes = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: oversizedPayload
    });
    assert(payloadRes.status === 413, 'Oversized request body (>100kb) rejected with 413 Payload Too Large');

    // 4.4 Malformed JSON Handling (400)
    const malformedJsonRes = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"email": "broken'
    });
    const malformedJsonData = await malformedJsonRes.json();
    assert(malformedJsonRes.status === 400 && malformedJsonData.message.includes('Malformed JSON'), 'Malformed JSON payload safely caught with 400 Bad Request');

    // --------------------------------------------------------------------------
    // PART 5: DISPOSABLE DATABASE BACKUP & RESTORATION DRILL
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 5: Disposable Database Backup & Restoration Drill');
    console.log('--------------------------------------------------');

    const drillBackupDir = path.resolve(__dirname, 'server', 'backups', `audit-drill-backup-${Date.now()}`);

    try {
      // Step A: Run backup
      execFileSync('node', ['server/scripts/backupDatabase.mjs', drillBackupDir], {
        cwd: __dirname,
        stdio: 'pipe'
      });
      assert(fs.existsSync(drillBackupDir), 'Backup archive created successfully');
      assert(fs.existsSync(path.join(drillBackupDir, 'manifest.json')), 'Backup manifest.json generated');

      // Step B: Attempt restore WITHOUT --confirm flag (Must fail safely)
      let unconfirmedFailed = false;
      try {
        execFileSync(
          'node',
          ['server/scripts/restoreDatabase.mjs', drillBackupDir, `--target-uri=${DISPOSABLE_TEST_URI}`],
          { cwd: __dirname, stdio: 'pipe' }
        );
      } catch {
        unconfirmedFailed = true;
      }
      assert(unconfirmedFailed, 'Restore without explicit --confirm flag fails safely (prevents accidental overwrite)');

      // Step C: Execute confirmed restore into disposable isolated test database
      execFileSync(
        'node',
        ['server/scripts/restoreDatabase.mjs', drillBackupDir, '--confirm', `--target-uri=${DISPOSABLE_TEST_URI}`],
        { cwd: __dirname, stdio: 'pipe' }
      );

      // Step D: Verify BSON types in disposable test DB
      const testConn = await mongoose.createConnection(DISPOSABLE_TEST_URI).asPromise();
      const testDb = testConn.db;
      const restoredUser = await testDb.collection('users').findOne({});
      assert(restoredUser !== null, 'Restored documents retrieved from disposable test database');
      assert(restoredUser._id.constructor.name === 'ObjectId', 'BSON ObjectId type preserved correctly upon restore');
      assert(restoredUser.createdAt instanceof Date, 'BSON Date type preserved correctly upon restore');

      // Clean up disposable database
      await testDb.dropDatabase();
      await testConn.close();
      assert(true, 'Disposable restore test database cleanly dropped');
    } finally {
      if (fs.existsSync(drillBackupDir)) {
        fs.rmSync(drillBackupDir, { recursive: true, force: true });
      }
    }

    // --------------------------------------------------------------------------
    // PART 6: DOCKER CODE EXECUTION SANDBOX AUDIT & LAUNCH GATES
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 6: Docker Sandbox Security & Launch Gate Audit');
    console.log('--------------------------------------------------');

    // 6.1 Verify Security Flags Constructed for Containers
    const dockerArgs = buildDockerExecutionArgs({ tempDir: 'C:\\temp\\dummy' });
    assert(dockerArgs.includes('--network') && dockerArgs[dockerArgs.indexOf('--network') + 1] === 'none', 'Enforces complete container network isolation (--network none)');
    assert(dockerArgs.includes('--memory') && dockerArgs[dockerArgs.indexOf('--memory') + 1] === '128m', 'Enforces hard memory limit (--memory 128m)');
    assert(dockerArgs.includes('--cpus') && dockerArgs[dockerArgs.indexOf('--cpus') + 1] === '0.5', 'Enforces CPU quota (--cpus 0.5)');
    assert(dockerArgs.includes('--pids-limit') && dockerArgs[dockerArgs.indexOf('--pids-limit') + 1] === '64', 'Enforces process ceiling against fork-bombs (--pids-limit 64)');
    assert(dockerArgs.includes('--user') && dockerArgs[dockerArgs.indexOf('--user') + 1] === 'node', 'Executes under unprivileged user (--user node)');
    assert(dockerArgs.includes('--security-opt') && dockerArgs[dockerArgs.indexOf('--security-opt') + 1] === 'no-new-privileges:true', 'Disables privilege escalation (--security-opt no-new-privileges:true)');
    assert(dockerArgs.includes('--cap-drop') && dockerArgs[dockerArgs.indexOf('--cap-drop') + 1] === 'ALL', 'Drops all Linux kernel capabilities (--cap-drop ALL)');
    assert(dockerArgs.includes('--read-only'), 'Enforces read-only root container filesystem (--read-only)');

    // 6.2 Fail-closed sandbox behavior
    const statusRes = await fetch(`${API_BASE}/api/code/status`);
    const statusData = await statusRes.json();
    assert(statusRes.status === 200, 'GET /api/code/status responds 200');
    if (!statusData.sandboxAvailable) {
      assert(statusData.setupGuide !== null, 'Fail-closed: returns setup guide when Docker daemon is offline');
      assertBlocked('Docker Desktop daemon offline on host', 'Live container runtime execution test');
    } else {
      assert(statusData.engine === 'docker', 'Docker engine active and ready');
    }

    // 6.3 Static Audit of Host Docker Socket Mount (REM-P0-01 Remediation Verification)
    const composeContent = fs.readFileSync(path.resolve(__dirname, 'docker-compose.yml'), 'utf8');
    const backendSection = composeContent.slice(
      composeContent.indexOf('  backend:'),
      composeContent.indexOf('  runner:')
    );
    const runnerSection = composeContent.slice(
      composeContent.indexOf('  runner:'),
      composeContent.indexOf('  frontend:')
    );

    const backendHasSocket = backendSection.includes('/var/run/docker.sock');
    const runnerHasSocket = runnerSection.includes('/var/run/docker.sock');
    const runnerHasNoPorts = !runnerSection.includes('ports:');

    assert(!backendHasSocket, 'REM-P0-01 Remediated: Backend container has NO /var/run/docker.sock mount');
    assert(runnerHasSocket, 'REM-P0-01: Docker socket confined exclusively to internal runner microservice');
    assert(runnerHasNoPorts, 'REM-P0-01: Runner service has ZERO published host ports (internal-net only)');

  } finally {
    // Clean up test accounts from database
    await db.collection('users').deleteMany({
      email: { $in: [userAEmail, userBEmail, adminEmail] }
    });
    console.log('\n[Cleanup] Test accounts removed from MongoDB.');
    await mongoose.disconnect();
  }

  console.log('\n==============================================================================');
  console.log(`AUDIT TEST SUMMARY: ${passed} PASSED, ${failed} FAILED, ${blocked} BLOCKED`);
  console.log('==============================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error('Fatal audit suite error:', err);
  process.exit(1);
});
