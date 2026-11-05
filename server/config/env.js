import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server/.env if present
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

/**
 * Validates and exposes production-hardened environment configuration.
 * Fails safely during server startup if required variables are missing or insecure.
 */
export const validateEnvironment = () => {
  const errors = [];

  const NODE_ENV = process.env.NODE_ENV || 'development';
  const isProduction = NODE_ENV === 'production';
  const isTest = NODE_ENV === 'test';

  // 1. Port validation
  const portRaw = process.env.PORT || '5000';
  const PORT = parseInt(portRaw, 10);
  if (isNaN(PORT) || PORT <= 0 || PORT > 65535) {
    errors.push(`Invalid PORT "${portRaw}". Must be a valid TCP port number between 1 and 65535.`);
  }

  // 2. MongoDB URI validation
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    errors.push('Missing required environment variable: MONGO_URI.');
  } else if (!MONGO_URI.startsWith('mongodb://') && !MONGO_URI.startsWith('mongodb+srv://')) {
    errors.push('Invalid MONGO_URI format. Must start with mongodb:// or mongodb+srv://');
  }

  // 3. JWT Secret validation
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    errors.push('Missing required environment variable: JWT_SECRET.');
  } else if (isProduction) {
    // In production, enforce minimum length and forbid trivial dev secrets
    if (JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters in production.');
    }
    const insecureDefaults = [
      'secret',
      'password',
      'development',
      'jwt_secret',
      'codeforge_jwt_secret',
      'changeme',
      '12345678'
    ];
    if (insecureDefaults.some((def) => JWT_SECRET.toLowerCase().includes(def))) {
      errors.push('Insecure JWT_SECRET detected in production. Must use a cryptographically strong random secret.');
    }
  }

  // 4. CORS Origins
  let CORS_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
  if (process.env.CORS_ORIGIN) {
    CORS_ORIGINS = process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
  }

  // 5. Runner Microservice Configuration (REM-P0-01 Isolated Execution Boundary)
  const RUNNER_SERVICE_URL =
    process.env.RUNNER_SERVICE_URL || (isProduction ? 'http://runner:5050' : 'http://127.0.0.1:5050');
  if (!RUNNER_SERVICE_URL.startsWith('http://') && !RUNNER_SERVICE_URL.startsWith('https://')) {
    errors.push('Invalid RUNNER_SERVICE_URL format. Must start with http:// or https://');
  }

  let RUNNER_SHARED_SECRET = process.env.RUNNER_SHARED_SECRET;
  if (!RUNNER_SHARED_SECRET) {
    if (isProduction) {
      errors.push('Missing required environment variable in production: RUNNER_SHARED_SECRET.');
    } else {
      RUNNER_SHARED_SECRET = 'dev-runner-secret-for-local-testing-only-32chars';
    }
  } else if (isProduction) {
    if (RUNNER_SHARED_SECRET.length < 32) {
      errors.push('RUNNER_SHARED_SECRET must be at least 32 characters in production.');
    }
    const insecureRunnerDefaults = [
      'secret',
      'password',
      'development',
      'changeme',
      'runner_secret',
      'cf_runner_sec',
      'dev-runner',
      'replace_with',
      'default',
      '1234',
      'admin',
      'codeforge'
    ];
    if (insecureRunnerDefaults.some((def) => RUNNER_SHARED_SECRET.toLowerCase().includes(def))) {
      errors.push(
        'Insecure RUNNER_SHARED_SECRET detected in production. Must use a cryptographically strong random secret.'
      );
    }
  }

  if (errors.length > 0) {
    const errorSummary = `[Configuration Error] Environment validation failed:\n  - ${errors.join('\n  - ')}`;
    console.error(errorSummary);
    throw new Error(errorSummary);
  }

  return {
    port: PORT,
    nodeEnv: NODE_ENV,
    isProduction,
    isTest,
    mongoUri: MONGO_URI,
    jwtSecret: JWT_SECRET,
    corsOrigins: CORS_ORIGINS,
    runnerServiceUrl: RUNNER_SERVICE_URL,
    runnerSharedSecret: RUNNER_SHARED_SECRET,
    requestBodyLimit: process.env.REQUEST_BODY_LIMIT || '100kb',
    maxConcurrentExecutions: parseInt(process.env.MAX_CONCURRENT_EXECUTIONS || '5', 10)
  };
};

// Singleton config instance
let config = null;
export const getConfig = () => {
  if (!config) {
    config = validateEnvironment();
  }
  return config;
};

export default getConfig;
