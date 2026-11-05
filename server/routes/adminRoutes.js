import express from 'express';
import {
  getAdminQuestions,
  createAdminQuestion,
  getAdminQuestionById,
  updateAdminQuestion,
  archiveAdminQuestion,
  restoreAdminQuestion,
  getAdminQuizzes,
  createAdminQuiz,
  getAdminQuizById,
  updateAdminQuiz,
  publishAdminQuiz,
  unpublishAdminQuiz,
  archiveAdminQuiz,
  getAdminOverview,
  getAdminAuditLogs
} from '../controllers/adminController.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// All admin routes strictly enforce authenticated session and database-verified admin role
router.use(authenticateToken, requireAdmin);

// Dashboard Overview & Audit Logs
router.get('/overview', getAdminOverview);
router.get('/audit-logs', getAdminAuditLogs);

// Question Bank Management
router.get('/questions', getAdminQuestions);
router.post('/questions', createAdminQuestion);
router.get('/questions/:id', getAdminQuestionById);
router.put('/questions/:id', updateAdminQuestion);
router.patch('/questions/:id/archive', archiveAdminQuestion);
router.patch('/questions/:id/restore', restoreAdminQuestion);

// Quiz Builder & Management
router.get('/quizzes', getAdminQuizzes);
router.post('/quizzes', createAdminQuiz);
router.get('/quizzes/:id', getAdminQuizById);
router.put('/quizzes/:id', updateAdminQuiz);
router.post('/quizzes/:id/publish', publishAdminQuiz);
router.post('/quizzes/:id/unpublish', unpublishAdminQuiz);
router.patch('/quizzes/:id/archive', archiveAdminQuiz);

export default router;
