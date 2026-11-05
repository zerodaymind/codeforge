import express from 'express';
import {
  startDiagnosticSession,
  getDiagnosticSession,
  submitDiagnosticSession,
  abandonDiagnosticSession,
  getLatestDiagnosticReport,
  getDiagnosticHistory
} from '../controllers/diagnosticController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Specific routes before parameter routes
router.post('/sessions', authenticateToken, startDiagnosticSession);
router.get('/sessions/latest', authenticateToken, getLatestDiagnosticReport);
router.get('/history', authenticateToken, getDiagnosticHistory);

// Parameterized session routes
router.get('/sessions/:id', authenticateToken, getDiagnosticSession);
router.post('/sessions/:id/submit', authenticateToken, submitDiagnosticSession);
router.post('/sessions/:id/abandon', authenticateToken, abandonDiagnosticSession);

export default router;
