import Roadmap from '../models/Roadmap.js';
import User from '../models/User.js';
import DiagnosticSession from '../models/DiagnosticSession.js';
import ProblemProgress from '../models/ProblemProgress.js';
import Progress from '../models/Progress.js';
import QuizAttempt from '../models/QuizAttempt.js';
import { generateRoadmap } from '../services/roadmapPlanner.js';
import { getLatestDiagnosticComparison } from '../services/reassessmentService.js';
import logger from '../utils/logger.js';

/**
 * Formats a Roadmap document safely for client consumption.
 */
export function formatSafeRoadmap(roadmapDoc) {
  if (!roadmapDoc) return null;
  const doc = typeof roadmapDoc.toObject === 'function' ? roadmapDoc.toObject() : { ...roadmapDoc };

  return {
    id: doc._id ? doc._id.toString() : '',
    _id: doc._id ? doc._id.toString() : '',
    userId: doc.user ? doc.user.toString() : '',
    summary: doc.summary || '',
    activeGoals: doc.activeGoals || [],
    activeLanguages: doc.activeLanguages || [],
    diagnosticSessionId: doc.diagnosticSession ? doc.diagnosticSession.toString() : null,
    reassessmentComparison: doc.reassessmentComparison || null,
    lastCalculatedAt: doc.lastCalculatedAt,
    stats: {
      totalItems: doc.stats?.totalItems ?? (doc.recommendations?.length || 0),
      completedItems: doc.stats?.completedItems ?? (doc.recommendations?.filter((r) => r.isCompleted).length || 0),
      needsRevisionCount: doc.stats?.needsRevisionCount ?? 0,
      promisingCount: doc.stats?.promisingCount ?? 0,
      pendingCount: doc.stats?.pendingCount ?? 0
    },
    recommendations: (doc.recommendations || []).map((r) => ({
      id: r.id,
      topic: r.topic,
      subtopic: r.subtopic || '',
      state: r.state,
      actionType: r.actionType,
      priority: r.priority,
      title: r.title,
      reason: r.reason,
      sampleSize: r.sampleSize || 0,
      difficulty: r.difficulty || 'Medium',
      destinationUrl: r.destinationUrl,
      resourceTitle: r.resourceTitle,
      resourceType: r.resourceType,
      isCompleted: Boolean(r.isCompleted),
      completedAt: r.completedAt,
      evidenceSummary: r.evidenceSummary || {},
      reassessmentSummary: r.reassessmentSummary || null
    }))
  };
}

/**
 * Helper to gather all learner context and compute a fresh roadmap.
 */
async function computeRoadmapForUser(userId, previousRecommendations = []) {
  // 1. Fetch user profile
  const user = await User.findById(userId).lean();
  if (!user) return null;

  // 2. Fetch latest submitted diagnostic session (strictly excluding in_progress and abandoned)
  const latestDiagnostic = await DiagnosticSession.findOne({
    user: userId,
    status: 'submitted'
  })
    .sort({ submittedAt: -1, createdAt: -1 })
    .lean();

  // 3. Fetch completed problem slugs from ProblemProgress and legacy Progress
  const [problemProgressRecords, legacyProgress] = await Promise.all([
    ProblemProgress.find({
      user: userId,
      completed: true
    })
      .populate('problem', 'slug')
      .lean(),
    Progress.findOne({ user: userId }).lean()
  ]);

  const completedProblemSlugs = new Set();
  for (const prog of problemProgressRecords) {
    if (prog.problem && prog.problem.slug) {
      completedProblemSlugs.add(prog.problem.slug);
    }
  }
  if (legacyProgress && Array.isArray(legacyProgress.completedProblems)) {
    for (const cp of legacyProgress.completedProblems) {
      if (cp.problemId) {
        completedProblemSlugs.add(cp.problemId);
      }
    }
  }

  // 4. Fetch passed quizzes
  const passedQuizAttempts = await QuizAttempt.find({
    user: userId,
    status: { $in: ['submitted', 'completed'] },
    isPassed: true
  })
    .select('quizId')
    .lean();

  const passedQuizIds = new Set(passedQuizAttempts.map((q) => q.quizId));

  // 5. Fetch diagnostic comparison if user has reassessment evidence
  const reassessmentComparison = await getLatestDiagnosticComparison(userId);

  // 6. Run pure deterministic planner
  return generateRoadmap({
    user,
    latestDiagnostic,
    completedProblemSlugs,
    passedQuizIds,
    previousRecommendations,
    reassessmentComparison
  });
}

