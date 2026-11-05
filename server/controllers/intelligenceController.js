import { getLearnerIntelligence } from '../services/learningIntelligenceService.js';
import { generateLearningRecommendations } from '../services/recommendationEngine.js';
import { normalizeTopicName } from '../services/roadmapPlanner.js';
import logger from '../utils/logger.js';

/**
 * ==============================================================================
 * Learning Intelligence Controller (Milestone 16A)
 *
 * Exposes authenticated endpoints to query synthesized learner intelligence,
 * explainable topic states, and deterministic catalog-grounded recommendations.
 *
 * TENANT SECURITY:
 * Strictly scoped to req.user.id. Never trusts client-supplied IDs or payloads.
 * ==============================================================================
 */

/**
 * GET /api/intelligence/state
 * Retrieves the comprehensive topic-level intelligence state model for the authenticated learner.
 */
export const getLearnerState = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const intelligence = await getLearnerIntelligence(userId);

    return res.status(200).json({
      success: true,
      message: 'Learner intelligence state evaluated successfully.',
      data: intelligence
    });
  } catch (error) {
    logger.error('Error fetching learner intelligence state:', error);
    next(error);
  }
};

/**
 * GET /api/intelligence/recommendations
 * Retrieves prioritized next learning actions grounded in CodeForge catalog items.
 */
export const getRecommendations = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

    const intelligence = await getLearnerIntelligence(userId);
    const recommendationPlan = generateLearningRecommendations(intelligence, { limit });

    return res.status(200).json({
      success: true,
      message: 'Learning recommendations generated successfully.',
      data: recommendationPlan
    });
  } catch (error) {
    logger.error('Error generating learning recommendations:', error);
    next(error);
  }
};

/**
 * GET /api/intelligence/topic/:topicName
 * Retrieves detailed intelligence breakdown and raw evidence metrics for a single topic.
 */
export const getTopicIntelligence = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { topicName } = req.params;

    if (!topicName || typeof topicName !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'A valid topic name parameter is required.'
      });
    }

    const canonicalQuery = normalizeTopicName(topicName).toLowerCase();
    const intelligence = await getLearnerIntelligence(userId);

    const topicAnalysis = intelligence.topicStates.find(
      (t) => t.topic.toLowerCase() === canonicalQuery || t.topic.toLowerCase() === topicName.toLowerCase()
    );

    if (!topicAnalysis) {
      return res.status(404).json({
        success: false,
        message: `Topic '${topicName}' not found in learner intelligence model.`
      });
    }

    return res.status(200).json({
      success: true,
      message: `Intelligence evaluated for topic '${topicAnalysis.topic}'.`,
      data: {
        topic: topicAnalysis.topic,
        state: topicAnalysis.state,
        confidence: topicAnalysis.confidence,
        masteryScore: topicAnalysis.masteryScore,
        accuracyPercentage: topicAnalysis.accuracyPercentage,
        sampleSize: topicAnalysis.sampleSize,
        freshnessScore: topicAnalysis.freshnessScore,
        isGoalAligned: topicAnalysis.isGoalAligned,
        rationale: topicAnalysis.rationale,
        limitations: topicAnalysis.limitations,
        evidenceBreakdown: topicAnalysis.evidenceBreakdown
      }
    });
  } catch (error) {
    logger.error(`Error fetching intelligence for topic '${req.params?.topicName}':`, error);
    next(error);
  }
};
