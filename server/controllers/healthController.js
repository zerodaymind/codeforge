import mongoose from 'mongoose';
import { isSandboxAvailable } from '../services/codeExecutionService.js';

const processStartTime = Date.now();

/**
 * Liveness Check (GET /api/health or GET /api/health/live)
 * Confirms that the Node.js application process is alive and responding.
 */
export const getLiveness = (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptimeSeconds: Math.floor((Date.now() - processStartTime) / 1000),
    timestamp: new Date().toISOString()
  });
};

/**
 * Readiness Check (GET /api/health/ready)
 * Verifies that required dependencies (e.g. MongoDB connection) are operational before receiving traffic.
 * Accurately reports Docker sandbox availability without confusing liveness with readiness.
 */
export const getReadiness = (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  const isDockerAvailable = isSandboxAvailable();

  const isReady = isDbConnected;

  const responsePayload = {
    status: isReady ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    checks: {
      database: isDbConnected ? 'connected' : 'disconnected',
      dockerSandbox: isDockerAvailable ? 'available' : 'unavailable'
    }
  };

  const statusCode = isReady ? 200 : 503;
  return res.status(statusCode).json(responsePayload);
};

// Default backwards-compatible handler for /api/health
export const getHealthStatus = (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;

  res.status(200).json({
    success: true,
    message: 'CodeForge API is running',
    database: isDbConnected ? 'connected' : 'disconnected'
  });
};
