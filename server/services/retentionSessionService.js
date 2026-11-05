import crypto from 'crypto';
import mongoose from 'mongoose';
import Question from '../models/Question.js';
import DiagnosticSession from '../models/DiagnosticSession.js';
import RetentionSession from '../models/RetentionSession.js';
import { getLearnerIntelligence } from './learningIntelligenceService.js';
import { recordCompetencySnapshot } from './competencyTrackingService.js';
import { normalizeTopicName, slugify } from './roadmapPlanner.js';

/**
 * ==============================================================================
 * Retention Assessment Session Service (Milestone 16C)
 *
 * Manages authentic retention check-in sessions, unseen question prioritization,
 * repeat-exposure tracking, server-side scoring, and longitudinal outcome classification.
 * ==============================================================================
 */

export const RETENTION_OUTCOME = {
  RETAINED: 'retained_on_reassessment',
  IMPROVED: 'improved_on_reassessment',
  POSSIBLE_DECLINE: 'possible_decline_on_reassessment',
  INSUFFICIENT_EVIDENCE: 'insufficient_evidence',
  FIRST_ASSESSMENT: 'first_retention_assessment',
  NOT_COMPARABLE: 'not_comparable'
};

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Serializes a RetentionSession for client response.
 * Strictly conceals answers and explanations while status is 'in_progress'.
 */
export function formatSafeRetentionSession(session) {
  if (!session) return null;
  const doc = typeof session.toObject === 'function' ? session.toObject() : { ...session };
  const isInProgress = doc.status === 'in_progress';

  const safeQuestions = (doc.questions || []).map((q) => ({
    questionId: q.questionId,
    topic: q.topic,
    subtopic: q.subtopic,
    question: q.question,
    codeSnippet: q.codeSnippet || '',
    options: q.options,
    difficulty: q.difficulty,
    points: q.points || 1,
    isRepeated: q.isRepeated || false,
    timesSeen: q.timesSeen || 0,
    ...(isInProgress
      ? {}
      : {
          answer: q.answer,
          correctAnswer: q.answer,
          explanation: q.explanation
        })
  }));

  return {
    id: doc._id.toString(),
    _id: doc._id.toString(),
    sessionId: doc.sessionId,
    userId: doc.user ? doc.user.toString() : '',
    targetTopic: doc.targetTopic,
    status: doc.status,
    questions: safeQuestions,
    totalQuestions: safeQuestions.length,
    historicalBaseline: doc.historicalBaseline || {},
    startedAt: doc.startedAt,
    submittedAt: doc.submittedAt,
    durationSeconds: doc.durationSeconds || 0,
    ...(!isInProgress && doc.outcome
      ? {
          outcome: doc.outcome,
          selectedAnswers: doc.selectedAnswers || []
        }
      : {})
  };
}

/**
 * Starts a fresh retention assessment session or resumes an in-progress one.
 *
 * @param {string} userId - Authenticated user ID
 * @param {Object} [options={}]
 * @param {string} [options.topic] - Target topic
 * @param {boolean} [options.forceNew=false]
 * @returns {Promise<Object>} Formatted session
 */
