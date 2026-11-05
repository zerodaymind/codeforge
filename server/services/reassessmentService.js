import DiagnosticSession from '../models/DiagnosticSession.js';
import { normalizeTopicName } from './roadmapPlanner.js';

/**
 * Deterministic Diagnostic Comparison & Reassessment Engine (Milestone 15D)
 *
 * Compares two submitted diagnostic assessments belonging to the same learner.
 * Implements conservative, responsible evidence rules:
 * - Requires at least 2 answered questions per topic in both sessions for quantitative comparison.
 * - Detects question overlap (shared vs new questions) and discloses prompt variation.
 * - Classifies observed trend:
 *   - 'encouraging_progress' (+15pp or higher, with >=2 sample in both)
 *   - 'further_revision_recommended' (-15pp or lower, or persistent gap <70%)
 *   - 'performance_stable' (within +/- 15pp)
 *   - 'insufficient_sample' (sample size < 2 in either attempt)
 *   - 'first_assessment' (topic only evaluated in current attempt)
 *   - 'not_reassessed' (topic only evaluated in previous attempt)
 * - Discloses explicit limitations on every comparison (no causal claims, prompt familiarity, sample size).
 */

export const COMPARISON_STATUS = {
  ENCOURAGING_PROGRESS: 'encouraging_progress',
  FURTHER_REVISION_RECOMMENDED: 'further_revision_recommended',
  PERFORMANCE_STABLE: 'performance_stable',
  INSUFFICIENT_SAMPLE: 'insufficient_sample',
  FIRST_ASSESSMENT: 'first_assessment',
  NOT_REASSESSED: 'not_reassessed'
};

const GLOBAL_COMPARISON_LIMITATIONS = [
  'Diagnostic assessments sample questions dynamically; score differences reflect different prompt contexts as well as concept recall.',
  'Sample sizes per topic are modest (2–5 questions); observed deltas should be interpreted as directional indicators rather than definitive mastery proof.',
  'Observed changes over time cannot be causally attributed to any single revision or practice activity.',
  'Identical repeated questions may exhibit score improvement influenced by prompt familiarity.'
];

/**
 * Pure comparison function evaluating two submitted diagnostic sessions.
 *
 * @param {Object} previousSession - Prior submitted DiagnosticSession document
 * @param {Object} currentSession - Subsequent submitted DiagnosticSession document
 * @returns {Object} Comprehensive, deterministic comparison report
 */
