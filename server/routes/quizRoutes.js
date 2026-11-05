import express from 'express';
import {
  getQuizzes,
  getQuizById,
  createAttempt,
  getAttemptHistory,
  getAttemptById,
  submitAttempt
} from '../controllers/quizController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// 1. Attempts management routes (placed before /:id parameter to avoid route parameter collision)
router.get('/attempts', authenticateToken, getAttemptHistory);
router.get('/attempts/:attemptId', authenticateToken, getAttemptById);
router.post('/attempts/:attemptId/submit', authenticateToken, submitAttempt);

// 2. Catalog routes
router.get('/', getQuizzes);
router.get('/:id', getQuizById);
router.post('/:id/attempts', authenticateToken, createAttempt);

export default router;
