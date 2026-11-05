import { spawn, execFile, execSync } from 'child_process';
import crypto from 'crypto';
import { normalizeLanguageId } from '../config/languages.js';
import { resolveProblemSignature } from '../config/problemSignatures.js';

/**
 * ==============================================================================
 * CodeForge Hardened Runner Execution Service (REM-P0-02)
 *
 * Dedicated sandbox execution boundary for running untrusted student code.
 *
 * Security Architecture & Lifecycle Protections:
 * 1.  Zero Host Bind-Mounts: Default stdin execution transport (`node -`)
 *     streams solution directly into memory, eliminating DooD volume mismatches
 *     and host directory traversal risks.
 * 2.  Active Container Tracking & Forced Termination: Every execution assigns
 *     a deterministic container name (`cf-job-<uuid>`). On timeout or buffer
 *     flood, an active `docker rm -f <name>` watchdog forcefully terminates
 *     the container on the engine rather than relying solely on client process kill.
 * 3.  Signal Reaping & Bounded Termination: Container runs with `--init` and
 *     `--stop-timeout 2`, preventing zombie process accumulation.
 * 4.  Network Air-Gap: Container is strictly isolated with `--network none`.
 * 5.  Kernel Capability Stripping: Drops all Linux capabilities with `--cap-drop ALL`.
 * 6.  Filesystem Lockdown: Immutable `--read-only` root with isolated tmpfs.
 * 7.  Non-Privileged Execution: Runs strictly as `--user node` (UID 1000) with
 *     privilege escalation disabled (`--security-opt no-new-privileges:true`).
 * 8.  Hard Resource Quotas: 128MB RAM, 128MB swap ceiling, 0.5 CPU, 64 processes.
 * 9.  Hard Deadlines: 5000ms wall-clock timeout and 512KB process buffer ceiling.
 * 10. Sandboxed Runtime Support: Supports pluggable `--runtime=runsc` (gVisor).
 * 11. Active Job Registry & Graceful Shutdown: Tracks all running jobs and kills
 *     orphans if the runner daemon receives SIGTERM/SIGINT.
 * ==============================================================================
 */

const MAX_OUTPUT_BYTES = 64 * 1024; // 64KB response truncation ceiling
const MAX_BUFFER_BYTES = 512 * 1024; // 512KB process buffer limit
const ALLOWED_LANGUAGES = [
  'javascript', 'nodejs', 'js', 'node',
  'python', 'py', 'python3',
  'c',
  'cpp', 'c++', 'cplusplus',
  'java'
];
const DEFAULT_SANDBOX_IMAGE = process.env.SANDBOX_IMAGE || 'codeforge-sandbox:latest';

let activeRuns = 0;
export const getMaxConcurrentRuns = () => parseInt(process.env.MAX_CONCURRENT_RUNS || '5', 10);
export const getActiveRuns = () => activeRuns;

// In-memory active job registry: jobId -> { containerName, process, startTime }
export const activeJobs = new Map();

/**
 * Forcefully terminates and removes an execution container on the container engine.
 * @param {string} containerName
 * @returns {Promise<void>}
 */
export const killExecutionContainer = (containerName) => {
  return new Promise((resolve) => {
    if (!containerName) return resolve();
    execFile(
      'docker',
      ['rm', '-f', containerName],
      { timeout: 3000, stdio: ['ignore', 'ignore', 'ignore'] },
      () => resolve()
    );
  });
};

/**
 * Graceful termination: clean up all active containers on runner shutdown.
 */
export const terminateAllActiveJobs = async () => {
  const killPromises = [];
  for (const [jobId, job] of activeJobs.entries()) {
    console.warn(`[Runner Cleanup] Forcefully terminating active job ${jobId} (${job.containerName})`);
    if (job.process && !job.process.killed) {
      try {
        job.process.kill('SIGKILL');
      } catch {
        // Ignore kill error
      }
    }
    killPromises.push(killExecutionContainer(job.containerName));
  }
  await Promise.all(killPromises);
  activeJobs.clear();
};

// Register shutdown cleanup hooks once
if (typeof process !== 'undefined' && process.on) {
  process.once('SIGTERM', async () => {
    await terminateAllActiveJobs();
  });
  process.once('SIGINT', async () => {
    await terminateAllActiveJobs();
  });
}

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
 * Checks whether the container runtime daemon is available and responsive.
 * @returns {boolean}
 */
export const isRunnerSandboxAvailable = (options = {}) => {
  if (options && options.mockSandboxAvailable !== undefined) {
    return Boolean(options.mockSandboxAvailable);
  }
  if (options && options.mockRuntimes !== undefined) {
    return options.mockRuntimes !== null;
  }
  try {
    execSync('docker ps -q', {
      timeout: 2000,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });
    return true;
  } catch {
    return false;
  }
};

let cachedEngineRuntimes = null;
let lastRuntimeCheckTime = 0;
const RUNTIME_CACHE_TTL_MS = 2000;

/**
 * Invalidate cached container engine runtimes (useful for testing and engine re-probes).
 */
export const clearRuntimeCache = () => {
  cachedEngineRuntimes = null;
  lastRuntimeCheckTime = 0;
};

/**
 * Queries the container engine for registered OCI runtimes.
 * Extracts runtime names from `docker info --format "{{json .Runtimes}}"`.
 *
 * @param {object} [options={}]
 * @param {string[]|null} [options.mockRuntimes] - Mock runtimes for testing without engine query.
 * @param {boolean} [options.skipCache=false]
 * @returns {string[]|null} Array of runtime names, or null if engine cannot be queried.
 */
