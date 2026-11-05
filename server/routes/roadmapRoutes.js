import express from 'express';
import {
  getRoadmap,
  recalculateRoadmap,
  completeRoadmapRecommendation
} from '../controllers/roadmapController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Retrieve or lazily initialize the revision roadmap
router.get('/', authenticateToken, getRoadmap);

// Force re-evaluation of roadmap based on updated diagnostic or problem progress
router.post('/recalculate', authenticateToken, recalculateRoadmap);

// Complete or toggle completion of a specific recommendation item
router.patch('/recommendations/:id/complete', authenticateToken, completeRoadmapRecommendation);

export default router;
