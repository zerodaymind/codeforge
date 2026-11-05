import {
  PREREQUISITE_GRAPH,
  validateGraph,
  getTopologicalOrder,
  evaluatePrerequisiteReadiness
} from '../services/prerequisiteGraph.js';
import {
  getOrCreatePracticeBundle
} from '../services/practiceBundleService.js';
import {
  recordCompetencySnapshot,
  getCompetencyTrend
} from '../services/competencyTrackingService.js';
import { getLearnerIntelligence } from '../services/learningIntelligenceService.js';
import logger from '../utils/logger.js';

/**
 * ==============================================================================
 * Adaptive Practice & Pathway Controller (Milestone 16B)
 *
 * Exposes endpoints for:
 * 1. Prerequisite Knowledge Graph & Readiness evaluations
 * 2. Targeted Practice Bundle assembly and live completion status
 * 3. Longitudinal Competency Snapshots & 30/60/90-day trend analytics
 * ==============================================================================
 */

/**
 * GET /api/intelligence/pathways/prerequisites
 * Retrieves the validated prerequisite knowledge graph, topological learning order,
 * and readiness evaluations for the authenticated learner.
 */
export const getPrerequisitePathway = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const validation = validateGraph(PREREQUISITE_GRAPH);
    if (!validation.valid) {
      return res.status(500).json({
        success: false,
        message: `Graph validation failed: ${validation.error}`
      });
    }

    const topologicalOrder = getTopologicalOrder(PREREQUISITE_GRAPH);
    const intelligence = await getLearnerIntelligence(userId);

    // Evaluate readiness for each node in topological order
    const readinessMap = {};
    for (const topic of topologicalOrder) {
      readinessMap[topic] = evaluatePrerequisiteReadiness(
        topic,
        intelligence.topicStates,
        PREREQUISITE_GRAPH
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Prerequisite pathway evaluated successfully.',
      data: {
        graph: PREREQUISITE_GRAPH,
        topologicalOrder,
        readinessMap
      }
    });
  } catch (error) {
    logger.error('Error fetching prerequisite pathway:', error);
    next(error);
  }
};

/**
 * GET /api/intelligence/pathways/practice-bundle
 * Retrieves the active targeted practice bundle with live completion status.
 */
export const getActiveBundle = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { topic } = req.query;

    const result = await getOrCreatePracticeBundle(userId, {
      topic: typeof topic === 'string' ? topic.trim() : undefined,
      forceNew: false
    });

    return res.status(200).json({
      success: result.success,
      hasBundle: result.hasBundle,
      message: result.hasBundle ? 'Active practice bundle retrieved.' : result.message,
      data: result.hasBundle ? result.bundle : null,
      reason: result.reason || null
    });
  } catch (error) {
    logger.error('Error fetching active practice bundle:', error);
    next(error);
  }
};

/**
 * POST /api/intelligence/pathways/practice-bundle
 * Assembles a fresh targeted practice bundle for a target topic or top gap.
 */
export const generateNewBundle = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { topic } = req.body || {};

    const result = await getOrCreatePracticeBundle(userId, {
      topic: typeof topic === 'string' ? topic.trim() : undefined,
      forceNew: true
    });

    return res.status(result.hasBundle ? 201 : 200).json({
      success: result.success,
      hasBundle: result.hasBundle,
      message: result.hasBundle ? 'New targeted practice bundle assembled.' : result.message,
      data: result.hasBundle ? result.bundle : null,
      reason: result.reason || null
    });
  } catch (error) {
    logger.error('Error generating practice bundle:', error);
    next(error);
  }
};

/**
 * GET /api/intelligence/pathways/competency-trends
 * Retrieves longitudinal competency trends across 30, 60, or 90 days.
 */
export const getCompetencyTrends = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const windowDays = parseInt(req.query.windowDays, 10) || 30;

    const trendReport = await getCompetencyTrend(userId, { windowDays });

    return res.status(200).json({
      success: true,
      message: 'Longitudinal competency trends evaluated successfully.',
      data: trendReport
    });
  } catch (error) {
    logger.error('Error fetching competency trends:', error);
    next(error);
  }
};

/**
 * POST /api/intelligence/pathways/competency-snapshot
 * Authoritatively records a dated competency snapshot (rate-limited).
 */
export const recordSnapshot = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { force = false } = req.body || {};

    const result = await recordCompetencySnapshot(
      userId,
      'manual_checkpoint',
      new Date(),
      force === true
    );

    return res.status(201).json({
      success: true,
      message: 'Competency snapshot recorded successfully.',
      isNew: true,
      data: result.snapshot || result
    });
  } catch (error) {
    if (error.status === 429) {
      return res.status(429).json({
        success: false,
        message: error.message,
        isNew: false,
        data: error.snapshot || null
      });
    }
    logger.error('Error recording competency snapshot:', error);
    next(error);
  }
};
