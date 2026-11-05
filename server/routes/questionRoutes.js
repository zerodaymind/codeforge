import express from 'express';
import { getQuestions, submitQuiz } from '../controllers/questionController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /api/questions - Public endpoint returning questions stripped of answers and explanations
router.get('/', getQuestions);

// POST /api/questions/submit - Authenticated endpoint evaluating answers and returning verified score review
router.post('/submit', authenticateToken, submitQuiz);

export default router;