export const queryEngineRuntimes = (options = {}) => {
  if (options.mockRuntimes !== undefined) {
    return options.mockRuntimes;
  }
  if (!options.skipCache && cachedEngineRuntimes && (Date.now() - lastRuntimeCheckTime < RUNTIME_CACHE_TTL_MS)) {
    return cachedEngineRuntimes;
  }

  try {
    const stdout = execSync('docker info --format "{{json .Runtimes}}"', {
      timeout: 2500,
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
      encoding: 'utf8'
    });
    if (!stdout || !stdout.trim()) {
      cachedEngineRuntimes = [];
      lastRuntimeCheckTime = Date.now();
      return [];
    }
    const parsed = JSON.parse(stdout.trim());
    const runtimes = Object.keys(parsed || {});
    cachedEngineRuntimes = runtimes;
    lastRuntimeCheckTime = Date.now();
    return runtimes;
  } catch {
    cachedEngineRuntimes = null;
    lastRuntimeCheckTime = Date.now();
    return null;
  }
};

/**
 * Determines whether the current deployment or invocation requires gVisor runtime.
 * Strict fail-closed policy:
 * - If requireGvisor is explicitly supplied in options, honor that boolean.
 * - If process.env.REQUIRE_GVISOR is set, check whether it is 'true'.
 * - In production (NODE_ENV=production), defaults to required unless REQUIRE_GVISOR='false'.
 *
 * @param {object} [options={}]
 * @returns {boolean}
 */
export const isGvisorRequired = (options = {}) => {
  if (options && options.requireGvisor !== undefined) {
    return Boolean(options.requireGvisor);
  }
  if (process.env.REQUIRE_GVISOR !== undefined) {
    return process.env.REQUIRE_GVISOR === 'true';
  }
  return process.env.NODE_ENV === 'production';
};

/**
 * Provides comprehensive runtime transparency (REM-P0-07B).
 * Separates three distinct concepts:
 * 1. configuredRuntime: what was requested via CONTAINER_RUNTIME (defaults to 'runc').
 * 2. engineRuntimes: what runtimes the Docker daemon actually reports (or null if query fails).
 * 3. verifiedRuntimeStatus: verified operational status (never claims active gVisor solely from env var).
 *
 * @param {object} [options={}]
 * @returns {{
 *   configuredRuntime: string,
 *   effectiveRuntime: string,
 *   isGvisorConfigured: boolean,
 *   engineRuntimes: string[]|null,
 *   isEngineAvailable: boolean,
 *   isGvisorSupportedByEngine: boolean,
 *   gvisorActive: boolean,
 *   gvisorVerified: boolean,
 *   verifiedRuntimeStatus: string,
 *   isolationTier: string
 * }}
 */
export const getRuntimeTransparencyInfo = (options = {}) => {
  const configuredRuntime = (
    options && options.configuredRuntime !== undefined
      ? options.configuredRuntime
      : (process.env.CONTAINER_RUNTIME || '')
  ).trim();

  const isGvisorConfigured = configuredRuntime === 'runsc';
  const engineRuntimes = queryEngineRuntimes(options);
  const isEngineAvailable = engineRuntimes !== null;
  const isGvisorSupportedByEngine = Boolean(isEngineAvailable && engineRuntimes.includes('runsc'));

  let verifiedRuntimeStatus = 'unknown';
  let isolationTier = 'unverified-or-unavailable';
  let gvisorActive = false;
  let gvisorVerified = false;

  if (!isEngineAvailable) {
    verifiedRuntimeStatus = 'unknown';
    isolationTier = 'unverified-or-unavailable';
    gvisorActive = false;
    gvisorVerified = false;
  } else if (isGvisorConfigured) {
    if (isGvisorSupportedByEngine) {
      verifiedRuntimeStatus = 'verified-gvisor-active';
      isolationTier = 'hardened-microkernel-gvisor';
      gvisorActive = true;
      gvisorVerified = true;
    } else {
      verifiedRuntimeStatus = 'unsupported-gvisor-missing';
      isolationTier = 'unverified-or-unavailable';
      gvisorActive = false;
      gvisorVerified = false;
    }
  } else {
    const effective = configuredRuntime || 'runc';
    if (effective === 'runc' || engineRuntimes.includes(effective)) {
      verifiedRuntimeStatus = 'development-runc-active';
      isolationTier = 'development-container-only';
    } else {
      verifiedRuntimeStatus = 'unverified-custom-runtime';
      isolationTier = 'unverified-or-unavailable';
    }
    gvisorActive = false;
    gvisorVerified = false;
  }

  return {
    configuredRuntime: configuredRuntime || 'runc',
    effectiveRuntime: isGvisorConfigured ? 'runsc' : (configuredRuntime || 'runc'),
    isGvisorConfigured,
    engineRuntimes,
    isEngineAvailable,
    isGvisorSupportedByEngine,
    gvisorActive,
    gvisorVerified,
    verifiedRuntimeStatus,
    isolationTier
  };
};

/**
 * Validates untrusted code execution job payload.
 * Rejects unsupported languages, empty code, oversized code, or forbidden parameters.
 *
 * @param {object} payload
 * @returns {{ language: string, sourceCode: string, inputData: string }}
 */