export function compareDiagnosticSessions(previousSession, currentSession) {
  if (!previousSession || !currentSession) {
    return {
      hasComparison: false,
      reason: 'missing_sessions',
      message: 'Two valid diagnostic sessions are required for comparison.'
    };
  }

  // Pre-condition: both must be submitted
  if (previousSession.status !== 'submitted' || currentSession.status !== 'submitted') {
    return {
      hasComparison: false,
      reason: 'incomplete_sessions',
      message: 'Authoritative comparison requires both diagnostic sessions to be completed and submitted.'
    };
  }

  const prevDate = previousSession.submittedAt || previousSession.createdAt;
  const currDate = currentSession.submittedAt || currentSession.createdAt;

  const previousOverallScore = {
    score: previousSession.score || 0,
    maxScore: previousSession.maxScore || 0,
    percentage: previousSession.percentage || 0
  };

  const currentOverallScore = {
    score: currentSession.score || 0,
    maxScore: currentSession.maxScore || 0,
    percentage: currentSession.percentage || 0
  };

  const overallDeltaPercentage = currentOverallScore.percentage - previousOverallScore.percentage;

  // Build maps of topicResults by canonical topic name
  const prevTopicMap = new Map();
  for (const tr of previousSession.topicResults || []) {
    const canonical = normalizeTopicName(tr.topic);
    prevTopicMap.set(canonical, tr);
  }

  const currTopicMap = new Map();
  for (const tr of currentSession.topicResults || []) {
    const canonical = normalizeTopicName(tr.topic);
    currTopicMap.set(canonical, tr);
  }

  // Map question IDs by canonical topic for overlap analysis
  const prevQuestionsByTopic = new Map();
  for (const q of previousSession.questions || []) {
    const canonical = normalizeTopicName(q.topic);
    if (!prevQuestionsByTopic.has(canonical)) {
      prevQuestionsByTopic.set(canonical, new Set());
    }
    prevQuestionsByTopic.get(canonical).add(q.questionId);
  }

  const currQuestionsByTopic = new Map();
  for (const q of currentSession.questions || []) {
    const canonical = normalizeTopicName(q.topic);
    if (!currQuestionsByTopic.has(canonical)) {
      currQuestionsByTopic.set(canonical, new Set());
    }
    currQuestionsByTopic.get(canonical).add(q.questionId);
  }

  // Union of all topics across both sessions
  const allTopicsSet = new Set([...prevTopicMap.keys(), ...currTopicMap.keys()]);
  const topicComparisons = [];

  for (const topic of allTopicsSet) {
    const prevRes = prevTopicMap.get(topic);
    const currRes = currTopicMap.get(topic);

    const prevQIds = prevQuestionsByTopic.get(topic) || new Set();
    const currQIds = currQuestionsByTopic.get(topic) || new Set();

    let sharedQuestionsCount = 0;
    for (const qId of currQIds) {
      if (prevQIds.has(qId)) {
        sharedQuestionsCount++;
      }
    }
    const newQuestionsCount = currQIds.size - sharedQuestionsCount;

    // Case 1: First assessment for this topic
    if (!prevRes && currRes) {
      topicComparisons.push({
        topic,
        comparable: false,
        status: COMPARISON_STATUS.FIRST_ASSESSMENT,
        label: 'First Assessment',
        previousAccuracy: null,
        previousSample: 0,
        currentAccuracy: currRes.accuracyPercentage,
        currentSample: currRes.answeredQuestions,
        deltaPercentage: null,
        sharedQuestionsCount: 0,
        newQuestionsCount: currQIds.size,
        interpretation: `Assessed for the first time in your latest session (${currRes.accuracyPercentage}% across ${currRes.answeredQuestions} questions).`,
        limitations: ['No previous assessment data exists for this topic to evaluate change.']
      });
      continue;
    }

    // Case 2: Topic was not reassessed in current session
    if (prevRes && !currRes) {
      topicComparisons.push({
        topic,
        comparable: false,
        status: COMPARISON_STATUS.NOT_REASSESSED,
        label: 'Not Reassessed',
        previousAccuracy: prevRes.accuracyPercentage,
        previousSample: prevRes.answeredQuestions,
        currentAccuracy: null,
        currentSample: 0,
        deltaPercentage: null,
        sharedQuestionsCount: 0,
        newQuestionsCount: 0,
        interpretation: `Evaluated in earlier session (${prevRes.accuracyPercentage}% across ${prevRes.answeredQuestions} questions) but not sampled in the latest assessment.`,
        limitations: ['Topic was omitted from the latest diagnostic session.']
      });
      continue;
    }

    // Case 3: Assessed in both sessions
    const prevSample = prevRes.answeredQuestions ?? prevRes.totalQuestions ?? 0;
    const currSample = currRes.answeredQuestions ?? currRes.totalQuestions ?? 0;
    const prevAccuracy = prevRes.accuracyPercentage ?? 0;
    const currAccuracy = currRes.accuracyPercentage ?? 0;
    const deltaPercentage = currAccuracy - prevAccuracy;

    const topicLimitations = [];

    // Analyze question overlap
    if (sharedQuestionsCount === 0 && currQIds.size > 0) {
      topicLimitations.push(`Different questions were evaluated in both sessions (${currQIds.size} new questions). Results reflect question variation as well as concept recall.`);
    } else if (sharedQuestionsCount > 0 && newQuestionsCount > 0) {
      topicLimitations.push(`Partial question overlap (${sharedQuestionsCount} repeated, ${newQuestionsCount} new). Performance reflects a combination of question recall and new prompt problem-solving.`);
    } else if (sharedQuestionsCount === currQIds.size && currQIds.size > 0) {
      topicLimitations.push(`Identical question set sampled in both sessions. Improvement may partly reflect familiarity with the specific questions.`);
    }

    // Check conservative sample size threshold (< 2 in either attempt)
    if (prevSample < 2 || currSample < 2) {
      topicLimitations.push('Sample size threshold (minimum 2 answered questions) was not satisfied in one or both assessments.');
      topicComparisons.push({
        topic,
        comparable: false,
        status: COMPARISON_STATUS.INSUFFICIENT_SAMPLE,
        label: 'Not Enough Comparable Evidence',
        previousAccuracy: prevAccuracy,
        previousSample: prevSample,
        currentAccuracy: currAccuracy,
        currentSample: currSample,
        deltaPercentage: null,
        sharedQuestionsCount,
        newQuestionsCount,
        interpretation: `Sample size is too small for a confident comparison (${prevSample} question(s) previously vs ${currSample} currently). A minimum of 2 answered questions per attempt is required.`,
        limitations: topicLimitations
      });
      continue;
    }

    // Both sessions have >= 2 questions -> Quantitative comparison is supported
    let status = COMPARISON_STATUS.PERFORMANCE_STABLE;
    let label = 'Performance Appears Stable';
    let interpretation = '';

    if (deltaPercentage >= 15) {
      status = COMPARISON_STATUS.ENCOURAGING_PROGRESS;
      label = 'Encouraging Progress';
      interpretation = `Observed accuracy improved by ${deltaPercentage} percentage points (${prevAccuracy}% -> ${currAccuracy}% across ${currSample} questions). New evidence indicates stronger concept familiarity.`;
    } else if (deltaPercentage <= -15) {
      status = COMPARISON_STATUS.FURTHER_REVISION_RECOMMENDED;
      label = 'Further Revision Recommended';
      interpretation = `Observed accuracy decreased by ${Math.abs(deltaPercentage)} percentage points (${prevAccuracy}% -> ${currAccuracy}% across ${currSample} questions). Foundational revision is strongly recommended.`;
    } else {
      status = COMPARISON_STATUS.PERFORMANCE_STABLE;
      label = 'Performance Appears Stable';
      const sign = deltaPercentage >= 0 ? '+' : '';
      interpretation = `Observed accuracy is broadly consistent (${prevAccuracy}% vs ${currAccuracy}%, delta: ${sign}${deltaPercentage}pp across ${currSample} questions).`;
    }

    // Persistent gap disclosure
    if (currAccuracy < 70) {
      interpretation += ' Current accuracy remains below the 70% proficiency threshold; continued reinforcement is recommended.';
      if (status === COMPARISON_STATUS.PERFORMANCE_STABLE) {
        status = COMPARISON_STATUS.FURTHER_REVISION_RECOMMENDED;
        label = 'Further Revision Recommended';
      }
    }

    topicComparisons.push({
      topic,
      comparable: true,
      status,
      label,
      previousAccuracy: prevAccuracy,
      previousSample: prevSample,
      currentAccuracy: currAccuracy,
      currentSample: currSample,
      deltaPercentage,
      sharedQuestionsCount,
      newQuestionsCount,
      interpretation,
      limitations: topicLimitations
    });
  }

  // Deterministic sorting of topic comparisons:
  // 1. Further revision recommended (urgency tier 1)
  // 2. Insufficient sample (urgency tier 2)
  // 3. Performance stable (urgency tier 3)
  // 4. Encouraging progress (urgency tier 4)
  // 5. First assessment / Not reassessed (tier 5)
  // Secondary: topic name alphabetical
  const TIER_ORDER = {
    [COMPARISON_STATUS.FURTHER_REVISION_RECOMMENDED]: 1,
    [COMPARISON_STATUS.INSUFFICIENT_SAMPLE]: 2,
    [COMPARISON_STATUS.PERFORMANCE_STABLE]: 3,
    [COMPARISON_STATUS.ENCOURAGING_PROGRESS]: 4,
    [COMPARISON_STATUS.FIRST_ASSESSMENT]: 5,
    [COMPARISON_STATUS.NOT_REASSESSED]: 6
  };

  topicComparisons.sort((a, b) => {
    const tierA = TIER_ORDER[a.status] || 99;
    const tierB = TIER_ORDER[b.status] || 99;
    if (tierA !== tierB) return tierA - tierB;
    return a.topic.localeCompare(b.topic);
  });

  // Overall interpretation text
  const deltaSign = overallDeltaPercentage >= 0 ? '+' : '';
  const overallInterpretation =
    `Overall score shifted by ${deltaSign}${overallDeltaPercentage} percentage points ` +
    `(${previousOverallScore.percentage}% on ${new Date(prevDate).toLocaleDateString()} -> ` +
    `${currentOverallScore.percentage}% on ${new Date(currDate).toLocaleDateString()}). ` +
    `Detailed topic breakdowns indicate specific areas for targeted reinforcement.`;

  return {
    hasComparison: true,
    previousSessionId: previousSession._id ? previousSession._id.toString() : '',
    previousDate: prevDate,
    currentSessionId: currentSession._id ? currentSession._id.toString() : '',
    currentDate: currDate,
    previousOverallScore,
    currentOverallScore,
    overallDeltaPercentage,
    overallInterpretation,
    topicComparisons,
    limitations: GLOBAL_COMPARISON_LIMITATIONS
  };
}

