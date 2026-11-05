import express from 'express';
import {
  getLatestComparison,
  getSessionComparison,
  getActivityHistory,
  getActivitySummary
} from '../controllers/reinforcementController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get latest diagnostic comparison (two most recent submitted sessions)
router.get('/comparison', authenticateToken, getLatestComparison);

// Get diagnostic comparison for a specific session against its predecessor
router.get('/comparison/:sessionId', authenticateToken, getSessionComparison);

// Get authoritative, paginated activity history with filters
router.get('/history', authenticateToken, getActivityHistory);

// Get high-level reinforcement summary metrics
router.get('/summary', authenticateToken, getActivitySummary);

export default router;