export const validateJobPayload = (payload = {}) => {
  const { language = 'javascript', sourceCode, inputData = '' } = payload;

  if (!language || typeof language !== 'string' || !ALLOWED_LANGUAGES.includes(language.toLowerCase().trim())) {
    const err = new Error('Unsupported language. Runner supports JavaScript, Python, C, C++, and Java.');
    err.statusCode = 400;
    err.code = 'UNSUPPORTED_LANGUAGE';
    throw err;
  }

  if (sourceCode === undefined || sourceCode === null || typeof sourceCode !== 'string') {
    const err = new Error('Source code is required.');
    err.statusCode = 400;
    err.code = 'MISSING_SOURCE_CODE';
    throw err;
  }

  if (sourceCode.trim().length === 0) {
    const err = new Error('Source code cannot be empty.');
    err.statusCode = 400;
    err.code = 'EMPTY_SOURCE_CODE';
    throw err;
  }

  if (sourceCode.length > 65536) {
    const err = new Error('Source code exceeds maximum allowable limit of 64KB.');
    err.statusCode = 400;
    err.code = 'SOURCE_CODE_TOO_LARGE';
    throw err;
  }

  // Reject any payload attempting to pass privileged or custom container arguments
  const forbiddenKeys = [
    'dockerArgs', 'image', 'mounts', 'privileged', 'runtime', 'network',
    'volumes', 'capAdd', 'securityOpt', 'user', 'devices', 'pid', 'ipc',
    'containerRuntime', 'runtimeConfig', 'requireGvisor'
  ];
  for (const key of forbiddenKeys) {
    if (payload[key] !== undefined) {
      const err = new Error(`Client-supplied container runtime argument '${key}' is strictly forbidden.`);
      err.statusCode = 400;
      err.code = 'FORBIDDEN_RUNTIME_ARGUMENTS';
      throw err;
    }
  }

  return {
    language: language.toLowerCase().trim(),
    sourceCode,
    inputData: String(inputData || ''),
    problemSlug: payload.problemSlug || payload.slug || null,
    problemId: payload.problemId || null
  };
};

/**
 * Builds the hardened argument list for isolated Docker sandbox execution.
 * Supports both options object and legacy string tempDir signature.
 *
 * @param {object|string} [options={}]
 * @returns {string[]}
 */
export const buildHardenedDockerArgs = (options = {}) => {
  const containerName = typeof options === 'string' ? null : options?.containerName || null;
  const tempDir = typeof options === 'string' ? options : options?.tempDir || null;
  const memory = (typeof options === 'object' && options?.memory) || '128m';
  const cpus = (typeof options === 'object' && options?.cpus) || '0.5';
  const pidsLimit = (typeof options === 'object' && options?.pidsLimit) || '64';
  const allowExec = typeof options === 'object' && Boolean(options?.allowExec);
  const tmpfsSize = (typeof options === 'object' && options?.tmpfsSize) || (allowExec ? '32m' : '16m');
  const image = (typeof options === 'object' && options?.image) || DEFAULT_SANDBOX_IMAGE;
  const runtime = (typeof options === 'object' && options?.runtime) || process.env.CONTAINER_RUNTIME;

  const tmpfsFlag = allowExec
    ? `/tmp:rw,exec,nosuid,size=${tmpfsSize}`
    : `/tmp:rw,noexec,nosuid,size=${tmpfsSize}`;

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
    '--tmpfs', tmpfsFlag
  ];

  if (runtime) {
    args.push(`--runtime=${runtime}`);
  }

  if (containerName) {
    args.push('--name', containerName);
  }

  // Enforce init process signal reaping and bounded stop timeout
  args.push('--init');
  args.push('--stop-timeout', '2');

  if (tempDir) {
    args.push('-v', `${tempDir}:/app:ro`);
    args.push(image, 'node', '/app/solution.js');
  } else {
    // Default: Stdin streaming execution mode (zero host bind-mounts)
    args.push('-i', image, 'node', '-');
  }

  return args;
};

/**
 * Bundles Python code with standard input and LeetCode function harness.
 * @param {string} sourceCode
 * @param {string} inputData
 * @returns {string}
 */
export const buildPythonBundle = (sourceCode, inputData = '') => {
  return `import sys, json, re, io, inspect

_cf_input = ${JSON.stringify(inputData)}
_cf_has_printed = False
_orig_print = print

if _cf_input:
    sys.stdin = io.StringIO(_cf_input)

def _wrapped_print(*args, **kwargs):
    global _cf_has_printed
    _cf_has_printed = True
    _orig_print(*args, **kwargs)

print = _wrapped_print

${sourceCode}

if not _cf_has_printed and _cf_input and _cf_input.strip():
    try:
        src = ${JSON.stringify(sourceCode)}
        match = re.search(r'def\\s+([a-zA-Z0-9_]+)\\s*\\(', src)
        if match:
            fn_name = match.group(1)
            fn = globals().get(fn_name)
            if not callable(fn) and 'Solution' in globals():
                sol_cls = globals()['Solution']
                sol_inst = sol_cls()
                fn = getattr(sol_inst, fn_name, None)
            if callable(fn):
                scope = {}
                input_stmt = re.sub(r',\\s*([a-zA-Z0-9_]+)\\s*=', r'; \\1 =', _cf_input.strip())
                exec(input_stmt, globals(), scope)
                sig = inspect.signature(fn)
                call_args = [scope[k] for k in sig.parameters.keys() if k in scope]
                res = fn(*call_args)
                if res is not None:
                    _orig_print(json.dumps(res, separators=(',', ':')))
                elif call_args:
                    _orig_print(json.dumps(call_args[0], separators=(',', ':')))
    except Exception as e:
        sys.stderr.write("Runtime Error: " + str(e))
        sys.exit(1)
`;
};

/**
 * Detects whether C++ source code contains an explicit main() entry point.
 * Strips comments and string literals to prevent false positives.
 * @param {string} code
 * @returns {boolean}
 */
export const hasCppMain = (code) => {
  if (!code || typeof code !== 'string') return false;
  const stripped = code
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");
  return /(?:^|[\s;{}])(?:int|signed|auto|void)\s+main\s*\([^)]*\)/.test(stripped);
};

/**
 * Parses test case input string into a dictionary of named variable assignments.
 * Supports "var = val, var2 = val2" format and raw JSON fallback.
 * @param {string} inputStr
 * @returns {object}
 */
