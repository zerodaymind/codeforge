import express from 'express';
import {
  getSandboxStatus,
  runCode,
  submitCode,
  getSubmissions
} from '../controllers/codeController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { codeExecutionRateLimiter } from '../middleware/securityMiddleware.js';

const router = express.Router();

// 1. GET /api/code/status - Public sandbox status & setup guide
router.get('/status', getSandboxStatus);

// 2. POST /api/code/run - Run code (rate limited to prevent container exhaustion)
router.post('/run', codeExecutionRateLimiter, runCode);

// 3. POST /api/code/submit - Submit code against test cases (requires JWT, rate limited)
router.post('/submit', authenticateToken, codeExecutionRateLimiter, submitCode);

// 4. GET /api/code/submissions - Get authenticated user's submission history (requires JWT)
router.get('/submissions', authenticateToken, getSubmissions);

export default router;
