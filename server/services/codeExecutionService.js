import { execFileSync } from 'child_process';
import { createSignedHeaders } from '../runner/runnerSigning.js';
import { isLanguageSupported, normalizeLanguageId } from '../config/languages.js';

/**
 * Windows / Linux Docker Sandbox Setup Guide
 */
export const DOCKER_SETUP_GUIDE = {
  os: process.platform === 'win32' ? 'Windows' : process.platform,
  title: 'Secure Code Execution Sandbox Setup',
  status: 'SANDBOX_UNAVAILABLE',
  message:
    'Secure Docker execution sandbox is currently unavailable. To execute untrusted user code safely without exposing the host operating system, Docker must be running on the isolated runner service.',
  steps: [
    '1. Install Docker Desktop (https://www.docker.com/products/docker-desktop/).',
    '2. Ensure Docker Desktop daemon is running and WSL 2 backend is active.',
    '3. Pull the lightweight runtime sandbox image: docker pull node:20-alpine',
    '4. Start the isolated runner service (npm run runner or docker-compose up runner).',
    '5. Refresh this page or re-run code once the container engine is active.'
  ],
  securityNotice:
    'In accordance with strict security standards, CodeForge will NEVER execute untrusted client code using host eval, Function, or unconstrained host child processes.'
};

// Concurrency and Backpressure Control
let activeExecutions = 0;
export const getMaxConcurrentExecutions = () => parseInt(process.env.MAX_CONCURRENT_EXECUTIONS || '5', 10);
export const getActiveExecutions = () => activeExecutions;

// Output limits
const MAX_OUTPUT_BYTES = 64 * 1024; // 64KB response limit
const _MAX_BUFFER_BYTES = 512 * 1024; // 512KB process buffer limit

/**
 * Safely truncates string if it exceeds maximum allowable output size.
 * @param {string} str
 * @returns {string}
 */
export const truncateOutput = (str) => {
  if (!str || typeof str !== 'string') return '';
  if (str.length <= MAX_OUTPUT_BYTES) return str;
  return str.slice(0, MAX_OUTPUT_BYTES) + '\n[Output truncated: exceeded 64KB limit]';
};

/**
 * Resolves current runner service endpoint configuration.
 * @returns {{ runnerUrl: string, runnerSecret: string }}
 */
const getRunnerConfig = () => {
  const runnerUrl =
    process.env.RUNNER_SERVICE_URL ||
    (process.env.NODE_ENV === 'production' ? 'http://runner:5050' : 'http://127.0.0.1:5050');
  const runnerSecret = process.env.RUNNER_SHARED_SECRET;
  if (!runnerSecret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[Configuration Error] RUNNER_SHARED_SECRET must be configured in production.');
    }
    return { runnerUrl, runnerSecret: 'dev-runner-secret-for-local-testing-only-32chars' };
  }
  return { runnerUrl, runnerSecret };
};

// Cache runner availability for up to 2 seconds to avoid excessive health probes
let cachedRunnerAvailable = false;
let lastCheckTime = 0;
const CACHE_TTL_MS = 2000;

/**
 * Asynchronously checks whether the isolated runner service and its Docker sandbox are available.
 * Non-blocking HTTP probe against GET /api/runner/health.
 * @returns {Promise<boolean>}
 */
export const isSandboxAvailableAsync = async () => {
  try {
    const { runnerUrl } = getRunnerConfig();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);

    const res = await fetch(`${runnerUrl}/api/runner/health`, {
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!res.ok) {
      cachedRunnerAvailable = false;
      lastCheckTime = Date.now();
      return false;
    }

    const data = await res.json();
    const available = data.sandboxAvailable === true;
    cachedRunnerAvailable = available;
    lastCheckTime = Date.now();
    return available;
  } catch {
    cachedRunnerAvailable = false;
    lastCheckTime = Date.now();
    return false;
  }
};

/**
 * Synchronous probe to check runner sandbox availability.
 * Employs cached state or lightweight synchronous probe for backward compatibility with sync callers.
 * @returns {boolean}
 */