export const parseCppInputVariables = (inputStr) => {
  if (!inputStr || typeof inputStr !== 'string' || !inputStr.trim()) return {};
  const trimmed = inputStr.trim();
  if (trimmed.includes('=')) {
    try {
      const parts = trimmed.split(/,\s*(?=[a-zA-Z0-9_$]+\s*=)/);
      const varNames = parts.map((p) => p.trim().split('=')[0].trim()).filter(Boolean);
      const parseFn = new Function(`let ${trimmed}; return { ${varNames.join(', ')} };`);
      return parseFn();
    } catch {
      // Fallback regex parsing
      const map = {};
      const regex = /([a-zA-Z0-9_$]+)\s*=\s*([^,=]+(?:\[.*?\])?(?:\(.*?\))?)/g;
      let m;
      while ((m = regex.exec(trimmed)) !== null) {
        try { map[m[1].trim()] = JSON.parse(m[2].trim()); } catch { map[m[1].trim()] = m[2].trim(); }
      }
      if (Object.keys(map).length > 0) return map;
    }
  }
  try {
    return { _raw: JSON.parse(trimmed) };
  } catch {
    return { _raw: trimmed };
  }
};

/**
 * Formats a JavaScript value into a valid C++ literal expression.
 * @param {any} val
 * @param {string} type
 * @returns {string}
 */
export const toCppLiteral = (val, type = '') => {
  const cleanType = (type || '').replace('&', '').trim();
  if (cleanType === 'vector<int>') {
    const arr = Array.isArray(val) ? val : [];
    return `vector<int>{${arr.map((v) => parseInt(v, 10) || 0).join(', ')}}`;
  }
  if (cleanType === 'vector<char>') {
    const arr = Array.isArray(val) ? val : [];
    return `vector<char>{${arr.map((c) => `'${String(c).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`).join(', ')}}`;
  }
  if (cleanType === 'vector<string>') {
    const arr = Array.isArray(val) ? val : [];
    return `vector<string>{${arr.map((s) => JSON.stringify(String(s))).join(', ')}}`;
  }
  if (cleanType === 'int') {
    return String(parseInt(val, 10) || 0);
  }
  if (cleanType === 'double') {
    const num = parseFloat(val);
    return isNaN(num) ? '0.0' : String(num);
  }
  if (cleanType === 'bool') {
    return val ? 'true' : 'false';
  }
  if (cleanType === 'string') {
    return JSON.stringify(String(val !== undefined && val !== null ? val : ''));
  }
  if (cleanType === 'ListNode*') {
    const arr = Array.isArray(val) ? val : [];
    return `createList({${arr.map((v) => parseInt(v, 10) || 0).join(', ')}})`;
  }
  return JSON.stringify(val);
};

/**
 * Builds C++ execution harness for LRUCache.
 * @param {string} sourceCode
 * @param {string} inputData
 * @returns {string}
 */
export const buildLruCacheCppHarness = (sourceCode, inputData = '') => {
  const effectiveInput = (inputData && inputData.trim())
    ? inputData
    : '["LRUCache", "put", "put", "get"], [[2], [1, 1], [2, 2], [1]]';
  let commands = ['LRUCache', 'put', 'put', 'get'];
  let args = [[2], [1, 1], [2, 2], [1]];
  try {
    const parsed = JSON.parse(`[${effectiveInput}]`);
    if (Array.isArray(parsed[0]) && Array.isArray(parsed[1])) {
      commands = parsed[0];
      args = parsed[1];
    }
  } catch {}

  const steps = [];
  steps.push('    LRUCache* obj = nullptr;');
  steps.push('    cout << "[";');
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    const arg = args[i] || [];
    const sep = i === 0 ? '' : 'cout << ","; ';
    if (cmd === 'LRUCache') {
      const cap = parseInt(arg[0], 10) || 2;
      steps.push(`    ${sep}obj = new LRUCache(${cap}); cout << "null";`);
    } else if (cmd === 'put') {
      const k = parseInt(arg[0], 10) || 0;
      const v = parseInt(arg[1], 10) || 0;
      steps.push(`    ${sep}if (obj) obj->put(${k}, ${v}); cout << "null";`);
    } else if (cmd === 'get') {
      const k = parseInt(arg[0], 10) || 0;
      steps.push(`    ${sep}if (obj) cout << obj->get(${k}); else cout << -1;`);
    }
  }
  steps.push('    cout << "]" << endl;');
  steps.push('    delete obj;');

  return `
#include <iostream>
#include <vector>
#include <string>
#include <unordered_map>
#include <list>
using namespace std;

${sourceCode}

int main() {
${steps.join('\n')}
    return 0;
}
`;
};

/**
 * Builds a complete C++ bundle for compilation and execution.
 * Mode 1: Complete program containing main() -> compiled as-is.
 * Mode 2 & 3: LeetCode-style class Solution or function -> wrapped in authoritative problem harness.
 * If neither main() nor a supported problem signature exists, flags compilation error clearly.
 *
 * @param {string} sourceCode
 * @param {string} [inputData='']
 * @param {object} [options={}]
 * @returns {{ isCompleteProgram: boolean, isUnsupported: boolean, errorMessage?: string, sourceCode?: string }}
 */
