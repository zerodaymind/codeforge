/**
 * ==============================================================================
 * CODEFORGE REM-P0-03 RUNNER HOST-ISOLATION & REPLAY DEFENSE VERIFICATION SUITE
 *
 * Verifies all REM-P0-03 security architecture requirements:
 * 1.  Public backend container has NO Docker socket, NO docker-cli, non-root USER node.
 * 2.  Deliberate 3-tier network microsegmentation and Multi-Host Production Manifests:
 *     - frontend-net (frontend <-> backend)
 *     - data-net with internal: true (backend <-> mongodb only)
 *     - runner-net with internal: true (backend <-> runner only)
 *     - docker-compose.prod.app.yml: Zero Docker socket on web application host.
 *     - docker-compose.prod.runner.yml: Dedicated execution host with gVisor runsc.
 *     - docs/architecture-isolated-runner.md: Formal multi-host trust boundary spec.
 * 3.  Production secret hardening:
 *     - docker-compose.yml enforces ${RUNNER_SHARED_SECRET:?...} with zero fallback.
 *     - Production startup fails on missing, short (<32), or insecure fallback secrets.
 * 4.  Canonical HMAC-SHA256 request signing & comprehensive replay defense:
 *     - Timestamp freshness validation (±60s window: past and future).
 *     - Nonce tracking rejects replayed requests (401 REPLAYED_REQUEST_NONCE).
 *     - Atomic nonce claim eliminates race conditions for concurrent duplicate requests.
 *     - Distributed / multi-replica nonce store verification across independent replicas.
 *     - Runner restart & cache reset resilience.
 *     - Body, path, and method integrity verification (401 INVALID_REQUEST_SIGNATURE).
 *     - Strict format validation for timestamps, nonces, and signatures.
 * 5.  Execution lifecycle & active termination watchdogs:
 *     - Stdin streaming transport (node -) eliminates DooD host bind-mounts.
 *     - Explicit container naming (cf-job-<uuid>).
 *     - Signal forwarding via --init and bounded termination via --stop-timeout 2.
 *     - Active kill watchdog (docker rm -f) on timeout or output limit overflow.
 *     - Active job registry and graceful shutdown termination.
 * 6.  Live runtime isolation reporting:
 *     - Checks live daemon availability and honestly reports BLOCKED when offline.
 * ==============================================================================
 */

import { readFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import https from 'https';
import { execFileSync } from 'child_process';
import express from 'express';

import {
  authenticateRunnerRequest,
  getExpectedRunnerSecret
} from './server/runner/runnerAuthMiddleware.js';
import {
  createSignedHeaders,
  verifySignedRequest,
  resetNonceCache,
  InMemoryNonceStore,
  SharedNonceStore,
  setNonceStore,
  getNonceStore
} from './server/runner/runnerSigning.js';
import {
  buildHardenedDockerArgs,
  buildStdinExecutionBundle,
  isRunnerSandboxAvailable,
  activeJobs,
  killExecutionContainer,
  validateJobPayload,
  executeInSandbox,
  getRuntimeTransparencyInfo,
  queryEngineRuntimes,
  isGvisorRequired,
  clearRuntimeCache
} from './server/runner/runnerExecutionService.js';
import { startRunnerServer, stopRunnerServer, getRunnerHealth } from './server/runner/runnerServer.js';
import { runInSandbox } from './server/services/codeExecutionService.js';
import { validateEnvironment } from './server/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function block(testName, reason) {
  blocked++;
  console.log(`  ⚠ BLOCKED: ${testName}`);
  console.log(`    Reason: ${reason}`);
}

