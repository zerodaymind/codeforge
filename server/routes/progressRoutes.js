import express from 'express';
import {
  getMyProgress,
  getProblemProgress,
  markProblemCompleted,
  unmarkProblemCompleted,
  recordQuizAttempt,
  completeProblemLegacy
} from '../controllers/progressController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// 1. GET /api/progress - Authenticated user's all problem progress
router.get('/', authenticateToken, getMyProgress);

// 2. POST /api/progress/quiz - Record quiz attempt (must be registered before /:problemId)
router.post('/quiz', authenticateToken, recordQuizAttempt);

// 3. Legacy compatibility: POST /api/progress/problems/:problemId/complete
router.post('/problems/:problemId/complete', authenticateToken, completeProblemLegacy);

// 4. GET /api/progress/:problemId - Authenticated single problem progress
router.get('/:problemId', authenticateToken, getProblemProgress);

// 5. PUT /api/progress/:problemId - Mark problem completed
router.put('/:problemId', authenticateToken, markProblemCompleted);

// 6. DELETE /api/progress/:problemId - Mark problem incomplete
router.delete('/:problemId', authenticateToken, unmarkProblemCompleted);

export default router;