export async function startOrCreateRetentionSession(userId, options = {}) {
  const { topic: rawTopic, forceNew = false } = options;

  if (!rawTopic) {
    const err = new Error('Target topic is required to initiate a retention assessment.');
    err.status = 400;
    throw err;
  }

  const targetTopic = normalizeTopicName(rawTopic);

  // 1. Resume active session if not forcing new
  if (!forceNew) {
    const existing = await RetentionSession.findOne({
      user: userId,
      targetTopic,
      status: 'in_progress'
    }).sort({ createdAt: -1 });

    if (existing) {
      return {
        isResumed: true,
        session: formatSafeRetentionSession(existing)
      };
    }
  } else {
    // Abandon any prior in-progress session for this topic
    await RetentionSession.updateMany(
      { user: userId, targetTopic, status: 'in_progress' },
      { $set: { status: 'abandoned' } }
    );
  }

  // 2. Fetch Learner Historical Baseline for this topic
  const intelligence = await getLearnerIntelligence(userId);
  const topicState = intelligence.topicStates.find(
    (ts) => normalizeTopicName(ts.topic) === targetTopic
  );

  const baselineScore = topicState?.masteryScore ?? null;
  const baselineSampleSize = topicState?.sampleSize ?? 0;
  const baselineDifficulty = topicState?.evidenceBreakdown?.practice?.solvedDifficulty || {};

  const historicalBaseline = {
    baselineScore,
    baselineDate: new Date(),
    baselineSampleSize,
    baselineModality: 'diagnostic',
    baselineDifficulty,
    source: baselineSampleSize >= 2 ? 'intelligence_synthesis' : 'none'
  };

  // 3. Query Previous Question Exposure across Diagnostics & Retention Sessions
  const [priorDiagnostics, priorRetention] = await Promise.all([
    DiagnosticSession.find({ user: userId })
      .select('questions submittedAt createdAt')
      .lean(),
    RetentionSession.find({ user: userId })
      .select('questions submittedAt createdAt')
      .lean()
  ]);

  const seenQuestionsMap = new Map();

  function trackSeenQuestion(qId, date) {
    const prev = seenQuestionsMap.get(qId) || { timesSeen: 0, lastSeenAt: null };
    const qDate = date ? new Date(date) : new Date();
    seenQuestionsMap.set(qId, {
      timesSeen: prev.timesSeen + 1,
      lastSeenAt: !prev.lastSeenAt || qDate > prev.lastSeenAt ? qDate : prev.lastSeenAt
    });
  }

  for (const ds of priorDiagnostics) {
    const date = ds.submittedAt || ds.createdAt;
    for (const q of ds.questions || []) {
      trackSeenQuestion(q.questionId, date);
    }
  }

  for (const rs of priorRetention) {
    const date = rs.submittedAt || rs.createdAt;
    for (const q of rs.questions || []) {
      trackSeenQuestion(q.questionId, date);
    }
  }

  // 4. Query Available Active Questions from Question Bank
  const regex = new RegExp(`^${escapeRegex(targetTopic)}$`, 'i');
  const candidateQuestions = await Question.find({
    status: 'active',
    $or: [{ topic: regex }, { tags: regex }]
  }).lean();

  if (candidateQuestions.length === 0) {
    const err = new Error(`No active assessment questions available in the catalog for '${targetTopic}'.`);
    err.status = 404;
    throw err;
  }

  // Partition candidates into unseen and seen questions
  const unseenQuestions = [];
  const seenQuestions = [];

  for (const q of candidateQuestions) {
    if (seenQuestionsMap.has(q.id)) {
      seenQuestions.push({
        ...q,
        exposure: seenQuestionsMap.get(q.id)
      });
    } else {
      unseenQuestions.push(q);
    }
  }

  // Sort seen questions: oldest seen first (to minimize recent recall bias)
  seenQuestions.sort((a, b) => a.exposure.lastSeenAt.getTime() - b.exposure.lastSeenAt.getTime());

  // Prioritize unseen questions, take up to 3 total
  const selected = [];
  for (const u of unseenQuestions) {
    if (selected.length >= 3) break;
    selected.push({
      ...u,
      isRepeated: false,
      timesSeen: 0,
      lastSeenAt: null
    });
  }

  if (selected.length < 3) {
    for (const s of seenQuestions) {
      if (selected.length >= 3) break;
      selected.push({
        ...s,
        isRepeated: true,
        timesSeen: s.exposure.timesSeen,
        lastSeenAt: s.exposure.lastSeenAt
      });
    }
  }

  // Map to question snapshot sub-schemas
  const questionsToPersist = selected.map((q) => ({
    questionId: q.id,
    topic: targetTopic,
    subtopic: q.tags?.[0] || q.topic,
    question: q.question,
    codeSnippet: q.codeSnippet || '',
    options: q.options,
    difficulty: q.difficulty || 'Medium',
    points: q.points || 1,
    answer: q.answer,
    explanation: q.explanation,
    isRepeated: q.isRepeated || false,
    timesSeen: q.timesSeen || 0,
    lastSeenAt: q.lastSeenAt || null
  }));

  // 5. Persist Session Document
  const sessionId = `ret-session-${slugify(targetTopic)}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const sessionDoc = await RetentionSession.create({
    user: userId,
    sessionId,
    targetTopic,
    status: 'in_progress',
    questions: questionsToPersist,
    historicalBaseline,
    startedAt: new Date()
  });

  return {
    isResumed: false,
    session: formatSafeRetentionSession(sessionDoc)
  };
}

/**
 * Submits and authoritatively scores a retention assessment session.
 *
 * @param {string} userId - Authenticated user ID
 * @param {string} sessionIdOrMongoId - Session identifier
 * @param {Array<Object>} submittedAnswers - [{ questionId, selectedOption }]
 * @returns {Promise<Object>} Completed session with outcome and disclosures
 */
export async function submitRetentionSession(userId, sessionIdOrMongoId, submittedAnswers = []) {
  if (!sessionIdOrMongoId) {
    const err = new Error('Session ID is required.');
    err.status = 400;
    throw err;
  }

  const query = {
    $or: [
      { sessionId: sessionIdOrMongoId },
      { _id: mongoose.isValidObjectId(sessionIdOrMongoId) ? sessionIdOrMongoId : null }
    ].filter((q) => q._id !== null || q.sessionId)
  };

  const session = await RetentionSession.findOne(query);

  if (!session) {
    const err = new Error('Retention assessment session not found.');
    err.status = 404;
    throw err;
  }

  // Security: Ownership verification
  if (session.user.toString() !== userId.toString()) {
    const err = new Error('Access denied. You do not own this retention session.');
    err.status = 403;
    throw err;
  }

  // Idempotency: Reject duplicate submission
  if (session.status === 'submitted') {
    const err = new Error('This retention session has already been submitted and scored.');
    err.status = 409;
    err.session = formatSafeRetentionSession(session);
    throw err;
  }

  if (session.status === 'abandoned') {
    const err = new Error('This retention session was abandoned and cannot be submitted.');
    err.status = 409;
    throw err;
  }

  // 1. Authoritative Server-Side Scoring
  const answerMap = new Map();
  if (Array.isArray(submittedAnswers)) {
    for (const ans of submittedAnswers) {
      if (ans && ans.questionId !== undefined) {
        answerMap.set(Number(ans.questionId), ans.selectedOption);
      }
    }
  }

  let totalPoints = 0;
  let maxPoints = 0;
  const processedAnswers = [];

  for (const q of session.questions) {
    const selectedOption = answerMap.has(q.questionId) ? answerMap.get(q.questionId) : null;
    const isCorrect = selectedOption !== null && selectedOption === q.answer;
    const pointsAwarded = isCorrect ? (q.points || 1) : 0;

    totalPoints += pointsAwarded;
    maxPoints += (q.points || 1);

    processedAnswers.push({
      questionId: q.questionId,
      selectedOption,
      isCorrect,
      pointsAwarded
    });
  }

  const percentage = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;
  const baseline = session.historicalBaseline || {};
  const baseScore = baseline.baselineScore;
  const baseSample = baseline.baselineSampleSize || 0;

  // 2. Repeat-Exposure Disclosures
  const repeatedQuestions = session.questions.filter((q) => q.isRepeated);
  const repeatedQuestionsCount = repeatedQuestions.length;
  const repeatedPercentage = session.questions.length > 0
    ? Math.round((repeatedQuestionsCount / session.questions.length) * 100)
    : 0;

  const disclosures = [
    'Retention assessments provide directional concept verification; they do not measure long-term memory or academic certification.',
    'Score differences within ±14 percentage points reflect natural assessment context and prompt variation rather than cognitive decay.'
  ];

  if (repeatedQuestionsCount > 0) {
    disclosures.push(
      `Repeat Exposure Disclosure: ${repeatedQuestionsCount} of ${session.questions.length} questions (${repeatedPercentage}%) were previously answered in prior sessions. Demonstrated performance may partly reflect prompt recall.`
    );
  }

  // 3. Outcome Classification Logic
  let classification = RETENTION_OUTCOME.INSUFFICIENT_EVIDENCE;
  let scoreDelta = null;
  let isComparable = false;
  let reason = '';

  if (baseScore === null || baseSample < 2) {
    classification = RETENTION_OUTCOME.FIRST_ASSESSMENT;
    scoreDelta = null;
    isComparable = false;
    reason = `First retention checkpoint completed for ${session.targetTopic} (${percentage}% across ${session.questions.length} questions). This assessment establishes your baseline for future retention checks.`;
  } else {
    scoreDelta = percentage - baseScore;
    isComparable = true;

    if (scoreDelta >= 15) {
      classification = RETENTION_OUTCOME.IMPROVED;
      reason = `Demonstrated improvement: Observed performance (${percentage}%) increased by +${scoreDelta} percentage points over prior baseline (${baseScore}%). Conceptual durability is strong.`;
    } else if (scoreDelta <= -15 && percentage < 70) {
      classification = RETENTION_OUTCOME.POSSIBLE_DECLINE;
      reason = `Possible retention decline: Observed performance (${percentage}%) is lower than prior baseline (${baseScore}%) by ${Math.abs(scoreDelta)} percentage points. Targeted revision is recommended.`;
    } else {
      classification = RETENTION_OUTCOME.RETAINED;
      const sign = scoreDelta >= 0 ? '+' : '';
      reason = `Demonstrated retention: Observed performance (${percentage}%, delta: ${sign}${scoreDelta}pp vs ${baseScore}%) confirms stable understanding. Key concept mechanics remain sound.`;
    }
  }

  // 4. Grounded Follow-up Recommended Action
  let recommendedAction = null;
  const topicSlug = slugify(session.targetTopic);
  const recId = `rec-ret-${topicSlug}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  if (classification === RETENTION_OUTCOME.IMPROVED) {
    recommendedAction = {
      actionCategory: 'advance',
      title: `Advance Beyond ${session.targetTopic}`,
      description: `Your retention check demonstrated score growth. Progress to subsequent topics in your learning pathway.`,
      url: `/practice?topic=${encodeURIComponent(session.targetTopic)}`,
      recommendationId: recId
    };
  } else if (classification === RETENTION_OUTCOME.POSSIBLE_DECLINE) {
    recommendedAction = {
      actionCategory: 'review',
      title: `Refresh ${session.targetTopic} Mechanics`,
      description: `A targeted practice session is recommended to shore up foundational syntax and pattern application.`,
      url: `/practice?topic=${encodeURIComponent(session.targetTopic)}`,
      recommendationId: recId
    };
  } else if (classification === RETENTION_OUTCOME.FIRST_ASSESSMENT) {
    recommendedAction = {
      actionCategory: 'practice',
      title: `Continue Regular Practice in ${session.targetTopic}`,
      description: `Baseline established. Solve code challenges to reinforce problem-solving momentum.`,
      url: `/practice?topic=${encodeURIComponent(session.targetTopic)}`,
      recommendationId: recId
    };
  } else {
    // Retained or other
    recommendedAction = {
      actionCategory: 'practice',
      title: `Stretch Challenge in ${session.targetTopic}`,
      description: `Concepts verified durable. Tackle higher-complexity algorithmic challenges to expand depth.`,
      url: `/practice?topic=${encodeURIComponent(session.targetTopic)}`,
      recommendationId: recId
    };
  }

  const outcome = {
    classification,
    score: totalPoints,
    maxScore: maxPoints,
    percentage,
    scoreDelta,
    isComparable,
    repeatedQuestionsCount,
    repeatedPercentage,
    reason,
    comparabilityDisclosures: disclosures,
    recommendedAction
  };

  // 5. Persist Session Completion
  session.status = 'submitted';
  session.selectedAnswers = processedAnswers;
  session.outcome = outcome;
  session.submittedAt = new Date();
  session.durationSeconds = Math.max(0, Math.floor((session.submittedAt.getTime() - session.startedAt.getTime()) / 1000));

  await session.save();

  // 6. Record Updated Competency Snapshot
  try {
    await recordCompetencySnapshot(userId, {
      sourceEvent: 'retention_assessment',
      force: true,
      notes: `Retention check completed for ${session.targetTopic}: ${classification} (${percentage}%)`
    });
  } catch {
    // Snapshot creation failure should not break submission response
  }

  return formatSafeRetentionSession(session);
}

