import express from 'express';
import {
  getProblems,
  getProblemById,
  submitProblem,
  getMyProblemProgress
} from '../controllers/problemController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// 1. GET /api/problems - Public list of practice problems
router.get('/', getProblems);

// 2. GET /api/problems/progress/me - Authenticated user's problem progress
// IMPORTANT: Registered BEFORE /:id so "progress" is not captured as an :id parameter
router.get('/progress/me', authenticateToken, getMyProblemProgress);

// 3. GET /api/problems/:id - Public single problem details
router.get('/:id', getProblemById);

// 4. POST /api/problems/:id/submit - Authenticated code/answer submission
router.post('/:id/submit', authenticateToken, submitProblem);

export default router;
