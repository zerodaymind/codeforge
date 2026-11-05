import mongoose from 'mongoose';
import {
  getLatestDiagnosticComparison,
  getDiagnosticSessionComparison
} from '../services/reassessmentService.js';
import {
  getUserActivityHistory,
  getUserActivitySummary
} from '../services/activityOutcomeService.js';
import logger from '../utils/logger.js';

/**
 * GET /api/reinforcement/comparison
 * Retrieves the comparison between the user's latest two submitted diagnostic assessments.
 */
export const getLatestComparison = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const comparison = await getLatestDiagnosticComparison(userId);

    return res.status(200).json({
      success: true,
      message: 'Latest diagnostic comparison retrieved.',
      data: comparison
    });
  } catch (error) {
    logger.error('Error fetching latest diagnostic comparison:', error);
    next(error);
  }
};

/**
 * GET /api/reinforcement/comparison/:sessionId
 * Retrieves comparison for a specific diagnostic session against its immediate predecessor.
 */
export const getSessionComparison = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid diagnostic session ID is required.'
      });
    }

    const comparison = await getDiagnosticSessionComparison(userId, sessionId);
    if (!comparison) {
      return res.status(404).json({
        success: false,
        message: 'Diagnostic session not found.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Diagnostic session comparison retrieved.',
      data: comparison
    });
  } catch (error) {
    logger.error(`Error fetching comparison for session ${req.params?.sessionId}:`, error);
    next(error);
  }
};

/**
 * GET /api/reinforcement/history
 * Retrieves authoritative, paginated activity history with optional filters.
 */
export const getActivityHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { type, verifiedOnly, topic, page, limit } = req.query;

    const history = await getUserActivityHistory(userId, {
      type: typeof type === 'string' ? type.trim().toLowerCase() : 'all',
      verifiedOnly: verifiedOnly === 'true' || verifiedOnly === true,
      topic: typeof topic === 'string' ? topic.trim() : 'all',
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20
    });

    return res.status(200).json({
      success: true,
      message: 'Activity history retrieved.',
      data: history
    });
  } catch (error) {
    logger.error('Error fetching activity history:', error);
    next(error);
  }
};

/**
 * GET /api/reinforcement/summary
 * Retrieves high-level verified outcome counts and latest reinforcement indicators.
 */
export const getActivitySummary = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const summary = await getUserActivitySummary(userId);

    return res.status(200).json({
      success: true,
      message: 'Activity summary retrieved.',
      data: summary
    });
  } catch (error) {
    logger.error('Error fetching activity summary:', error);
    next(error);
  }
};