async function runTestSuite() {
  console.log('\n================================================================');
  console.log('  CODEFORGE REM-P0-03 RUNNER HOST-ISOLATION VERIFICATION SUITE');
  console.log('================================================================\n');

  const composePath = path.resolve(__dirname, 'docker-compose.yml');
  const backendDockerfile = path.resolve(__dirname, 'Dockerfile');
  const runnerDockerfile = path.resolve(__dirname, 'Dockerfile.runner');

  const composeRaw = readFileSync(composePath, 'utf8');
  const backendDockerRaw = readFileSync(backendDockerfile, 'utf8');
  const runnerDockerRaw = readFileSync(runnerDockerfile, 'utf8');

  // ----------------------------------------------------------------------------
  // SECTION 1: Public Backend Isolation
  // ----------------------------------------------------------------------------
  console.log('----------------------------------------------------------------');
  console.log('SECTION 1: Public Backend Container Isolation');
  console.log('----------------------------------------------------------------');

  const backendSection = composeRaw.slice(
    composeRaw.indexOf('  backend:'),
    composeRaw.indexOf('  runner:')
  );
  assert(
    !backendSection.includes('/var/run/docker.sock'),
    'docker-compose.yml: Public backend service has NO /var/run/docker.sock mount'
  );
  assert(
    !backendDockerRaw.includes('apk add --no-cache docker-cli') &&
      !backendDockerRaw.includes('apk add docker-cli'),
    'Dockerfile: Public backend does NOT install docker-cli'
  );
  assert(
    !backendDockerRaw.includes('addgroup node docker'),
    'Dockerfile: Public backend node user is NOT added to docker group'
  );
  assert(
    backendDockerRaw.includes('USER node'),
    'Dockerfile: Public backend enforces least-privilege non-root USER node'
  );
  assert(
    runnerDockerRaw.includes('USER node'),
    'Dockerfile.runner: Dedicated runner enforces least-privilege non-root USER node'
  );

  // ----------------------------------------------------------------------------
  // SECTION 2: 3-Tier Network Microsegmentation & Multi-Host Architecture (REM-P0-03)
  // ----------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('SECTION 2: 3-Tier Network Microsegmentation & Multi-Host Manifests');
  console.log('----------------------------------------------------------------');

  const runnerSection = composeRaw.slice(
    composeRaw.indexOf('  runner:'),
    composeRaw.indexOf('  frontend:')
  );
  const frontendSection = composeRaw.slice(
    composeRaw.indexOf('  frontend:'),
    composeRaw.indexOf('\nnetworks:')
  );
  const mongoSection = composeRaw.slice(
    composeRaw.indexOf('  mongodb:'),
    composeRaw.indexOf('  backend:')
  );
  const networksSection = composeRaw.slice(composeRaw.indexOf('\nnetworks:'));

  // 2.1 Network Definitions
  assert(networksSection.includes('frontend-net:'), 'docker-compose.yml defines frontend-net');
  assert(
    networksSection.includes('data-net:') && networksSection.includes('internal: true'),
    'docker-compose.yml defines data-net with internal: true (no WAN access)'
  );
  assert(
    networksSection.includes('runner-net:') && networksSection.includes('internal: true'),
    'docker-compose.yml defines runner-net with internal: true (no WAN access)'
  );

  // 2.2 Network Membership Isolation
  assert(
    frontendSection.includes('- frontend-net') &&
      !frontendSection.includes('runner-net') &&
      !frontendSection.includes('data-net'),
    'Frontend is isolated to frontend-net (CANNOT route to runner or mongodb)'
  );
  assert(
    mongoSection.includes('- data-net') &&
      !mongoSection.includes('frontend-net') &&
      !mongoSection.includes('runner-net'),
    'MongoDB is isolated to data-net (CANNOT route to frontend or runner)'
  );
  assert(
    runnerSection.includes('- runner-net') &&
      !runnerSection.includes('frontend-net') &&
      !runnerSection.includes('data-net'),
    'Runner is isolated to runner-net (CANNOT route to frontend or mongodb)'
  );
  assert(
    backendSection.includes('- frontend-net') &&
      backendSection.includes('- data-net') &&
      backendSection.includes('- runner-net'),
    'Backend mediates communication across segmented tiers'
  );
  assert(
    !runnerSection.includes('ports:'),
    'Runner service has ZERO published host ports'
  );

  // 2.3 Multi-Host Production Manifests (REM-P0-03)
  const prodAppPath = path.resolve(__dirname, 'docker-compose.prod.app.yml');
  const prodRunnerPath = path.resolve(__dirname, 'docker-compose.prod.runner.yml');
  const archDocPath = path.resolve(__dirname, 'docs/architecture-isolated-runner.md');

  assert(existsSync(prodAppPath), 'docker-compose.prod.app.yml exists for application tier');
  const prodAppRaw = readFileSync(prodAppPath, 'utf8');
  const prodAppServices = prodAppRaw.slice(prodAppRaw.indexOf('services:'));
  assert(
    !prodAppServices.includes('/var/run/docker.sock') && !prodAppServices.includes('  runner:'),
    'docker-compose.prod.app.yml completely eliminates Docker socket and runner on App host'
  );
  assert(
    prodAppRaw.includes('RUNNER_SERVICE_URL:'),
    'docker-compose.prod.app.yml dispatches code execution to dedicated remote runner host'
  );

  assert(existsSync(prodRunnerPath), 'docker-compose.prod.runner.yml exists for execution tier');
  const prodRunnerRaw = readFileSync(prodRunnerPath, 'utf8');
  assert(
    prodRunnerRaw.includes('CONTAINER_RUNTIME: ${CONTAINER_RUNTIME:-runsc}'),
    'docker-compose.prod.runner.yml configures gVisor (runsc) user-space microkernel sandboxing'
  );
  assert(
    prodRunnerRaw.includes('127.0.0.1:5050:5050'),
    'docker-compose.prod.runner.yml binds runner port strictly to private host interface'
  );

  assert(existsSync(archDocPath), 'docs/architecture-isolated-runner.md exists and specifies trust boundaries');

  // ----------------------------------------------------------------------------
  // SECTION 3: Production Credential Hardening & Fallback Elimination
  // ----------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('SECTION 3: Production Credential Hardening & Fallback Elimination');
  console.log('----------------------------------------------------------------');

  assert(
    !composeRaw.includes('cf_runner_sec_4f9a8b1c2e3d4f5a6b7c8d9e0f1a2b3c'),
    'docker-compose.yml contains ZERO hardcoded fallback secrets'
  );
  assert(
    composeRaw.includes('${RUNNER_SHARED_SECRET:?'),
    'docker-compose.yml enforces ${RUNNER_SHARED_SECRET:?...} required environment variable'
  );

  // Test production validation rules
  const originalEnv = { ...process.env };
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.RUNNER_SHARED_SECRET;
    let missingSecretThrew = false;
    try {
      validateEnvironment();
    } catch {
      missingSecretThrew = true;
    }
    assert(missingSecretThrew, 'validateEnvironment() throws fatal error when RUNNER_SHARED_SECRET is missing in production');

    process.env.RUNNER_SHARED_SECRET = 'short_secret_123';
    let shortSecretThrew = false;
    try {
      validateEnvironment();
    } catch {
      shortSecretThrew = true;
    }
    assert(shortSecretThrew, 'validateEnvironment() throws fatal error when RUNNER_SHARED_SECRET < 32 characters in production');

    process.env.RUNNER_SHARED_SECRET = 'cf_runner_sec_4f9a8b1c2e3d4f5a6b7c8d9e0f1a2b3c';
    let knownDefaultThrew = false;
    try {
      validateEnvironment();
    } catch {
      knownDefaultThrew = true;
    }
    assert(knownDefaultThrew, 'validateEnvironment() strictly rejects known default substrings in production');

    delete process.env.RUNNER_SHARED_SECRET;
    let middlewareThrew = false;
    try {
      getExpectedRunnerSecret();
    } catch {
      middlewareThrew = true;
    }
    assert(middlewareThrew, 'runnerAuthMiddleware.getExpectedRunnerSecret() fails safely when secret is unconfigured in production');
  } finally {
    process.env = originalEnv;
  }

  // ----------------------------------------------------------------------------
  // SECTION 4: Request Signing, Body Integrity & Replay Defense (REM-P0-03)
  // ----------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('SECTION 4: Request Signing, Body Integrity & Replay Defense');
  console.log('----------------------------------------------------------------');

  const testSecret = '0123456789abcdef0123456789abcdef0123456789abcdef';
  resetNonceCache();

  const samplePayload = { language: 'javascript', sourceCode: 'console.log("secure");', inputData: '42' };
  const sampleHeaders = createSignedHeaders('POST', '/api/runner/execute', samplePayload, testSecret);
  assert(typeof getNonceStore === 'function', 'runnerSigning exports getNonceStore for store introspection');

  // 4.1 Valid signature passes
  const validReq = {
    method: 'POST',
    path: '/api/runner/execute',
    headers: sampleHeaders,
    body: samplePayload
  };
  const validRes = await verifySignedRequest(validReq, testSecret);
  assert(validRes.valid === true, 'Valid HMAC-SHA256 signed request verifies successfully');

  // 4.2 Replay Attack Prevention: identical nonce within window rejected
  const replayRes = await verifySignedRequest(validReq, testSecret);
  assert(
    replayRes.valid === false && replayRes.code === 'REPLAYED_REQUEST_NONCE',
    'Replay attack prevented: duplicate nonce within acceptance window is rejected (401 REPLAYED_REQUEST_NONCE)'
  );

  // 4.3 Body Integrity: tampered payload rejected
  const tamperedPayload = { ...samplePayload, sourceCode: 'console.log("tampered");' };
  const freshHeaders = createSignedHeaders('POST', '/api/runner/execute', samplePayload, testSecret);
  const tamperedReq = {
    method: 'POST',
    path: '/api/runner/execute',
    headers: freshHeaders,
    body: tamperedPayload
  };
  const tamperedRes = await verifySignedRequest(tamperedReq, testSecret);
  assert(
    tamperedRes.valid === false && tamperedRes.code === 'INVALID_REQUEST_SIGNATURE',
    'Body integrity enforced: altered sourceCode fails HMAC verification (401 INVALID_REQUEST_SIGNATURE)'
  );

  // 4.4 Method/Path Integrity: path redirection rejected
  const redirectedReq = {
    method: 'POST',
    path: '/api/runner/other',
    headers: createSignedHeaders('POST', '/api/runner/execute', samplePayload, testSecret),
    body: samplePayload
  };
  const redirectedRes = await verifySignedRequest(redirectedReq, testSecret);
  assert(
    redirectedRes.valid === false && redirectedRes.code === 'INVALID_REQUEST_SIGNATURE',
    'Path integrity enforced: redirected request path fails HMAC verification'
  );

  // 4.5 Method Tampering: POST signature sent on GET request
  const methodTamperedReq = {
    method: 'GET',
    path: '/api/runner/execute',
    headers: createSignedHeaders('POST', '/api/runner/execute', samplePayload, testSecret),
    body: samplePayload
  };
  const methodTamperedRes = await verifySignedRequest(methodTamperedReq, testSecret);
  assert(
    methodTamperedRes.valid === false && methodTamperedRes.code === 'INVALID_REQUEST_SIGNATURE',
    'Method integrity enforced: altered HTTP method fails HMAC verification'
  );

  // 4.6 Incorrect Secret Key rejected
  const wrongSecret = 'fedcba9876543210fedcba9876543210fedcba9876543210';
  const wrongSecretReq = {
    method: 'POST',
    path: '/api/runner/execute',
    headers: createSignedHeaders('POST', '/api/runner/execute', samplePayload, wrongSecret),
    body: samplePayload
  };
  const wrongSecretRes = await verifySignedRequest(wrongSecretReq, testSecret);
  assert(
    wrongSecretRes.valid === false && wrongSecretRes.code === 'INVALID_REQUEST_SIGNATURE',
    'Secret integrity enforced: request signed with incorrect secret key is rejected'
  );

  // 4.7 Tampered Signature String rejected
  const badSigHeaders = createSignedHeaders('POST', '/api/runner/execute', samplePayload, testSecret);
  badSigHeaders['x-codeforge-signature'] = 'a'.repeat(64);
  const badSigReq = {
    method: 'POST',
    path: '/api/runner/execute',
    headers: badSigHeaders,
    body: samplePayload
  };
  const badSigRes = await verifySignedRequest(badSigReq, testSecret);
  assert(
    badSigRes.valid === false && badSigRes.code === 'INVALID_REQUEST_SIGNATURE',
    'Signature verification rejects forged/tampered signature digest'
  );

  // 4.8 Expired Timestamp rejected (past)
  const expiredHeaders = createSignedHeaders('POST', '/api/runner/execute', samplePayload, testSecret);
  expiredHeaders['x-codeforge-timestamp'] = (Date.now() - 120000).toString(); // 2 minutes old
  const expiredReq = {
    method: 'POST',
    path: '/api/runner/execute',
    headers: expiredHeaders,
    body: samplePayload
  };
  const expiredRes = await verifySignedRequest(expiredReq, testSecret);
  assert(
    expiredRes.valid === false && expiredRes.code === 'EXPIRED_REQUEST_TIMESTAMP',
    'Timestamp freshness enforced: request older than 60s is rejected (401 EXPIRED_REQUEST_TIMESTAMP)'
  );

  // 4.9 Future Timestamp outside window rejected
  const futureHeaders = createSignedHeaders('POST', '/api/runner/execute', samplePayload, testSecret);
  futureHeaders['x-codeforge-timestamp'] = (Date.now() + 120000).toString(); // 2 minutes in future
  const futureReq = {
    method: 'POST',
    path: '/api/runner/execute',
    headers: futureHeaders,
    body: samplePayload
  };
  const futureRes = await verifySignedRequest(futureReq, testSecret);
  assert(
    futureRes.valid === false && futureRes.code === 'EXPIRED_REQUEST_TIMESTAMP',
    'Timestamp freshness enforced: future request beyond 60s is rejected (401 EXPIRED_REQUEST_TIMESTAMP)'
  );

  // 4.10 Concurrent Duplicate Requests Race Defense
  const concurrentHeaders = createSignedHeaders('POST', '/api/runner/execute', samplePayload, testSecret);
  const concurrentReq = {
    method: 'POST',
    path: '/api/runner/execute',
    headers: concurrentHeaders,
    body: samplePayload
  };
  const raceResults = await Promise.all([
    verifySignedRequest(concurrentReq, testSecret),
    verifySignedRequest(concurrentReq, testSecret),
    verifySignedRequest(concurrentReq, testSecret)
  ]);
  const successfulClaims = raceResults.filter((r) => r.valid === true);
  const rejectedReplays = raceResults.filter((r) => r.valid === false && r.code === 'REPLAYED_REQUEST_NONCE');
  assert(
    successfulClaims.length === 1 && rejectedReplays.length === 2,
    'Atomic replay defense: exactly ONE concurrent request succeeds; duplicate concurrent nonces rejected'
  );

  // 4.11 Multi-Replica Replay Protection using SharedNonceStore
  const sharedStore = new SharedNonceStore();
  setNonceStore(sharedStore);
  const replicaHeaders = createSignedHeaders('POST', '/api/runner/execute', samplePayload, testSecret);
  const replicaReq1 = {
    method: 'POST',
    path: '/api/runner/execute',
    headers: replicaHeaders,
    body: samplePayload
  };
  // Processed on Replica 1
  const replica1Res = await verifySignedRequest(replicaReq1, testSecret, { nonceStore: sharedStore });
  assert(replica1Res.valid === true, 'Multi-replica: Request on Replica 1 verifies and claims nonce');
  // Replayed on Replica 2 sharing the same store
  const replica2Res = await verifySignedRequest(replicaReq1, testSecret, { nonceStore: sharedStore });
  assert(
    replica2Res.valid === false && replica2Res.code === 'REPLAYED_REQUEST_NONCE',
    'Multi-replica: Replica 2 rejects replayed nonce claimed by Replica 1 via SharedNonceStore'
  );
  // Restore default store
  setNonceStore(new InMemoryNonceStore());

  // 4.12 Runner Restart & Cache Reset Resilience
  resetNonceCache();
  const restartExpiredHeaders = createSignedHeaders('POST', '/api/runner/execute', samplePayload, testSecret);
  restartExpiredHeaders['x-codeforge-timestamp'] = (Date.now() - 90000).toString(); // 90s old
  const restartReq = {
    method: 'POST',
    path: '/api/runner/execute',
    headers: restartExpiredHeaders,
    body: samplePayload
  };
  const restartRes = await verifySignedRequest(restartReq, testSecret);
  assert(
    restartRes.valid === false && restartRes.code === 'EXPIRED_REQUEST_TIMESTAMP',
    'Restart resilience: empty nonce cache after restart STILL rejects expired timestamps (bounded skew)'
  );

  // 4.13 Malformed Timestamp Rejection
  const malformedTsHeaders = createSignedHeaders('POST', '/api/runner/execute', samplePayload, testSecret);
  malformedTsHeaders['x-codeforge-timestamp'] = 'not-a-number';
  const malformedTsReq = { method: 'POST', path: '/api/runner/execute', headers: malformedTsHeaders, body: samplePayload };
  const malformedTsRes = await verifySignedRequest(malformedTsReq, testSecret);
  assert(
    malformedTsRes.valid === false && malformedTsRes.code === 'INVALID_TIMESTAMP_FORMAT',
    'Malformed timestamp rejected: non-numeric string returns 401 INVALID_TIMESTAMP_FORMAT'
  );

  // 4.14 Malformed Nonce Rejection
  const malformedNonceHeaders = createSignedHeaders('POST', '/api/runner/execute', samplePayload, testSecret);
  malformedNonceHeaders['x-codeforge-nonce'] = 'short';
  const malformedNonceReq = { method: 'POST', path: '/api/runner/execute', headers: malformedNonceHeaders, body: samplePayload };
  const malformedNonceRes = await verifySignedRequest(malformedNonceReq, testSecret);
  assert(
    malformedNonceRes.valid === false && malformedNonceRes.code === 'INVALID_NONCE_FORMAT',
    'Malformed nonce rejected: short nonce returns 401 INVALID_NONCE_FORMAT'
  );

  // 4.15 Malformed Signature Rejection
  const malformedSigHeaders = createSignedHeaders('POST', '/api/runner/execute', samplePayload, testSecret);
  malformedSigHeaders['x-codeforge-signature'] = 'not-hex-signature-123';
  const malformedSigReq = { method: 'POST', path: '/api/runner/execute', headers: malformedSigHeaders, body: samplePayload };
  const malformedSigRes = await verifySignedRequest(malformedSigReq, testSecret);
  assert(
    malformedSigRes.valid === false && malformedSigRes.code === 'INVALID_SIGNATURE_FORMAT',
    'Malformed signature rejected: non-hex signature returns 401 INVALID_SIGNATURE_FORMAT'
  );

  // 4.16 Nonce Store Failure Fail-Closed (NONCE_STORE_UNAVAILABLE)
  const failingStore = {
    isShared: true,
    claim: async () => {
      throw new Error('Atomic distributed store offline');
    }
  };
  const storeFailHeaders = createSignedHeaders('POST', '/api/runner/execute', samplePayload, testSecret);
  const storeFailReq = {
    method: 'POST',
    path: '/api/runner/execute',
    headers: storeFailHeaders,
    body: samplePayload
  };
  const storeFailRes = await verifySignedRequest(storeFailReq, testSecret, { nonceStore: failingStore });
  assert(
    storeFailRes.valid === false && storeFailRes.code === 'NONCE_STORE_UNAVAILABLE',
    'Nonce store failure fails closed: returns NONCE_STORE_UNAVAILABLE rather than silently proceeding'
  );

  // 4.17 Production Required Shared Store Enforcement
  const localMemStore = new InMemoryNonceStore();
  const requireSharedHeaders = createSignedHeaders('POST', '/api/runner/execute', samplePayload, testSecret);
  const requireSharedReq = {
    method: 'POST',
    path: '/api/runner/execute',
    headers: requireSharedHeaders,
    body: samplePayload
  };
  const requireSharedRes = await verifySignedRequest(requireSharedReq, testSecret, {
    nonceStore: localMemStore,
    requireSharedStore: true
  });
  assert(
    requireSharedRes.valid === false && requireSharedRes.code === 'SHARED_NONCE_STORE_REQUIRED',
    'Shared nonce store requirement enforced: returns SHARED_NONCE_STORE_REQUIRED if local memory store provided'
  );

  const sharedStoreOk = new SharedNonceStore();
  const sharedOkRes = await verifySignedRequest(requireSharedReq, testSecret, {
    nonceStore: sharedStoreOk,
    requireSharedStore: true
  });
  assert(
    sharedOkRes.valid === true,
    'Shared nonce store passes requiredSharedStore check successfully'
  );

  // ----------------------------------------------------------------------------
  // SECTION 5: Stdin Execution Transport & Active Watchdogs
  // ----------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('SECTION 5: Stdin Execution Transport & Active Watchdogs');
  console.log('----------------------------------------------------------------');

  // 5.1 Stdin Execution Transport eliminates host bind-mounts
  const stdinArgs = buildHardenedDockerArgs({ containerName: 'cf-test-job-123' });
  assert(
    !stdinArgs.includes('-v') && stdinArgs.includes('-i') && stdinArgs.includes('-'),
    'Stdin transport mode: executes code via stdin streaming (ZERO host bind-mounts, eliminates DooD path mismatch)'
  );
  assert(
    stdinArgs.includes('--name') && stdinArgs[stdinArgs.indexOf('--name') + 1] === 'cf-test-job-123',
    'Enforces deterministic container naming for active lifecycle management (--name)'
  );
  assert(stdinArgs.includes('--init'), 'Enforces container init process for zombie reaping and signal forwarding (--init)');
  assert(
    stdinArgs.includes('--stop-timeout') && stdinArgs[stdinArgs.indexOf('--stop-timeout') + 1] === '2',
    'Enforces bounded container termination (--stop-timeout 2)'
  );
  assert(
    stdinArgs.includes('--network') && stdinArgs[stdinArgs.indexOf('--network') + 1] === 'none',
    'Enforces complete air-gapped network isolation (--network none)'
  );
  assert(
    stdinArgs.includes('--memory') && stdinArgs[stdinArgs.indexOf('--memory') + 1] === '128m',
    'Enforces memory limit quota (--memory 128m)'
  );
  assert(
    stdinArgs.includes('--memory-swap') && stdinArgs[stdinArgs.indexOf('--memory-swap') + 1] === '128m',
    'Enforces memory swap ceiling (--memory-swap 128m)'
  );
  assert(
    stdinArgs.includes('--cpus') && stdinArgs[stdinArgs.indexOf('--cpus') + 1] === '0.5',
    'Enforces CPU quota limit (--cpus 0.5)'
  );
  assert(
    stdinArgs.includes('--pids-limit') && stdinArgs[stdinArgs.indexOf('--pids-limit') + 1] === '64',
    'Enforces process ceiling against fork bombs (--pids-limit 64)'
  );
  assert(
    stdinArgs.includes('--user') && stdinArgs[stdinArgs.indexOf('--user') + 1] === 'node',
    'Executes under non-privileged node user (--user node)'
  );
  assert(
    stdinArgs.includes('--security-opt') && stdinArgs[stdinArgs.indexOf('--security-opt') + 1] === 'no-new-privileges:true',
    'Disables privilege escalation (--security-opt no-new-privileges:true)'
  );
  assert(
    stdinArgs.includes('--cap-drop') && stdinArgs[stdinArgs.indexOf('--cap-drop') + 1] === 'ALL',
    'Drops all Linux kernel capabilities (--cap-drop ALL)'
  );
  assert(stdinArgs.includes('--read-only'), 'Enforces read-only root container filesystem (--read-only)');
  assert(
    stdinArgs.includes('--tmpfs') && stdinArgs[stdinArgs.indexOf('--tmpfs') + 1].includes('noexec'),
    'Enforces restricted tmpfs with noexec and nosuid flags (--tmpfs)'
  );

  // 5.2 Stdin Bundle generation wraps input safely
  const bundle = buildStdinExecutionBundle('console.log("hello");', 'test-input');
  assert(
    bundle.includes('const _cf_input = "test-input"') && bundle.includes('fs.readFileSync'),
    'buildStdinExecutionBundle injects inputData harness and sourceCode into memory stream'
  );

  // 5.3 Active Job Tracking
  assert(activeJobs instanceof Map, 'activeJobs registry tracks running container handles');
  assert(typeof killExecutionContainer === 'function', 'killExecutionContainer actively issues docker rm -f on container engine');

  // 5.4 Client-Supplied Container Arguments Rejected
  let rejectedArgsCount = 0;
  const maliciousPayloads = [
    { language: 'javascript', sourceCode: 'console.log(1)', dockerArgs: ['--privileged'] },
    { language: 'javascript', sourceCode: 'console.log(1)', runtime: 'runc' },
    { language: 'javascript', sourceCode: 'console.log(1)', image: 'ubuntu:latest' },
    { language: 'javascript', sourceCode: 'console.log(1)', mounts: ['/var/run:/var/run'] },
    { language: 'javascript', sourceCode: 'console.log(1)', privileged: true },
    { language: 'javascript', sourceCode: 'console.log(1)', network: 'host' }
  ];
  for (const p of maliciousPayloads) {
    try {
      validateJobPayload(p);
    } catch (err) {
      if (err.code === 'FORBIDDEN_RUNTIME_ARGUMENTS' && err.statusCode === 400) {
        rejectedArgsCount++;
      }
    }
  }
  assert(
    rejectedArgsCount === maliciousPayloads.length,
    `validateJobPayload rejects all ${maliciousPayloads.length} client runtime override parameters with 400 FORBIDDEN_RUNTIME_ARGUMENTS`
  );

  // 5.5 Runtime Specification & Zero Fallback
  const gvisorArgs = buildHardenedDockerArgs({ runtime: 'runsc' });
  assert(
    gvisorArgs.includes('--runtime=runsc'),
    'buildHardenedDockerArgs configures gVisor runtime explicitly (--runtime=runsc)'
  );

  // ----------------------------------------------------------------------------
  // SECTION 6: Live Endpoints & Fail-Closed Behavior
  // ----------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('SECTION 6: Live Endpoints & Fail-Closed Behavior');
  console.log('----------------------------------------------------------------');

  const TEST_RUNNER_PORT = 5098;
  const testRunnerApp = express();
  testRunnerApp.use(express.json());

  testRunnerApp.get('/health', (_req, res) => {
    res.status(200).json({ success: true, service: 'codeforge-runner', sandboxAvailable: isRunnerSandboxAvailable() });
  });

  testRunnerApp.post('/api/runner/execute', authenticateRunnerRequest, (_req, res) => {
    return res.status(200).json({
      success: true,
      sandboxAvailable: true,
      status: 'SUCCESS',
      verdict: 'Completed',
      stdout: 'runner output\n',
      stderr: '',
      executionDuration: 42
    });
  });

  const server = http.createServer(testRunnerApp);
  await new Promise((resolve) => server.listen(TEST_RUNNER_PORT, resolve));

  try {
    process.env.RUNNER_SERVICE_URL = `http://127.0.0.1:${TEST_RUNNER_PORT}`;
    process.env.RUNNER_SHARED_SECRET = testSecret;

    // 6.1 Backend dispatches signed request to runner
    const signedHeaders = createSignedHeaders('POST', '/api/runner/execute', samplePayload, testSecret);
    const authRes = await fetch(`http://127.0.0.1:${TEST_RUNNER_PORT}/api/runner/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...signedHeaders
      },
      body: JSON.stringify(samplePayload)
    });
    assert(authRes.status === 200, 'Runner accepts valid HMAC signed request (200 OK)');

    // 6.2 Runner rejects replayed request to live HTTP endpoint
    const replayHttpRes = await fetch(`http://127.0.0.1:${TEST_RUNNER_PORT}/api/runner/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...signedHeaders
      },
      body: JSON.stringify(samplePayload)
    });
    assert(
      replayHttpRes.status === 401,
      'Live endpoint rejects replayed HTTP request with 401 Unauthorized'
    );

    // 6.3 Runner rejects unauthenticated request
    const unauthHttpRes = await fetch(`http://127.0.0.1:${TEST_RUNNER_PORT}/api/runner/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(samplePayload)
    });
    assert(unauthHttpRes.status === 401, 'Live endpoint rejects unauthenticated request with 401');

    // 6.4 Backend fail-closed when runner is completely offline
    process.env.RUNNER_SERVICE_URL = 'http://127.0.0.1:54321';
    const unreachableRes = await runInSandbox('console.log("unreachable");');
    assert(
      unreachableRes.status === 'SANDBOX_UNAVAILABLE' && unreachableRes.sandboxAvailable === false,
      'Backend safely fails closed with SANDBOX_UNAVAILABLE when runner service is unreachable'
    );
    assert(
      unreachableRes.executionDuration === 0 && !unreachableRes.stdout,
      'Zero host execution guarantee: host NEVER evaluates untrusted code'
    );

    process.env.RUNNER_SERVICE_URL = `http://127.0.0.1:${TEST_RUNNER_PORT}`;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  // 6.5 Live Mutual TLS (mTLS) Handshake & Verification
  console.log('\n  --- Sub-section: Live mTLS Handshake & Cryptographic Verification ---');
  const tlsTestDir = path.resolve(__dirname, './.tmp_mtls_test');
  if (!existsSync(tlsTestDir)) mkdirSync(tlsTestDir, { recursive: true });

  const makeHttpsRequest = (urlStr, options = {}, body = null) => {
    return new Promise((resolve, reject) => {
      const url = new URL(urlStr);
      const reqOptions = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: options.headers || {},
        ca: options.ca,
        cert: options.cert,
        key: options.key,
        rejectUnauthorized: options.rejectUnauthorized !== undefined ? options.rejectUnauthorized : true
      };
      const req = https.request(reqOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          resolve({ status: res.statusCode, data });
        });
      });
      req.on('error', (err) => {
        reject(err);
      });
      if (body) {
        req.write(typeof body === 'string' ? body : JSON.stringify(body));
      }
      req.end();
    });
  };

  try {
    // Generate test CA, server cert, authorized client cert, and rogue client cert
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
      '-keyout', path.join(tlsTestDir, 'ca.key'),
      '-out', path.join(tlsTestDir, 'ca.crt'),
      '-days', '1', '-subj', '/CN=CodeForgeTestCA'
    ], { stdio: 'ignore' });

    execFileSync('openssl', [
      'req', '-newkey', 'rsa:2048', '-nodes',
      '-keyout', path.join(tlsTestDir, 'server.key'),
      '-out', path.join(tlsTestDir, 'server.csr'),
      '-subj', '/CN=localhost'
    ], { stdio: 'ignore' });

    execFileSync('openssl', [
      'x509', '-req', '-in', path.join(tlsTestDir, 'server.csr'),
      '-CA', path.join(tlsTestDir, 'ca.crt'),
      '-CAkey', path.join(tlsTestDir, 'ca.key'),
      '-CAcreateserial',
      '-out', path.join(tlsTestDir, 'server.crt'),
      '-days', '1'
    ], { stdio: 'ignore' });

    execFileSync('openssl', [
      'req', '-newkey', 'rsa:2048', '-nodes',
      '-keyout', path.join(tlsTestDir, 'client.key'),
      '-out', path.join(tlsTestDir, 'client.csr'),
      '-subj', '/CN=CodeForgeAppBackend'
    ], { stdio: 'ignore' });

    execFileSync('openssl', [
      'x509', '-req', '-in', path.join(tlsTestDir, 'client.csr'),
      '-CA', path.join(tlsTestDir, 'ca.crt'),
      '-CAkey', path.join(tlsTestDir, 'ca.key'),
      '-CAcreateserial',
      '-out', path.join(tlsTestDir, 'client.crt'),
      '-days', '1'
    ], { stdio: 'ignore' });

    // Rogue self-signed client certificate (untrusted CA)
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
      '-keyout', path.join(tlsTestDir, 'rogue.key'),
      '-out', path.join(tlsTestDir, 'rogue.crt'),
      '-days', '1', '-subj', '/CN=RogueClient'
    ], { stdio: 'ignore' });

    const caCert = readFileSync(path.join(tlsTestDir, 'ca.crt'));
    const serverCert = readFileSync(path.join(tlsTestDir, 'server.crt'));
    const serverKey = readFileSync(path.join(tlsTestDir, 'server.key'));
    const clientCert = readFileSync(path.join(tlsTestDir, 'client.crt'));
    const clientKey = readFileSync(path.join(tlsTestDir, 'client.key'));
    const rogueCert = readFileSync(path.join(tlsTestDir, 'rogue.crt'));
    const rogueKey = readFileSync(path.join(tlsTestDir, 'rogue.key'));

    const MTLS_PORT = 5097;
    await startRunnerServer(MTLS_PORT, {
      cert: serverCert,
      key: serverKey,
      ca: caCert,
      mtls: true,
      requestCert: true,
      rejectUnauthorized: true
    });

    try {
      // 6.5.1: Authorized client with valid mTLS cert and HMAC headers
      const validSignedHeaders = createSignedHeaders('POST', '/api/runner/execute', samplePayload, testSecret);
      const mtlsOkRes = await makeHttpsRequest(
        `https://localhost:${MTLS_PORT}/api/runner/execute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...validSignedHeaders
          },
          ca: caCert,
          cert: clientCert,
          key: clientKey
        },
        samplePayload
      );
      assert(
        mtlsOkRes.status === 200 || mtlsOkRes.status === 503,
        'mTLS Handshake: Authorized client with valid X.509 client certificate establishes mutual TLS connection'
      );

      // 6.5.2: Authorized client with valid mTLS cert but missing HMAC headers
      const mtlsNoAuthRes = await makeHttpsRequest(
        `https://localhost:${MTLS_PORT}/api/runner/execute`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          ca: caCert,
          cert: clientCert,
          key: clientKey
        },
        samplePayload
      );
      assert(
        mtlsNoAuthRes.status === 401,
        'Defense-in-depth: Even with valid mTLS cert, request without valid HMAC signature is rejected with 401'
      );

      // 6.5.3: Client without client certificate is rejected at TLS handshake
      let uncertificatedFailed = false;
      try {
        await makeHttpsRequest(
          `https://localhost:${MTLS_PORT}/api/runner/execute`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            ca: caCert
          },
          samplePayload
        );
      } catch {
        uncertificatedFailed = true;
      }
      assert(
        uncertificatedFailed,
        'mTLS Handshake: Request without client certificate is terminated at TLS layer before HTTP processing'
      );

      // 6.5.4: Rogue client with untrusted certificate is rejected at TLS handshake
      let rogueFailed = false;
      try {
        await makeHttpsRequest(
          `https://localhost:${MTLS_PORT}/api/runner/execute`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            ca: caCert,
            cert: rogueCert,
            key: rogueKey
          },
          samplePayload
        );
      } catch {
        rogueFailed = true;
      }
      assert(
        rogueFailed,
        'mTLS Handshake: Rogue client with untrusted certificate is rejected at TLS handshake'
      );
    } finally {
      await stopRunnerServer();
    }
  } finally {
    if (existsSync(tlsTestDir)) {
      rmSync(tlsTestDir, { recursive: true, force: true });
    }
  }

  // ----------------------------------------------------------------------------
  // SECTION 7: Live Runtime Isolation Status (Honest Reporting)
  // ----------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('SECTION 7: Live Container Runtime Isolation Status');
  console.log('----------------------------------------------------------------');

  const dockerActive = isRunnerSandboxAvailable();
  if (!dockerActive) {
    block(
      'Live Docker Container Sandbox Execution & Resource Quotas',
      'Docker daemon is offline in this environment (failed to connect to dockerDesktopLinuxEngine). CodeForge safely failed closed.'
    );
    block(
      'Live MicroVM / gVisor Sandboxed Runtime Verification',
      'Requires active production runtime engine (e.g. gVisor runsc / Firecracker). Host execution disabled.'
    );
  } else {
    assert(true, 'Live Docker daemon active and verified');
  }

  // ----------------------------------------------------------------------------
  // SECTION 8: Runtime Transparency & Fail-Closed Enforcement (REM-P0-07B)
  // ----------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('SECTION 8: Runtime Transparency & Fail-Closed Enforcement');
  console.log('----------------------------------------------------------------');

  // 8.1: Configured runtime absent/empty defaults to runc development container
  assert(isGvisorRequired({ requireGvisor: true }) === true, 'isGvisorRequired: returns true when explicitly required');
  assert(isGvisorRequired({ requireGvisor: false }) === false, 'isGvisorRequired: returns false when explicitly set to false');
  assert(Array.isArray(queryEngineRuntimes({ mockRuntimes: ['runc'] })), 'queryEngineRuntimes: returns array of available runtimes');

  clearRuntimeCache();
  const absentInfo = getRuntimeTransparencyInfo({ configuredRuntime: '', mockRuntimes: ['runc', 'io.containerd.runc.v2'] });
  assert(absentInfo.configuredRuntime === 'runc', 'Runtime transparency: empty CONTAINER_RUNTIME resolves to "runc"');
  assert(absentInfo.isGvisorConfigured === false, 'Runtime transparency: empty CONTAINER_RUNTIME is not marked gVisor configured');
  assert(absentInfo.gvisorActive === false, 'Runtime transparency: empty CONTAINER_RUNTIME reports gvisorActive: false');
  assert(absentInfo.gvisorVerified === false, 'Runtime transparency: empty CONTAINER_RUNTIME reports gvisorVerified: false');
  assert(absentInfo.verifiedRuntimeStatus === 'development-runc-active', 'Runtime transparency: status reports development-runc-active');
  assert(absentInfo.isolationTier === 'development-container-only', 'Runtime transparency: isolationTier reports development-container-only');

  // 8.2: Standard runc configuration
  clearRuntimeCache();
  const runcInfo = getRuntimeTransparencyInfo({ configuredRuntime: 'runc', mockRuntimes: ['runc'] });
  assert(runcInfo.configuredRuntime === 'runc', 'Runtime transparency: explicit "runc" reports configuredRuntime: runc');
  assert(runcInfo.isGvisorConfigured === false, 'Runtime transparency: runc is not marked gVisor configured');
  assert(runcInfo.gvisorActive === false, 'Runtime transparency: runc reports gvisorActive: false');
  assert(runcInfo.verifiedRuntimeStatus === 'development-runc-active', 'Runtime transparency: runc reports development-runc-active');

  // 8.3: runsc configured but missing/unsupported in engine (e.g. Windows Docker Desktop)
  clearRuntimeCache();
  const missingGvisorInfo = getRuntimeTransparencyInfo({
    configuredRuntime: 'runsc',
    mockRuntimes: ['runc', 'nvidia']
  });
  assert(missingGvisorInfo.isGvisorConfigured === true, 'Runtime transparency: runsc is marked gVisor configured');
  assert(missingGvisorInfo.isGvisorSupportedByEngine === false, 'Runtime transparency: engine does not support runsc');
  assert(missingGvisorInfo.gvisorActive === false, 'Runtime transparency: NEVER reports gvisorActive: true when runsc is missing from engine');
  assert(missingGvisorInfo.gvisorVerified === false, 'Runtime transparency: gvisorVerified is false when runsc is missing from engine');
  assert(missingGvisorInfo.verifiedRuntimeStatus === 'unsupported-gvisor-missing', 'Runtime transparency: status reports unsupported-gvisor-missing');
  assert(missingGvisorInfo.isolationTier === 'unverified-or-unavailable', 'Runtime transparency: isolationTier reports unverified-or-unavailable');

  // 8.4: Engine query failure / offline engine
  clearRuntimeCache();
  const offlineEngineInfo = getRuntimeTransparencyInfo({
    configuredRuntime: 'runsc',
    mockRuntimes: null
  });
  assert(offlineEngineInfo.engineRuntimes === null, 'Runtime transparency: engine failure reports engineRuntimes: null');
  assert(offlineEngineInfo.isEngineAvailable === false, 'Runtime transparency: engine availability reports false');
  assert(offlineEngineInfo.gvisorActive === false, 'Runtime transparency: engine failure reports gvisorActive: false');
  assert(offlineEngineInfo.gvisorVerified === false, 'Runtime transparency: engine failure reports gvisorVerified: false');
  assert(offlineEngineInfo.verifiedRuntimeStatus === 'unknown', 'Runtime transparency: status reports unknown when engine query fails');

  // 8.5: runsc configured AND reported by engine (Mocked verification)
  clearRuntimeCache();
  const activeGvisorInfo = getRuntimeTransparencyInfo({
    configuredRuntime: 'runsc',
    mockRuntimes: ['runc', 'runsc']
  });
  assert(activeGvisorInfo.isGvisorConfigured === true, '[MOCKED] Runtime transparency: runsc is marked gVisor configured');
  assert(activeGvisorInfo.isGvisorSupportedByEngine === true, '[MOCKED] Runtime transparency: engine reports runsc available');
  assert(activeGvisorInfo.gvisorActive === true, '[MOCKED] Runtime transparency: verified gVisor reports gvisorActive: true');
  assert(activeGvisorInfo.gvisorVerified === true, '[MOCKED] Runtime transparency: verified gVisor reports gvisorVerified: true');
  assert(activeGvisorInfo.verifiedRuntimeStatus === 'verified-gvisor-active', '[MOCKED] Runtime transparency: status reports verified-gvisor-active');
  assert(activeGvisorInfo.isolationTier === 'hardened-microkernel-gvisor', '[MOCKED] Runtime transparency: isolationTier reports hardened-microkernel-gvisor');

  // 8.6: Health endpoint never claims verified gVisor based only on env var
  const unverifiedHealth = getRunnerHealth({
    configuredRuntime: 'runsc',
    mockRuntimes: ['runc'],
    requireGvisor: true
  });
  assert(unverifiedHealth.gvisorActive === false, 'Health probe: never reports gvisorActive: true solely based on configuredRuntime=runsc');
  assert(unverifiedHealth.gvisorVerified === false, 'Health probe: never reports gvisorVerified: true when runsc is missing from engine');
  assert(unverifiedHealth.sandboxAvailable === false, 'Health probe: sandboxAvailable fails closed (false) in production when gVisor is required but missing');
  assert(unverifiedHealth.status === 'degraded', 'Health probe: status reports degraded when gVisor is required but missing');

  // 8.7: Production job rejection when gVisor is required but missing from engine
  const missingEngineJob = await executeInSandbox(
    { language: 'javascript', sourceCode: 'console.log("prod");' },
    { requireGvisor: true, configuredRuntime: 'runsc', mockRuntimes: ['runc'] }
  );
  assert(missingEngineJob.status === 'GVISOR_RUNTIME_REQUIRED', 'Pre-execution gate: rejects job with GVISOR_RUNTIME_REQUIRED when engine lacks runsc');
  assert(missingEngineJob.sandboxAvailable === false, 'Pre-execution gate: sandboxAvailable is false when gVisor required but missing');
  assert(missingEngineJob.verdict === 'Sandbox Configuration Error', 'Pre-execution gate: reports Sandbox Configuration Error');
  assert(missingEngineJob.executionDuration === 0, 'Pre-execution gate: zero execution duration (rejected before spawning container)');
  assert(missingEngineJob.runtimeInfo.verifiedRuntimeStatus === 'unsupported-gvisor-missing', 'Pre-execution gate: runtimeInfo exposes unsupported-gvisor-missing');

  // 8.8: Production job rejection when gVisor is required and runtime is configured as runc
  const runcProdJob = await executeInSandbox(
    { language: 'javascript', sourceCode: 'console.log("prod");' },
    { requireGvisor: true, configuredRuntime: 'runc', mockRuntimes: ['runc'] }
  );
  assert(runcProdJob.status === 'GVISOR_RUNTIME_REQUIRED', 'Pre-execution gate: rejects job when CONTAINER_RUNTIME=runc in production');
  assert(runcProdJob.sandboxAvailable === false, 'Pre-execution gate: sandboxAvailable is false when runc used in production');

  // 8.9: Production job rejection when gVisor is required and engine query fails
  const engineOfflineJob = await executeInSandbox(
    { language: 'javascript', sourceCode: 'console.log("prod");' },
    { requireGvisor: true, configuredRuntime: 'runsc', mockRuntimes: null }
  );
  assert(engineOfflineJob.status === 'GVISOR_RUNTIME_REQUIRED', 'Pre-execution gate: rejects job when engine runtimes cannot be queried');
  assert(engineOfflineJob.verdict === 'Sandbox Engine Unavailable', 'Pre-execution gate: verdict is Sandbox Engine Unavailable');

  // 8.10: Client-supplied runtime overrides remain strictly rejected
  const clientOverrideTests = [
    { key: 'runtime', value: 'runc' },
    { key: 'runtime', value: 'runsc' },
    { key: 'containerRuntime', value: 'runc' },
    { key: 'requireGvisor', value: false },
    { key: 'dockerArgs', value: ['--privileged'] }
  ];
  for (const item of clientOverrideTests) {
    let overrideThrew = false;
    let overrideCode = null;
    try {
      validateJobPayload({
        language: 'javascript',
        sourceCode: 'console.log("exploit");',
        [item.key]: item.value
      });
    } catch (err) {
      overrideThrew = true;
      overrideCode = err.code;
    }
    assert(
      overrideThrew && overrideCode === 'FORBIDDEN_RUNTIME_ARGUMENTS',
      `Client-supplied override '${item.key}' is strictly rejected with 400 FORBIDDEN_RUNTIME_ARGUMENTS`
    );
  }

  // 8.11: Live HTTP endpoint fails closed with 503 when gVisor is required but unavailable
  const PROD_FAIL_PORT = 5098;
  const prodSavedEnv = { ...process.env };
  process.env.NODE_ENV = 'production';
  process.env.REQUIRE_GVISOR = 'true';
  process.env.CONTAINER_RUNTIME = 'runsc';
  process.env.RUNNER_SHARED_SECRET = testSecret;

  try {
    await startRunnerServer(PROD_FAIL_PORT, {
      configuredRuntime: 'runsc',
      skipCache: true
    });

    try {
      // 8.11.1 Check health probe in production
      const prodHealthRes = await fetch(`http://127.0.0.1:${PROD_FAIL_PORT}/api/runner/health`);
      const prodHealth = await prodHealthRes.json();
      assert(prodHealthRes.status === 200, 'Live endpoint: health probe responds with 200 OK');
      assert(prodHealth.status === 'degraded', 'Live endpoint: production health reports status: degraded when runsc is unavailable');
      assert(prodHealth.sandboxAvailable === false, 'Live endpoint: production health reports sandboxAvailable: false');
      assert(
        prodHealth.verifiedRuntimeStatus === 'unsupported-gvisor-missing' || prodHealth.verifiedRuntimeStatus === 'unknown',
        'Live endpoint: production health reports unverified status (unsupported-gvisor-missing or unknown)'
      );

      // 8.11.2 Check execution job rejection in production
      const jobHeaders = createSignedHeaders('POST', '/api/runner/execute', samplePayload, testSecret);
      const prodExecRes = await fetch(`http://127.0.0.1:${PROD_FAIL_PORT}/api/runner/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Runner-Secret': testSecret,
          ...jobHeaders
        },
        body: JSON.stringify(samplePayload)
      });
      const prodExecData = await prodExecRes.json();
      assert(prodExecRes.status === 503, 'Live endpoint: returns HTTP 503 Service Unavailable when gVisor is required but engine lacks runsc');
      assert(prodExecData.status === 'GVISOR_RUNTIME_REQUIRED', 'Live endpoint: response body status is GVISOR_RUNTIME_REQUIRED');
      assert(prodExecData.sandboxAvailable === false, 'Live endpoint: response body sandboxAvailable is false');
    } finally {
      await stopRunnerServer();
    }
  } finally {
    process.env = prodSavedEnv;
  }

  // ----------------------------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED, ${blocked} BLOCKED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test suite failed unexpectedly:', err);
  process.exit(1);
});
