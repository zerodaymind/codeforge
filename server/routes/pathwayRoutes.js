import express from 'express';
import {
  getPrerequisitePathway,
  getActiveBundle,
  generateNewBundle,
  getCompetencyTrends,
  recordSnapshot
} from '../controllers/pathwayController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// All pathway endpoints strictly require authenticated session
router.use(authenticateToken);

/**
 * GET /api/intelligence/pathways/prerequisites
 * Evaluates the validated prerequisite DAG, topological order, and readiness flags.
 */
router.get('/prerequisites', getPrerequisitePathway);

/**
 * GET /api/intelligence/pathways/practice-bundle (alias: /bundle)
 * Retrieves the learner's active targeted practice bundle with live completion flags.
 */
router.get('/practice-bundle', getActiveBundle);
router.get('/bundle', getActiveBundle);

/**
 * POST /api/intelligence/pathways/practice-bundle (alias: /bundle)
 * Assembles a fresh targeted practice bundle for a target topic or top gap.
 */
router.post('/practice-bundle', generateNewBundle);
router.post('/bundle', generateNewBundle);

/**
 * GET /api/intelligence/pathways/competency-trends (alias: /trends)
 * Evaluates longitudinal competency comparisons across 30, 60, or 90 days.
 */
router.get('/competency-trends', getCompetencyTrends);
router.get('/trends', getCompetencyTrends);

/**
 * POST /api/intelligence/pathways/competency-snapshot (alias: /snapshot)
 * Authoritatively captures an immutable dated competency snapshot.
 */
router.post('/competency-snapshot', recordSnapshot);
router.post('/snapshot', recordSnapshot);

export default router;
