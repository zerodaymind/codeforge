import express from 'express';
import {
  getOverview,
  getTopicAnalytics,
  getTrendAnalytics
} from '../controllers/analyticsController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// All analytics endpoints require authenticated user identity
router.get('/overview', authenticateToken, getOverview);
router.get('/topics', authenticateToken, getTopicAnalytics);
router.get('/trends', authenticateToken, getTrendAnalytics);

export default router;