/**
 * Service method to retrieve and compare the latest two submitted diagnostic assessments for a user.
 *
 * @param {string} userId - Authenticated user ID
 * @returns {Promise<Object>} Comparison result object
 */
export async function getLatestDiagnosticComparison(userId) {
  const sessions = await DiagnosticSession.find({
    user: userId,
    status: 'submitted'
  })
    .sort({ submittedAt: -1, createdAt: -1 })
    .limit(2)
    .lean();

  if (!sessions || sessions.length === 0) {
    return {
      hasComparison: false,
      reason: 'no_assessments',
      message: 'No completed diagnostic assessments found. Take an initial diagnostic assessment to establish your baseline.'
    };
  }

  if (sessions.length === 1) {
    return {
      hasComparison: false,
      reason: 'single_assessment',
      message: 'Only one completed diagnostic assessment exists. Complete a reassessment to compare your progress over time.',
      latestSessionId: sessions[0]._id.toString(),
      latestSessionDate: sessions[0].submittedAt || sessions[0].createdAt,
      latestOverallScore: {
        score: sessions[0].score || 0,
        maxScore: sessions[0].maxScore || 0,
        percentage: sessions[0].percentage || 0
      }
    };
  }

  const [currentSession, previousSession] = sessions;
  return compareDiagnosticSessions(previousSession, currentSession);
}

/**
 * Service method to compare a specific diagnostic session against its immediate predecessor.
 *
 * @param {string} userId - Authenticated user ID
 * @param {string} sessionId - Target DiagnosticSession ID
 * @returns {Promise<Object>} Comparison result object
 */
export async function getDiagnosticSessionComparison(userId, sessionId) {
  const currentSession = await DiagnosticSession.findOne({
    _id: sessionId,
    user: userId,
    status: 'submitted'
  }).lean();

  if (!currentSession) {
    return null;
  }

  const targetDate = currentSession.submittedAt || currentSession.createdAt;

  // Find the immediately preceding submitted session
  const previousSession = await DiagnosticSession.findOne({
    user: userId,
    status: 'submitted',
    createdAt: { $lt: targetDate }
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!previousSession) {
    return {
      hasComparison: false,
      reason: 'no_prior_assessment',
      message: 'This was your first completed diagnostic assessment. No prior assessment exists for comparison.',
      targetSessionId: sessionId
    };
  }

  return compareDiagnosticSessions(previousSession, currentSession);
}