export const isSandboxAvailable = () => {
  if (Date.now() - lastCheckTime < CACHE_TTL_MS) {
    return cachedRunnerAvailable;
  }

  try {
    const { runnerUrl } = getRunnerConfig();
    const probeScript = `const http = require('http');
try {
  const u = new URL(process.argv[1]);
  const req = http.get({
    hostname: u.hostname,
    port: u.port || (u.protocol === 'https:' ? 443 : 80),
    path: '/api/runner/health',
    timeout: 1000
  }, (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        process.exit(parsed.sandboxAvailable ? 0 : 1);
      } catch {
        process.exit(1);
      }
    });
  });
  req.on('error', () => process.exit(1));
  req.on('timeout', () => { req.destroy(); process.exit(1); });
} catch {
  process.exit(1);
}`;

    execFileSync(process.execPath, ['-e', probeScript, runnerUrl], {
      timeout: 1500,
      stdio: ['ignore', 'ignore', 'ignore'],
      windowsHide: true
    });

    cachedRunnerAvailable = true;
    lastCheckTime = Date.now();
    return true;
  } catch {
    cachedRunnerAvailable = false;
    lastCheckTime = Date.now();
    return false;
  }
};

/**
 * Normalizes output strings for robust, safe output comparison.
 * Handles whitespace differences, carriage returns, JSON formatting, and trailing newlines.
 * @param {any} val
 * @returns {string}
 */
export const normalizeOutput = (val) => {
  if (val === undefined || val === null) return '';
  const str = String(val).replace(/\r\n/g, '\n').trim();

  // Try parsing JSON for structured equality
  try {
    const parsed = JSON.parse(str);
    return JSON.stringify(parsed);
  } catch {
    return str;
  }
};

/**
 * Compares actual output with expected output safely.
 * @param {string} actual
 * @param {string} expected
 * @returns {boolean}
 */
export const compareOutputs = (actual, expected) => {
  const normActual = normalizeOutput(actual);
  const normExpected = normalizeOutput(expected);

  if (normActual === normExpected) return true;

  // Case-insensitive exact match
  if (normActual.toLowerCase() === normExpected.toLowerCase()) return true;

  // Whitespace-stripped match (e.g. "[0, 1]" vs "[0,1]")
  const noSpaceActual = normActual.replace(/\s+/g, '');
  const noSpaceExpected = normExpected.replace(/\s+/g, '');
  if (noSpaceActual === noSpaceExpected) return true;

  return false;
};

/**
 * Validates language and source code payload.
 * Throws clean validation error objects with status code 400.
 * @param {string} language
 * @param {string} sourceCode
 */
export const validateCodePayload = (language, sourceCode) => {
  if (!language || typeof language !== 'string' || !isLanguageSupported(language)) {
    const err = new Error('Unsupported language. Supported languages: JavaScript, Python, C, C++, and Java.');
    err.statusCode = 400;
    throw err;
  }

  if (sourceCode === undefined || sourceCode === null || typeof sourceCode !== 'string') {
    const err = new Error('Source code is required.');
    err.statusCode = 400;
    throw err;
  }

  if (sourceCode.trim().length === 0) {
    const err = new Error('Source code cannot be empty.');
    err.statusCode = 400;
    throw err;
  }

  if (sourceCode.length > 65536) {
    const err = new Error('Source code exceeds maximum limit of 64KB.');
    err.statusCode = 400;
    throw err;
  }
};

/**
 * Builds the exact argument list for isolated Docker sandbox execution.
 * Retained for configuration inspection and unit verification tests.
 *
 * @param {object} [options={}]
 * @param {string} [options.tempDir]
 * @param {string} [options.memory='128m']
 * @param {string} [options.cpus='0.5']
 * @param {string} [options.pidsLimit='64']
 * @param {string} [options.tmpfsSize='16m']
 * @param {string} [options.image='node:20-alpine']
 * @returns {string[]}
 */
export const buildDockerExecutionArgs = (options = {}) => {
  const memory = options.memory || '128m';
  const cpus = options.cpus || '0.5';
  const pidsLimit = options.pidsLimit || '64';
  const tmpfsSize = options.tmpfsSize || '16m';
  const image = options.image || 'node:20-alpine';
  const tempDir = options.tempDir;

  const args = [
    'run',
    '--rm',
    '--network', 'none',
    '--memory', memory,
    '--memory-swap', memory,
    '--cpus', cpus,
    '--pids-limit', pidsLimit,
    '--user', 'node',
    '--security-opt', 'no-new-privileges:true',
    '--cap-drop', 'ALL',
    '--read-only',
    '--tmpfs', `/tmp:rw,noexec,nosuid,size=${tmpfsSize}`
  ];

  if (tempDir) {
    args.push('-v', `${tempDir}:/app:ro`);
    args.push(image, 'node', '/app/solution.js');
  } else {
    args.push('-i', image, 'node', '-');
  }

  return args;
};

