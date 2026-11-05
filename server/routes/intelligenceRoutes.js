import express from 'express';
import {
  getLearnerState,
  getRecommendations,
  getTopicIntelligence
} from '../controllers/intelligenceController.js';
import pathwayRoutes from './pathwayRoutes.js';
import retentionRoutes from './retentionRoutes.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// All intelligence endpoints strictly require valid JWT authentication
router.use(authenticateToken);

/**
 * GET /api/intelligence/state
 * Evaluates and returns the learner's synthesized topic-level intelligence model.
 */
router.get('/state', getLearnerState);

/**
 * GET /api/intelligence/recommendations
 * Generates prioritized next-action recommendations grounded in CodeForge's catalog.
 */
router.get('/recommendations', getRecommendations);

/**
 * GET /api/intelligence/topic/:topicName
 * Fetches granular evidence breakdown and metrics for a specific topic.
 */
router.get('/topic/:topicName', getTopicIntelligence);

// Adaptive practice pathways, prerequisite graphs, and competency tracking
router.use('/pathways', pathwayRoutes);

// Retention and durable learning
router.use('/retention', retentionRoutes);

export default router;