/**
 * GET /api/roadmap
 * Retrieves the authenticated user's current revision roadmap.
 * Lazily computes and persists a roadmap if none exists yet, or if a newer diagnostic session is present.
 */
export const getRoadmap = async (req, res, next) => {
  try {
    const userId = req.user.id;

    let roadmap = await Roadmap.findOne({ user: userId });

    // Check if a newer submitted diagnostic session exists since last calculation
    let shouldRecalculate = !roadmap;
    if (roadmap) {
      const newerSession = await DiagnosticSession.findOne({
        user: userId,
        status: 'submitted',
        submittedAt: { $gt: roadmap.lastCalculatedAt }
      });
      if (newerSession) {
        shouldRecalculate = true;
      }
    }

    if (shouldRecalculate) {
      const prevRecs = roadmap?.recommendations || [];
      const computed = await computeRoadmapForUser(userId, prevRecs);

      if (!computed) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      roadmap = await Roadmap.findOneAndUpdate(
        { user: userId },
        {
          $set: {
            ...computed,
            user: userId
          }
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Roadmap retrieved successfully.',
      data: formatSafeRoadmap(roadmap)
    });
  } catch (error) {
    logger.error('Error fetching roadmap:', error);
    next(error);
  }
};

/**
 * POST /api/roadmap/recalculate
 * Forces a re-evaluation of the roadmap based on latest diagnostic sessions,
 * problem solving records, and quiz attempts.
 * Preserves previously completed status of stable recommendations.
 */
export const recalculateRoadmap = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const existingRoadmap = await Roadmap.findOne({ user: userId });
    const prevRecs = existingRoadmap?.recommendations || [];

    const computed = await computeRoadmapForUser(userId, prevRecs);
    if (!computed) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const updatedRoadmap = await Roadmap.findOneAndUpdate(
      { user: userId },
      {
        $set: {
          ...computed,
          user: userId
        }
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Roadmap recalculated successfully.',
      data: formatSafeRoadmap(updatedRoadmap)
    });
  } catch (error) {
    logger.error('Error recalculating roadmap:', error);
    next(error);
  }
};

/**
 * PATCH /api/roadmap/recommendations/:id/complete
 * Updates the completion state of a specific roadmap recommendation item.
 */
export const completeRoadmapRecommendation = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { isCompleted = true } = req.body || {};

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ success: false, message: 'Recommendation identifier is required.' });
    }

    const roadmap = await Roadmap.findOne({ user: userId });
    if (!roadmap) {
      return res.status(404).json({ success: false, message: 'Roadmap not found.' });
    }

    const rec = roadmap.recommendations.find((r) => r.id === id);
    if (!rec) {
      return res.status(404).json({ success: false, message: `Recommendation '${id}' not found in roadmap.` });
    }

    // Update item completion status
    const targetStatus = Boolean(isCompleted);
    rec.isCompleted = targetStatus;
    rec.completedAt = targetStatus ? new Date() : null;

    // Recalculate stats
    roadmap.stats.completedItems = roadmap.recommendations.filter((r) => r.isCompleted).length;
    roadmap.stats.pendingCount = roadmap.recommendations.length - roadmap.stats.completedItems;

    await roadmap.save();

    return res.status(200).json({
      success: true,
      message: targetStatus ? 'Recommendation marked as completed.' : 'Recommendation marked as incomplete.',
      data: formatSafeRoadmap(roadmap)
    });
  } catch (error) {
    logger.error('Error updating roadmap recommendation:', error);
    next(error);
  }
};