export const buildCppBundle = (sourceCode, inputData = '', options = {}) => {
  // Mode 1: Complete program mode containing main()
  if (hasCppMain(sourceCode)) {
    return {
      isCompleteProgram: true,
      isUnsupported: false,
      sourceCode
    };
  }

  // Mode 2 & 3: Function or LeetCode-style class Solution harness mode
  const problemSlug = options.problemSlug || options.slug || options.problemId;
  const signature = resolveProblemSignature(problemSlug, sourceCode);

  if (!signature) {
    // Neither main() nor a recognized problem signature exists
    return {
      isUnsupported: true,
      errorMessage: "No 'main' function detected and no supported problem harness available for this submission. Please include an int main() entry point or implement a supported problem Solution method."
    };
  }

  // Special handling for class data structures (e.g. LRUCache)
  if (signature.isCustomClass && signature.className === 'LRUCache') {
    return {
      isCompleteProgram: false,
      isUnsupported: false,
      sourceCode: buildLruCacheCppHarness(sourceCode, inputData)
    };
  }

  // Parse input variables against problem parameters
  const effectiveInput = (inputData && inputData.trim()) ? inputData : (signature.defaultInput || '');
  const parsedVars = parseCppInputVariables(effectiveInput);

  const hasClassSolution = /\bclass\s+Solution\b/.test(sourceCode);
  const paramSetupLines = [];
  const callArgNames = [];

  for (let i = 0; i < signature.params.length; i++) {
    const param = signature.params[i];
    let rawVal = parsedVars[param.name];
    if (rawVal === undefined) {
      if (Array.isArray(parsedVars._raw)) {
        rawVal = parsedVars._raw[i];
      } else if (signature.params.length === 1 && parsedVars._raw !== undefined) {
        rawVal = parsedVars._raw;
      }
    }

    const literalVal = toCppLiteral(rawVal, param.type);
    const varName = `_arg_${param.name}`;
    const baseType = (param.type || '').replace('&', '').trim();
    paramSetupLines.push(`    ${baseType} ${varName} = ${literalVal};`);
    callArgNames.push(varName);
  }

  let invocationLine = '';
  if (signature.isVoidInPlace) {
    const targetVar = `_arg_${signature.mutatedParam || signature.params[0].name}`;
    if (hasClassSolution) {
      invocationLine = `    Solution sol;\n    sol.${signature.methodName}(${callArgNames.join(', ')});\n    printResult(${targetVar});`;
    } else {
      invocationLine = `    ${signature.methodName}(${callArgNames.join(', ')});\n    printResult(${targetVar});`;
    }
  } else {
    if (hasClassSolution) {
      invocationLine = `    Solution sol;\n    auto _res = sol.${signature.methodName}(${callArgNames.join(', ')});\n    printResult(_res);`;
    } else {
      invocationLine = `    auto _res = ${signature.methodName}(${callArgNames.join(', ')});\n    printResult(_res);`;
    }
  }

  const generatedMain = `
// Automated entry point generated by CodeForge for ${signature.title}
int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
${paramSetupLines.join('\n')}
${invocationLine}
    return 0;
}
`;

  const includes = `
#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <algorithm>
#include <unordered_map>
#include <unordered_set>
#include <map>
#include <set>
#include <queue>
#include <deque>
#include <stack>
#include <cmath>
#include <climits>
#include <cctype>
#include <iomanip>

using namespace std;

#ifndef CODEFORGE_LISTNODE_DEFINED
#define CODEFORGE_LISTNODE_DEFINED
struct ListNode {
    int val;
    ListNode *next;
    ListNode() : val(0), next(nullptr) {}
    ListNode(int x) : val(x), next(nullptr) {}
    ListNode(int x, ListNode *next) : val(x), next(next) {}
};

inline ListNode* createList(const vector<int>& values) {
    if (values.empty()) return nullptr;
    ListNode* head = new ListNode(values[0]);
    ListNode* curr = head;
    for (size_t i = 1; i < values.size(); ++i) {
        curr->next = new ListNode(values[i]);
        curr = curr->next;
    }
    return head;
}
#endif

// Serializers
template<typename T>
void printResult(const vector<T>& vec) {
    cout << "[";
    for (size_t i = 0; i < vec.size(); ++i) {
        if (i > 0) cout << ",";
        cout << vec[i];
    }
    cout << "]" << endl;
}

inline void printResult(const vector<char>& vec) {
    cout << "[";
    for (size_t i = 0; i < vec.size(); ++i) {
        if (i > 0) cout << ",";
        cout << "\\"" << vec[i] << "\\"";
    }
    cout << "]" << endl;
}

inline void printResult(const vector<string>& vec) {
    cout << "[";
    for (size_t i = 0; i < vec.size(); ++i) {
        if (i > 0) cout << ",";
        cout << "\\"" << vec[i] << "\\"";
    }
    cout << "]" << endl;
}

inline void printResult(bool val) {
    cout << (val ? "true" : "false") << endl;
}

inline void printResult(int val) {
    cout << val << endl;
}

inline void printResult(long long val) {
    cout << val << endl;
}

inline void printResult(double val) {
    ostringstream oss;
    oss << fixed << setprecision(5) << val;
    cout << oss.str() << endl;
}

inline void printResult(const string& val) {
    cout << "\\"" << val << "\\"" << endl;
}

inline void printResult(ListNode* head) {
    cout << "[";
    bool first = true;
    while (head != nullptr) {
        if (!first) cout << ",";
        cout << head->val;
        first = false;
        head = head->next;
    }
    cout << "]" << endl;
}
`;

  const bundledCode = `${includes}

// --- USER CODE BEGIN ---
${sourceCode}
// --- USER CODE END ---

${generatedMain}
`;

  return {
    isCompleteProgram: false,
    isUnsupported: false,
    sourceCode: bundledCode
  };
};

/**
 * Builds multi-language execution bundle script for containerized execution.
 * Streams into in-container node dispatcher that writes source to tmpfs,
 * compiles if needed (C/C++/Java), executes with piped stdin, and streams output.
 *
 * @param {string} language
 * @param {string} sourceCode
 * @param {string} [inputData='']
 * @param {object} [options={}]
 * @returns {string}
 */
