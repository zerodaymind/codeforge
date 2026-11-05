import {
  getRetentionReviewSchedule,
  dismissRetentionTopic
} from '../services/retentionReviewService.js';
import {
  startOrCreateRetentionSession,
  getRetentionSessionById,
  submitRetentionSession,
  abandonRetentionSession,
  getRetentionHistory
} from '../services/retentionSessionService.js';
import logger from '../utils/logger.js';

/**
 * ==============================================================================
 * Retention & Durable Learning Controller (Milestone 16C)
 *
 * Exposes endpoints for:
 * 1. Retention review schedule & eligibility calculation
 * 2. Starting, resuming, and submitting targeted retention assessments
 * 3. Review dismissals with 48h cool-off
 * 4. Assessment history & longitudinal outcome analytics
 * ==============================================================================
 */

/**
 * GET /api/intelligence/retention/eligible (alias: /api/retention/eligible)
 * Evaluates the learner's evidence freshness and identifies topics eligible for review.
 */
export const getEligibleTopics = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await getRetentionReviewSchedule(userId);

    return res.status(200).json({
      success: true,
      message: 'Retention review schedule retrieved successfully.',
      data: result.schedule,
      totalEligible: result.totalEligible,
      dismissedTopics: result.dismissedTopics
    });
  } catch (error) {
    logger.error('Error fetching retention review schedule:', error);
    next(error);
  }
};

/**
 * POST /api/intelligence/retention/session (alias: /api/retention/session)
 * Starts a fresh retention assessment session or resumes an existing active one.
 */
export const startSession = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { topic, forceNew } = req.body || {};

    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A valid target topic is required to initiate a retention assessment.'
      });
    }

    const result = await startOrCreateRetentionSession(userId, {
      topic: topic.trim(),
      forceNew: Boolean(forceNew)
    });

    const isResumed = Boolean(result.isResumed);
    return res.status(isResumed ? 200 : 201).json({
      success: true,
      message: isResumed
        ? 'Active retention session resumed.'
        : 'Fresh retention assessment session created.',
      isResumed,
      data: result.session
    });
  } catch (error) {
    logger.error('Error starting retention session:', error);
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
};

/**
 * GET /api/intelligence/retention/session/:sessionId (alias: /api/retention/session/:sessionId)
 * Fetches an existing retention session by ID or MongoDB ObjectID.
 */
export const getSession = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    const session = await getRetentionSessionById(userId, sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: `Retention session '${sessionId}' was not found.`
      });
    }

    return res.status(200).json({
      success: true,
      data: session
    });
  } catch (error) {
    logger.error('Error fetching retention session:', error);
    next(error);
  }
};

/**
 * POST /api/intelligence/retention/session/:sessionId/submit (alias: /api/retention/session/:sessionId/submit)
 * Scores learner answers, updates baseline comparison, classifies retention outcome, and suggests next steps.
 */
export const submitSession = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;
    const { answers } = req.body || {};

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        message: 'Answers array is required to submit a retention assessment.'
      });
    }

    const completedSession = await submitRetentionSession(userId, sessionId, answers);

    return res.status(200).json({
      success: true,
      message: 'Retention assessment evaluated successfully.',
      data: completedSession
    });
  } catch (error) {
    logger.error('Error submitting retention session:', error);
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
};

/**
 * POST /api/intelligence/retention/session/:sessionId/abandon (alias: /api/retention/session/:sessionId/abandon)
 * Abandons an in-progress retention session.
 */
export const abandonSession = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    const session = await abandonRetentionSession(userId, sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: `Active retention session '${sessionId}' not found or already completed.`
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Retention session successfully abandoned.',
      data: session
    });
  } catch (error) {
    logger.error('Error abandoning retention session:', error);
    next(error);
  }
};

/**
 * GET /api/intelligence/retention/history (alias: /api/retention/history)
 * Fetches completed retention assessment history for the learner.
 */
export const getHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { topic, page, limit } = req.query;

    const result = await getRetentionHistory(userId, { topic, page, limit });

    return res.status(200).json({
      success: true,
      message: 'Retention history retrieved.',
      data: result.sessions,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('Error fetching retention history:', error);
    next(error);
  }
};

/**
 * POST /api/intelligence/retention/dismiss (alias: /api/retention/dismiss)
 * Dismisses retention prompt for a specific topic for 48 hours.
 */
export const dismissTopic = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { topic } = req.body || {};

    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Topic name is required to dismiss a retention check.'
      });
    }

    const expiresAt = dismissRetentionTopic(userId, topic.trim());

    return res.status(200).json({
      success: true,
      message: `Topic '${topic.trim()}' review dismissed for 48 hours.`,
      data: {
        topic: topic.trim(),
        dismissedUntil: expiresAt
      }
    });
  } catch (error) {
    logger.error('Error dismissing retention topic:', error);
    next(error);
  }
};
