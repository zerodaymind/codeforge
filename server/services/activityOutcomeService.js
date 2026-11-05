import ProblemAttempt from '../models/ProblemAttempt.js';
import Submission from '../models/Submission.js';
import QuizAttempt from '../models/QuizAttempt.js';
import DiagnosticSession from '../models/DiagnosticSession.js';
import { normalizeTopicName } from './roadmapPlanner.js';

/**
 * Authoritative Activity Outcome Service (Milestone 15D)
 *
 * Consolidates server-verified practice submissions, quiz attempts, and diagnostic assessments
 * into an authoritative, timeline-ordered activity history.
 *
 * CRITICAL INTEGRITY GUARANTEE:
 * Opening a resource, clicking a link, or manual task checking is NEVER treated as verified completion.
 * An activity is only marked 'isVerifiedCompletion: true' when authoritative server-side scoring or test
 * execution produced an accepted outcome or completed evaluation.
 */

/**
 * Retrieves unified, deduplicated activity history for an authenticated learner.
 *
 * @param {string} userId - Authenticated user ID
 * @param {Object} [options={}]
 * @param {string} [options.type='all'] - 'all' | 'practice' | 'quiz' | 'diagnostic'
 * @param {boolean} [options.verifiedOnly=false] - If true, returns only verified completions
 * @param {string} [options.topic='all'] - Filter by specific canonical topic
 * @param {number} [options.page=1]
 * @param {number} [options.limit=20]
 * @returns {Promise<Object>} Paginated activity timeline and metadata
 */