export const buildMultiLanguageExecutionScript = (language, sourceCode, inputData = '', options = {}) => {
  const canonicalLang = normalizeLanguageId(language) || 'javascript';
  const serializedLang = JSON.stringify(canonicalLang);
  const serializedInput = JSON.stringify(inputData || '');

  let fileWriteScript = '';
  if (canonicalLang === 'javascript') {
    fileWriteScript = `fs.writeFileSync('/tmp/solution.js', ${JSON.stringify(buildStdinExecutionBundle(sourceCode, inputData))});
    const proc = spawnSync('node', ['/tmp/solution.js'], {
      input: inputData,
      encoding: 'utf8',
      maxBuffer: 512 * 1024
    });
    if (proc.stdout) process.stdout.write(proc.stdout);
    if (proc.stderr) process.stderr.write(proc.stderr);
    process.exit(proc.status || 0);`;
  } else if (canonicalLang === 'python') {
    fileWriteScript = `fs.writeFileSync('/tmp/solution.py', ${JSON.stringify(buildPythonBundle(sourceCode, inputData))});
    const proc = spawnSync('python3', ['/tmp/solution.py'], {
      input: inputData,
      encoding: 'utf8',
      maxBuffer: 512 * 1024
    });
    if (proc.stdout) process.stdout.write(proc.stdout);
    if (proc.stderr) process.stderr.write(proc.stderr);
    process.exit(proc.status || 0);`;
  } else if (canonicalLang === 'c') {
    fileWriteScript = `fs.writeFileSync('/tmp/solution.c', ${JSON.stringify(sourceCode)});
    const comp = spawnSync('gcc', ['-O2', '-o', '/tmp/solution', '/tmp/solution.c'], {
      encoding: 'utf8',
      maxBuffer: 512 * 1024
    });
    if (comp.status !== 0) {
      process.stderr.write('Compilation Error:\\n' + (comp.stderr || comp.stdout || 'GCC compilation failed'));
      process.exit(101);
    }
    const proc = spawnSync('/tmp/solution', [], {
      input: inputData,
      encoding: 'utf8',
      maxBuffer: 512 * 1024
    });
    if (proc.stdout) process.stdout.write(proc.stdout);
    if (proc.stderr) process.stderr.write(proc.stderr);
    if (proc.signal) {
      process.stderr.write('Runtime Error: Process terminated by signal ' + proc.signal + '\\n');
      process.exit(134);
    }
    process.exit(proc.status !== null ? proc.status : (proc.error ? 1 : 0));`;
  } else if (canonicalLang === 'cpp') {
    const cppBundle = buildCppBundle(sourceCode, inputData, options);
    if (cppBundle.isUnsupported) {
      fileWriteScript = `process.stderr.write('Compilation Error:\\n' + ${JSON.stringify(cppBundle.errorMessage)}); process.exit(101);`;
    } else {
      fileWriteScript = `fs.writeFileSync('/tmp/solution.cpp', ${JSON.stringify(cppBundle.sourceCode)});
    const comp = spawnSync('g++', ['-O2', '-o', '/tmp/solution', '/tmp/solution.cpp'], {
      encoding: 'utf8',
      maxBuffer: 512 * 1024
    });
    if (comp.status !== 0) {
      process.stderr.write('Compilation Error:\\n' + (comp.stderr || comp.stdout || 'G++ compilation failed'));
      process.exit(101);
    }
    const proc = spawnSync('/tmp/solution', [], {
      input: inputData,
      encoding: 'utf8',
      maxBuffer: 512 * 1024
    });
    if (proc.stdout) process.stdout.write(proc.stdout);
    if (proc.stderr) process.stderr.write(proc.stderr);
    if (proc.signal) {
      process.stderr.write('Runtime Error: Process terminated by signal ' + proc.signal + '\\n');
      process.exit(134);
    }
    process.exit(proc.status !== null ? proc.status : (proc.error ? 1 : 0));`;
    }
  } else if (canonicalLang === 'java') {
    const classMatch = sourceCode.match(/public\s+class\s+([a-zA-Z0-9_]+)/);
    const className = classMatch ? classMatch[1] : 'Solution';
    fileWriteScript = `const javaFile = '/tmp/${className}.java';
    fs.writeFileSync(javaFile, ${JSON.stringify(sourceCode)});
    const comp = spawnSync('javac', ['-d', '/tmp', javaFile], {
      encoding: 'utf8',
      maxBuffer: 512 * 1024
    });
    if (comp.status !== 0) {
      process.stderr.write('Compilation Error:\\n' + (comp.stderr || comp.stdout || 'Javac compilation failed'));
      process.exit(101);
    }
    const proc = spawnSync('java', ['-Xmx64m', '-cp', '/tmp', '${className}'], {
      input: inputData,
      encoding: 'utf8',
      maxBuffer: 512 * 1024
    });
    if (proc.stdout) process.stdout.write(proc.stdout);
    if (proc.stderr) process.stderr.write(proc.stderr);
    if (proc.signal) {
      process.stderr.write('Runtime Error: Process terminated by signal ' + proc.signal + '\\n');
      process.exit(134);
    }
    process.exit(proc.status !== null ? proc.status : (proc.error ? 1 : 0));`;
  } else {
    fileWriteScript = `process.stderr.write('Unsupported language: ' + ${serializedLang}); process.exit(1);`;
  }

  return `
const fs = require('fs');
const { spawnSync } = require('child_process');

const inputData = ${serializedInput};

try {
  ${fileWriteScript}
} catch (err) {
  process.stderr.write(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
`;
};

/**
 * Bundles untrusted student source code with mock runtime input harness for stdin streaming.
 * @param {string} sourceCode
 * @param {string} inputData
 * @returns {string}
 */
