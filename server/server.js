import express from 'express';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import { getConfig } from './config/env.js';
import logger from './utils/logger.js';
import {
  configureHelmet,
  configureCors,
  apiRateLimiter,
  sanitizeMongoInput
} from './middleware/securityMiddleware.js';
import { correlationAndLoggingMiddleware } from './middleware/observabilityMiddleware.js';
import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import progressRoutes from './routes/progressRoutes.js';
import problemRoutes from './routes/problemRoutes.js';
import questionRoutes from './routes/questionRoutes.js';
import codeRoutes from './routes/codeRoutes.js';
import quizRoutes from './routes/quizRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import diagnosticRoutes from './routes/diagnosticRoutes.js';
import roadmapRoutes from './routes/roadmapRoutes.js';
import reinforcementRoutes from './routes/reinforcementRoutes.js';
import intelligenceRoutes from './routes/intelligenceRoutes.js';
import retentionRoutes from './routes/retentionRoutes.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

// Validate environment on boot; fails fast if required configuration is missing or insecure
const config = getConfig();

const app = express();

// 1. Trust proxy in production if behind reverse proxy / load balancer
if (config.isProduction) {
  app.set('trust proxy', 1);
}

// 2. HTTP Security Headers (Helmet with Monaco & Vite compatibility)
app.use(configureHelmet());

// 3. Dynamic CORS Allowlist
app.use(configureCors());

// 4. Request Correlation & Observability Logging
app.use(correlationAndLoggingMiddleware);

// 5. General API Rate Limiting (Applied to all API routes except health checks and sensitive auth endpoints)
app.use('/api', (req, res, next) => {
  // Health checks bypass rate limiting
  if (req.path.startsWith('/health')) {
    return next();
  }
  // Sensitive authentication endpoints have dedicated strict rate limiters (authLoginLimiter, authRegisterLimiter)
  if (req.path === '/auth/login' || req.path === '/auth/register') {
    return next();
  }
  return apiRateLimiter(req, res, next);
});

// 6. Request Body Size Limit & Parsing
app.use(express.json({ limit: config.requestBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: config.requestBodyLimit }));

// 7. NoSQL Query & Body Sanitization
app.use(sanitizeMongoInput);

// 8. Application Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', profileRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/problems', problemRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/code', codeRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/diagnostics', diagnosticRoutes);
app.use('/api/roadmap', roadmapRoutes);
app.use('/api/reinforcement', reinforcementRoutes);
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/retention', retentionRoutes);

// Root route for convenience
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    name: 'CodeForge API',
    environment: config.nodeEnv,
    health: '/api/health',
    readiness: '/api/health/ready'
  });
});

// 9. Unknown route handling & Centralized Error Middleware
app.use(notFound);
app.use(errorHandler);

let server = null;

// Graceful Shutdown Handler
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed.');

      try {
        await mongoose.connection.close(false);
        logger.info('MongoDB connection cleanly closed.');
        process.exit(0);
      } catch (err) {
        logger.error('Error closing MongoDB connection', { error: err.message });
        process.exit(1);
      }
    });

    // Force close if graceful shutdown exceeds 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout (10s).');
      process.exit(1);
    }, 10000).unref();
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server after successful database connection
export const startServer = async () => {
  try {
    await connectDB();
    server = app.listen(config.port, () => {
      logger.info(`CodeForge backend running in ${config.nodeEnv} mode at http://localhost:${config.port}`);
      logger.info(`Health check endpoints: http://localhost:${config.port}/api/health and /api/health/ready`);
    });
    return server;
  } catch (error) {
    logger.error(`Server failed to start: ${error.message}`);
    process.exit(1);
  }
};

startServer();

export default app;
