import express from 'express';
import {
  getEligibleTopics,
  startSession,
  getSession,
  submitSession,
  abandonSession,
  getHistory,
  dismissTopic
} from '../controllers/retentionController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// All retention endpoints require authenticated session
router.use(authenticateToken);

/**
 * GET /api/intelligence/retention/eligible (alias: /api/retention/eligible)
 * Evaluates learner evidence freshness and returns retention review candidates.
 */
router.get('/eligible', getEligibleTopics);

/**
 * POST /api/intelligence/retention/session (alias: /api/retention/session)
 * Starts a new retention assessment session or resumes an in-progress one.
 */
router.post('/session', startSession);

/**
 * GET /api/intelligence/retention/session/:sessionId (alias: /api/retention/session/:sessionId)
 * Fetches an existing retention assessment session.
 */
router.get('/session/:sessionId', getSession);

/**
 * POST /api/intelligence/retention/session/:sessionId/submit (alias: /api/retention/session/:sessionId/submit)
 * Authoritatively scores session, compares against historical baseline, and classifies outcome.
 */
router.post('/session/:sessionId/submit', submitSession);

/**
 * POST /api/intelligence/retention/session/:sessionId/abandon (alias: /api/retention/session/:sessionId/abandon)
 * Abandons an in-progress retention session.
 */
router.post('/session/:sessionId/abandon', abandonSession);

/**
 * GET /api/intelligence/retention/history (alias: /api/retention/history)
 * Lists completed retention assessments for the user with longitudinal comparisons.
 */
router.get('/history', getHistory);

/**
 * POST /api/intelligence/retention/dismiss (alias: /api/retention/dismiss)
 * Dismisses retention prompt for a specific topic for 48 hours.
 */
router.post('/dismiss', dismissTopic);

export default router;