export const buildStdinExecutionBundle = (sourceCode, inputData = '') => {
  const serializedInput = JSON.stringify(inputData);
  return `
const fs = require('fs');
const _cf_input = ${serializedInput};
const _cf_origReadFileSync = fs.readFileSync;
fs.readFileSync = function(path, enc) {
  if (path === 'input.txt' || path === '/dev/stdin' || path === 0) {
    return enc ? String(_cf_input) : Buffer.from(_cf_input);
  }
  return _cf_origReadFileSync.apply(fs, arguments);
};

let _cf_hasLogged = false;
const _cf_origConsoleLog = console.log;
console.log = function() {
  _cf_hasLogged = true;
  _cf_origConsoleLog.apply(console, arguments);
};

${sourceCode}

// Automated function invocation harness for function-based problem solutions
(function() {
  if (_cf_hasLogged || !_cf_input || typeof _cf_input !== 'string' || !_cf_input.trim()) return;
  try {
    const src = ${JSON.stringify(sourceCode)};
    const match = src.match(/function\\s+([a-zA-Z0-9_$]+)\\s*\\(([^)]*)\\)/) ||
                  src.match(/(?:const|let|var)\\s+([a-zA-Z0-9_$]+)\\s*=\\s*(?:function|\\([^)]*\\)\\s*=>)/);
    if (!match) return;
    const fnName = match[1];
    let targetFn = null;
    try { targetFn = eval(fnName); } catch {}
    if (typeof targetFn !== 'function') return;

    const parts = _cf_input.split(/,\\s*(?=[a-zA-Z0-9_$]+\\s*=)/);
    const varNames = parts.map(p => p.trim().split('=')[0].trim()).filter(Boolean);
    const parseFn = new Function(\`
      let \${_cf_input};
      return [ \${varNames.join(', ')} ];
    \`);
    const args = parseFn();
    const res = targetFn.apply(null, args);
    if (res !== undefined) {
      _cf_origConsoleLog(JSON.stringify(res));
    } else if (args.length > 0 && args[0] !== undefined) {
      _cf_origConsoleLog(JSON.stringify(args[0]));
    }
  } catch (harnessErr) {
    console.error('Runtime Error:', harnessErr.message || harnessErr);
    process.exit(1);
  }
})();
`;
};

/**
 * Executes a job payload inside an ephemeral Docker container using stdin streaming
 * and active lifecycle termination management.
 *
 * @param {object} payload
 * @param {object} [options={}]
 * @returns {Promise<{ stdout: string, stderr: string, executionDuration: number, status: string, verdict: string, runtimeInfo?: object }>}
 */