/**
 * Executes user source code by dispatching to the isolated internal runner microservice.
 *
 * Security Architecture (REM-P0-01):
 * - The public backend container has NO Docker socket access and NO Docker CLI.
 * - All code execution requests are forwarded to the dedicated internal runner service over
 *   a private internal network using timing-safe mutual authentication.
 * - The runner service executes the untrusted code inside a strictly bounded, non-root,
 *   air-gapped Docker container.
 * - If the runner is unreachable or container engine offline, fails closed with SANDBOX_UNAVAILABLE.
 *
 * @param {string} sourceCode
 * @param {string} [inputData='']
 * @param {string} [language='javascript']
 * @returns {Promise<{ stdout: string, stderr: string, executionDuration: number, status: string, verdict?: string, sandboxAvailable: boolean, setupGuide?: object }>}
 */
export const runInSandbox = async (sourceCode, inputData = '', language = 'javascript', options = {}) => {
  const maxConcurrent = getMaxConcurrentExecutions();
  if (activeExecutions >= maxConcurrent) {
    return {
      sandboxAvailable: true,
      status: 'CONCURRENCY_LIMIT_EXCEEDED',
      verdict: 'Execution Queue Busy',
      stdout: '',
      stderr: 'Maximum concurrent container executions reached. Backpressure applied.',
      executionDuration: 0
    };
  }

  activeExecutions += 1;
  try {
    const { runnerUrl, runnerSecret } = getRunnerConfig();
    const controller = new AbortController();
    // 7000ms timeout on API side (runner has 5000ms container timeout)
    const timer = setTimeout(() => controller.abort(), 7000);

    let response;
    try {
      const canonicalLang = normalizeLanguageId(language) || 'javascript';
      const payload = {
        language: canonicalLang,
        sourceCode,
        inputData: String(inputData || '')
      };
      if (options.problemSlug || options.slug) {
        payload.problemSlug = options.problemSlug || options.slug;
      }
      if (options.problemId) {
        payload.problemId = options.problemId;
      }
      const signedHeaders = createSignedHeaders('POST', '/api/runner/execute', payload, runnerSecret);

      response = await fetch(`${runnerUrl}/api/runner/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Runner-Secret': runnerSecret,
          ...signedHeaders
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } catch {
      clearTimeout(timer);
      cachedRunnerAvailable = false;
      return {
        sandboxAvailable: false,
        status: 'SANDBOX_UNAVAILABLE',
        verdict: 'Sandbox Unavailable',
        stdout: '',
        stderr: 'Docker runner service is unreachable. Host execution disabled for security.',
        executionDuration: 0,
        setupGuide: DOCKER_SETUP_GUIDE
      };
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 503) {
      cachedRunnerAvailable = false;
      const data = await response.json().catch(() => ({}));
      return {
        sandboxAvailable: false,
        status: 'SANDBOX_UNAVAILABLE',
        verdict: 'Sandbox Unavailable',
        stdout: '',
        stderr: data.message || 'Docker sandbox is unavailable on runner host. Host execution disabled.',
        executionDuration: 0,
        setupGuide: DOCKER_SETUP_GUIDE
      };
    }

    if (response.status === 429) {
      const data = await response.json().catch(() => ({}));
      return {
        sandboxAvailable: true,
        status: 'CONCURRENCY_LIMIT_EXCEEDED',
        verdict: data.verdict || 'Execution Queue Busy',
        stdout: '',
        stderr: data.message || 'Runner queue busy.',
        executionDuration: 0
      };
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return {
        sandboxAvailable: true,
        status: data.status || 'RUNTIME_ERROR',
        verdict: data.verdict || 'Runtime Error',
        stdout: truncateOutput(data.stdout || ''),
        stderr: truncateOutput(data.stderr || data.message || 'Runner error occurred.'),
        executionDuration: data.executionDuration || 0
      };
    }

    const data = await response.json();
    return {
      sandboxAvailable: true,
      status: data.status || 'SUCCESS',
      verdict: data.verdict || 'Executed',
      stdout: truncateOutput(data.stdout || ''),
      stderr: truncateOutput(data.stderr || ''),
      executionDuration: data.executionDuration || 0
    };
  } finally {
    activeExecutions = Math.max(0, activeExecutions - 1);
  }
};
