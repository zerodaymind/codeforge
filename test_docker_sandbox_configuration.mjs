/**
 * ==============================================================================
 * CODEFORGE CONTAINERIZED DOCKER EXECUTION CONFIGURATION TEST SUITE
 * Validates Docker sandbox security constraints, command construction,
 * Dockerfile / Docker Compose socket wiring, payload validation, and fail-closed behavior.
 * ==============================================================================
 */

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildDockerExecutionArgs,
  validateCodePayload,
  truncateOutput,
  isSandboxAvailable,
  runInSandbox,
  getMaxConcurrentExecutions
} from './server/services/codeExecutionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passed = 0;
let blocked = 0;
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

function block(testName, reason) {
  blocked++;
  console.log(`  ⚠ BLOCKED: ${testName}`);
  console.log(`    Reason: ${reason}`);
}

async function runTests() {
  console.log('\n==================================================');
  console.log('  CODEFORGE DOCKER SANDBOX CONFIGURATION SUITE');
  console.log('==================================================\n');

  // ----------------------------------------------------------------------------
  // PART 1: Docker Sandbox Security Flags & Command Construction
  // ----------------------------------------------------------------------------
  console.log('--------------------------------------------------');
  console.log('PART 1: Security Constraints & Command Construction');
  console.log('--------------------------------------------------');

  const argsWithMount = buildDockerExecutionArgs({ tempDir: '/tmp/test-sandbox' });
  const argsStdin = buildDockerExecutionArgs();

  // 1.1 Automatic container cleanup
  assert(argsWithMount.includes('--rm'), 'Enforces container cleanup upon termination (--rm)');

  // 1.2 Network isolation / Air-gapped execution
  assert(
    argsWithMount.includes('--network') && argsWithMount[argsWithMount.indexOf('--network') + 1] === 'none',
    'Enforces complete network isolation (--network none)'
  );

  // 1.3 Memory limit & swap bounding
  assert(
    argsWithMount.includes('--memory') && argsWithMount[argsWithMount.indexOf('--memory') + 1] === '128m',
    'Enforces memory limit quota (--memory 128m)'
  );
  assert(
    argsWithMount.includes('--memory-swap') && argsWithMount[argsWithMount.indexOf('--memory-swap') + 1] === '128m',
    'Enforces memory swap ceiling (--memory-swap 128m)'
  );

  // 1.4 CPU quota
  assert(
    argsWithMount.includes('--cpus') && argsWithMount[argsWithMount.indexOf('--cpus') + 1] === '0.5',
    'Enforces CPU quota limit (--cpus 0.5)'
  );

  // 1.5 Process limit (fork bomb prevention)
  assert(
    argsWithMount.includes('--pids-limit') && argsWithMount[argsWithMount.indexOf('--pids-limit') + 1] === '64',
    'Enforces process ceiling to prevent fork bombs (--pids-limit 64)'
  );

  // 1.6 Non-root user privilege
  assert(
    argsWithMount.includes('--user') && argsWithMount[argsWithMount.indexOf('--user') + 1] === 'node',
    'Executes under non-privileged "node" user (--user node)'
  );

  // 1.7 Privilege escalation disabled
  assert(
    argsWithMount.includes('--security-opt') &&
      argsWithMount[argsWithMount.indexOf('--security-opt') + 1] === 'no-new-privileges:true',
    'Disables privilege escalation (--security-opt no-new-privileges:true)'
  );

  // 1.8 Dropped Linux kernel capabilities
  assert(
    argsWithMount.includes('--cap-drop') && argsWithMount[argsWithMount.indexOf('--cap-drop') + 1] === 'ALL',
    'Drops all Linux kernel capabilities (--cap-drop ALL)'
  );

  // 1.9 Read-only root filesystem
  assert(argsWithMount.includes('--read-only'), 'Enforces read-only root filesystem (--read-only)');

  // 1.10 Non-executable, non-suid tmpfs
  const tmpfsIdx = argsWithMount.indexOf('--tmpfs');
  assert(
    tmpfsIdx !== -1 && argsWithMount[tmpfsIdx + 1].includes('noexec') && argsWithMount[tmpfsIdx + 1].includes('nosuid'),
    'Configures restricted tmpfs with noexec and nosuid flags (--tmpfs)'
  );

  // 1.11 Base image specification
  assert(argsWithMount.includes('node:20-alpine'), 'Uses hardened minimal runtime image (node:20-alpine)');

  // 1.12 Stdin streaming mode for containerized Docker-out-of-Docker environments
  assert(argsStdin.includes('-i') && argsStdin.includes('-'), 'Supports stdin execution mode without requiring host file mount');

  // ----------------------------------------------------------------------------
  // PART 2: Deployment Configuration Audit (REM-P0-01 Isolated Runner Architecture)
  // ----------------------------------------------------------------------------
  console.log('\n--------------------------------------------------');
  console.log('PART 2: Deployment Configuration (Dockerfile & Compose Isolation)');
  console.log('--------------------------------------------------');

  const dockerfileContent = readFileSync(path.resolve(__dirname, 'Dockerfile'), 'utf-8');
  assert(
    !dockerfileContent.includes('apk add --no-cache docker-cli') && !dockerfileContent.includes('apk add docker-cli'),
    'Public Backend Dockerfile has NO docker-cli installed (least privilege)'
  );
  assert(
    !dockerfileContent.includes('addgroup node docker'),
    'Public Backend Dockerfile does NOT grant docker group privileges to node user'
  );
  assert(
    dockerfileContent.includes('USER node'),
    'Backend Dockerfile enforces non-root USER node execution'
  );

  const composeContent = readFileSync(path.resolve(__dirname, 'docker-compose.yml'), 'utf-8');
  // Backend service block must NOT mount docker.sock
  const backendBlock = composeContent.slice(composeContent.indexOf('backend:'), composeContent.indexOf('runner:'));
  assert(
    !backendBlock.includes('/var/run/docker.sock'),
    'docker-compose.yml ensures backend service has NO host Docker socket mount'
  );
  assert(
    composeContent.includes('runner:') && composeContent.includes('/var/run/docker.sock:/var/run/docker.sock'),
    'docker-compose.yml confines Docker socket exclusively to dedicated runner service'
  );
  assert(
    composeContent.includes('RUNNER_SERVICE_URL: http://runner:5050'),
    'docker-compose.yml wires backend to internal runner service URL'
  );
  assert(
    !composeContent.includes('"27017:27017"'),
    'docker-compose.yml keeps MongoDB port 27017 unexposed to external network'
  );

  // ----------------------------------------------------------------------------
  // PART 3: Code Payload Validation & Output Buffering
  // ----------------------------------------------------------------------------
  console.log('\n--------------------------------------------------');
  console.log('PART 3: Code Payload Validation & Output Buffering');
  console.log('--------------------------------------------------');

  // 3.1 Unsupported language rejection
  let unsupportedThrown = false;
  try {
    validateCodePayload('rust', 'fn main() {}');
  } catch (err) {
    unsupportedThrown = err.statusCode === 400;
  }
  assert(unsupportedThrown, 'Rejects unsupported language (rust) with status 400');

  // 3.2 Empty code rejection
  let emptyThrown = false;
  try {
    validateCodePayload('javascript', '   \n  ');
  } catch (err) {
    emptyThrown = err.statusCode === 400;
  }
  assert(emptyThrown, 'Rejects empty source code with status 400');

  // 3.3 Oversized code (>64KB) rejection
  let oversizedThrown = false;
  try {
    validateCodePayload('javascript', 'console.log("X");'.repeat(6000));
  } catch (err) {
    oversizedThrown = err.statusCode === 400;
  }
  assert(oversizedThrown, 'Rejects oversized source code (>64KB) with status 400');

  // 3.4 Valid JavaScript passes validation
  let validPassed = true;
  try {
    validateCodePayload('javascript', 'console.log("Valid Code");');
  } catch {
    validPassed = false;
  }
  assert(validPassed, 'Valid JavaScript source code passes validation without error');

  // 3.5 Output truncation helper
  const largeOutput = 'A'.repeat(80000);
  const truncated = truncateOutput(largeOutput);
  assert(
    truncated.length < 80000 && truncated.includes('[Output truncated: exceeded 64KB limit]'),
    'Truncates output exceeding 64KB limit and appends truncation indicator'
  );

  // 3.6 Concurrency limit inspection
  assert(getMaxConcurrentExecutions() >= 1, `Max concurrent executions configured (${getMaxConcurrentExecutions()})`);

  // ----------------------------------------------------------------------------
  // PART 4: Fail-Closed Security & Live Execution Checks
  // ----------------------------------------------------------------------------
  console.log('\n--------------------------------------------------');
  console.log('PART 4: Fail-Closed Security & Container Execution');
  console.log('--------------------------------------------------');

  const dockerActive = isSandboxAvailable();

  if (!dockerActive) {
    console.log('  Notice: Docker daemon is currently offline in this environment.');
    const result = await runInSandbox('console.log("test");');
    assert(
      result.status === 'SANDBOX_UNAVAILABLE' && result.sandboxAvailable === false,
      'Fail-closed: returns SANDBOX_UNAVAILABLE when Docker engine is offline'
    );
    assert(
      result.setupGuide && Array.isArray(result.setupGuide.steps),
      'Provides actionable setup guide with security notices'
    );
    assert(
      !result.stdout && result.executionDuration === 0,
      'Strict zero-execution guarantee: host never executes untrusted code'
    );

    block(
      'Live Docker Container Execution & Timeout Simulation',
      'Requires active Docker Desktop daemon. CodeForge safely failed closed.'
    );
  } else {
    // Docker is available: run live container tests
    const liveRun = await runInSandbox('console.log("Containerized execution active!");');
    assert(
      liveRun.status === 'SUCCESS' && liveRun.stdout.includes('Containerized execution active!'),
      'Live Docker sandbox executes safely inside container'
    );
  }

  // ----------------------------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------------------------
  console.log('\n==================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED, ${blocked} BLOCKED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled error in test_docker_sandbox_configuration.mjs:', err);
  process.exit(1);
});