export const executeInSandbox = async (payload, options = {}) => {
  const validJob = validateJobPayload(payload);

  // Pre-execution gate (REM-P0-07B): fail closed before accepting execution jobs if gVisor is required
  const runtimeInfo = options.runtimeInfo || getRuntimeTransparencyInfo(options);
  if (isGvisorRequired(options)) {
    if (runtimeInfo.configuredRuntime !== 'runsc') {
      return {
        sandboxAvailable: false,
        status: 'GVISOR_RUNTIME_REQUIRED',
        verdict: 'Sandbox Configuration Error',
        stdout: '',
        stderr: `Production requires CONTAINER_RUNTIME='runsc', but '${runtimeInfo.configuredRuntime}' is configured. Host execution disabled.`,
        executionDuration: 0,
        runtimeInfo
      };
    }
    if (!runtimeInfo.isEngineAvailable) {
      return {
        sandboxAvailable: false,
        status: 'GVISOR_RUNTIME_REQUIRED',
        verdict: 'Sandbox Engine Unavailable',
        stdout: '',
        stderr: 'Production requires verified gVisor (runsc) runtime, but Docker engine runtimes could not be queried. Host execution disabled.',
        executionDuration: 0,
        runtimeInfo
      };
    }
    if (!runtimeInfo.isGvisorSupportedByEngine || runtimeInfo.verifiedRuntimeStatus !== 'verified-gvisor-active') {
      return {
        sandboxAvailable: false,
        status: 'GVISOR_RUNTIME_REQUIRED',
        verdict: 'Sandbox Configuration Error',
        stdout: '',
        stderr: `Production requires verified gVisor (runsc) runtime, but engine status is '${runtimeInfo.verifiedRuntimeStatus}' (registered engine runtimes: ${JSON.stringify(runtimeInfo.engineRuntimes)}). Host execution disabled.`,
        executionDuration: 0,
        runtimeInfo
      };
    }
  }

  if (!isRunnerSandboxAvailable(options)) {
    return {
      sandboxAvailable: false,
      status: 'SANDBOX_UNAVAILABLE',
      verdict: 'Sandbox Unavailable',
      stdout: '',
      stderr: 'Docker execution sandbox is unavailable on runner host. Host execution disabled.',
      executionDuration: 0,
      runtimeInfo
    };
  }

  const maxConcurrent = getMaxConcurrentRuns();
  if (activeRuns >= maxConcurrent) {
    return {
      sandboxAvailable: true,
      status: 'CONCURRENCY_LIMIT_EXCEEDED',
      verdict: 'Execution Queue Busy',
      stdout: '',
      stderr: 'Runner concurrency limit reached. Backpressure applied.',
      executionDuration: 0
    };
  }

  activeRuns += 1;
  const jobId = crypto.randomUUID();
  const containerName = `cf-job-${jobId.replace(/-/g, '').slice(0, 16)}`;
  const startTime = Date.now();
  const TIMEOUT_MS = 5000;

  const canonicalLang = normalizeLanguageId(validJob.language) || 'javascript';
  const isCompiled = ['c', 'cpp', 'java'].includes(canonicalLang);

  // Build hardened docker run arguments using stdin streaming (no host bind-mount)
  const dockerArgs = buildHardenedDockerArgs({
    containerName,
    allowExec: isCompiled,
    tmpfsSize: isCompiled ? '32m' : '16m',
    runtime: runtimeInfo.configuredRuntime === 'runsc' ? 'runsc' : (process.env.CONTAINER_RUNTIME || undefined)
  });
  const scriptBundle = canonicalLang === 'javascript'
    ? buildStdinExecutionBundle(validJob.sourceCode, validJob.inputData)
    : buildMultiLanguageExecutionScript(canonicalLang, validJob.sourceCode, validJob.inputData, {
        problemSlug: validJob.problemSlug,
        problemId: validJob.problemId
      });

  let childProc = null;
  let timeoutTimer = null;
  let isTerminated = false;

  try {
    return await new Promise((resolve) => {
      childProc = spawn('docker', dockerArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });

      // Register active container handle for lifecycle tracking
      activeJobs.set(jobId, {
        containerName,
        process: childProc,
        startTime
      });

      let stdoutAccum = '';
      let stderrAccum = '';
      let bufferExceeded = false;

      // Pipe solution script into container stdin
      try {
        childProc.stdin.write(scriptBundle, 'utf8');
        childProc.stdin.end();
      } catch {
        // Child process may have failed to start
      }

      // 1. Output Buffer Ceiling Monitoring
      childProc.stdout.on('data', (chunk) => {
        stdoutAccum += chunk.toString('utf8');
        if (stdoutAccum.length + stderrAccum.length > MAX_BUFFER_BYTES && !bufferExceeded) {
          bufferExceeded = true;
          isTerminated = true;
          killExecutionContainer(containerName);
          try {
            childProc.kill('SIGKILL');
          } catch {
            // Ignore kill error
          }
        }
      });

      childProc.stderr.on('data', (chunk) => {
        stderrAccum += chunk.toString('utf8');
        if (stdoutAccum.length + stderrAccum.length > MAX_BUFFER_BYTES && !bufferExceeded) {
          bufferExceeded = true;
          isTerminated = true;
          killExecutionContainer(containerName);
          try {
            childProc.kill('SIGKILL');
          } catch {
            // Ignore kill error
          }
        }
      });

      // 2. Wall-Clock Timeout Watchdog (Active Container Termination)
      timeoutTimer = setTimeout(async () => {
        if (isTerminated) return;
        isTerminated = true;

        // Forcefully remove container on engine daemon
        await killExecutionContainer(containerName);
        try {
          if (childProc && !childProc.killed) {
            childProc.kill('SIGKILL');
          }
        } catch {
          // Ignore kill error
        }

        const executionDuration = Date.now() - startTime;
        resolve({
          sandboxAvailable: true,
          status: 'TIME_LIMIT_EXCEEDED',
          verdict: 'Time Limit Exceeded',
          stdout: truncateOutput(stdoutAccum),
          stderr: 'Execution timed out after 5000ms. Container forcefully terminated.',
          executionDuration
        });
      }, TIMEOUT_MS);

      // 3. Process Exit Handling
      childProc.on('close', (code, signal) => {
        clearTimeout(timeoutTimer);
        const executionDuration = Date.now() - startTime;

        if (isTerminated) {
          // Already resolved via timeout or buffer overflow
          if (bufferExceeded) {
            return resolve({
              sandboxAvailable: true,
              status: 'OUTPUT_LIMIT_EXCEEDED',
              verdict: 'Output Limit Exceeded',
              stdout: truncateOutput(stdoutAccum),
              stderr: 'Excessive output generated. Process buffer limit exceeded (512KB). Container terminated.',
              executionDuration
            });
          }
          return;
        }

        isTerminated = true;

        if (bufferExceeded) {
          return resolve({
            sandboxAvailable: true,
            status: 'OUTPUT_LIMIT_EXCEEDED',
            verdict: 'Output Limit Exceeded',
            stdout: truncateOutput(stdoutAccum),
            stderr: 'Excessive output generated. Process buffer limit exceeded (512KB). Container terminated.',
            executionDuration
          });
        }

        if (signal === 'SIGTERM' || signal === 'SIGKILL' || code === 124 || code === 137) {
          return resolve({
            sandboxAvailable: true,
            status: 'TIME_LIMIT_EXCEEDED',
            verdict: 'Time Limit Exceeded',
            stdout: truncateOutput(stdoutAccum),
            stderr: 'Execution terminated by container runtime signal.',
            executionDuration
          });
        }

        if (code !== 0) {
          const isCompilation = code === 101 || /SyntaxError|Compilation Error/i.test(stderrAccum);
          return resolve({
            sandboxAvailable: true,
            status: isCompilation ? 'COMPILATION_ERROR' : 'RUNTIME_ERROR',
            verdict: isCompilation ? 'Compilation Error' : 'Runtime Error',
            stdout: truncateOutput(stdoutAccum),
            stderr: truncateOutput(stderrAccum || `Process exited with code ${code}`),
            executionDuration
          });
        }

        return resolve({
          sandboxAvailable: true,
          status: 'SUCCESS',
          verdict: 'Executed',
          stdout: truncateOutput(stdoutAccum),
          stderr: truncateOutput(stderrAccum),
          executionDuration
        });
      });

      childProc.on('error', (err) => {
        clearTimeout(timeoutTimer);
        if (isTerminated) return;
        isTerminated = true;
        const executionDuration = Date.now() - startTime;
        killExecutionContainer(containerName);

        resolve({
          sandboxAvailable: true,
          status: 'RUNTIME_ERROR',
          verdict: 'Runtime Error',
          stdout: truncateOutput(stdoutAccum),
          stderr: truncateOutput(err.message),
          executionDuration
        });
      });
    });
  } finally {
    clearTimeout(timeoutTimer);
    activeRuns = Math.max(0, activeRuns - 1);
    activeJobs.delete(jobId);
    // Asynchronous cleanup guarantee: ensure container is removed from engine
    killExecutionContainer(containerName).catch(() => {});
  }
};