/**
 * Retrieves a single retention session by ID with safe formatting.
 *
 * @param {string} userId - Authenticated user ID
 * @param {string} sessionIdOrMongoId
 * @returns {Promise<Object>}
 */
export async function getRetentionSessionById(userId, sessionIdOrMongoId) {
  const query = {
    user: userId,
    $or: [
      { sessionId: sessionIdOrMongoId },
      { _id: mongoose.isValidObjectId(sessionIdOrMongoId) ? sessionIdOrMongoId : null }
    ].filter((q) => q._id !== null || q.sessionId)
  };

  const session = await RetentionSession.findOne(query);
  if (!session) return null;
  return formatSafeRetentionSession(session);
}

/**
 * Retrieves paginated retention assessment history for a learner.
 *
 * @param {string} userId - Authenticated user ID
 * @param {Object} [options={}]
 * @param {string} [options.topic] - Filter by topic
 * @param {number} [options.page=1]
 * @param {number} [options.limit=10]
 * @returns {Promise<Object>} Paginated retention history
 */
export async function getRetentionHistory(userId, options = {}) {
  const { topic, page = 1, limit = 10 } = options;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10) || 10));

  const filter = {
    user: userId,
    status: 'submitted'
  };

  if (topic && typeof topic === 'string') {
    filter.targetTopic = normalizeTopicName(topic);
  }

  const [total, sessions] = await Promise.all([
    RetentionSession.countDocuments(filter),
    RetentionSession.find(filter)
      .sort({ submittedAt: -1, createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean()
  ]);

  const formattedSessions = sessions.map((s) => formatSafeRetentionSession(s));

  return {
    sessions: formattedSessions,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1
    }
  };
}

/**
 * Marks an in-progress retention session as abandoned.
 *
 * @param {string} userId
 * @param {string} sessionIdOrMongoId
 * @returns {Promise<Object>}
 */
export async function abandonRetentionSession(userId, sessionIdOrMongoId) {
  const query = {
    user: userId,
    status: 'in_progress',
    $or: [
      { sessionId: sessionIdOrMongoId },
      { _id: mongoose.isValidObjectId(sessionIdOrMongoId) ? sessionIdOrMongoId : null }
    ].filter((q) => q._id !== null || q.sessionId)
  };

  const session = await RetentionSession.findOneAndUpdate(
    query,
    { $set: { status: 'abandoned' } },
    { returnDocument: 'after' }
  );

  return session ? formatSafeRetentionSession(session) : null;
}
