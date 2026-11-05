import express from 'express';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { authenticateRunnerRequest } from './runnerAuthMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
import {
  isRunnerSandboxAvailable,
  executeInSandbox,
  getActiveRuns,
  getMaxConcurrentRuns,
  getRuntimeTransparencyInfo,
  isGvisorRequired
} from './runnerExecutionService.js';

/**
 * ==============================================================================
 * CodeForge Dedicated Internal Runner Microservice
 *
 * Runs inside the isolated runner trust boundary.
 * Listens on internal port 5050 (not exposed to external host networks).
 * ==============================================================================
 */

const app = express();
const PORT = parseInt(process.env.PORT || '5050', 10);
const DEFAULT_HOST = process.env.RUNNER_HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');

// Strict JSON body parsing (max 100kb payload)
app.use(express.json({ limit: '100kb' }));

/**
 * Computes comprehensive runner health and runtime transparency metrics.
 * @param {object} [options={}]
 * @returns {object}
 */
export const getRunnerHealth = (options = {}) => {
  const available = isRunnerSandboxAvailable(options);
  const runtimeInfo = getRuntimeTransparencyInfo(options);
  const gvisorRequired = isGvisorRequired(options);

  // If production requires gVisor, sandbox readiness fails closed unless runtime is verified
  const isReady = available && (!gvisorRequired || runtimeInfo.verifiedRuntimeStatus === 'verified-gvisor-active');

  return {
    success: true,
    service: 'codeforge-runner',
    status: isReady ? 'ok' : 'degraded',
    sandboxAvailable: isReady,
    engine: available ? 'docker' : null,
    activeRuns: getActiveRuns(),
    maxConcurrentRuns: getMaxConcurrentRuns(),
    runtime: runtimeInfo.effectiveRuntime,
    configuredRuntime: runtimeInfo.configuredRuntime,
    engineRuntimes: runtimeInfo.engineRuntimes,
    gvisorConfigured: runtimeInfo.isGvisorConfigured,
    gvisorSupported: runtimeInfo.isGvisorSupportedByEngine,
    gvisorActive: runtimeInfo.gvisorActive,
    gvisorVerified: runtimeInfo.gvisorVerified,
    verifiedRuntimeStatus: runtimeInfo.verifiedRuntimeStatus,
    isolationTier: runtimeInfo.isolationTier,
    gvisorRequired
  };
};

let activeServerOptions = {};

/**
 * Health Probes (Public to internal network, zero sensitive disclosures)
 * GET /health
 * GET /api/runner/health
 */
const healthHandler = (req, res) => {
  return res.status(200).json(getRunnerHealth(activeServerOptions));
};

app.get('/health', healthHandler);
app.get('/api/runner/health', healthHandler);

/**
 * POST /api/runner/execute
 * Protected by authenticateRunnerRequest (timing-safe mutual authentication).
 * Accepts bounded execution jobs and executes them in isolated Docker containers.
 */
app.post('/api/runner/execute', authenticateRunnerRequest, async (req, res, next) => {
  try {
    const result = await executeInSandbox(req.body);

    if (result.status === 'SANDBOX_UNAVAILABLE' || result.status === 'GVISOR_RUNTIME_REQUIRED') {
      return res.status(503).json({
        success: false,
        sandboxAvailable: false,
        status: result.status,
        verdict: result.verdict,
        message: result.stderr,
        runtimeInfo: result.runtimeInfo || undefined
      });
    }

    if (result.status === 'CONCURRENCY_LIMIT_EXCEEDED') {
      return res.status(429).json({
        success: false,
        sandboxAvailable: true,
        status: result.status,
        verdict: result.verdict,
        message: result.stderr
      });
    }

    return res.status(200).json({
      success: true,
      sandboxAvailable: true,
      status: result.status,
      verdict: result.verdict,
      stdout: result.stdout,
      stderr: result.stderr,
      executionDuration: result.executionDuration
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code || 'VALIDATION_ERROR',
        message: error.message
      });
    }
    return next(error);
  }
});

// Centralized error middleware
app.use((err, req, res, _next) => {
  const statusCode = err.statusCode || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? 'Internal runner error.' : err.message
  });
});

let runnerServer = null;

export const startRunnerServer = (port = PORT, options = {}) => {
  activeServerOptions = options;
  return new Promise((resolve, reject) => {
    const host = options.host || process.env.RUNNER_HOST || DEFAULT_HOST;
    const runtimeInfo = getRuntimeTransparencyInfo(options);
    const gvisorRequired = isGvisorRequired(options);
    console.log(
      `[CodeForge Runner] Runtime Transparency: configured=${runtimeInfo.configuredRuntime}, status=${runtimeInfo.verifiedRuntimeStatus}, isolationTier=${runtimeInfo.isolationTier}`
    );
    if (gvisorRequired && runtimeInfo.verifiedRuntimeStatus !== 'verified-gvisor-active') {
      console.warn(
        `[CodeForge Runner] WARNING: Production requires verified gVisor (runsc) runtime, but status is '${runtimeInfo.verifiedRuntimeStatus}'. All execution requests will fail closed.`
      );
    }

    const certPath = options.certPath || process.env.RUNNER_TLS_CERT;
    const keyPath = options.keyPath || process.env.RUNNER_TLS_KEY;
    const caPath = options.caPath || process.env.RUNNER_TLS_CA;
    const mtlsEnabled = Boolean(options.mtls || (certPath && keyPath) || (options.cert && options.key));

    if (mtlsEnabled) {
      try {
        const tlsOptions = {
          cert: options.cert || (certPath ? fs.readFileSync(certPath) : undefined),
          key: options.key || (keyPath ? fs.readFileSync(keyPath) : undefined),
          ca: options.ca || (caPath ? fs.readFileSync(caPath) : undefined),
          requestCert: options.requestCert !== undefined ? options.requestCert : Boolean(caPath || options.ca),
          rejectUnauthorized: options.rejectUnauthorized !== undefined ? options.rejectUnauthorized : Boolean(caPath || options.ca)
        };
        runnerServer = https.createServer(tlsOptions, app);
        runnerServer.listen(port, host, () => {
          console.log(`[CodeForge Runner] Listening securely on ${host}:${port} (mTLS Enabled)`);
          resolve(runnerServer);
        });
        runnerServer.on('error', reject);
      } catch (err) {
        reject(err);
      }
    } else {
      runnerServer = app.listen(port, host, () => {
        console.log(`[CodeForge Runner] Listening on ${host}:${port} (Internal Network Only)`);
        resolve(runnerServer);
      });
      runnerServer.on('error', reject);
    }
  });
};

export const stopRunnerServer = () => {
  activeServerOptions = {};
  return new Promise((resolve) => {
    if (runnerServer) {
      runnerServer.close(() => {
        console.log('[CodeForge Runner] Server stopped.');
        resolve();
      });
    } else {
      resolve();
    }
  });
};

// Start automatically if executed directly as main module
if (process.argv[1] && process.argv[1].endsWith('runnerServer.js')) {
  startRunnerServer();
}

export default app;