export async function getUserActivityHistory(userId, options = {}) {
  const {
    type = 'all',
    verifiedOnly = false,
    topic = 'all',
    page = 1,
    limit = 20
  } = options;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  // 1. Fetch practice problem submissions (code execution)
  const codeSubmissionsPromise = (type === 'all' || type === 'practice')
    ? Submission.find({ user: userId })
        .populate('problem', 'title slug topic difficulty')
        .sort({ createdAt: -1 })
        .limit(100)
        .lean()
    : Promise.resolve([]);

  // 2. Fetch direct problem attempts (answer submissions)
  const problemAttemptsPromise = (type === 'all' || type === 'practice')
    ? ProblemAttempt.find({ user: userId })
        .populate('problem', 'title slug topic difficulty')
        .sort({ createdAt: -1 })
        .limit(100)
        .lean()
    : Promise.resolve([]);

  // 3. Fetch completed quiz attempts
  const quizAttemptsPromise = (type === 'all' || type === 'quiz')
    ? QuizAttempt.find({ user: userId, status: { $in: ['submitted', 'completed'] } })
        .sort({ submittedAt: -1, createdAt: -1 })
        .limit(100)
        .lean()
    : Promise.resolve([]);

  // 4. Fetch submitted diagnostic sessions
  const diagnosticSessionsPromise = (type === 'all' || type === 'diagnostic')
    ? DiagnosticSession.find({ user: userId, status: 'submitted' })
        .sort({ submittedAt: -1, createdAt: -1 })
        .limit(50)
        .lean()
    : Promise.resolve([]);

  const [codeSubmissions, problemAttempts, quizAttempts, diagnosticSessions] = await Promise.all([
    codeSubmissionsPromise,
    problemAttemptsPromise,
    quizAttemptsPromise,
    diagnosticSessionsPromise
  ]);

  const activities = [];
  const seenProblemTimestamps = new Set();

  // Normalize Code Submissions
  for (const sub of codeSubmissions) {
    if (!sub.problem) continue;
    const isAccepted = sub.verdict === 'Accepted';
    const timeKey = `${sub.problem._id.toString()}_${Math.floor(new Date(sub.createdAt).getTime() / 2000)}`;
    seenProblemTimestamps.add(timeKey);

    activities.push({
      activityId: `code-${sub._id.toString()}`,
      activityType: 'practice_code',
      title: sub.problem.title,
      slug: sub.problem.slug,
      topic: normalizeTopicName(sub.problem.topic),
      difficulty: sub.problem.difficulty || 'Medium',
      language: sub.language || 'javascript',
      outcome: isAccepted ? 'accepted' : 'rejected',
      verdict: sub.verdict,
      isVerifiedCompletion: isAccepted,
      passedTests: sub.passedTests || 0,
      totalTests: sub.totalTests || 0,
      executionDuration: sub.executionDuration || 0,
      timestamp: sub.createdAt,
      actionUrl: `/practice/${sub.problem.slug}`
    });
  }

  // Normalize Problem Attempts (deduplicating if code submission occurred at same time)
  for (const att of problemAttempts) {
    if (!att.problem) continue;
    const timeKey = `${att.problem._id.toString()}_${Math.floor(new Date(att.createdAt).getTime() / 2000)}`;
    if (seenProblemTimestamps.has(timeKey)) continue;

    const isAccepted = att.status === 'Accepted';
    activities.push({
      activityId: `prob-${att._id.toString()}`,
      activityType: 'practice_answer',
      title: att.problem.title,
      slug: att.problem.slug,
      topic: normalizeTopicName(att.problem.topic),
      difficulty: att.problem.difficulty || 'Medium',
      outcome: isAccepted ? 'accepted' : 'rejected',
      verdict: att.status,
      isVerifiedCompletion: isAccepted,
      executionDuration: att.executionTime || 0,
      timestamp: att.createdAt,
      actionUrl: `/practice/${att.problem.slug}`
    });
  }

  // Normalize Quiz Attempts
  for (const qa of quizAttempts) {
    const isPassed = Boolean(qa.isPassed);
    activities.push({
      activityId: `quiz-${qa._id.toString()}`,
      activityType: 'quiz',
      title: qa.quizTitle || 'Assessment Quiz',
      quizId: qa.quizId,
      topic: normalizeTopicName(qa.topic),
      difficulty: qa.difficulty || 'Medium',
      outcome: 'scored',
      isVerifiedCompletion: true,
      score: qa.score || 0,
      maxScore: qa.maxScore || 0,
      percentage: qa.percentage || 0,
      isPassed,
      timestamp: qa.submittedAt || qa.createdAt,
      actionUrl: qa.quizId ? `/quiz?quizId=${qa.quizId}` : '/quiz'
    });
  }

  // Normalize Diagnostic Sessions
  for (const ds of diagnosticSessions) {
    activities.push({
      activityId: `diag-${ds._id.toString()}`,
      activityType: 'diagnostic',
      title: 'Diagnostic Assessment',
      topic: ds.assessedTopics?.[0] || 'Multi-Topic',
      difficulty: 'Adaptive',
      outcome: 'scored',
      isVerifiedCompletion: true,
      score: ds.score || 0,
      maxScore: ds.maxScore || 0,
      percentage: ds.percentage || 0,
      assessedTopics: ds.assessedTopics || [],
      durationSeconds: ds.durationSeconds || 0,
      timestamp: ds.submittedAt || ds.createdAt,
      actionUrl: `/diagnostic/report/${ds._id.toString()}`
    });
  }

  // Sort unified activities reverse-chronologically
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Apply filters
  let filtered = activities;

  if (verifiedOnly) {
    filtered = filtered.filter((a) => a.isVerifiedCompletion);
  }

  if (topic && topic !== 'all') {
    const canonicalTarget = normalizeTopicName(topic).toLowerCase();
    filtered = filtered.filter((a) => (a.topic || '').toLowerCase() === canonicalTarget);
  }

  const total = filtered.length;
  const totalPages = Math.ceil(total / limitNum) || 1;
  const skip = (pageNum - 1) * limitNum;
  const paginatedActivities = filtered.slice(skip, skip + limitNum);

  return {
    activities: paginatedActivities,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages,
      hasMore: pageNum < totalPages
    }
  };
}

/**
 * Computes high-level verified outcome counts for an authenticated learner.
 *
 * @param {string} userId - Authenticated user ID
 * @returns {Promise<Object>} Aggregated summary metrics
 */
export async function getUserActivitySummary(userId) {
  const [historyResult, codeAccepts, problemAccepts, passedQuizzes, submittedDiagnostics] = await Promise.all([
    getUserActivityHistory(userId, { limit: 5 }),
    Submission.countDocuments({ user: userId, verdict: 'Accepted' }),
    ProblemAttempt.countDocuments({ user: userId, status: 'Accepted' }),
    QuizAttempt.countDocuments({ user: userId, status: { $in: ['submitted', 'completed'] }, isPassed: true }),
    DiagnosticSession.countDocuments({ user: userId, status: 'submitted' })
  ]);

  const totalProblemsSolved = Math.max(codeAccepts, problemAccepts);
  const totalVerifiedActivities = totalProblemsSolved + passedQuizzes + submittedDiagnostics;

  return {
    totalProblemsSolved,
    totalQuizzesPassed: passedQuizzes,
    totalDiagnosticsCompleted: submittedDiagnostics,
    totalVerifiedActivities,
    recentActivities: historyResult.activities || []
  };
}
