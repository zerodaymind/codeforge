import Question from '../models/Question.js';
import DiagnosticSession from '../models/DiagnosticSession.js';
import QuizAttempt from '../models/QuizAttempt.js';
import Submission from '../models/Submission.js';
import RetentionSession from '../models/RetentionSession.js';
import { getLearnerIntelligence, LEARNING_STATE } from './learningIntelligenceService.js';
import { evaluatePrerequisiteReadiness } from './prerequisiteGraph.js';
import { normalizeTopicName } from './roadmapPlanner.js';

/**
 * ==============================================================================
 * Retention Review Scheduling Service (Milestone 16C)
 *
 * Implements evidence-based, configurable scheduling heuristics that identify
 * when previously learned topics are eligible for a retention check.
 *
 * NON-NEGOTIABLE SCIENTIFIC PRINCIPLE:
 * Inactivity is NEVER equated with forgetting.
 * Stale evidence is a reason to reassess, not proof that competence has declined.
 * A learner's proficiency is NEVER lowered solely because time has passed.
 * ==============================================================================
 */

export const RETENTION_POLICY = {
  FRESH_THRESHOLD_DAYS: 14,      // < 14 days: fresh, ordinarily no prompt
  REVIEW_THRESHOLD_DAYS: 30,     // 14–30 days: gentle review prompt
  STALE_THRESHOLD_DAYS: 60,      // 31–60 days: due for reassessment; > 60 days: stale evidence
  MIN_HISTORICAL_SAMPLES: 2,     // Need >= 2 items historically to establish baseline
  COOL_OFF_HOURS: 48             // Cooldown after dismissal or completion
};

export const RETENTION_URGENCY = {
  NONE: 'none',
  GENTLE: 'gentle',
  RECOMMENDED: 'recommended',
  PRIORITY: 'priority'
};

export const RETENTION_REVIEW_STATUS = {
  FRESH: 'fresh',
  ELIGIBLE_GENTLE: 'eligible_gentle',
  DUE_REASSESSMENT: 'due_reassessment',
  STALE_PRIORITY: 'stale_priority',
  INSUFFICIENT_BASELINE: 'insufficient_baseline',
  UNASSESSED: 'unassessed'
};

// In-memory dismissal registry: `${userId}:${canonicalTopic}` -> expirationDate
const dismissalCache = new Map();

/**
 * Dismisses retention prompt for a specific topic for COOL_OFF_HOURS (48h).
 *
 * @param {string} userId - Authenticated user ID
 * @param {string} topic - Topic name
 * @returns {Date} Expiration date
 */
export function dismissRetentionTopic(userId, topic) {
  const canonical = normalizeTopicName(topic);
  const key = `${userId}:${canonical}`;
  const expiresAt = new Date(Date.now() + RETENTION_POLICY.COOL_OFF_HOURS * 60 * 60 * 1000);
  dismissalCache.set(key, expiresAt);
  return expiresAt;
}

/**
 * Checks if a topic retention prompt is currently dismissed.
 *
 * @param {string} userId
 * @param {string} topic
 * @returns {boolean}
 */
export function isTopicDismissed(userId, topic) {
  const canonical = normalizeTopicName(topic);
  const key = `${userId}:${canonical}`;
  const expiresAt = dismissalCache.get(key);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt.getTime()) {
    dismissalCache.delete(key);
    return false;
  }
  return true;
}

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Evaluates the question bank to see if active questions exist for this topic.
 *
 * @param {string} canonicalTopic
 * @returns {Promise<{ hasContent: boolean, questionCount: number }>}
 */
export async function checkTopicAssessmentContent(canonicalTopic) {
  const regex = new RegExp(`^${escapeRegex(canonicalTopic)}$`, 'i');
  const count = await Question.countDocuments({
    status: 'active',
    $or: [{ topic: regex }, { tags: regex }]
  });
  return {
    hasContent: count > 0,
    questionCount: count,
    activeCount: count
  };
}

/**
 * Evaluates the full retention review schedule for an authenticated learner.
 *
 * @param {string} userId - Authenticated user ID
 * @param {Object} [options={}]
 * @param {Date} [options.referenceDate=new Date()]
 * @param {Object} [options.policyOverride={}]
 * @returns {Promise<Object>} Retention review schedule report
 */
export async function getRetentionReviewSchedule(userId, options = {}) {
  const { referenceDate = new Date(), policyOverride = {} } = options;
  const policy = { ...RETENTION_POLICY, ...policyOverride };

  // 1. Fetch Synthesized Learner Intelligence Model
  const intelligence = await getLearnerIntelligence(userId, referenceDate);
  const { topicStates } = intelligence;

  // 2. Query most recent timestamps per topic across all evidence models
  const [diagnostics, quizzes, submissions, retentionSessions] = await Promise.all([
    DiagnosticSession.find({ user: userId, status: 'submitted' })
      .select('topicResults questions submittedAt createdAt')
      .lean(),
    QuizAttempt.find({ user: userId, status: { $in: ['submitted', 'completed'] }, isPassed: true })
      .select('topic submittedAt createdAt')
      .lean(),
    Submission.find({ user: userId, verdict: 'Accepted' })
      .populate('problem', 'topic topics')
      .select('problem createdAt')
      .lean(),
    RetentionSession.find({ user: userId, status: 'submitted' })
      .select('targetTopic submittedAt createdAt')
      .lean()
  ]);

  // Build latest verified evidence date map per topic
  const latestDateMap = new Map();

  function updateLatestDate(topicName, date) {
    if (!topicName || !date) return;
    const canonical = normalizeTopicName(topicName);
    const time = new Date(date).getTime();
    if (isNaN(time)) return;
    const current = latestDateMap.get(canonical);
    if (!current || time > current.getTime()) {
      latestDateMap.set(canonical, new Date(time));
    }
  }

  // Populate from diagnostics
  for (const ds of diagnostics) {
    const dDate = ds.submittedAt || ds.createdAt;
    for (const tr of ds.topicResults || []) {
      updateLatestDate(tr.topic, dDate);
    }
    for (const q of ds.questions || []) {
      updateLatestDate(q.topic, dDate);
    }
  }

  // Populate from quizzes
  for (const qa of quizzes) {
    updateLatestDate(qa.topic, qa.submittedAt || qa.createdAt);
  }

  // Populate from submissions
  for (const s of submissions) {
    const pTopic = s.problem?.topic || (Array.isArray(s.problem?.topics) ? s.problem.topics[0] : null);
    if (pTopic) {
      updateLatestDate(pTopic, s.createdAt);
    }
  }

  // Populate from previous retention sessions
  for (const rs of retentionSessions) {
    updateLatestDate(rs.targetTopic, rs.submittedAt || rs.createdAt);
  }

  // 3. Evaluate each topic against scheduling policy
  const allTopics = [];
  const eligibleTopics = [];

  for (const ts of topicStates) {
    const canonical = normalizeTopicName(ts.topic);
    const lastEvidenceDate = latestDateMap.get(canonical) || null;
    const sampleSize = ts.sampleSize || 0;
    const masteryScore = ts.masteryScore;
    const currentState = ts.state;

    // Content availability check
    const contentCheck = await checkTopicAssessmentContent(canonical);

    // Prerequisite readiness check
    const readiness = evaluatePrerequisiteReadiness(canonical, topicStates);

    // Dismissal check
    const dismissed = isTopicDismissed(userId, canonical);

    let reviewStatus = RETENTION_REVIEW_STATUS.UNASSESSED;
    let urgency = RETENTION_URGENCY.NONE;
    let isEligible = false;
    let evidenceAgeDays = null;
    let reason = '';

    if (currentState === LEARNING_STATE.UNASSESSED || !lastEvidenceDate) {
      reviewStatus = RETENTION_REVIEW_STATUS.UNASSESSED;
      urgency = RETENTION_URGENCY.NONE;
      reason = 'Topic has not yet been assessed or practiced. Take an initial diagnostic or practice challenge.';
    } else if (sampleSize < policy.MIN_HISTORICAL_SAMPLES) {
      reviewStatus = RETENTION_REVIEW_STATUS.INSUFFICIENT_BASELINE;
      urgency = RETENTION_URGENCY.NONE;
      evidenceAgeDays = Math.max(0, Math.floor((referenceDate.getTime() - lastEvidenceDate.getTime()) / (1000 * 60 * 60 * 24)));
      reason = `Only ${sampleSize} item evaluated historically (minimum ${policy.MIN_HISTORICAL_SAMPLES} required). Complete further exercises to establish a reliable baseline.`;
    } else {
      evidenceAgeDays = Math.max(0, Math.floor((referenceDate.getTime() - lastEvidenceDate.getTime()) / (1000 * 60 * 60 * 24)));

      if (evidenceAgeDays < policy.FRESH_THRESHOLD_DAYS) {
        reviewStatus = RETENTION_REVIEW_STATUS.FRESH;
        urgency = RETENTION_URGENCY.NONE;
        reason = `Evidence is fresh (${evidenceAgeDays} days old). Your demonstrated performance (${masteryScore}%) is up to date.`;
      } else if (evidenceAgeDays <= policy.REVIEW_THRESHOLD_DAYS) {
        reviewStatus = RETENTION_REVIEW_STATUS.ELIGIBLE_GENTLE;
        urgency = RETENTION_URGENCY.GENTLE;
        isEligible = true;
        reason = `Last evaluated ${evidenceAgeDays} days ago (${masteryScore}% baseline). A gentle review check is recommended.`;
      } else if (evidenceAgeDays <= policy.STALE_THRESHOLD_DAYS) {
        reviewStatus = RETENTION_REVIEW_STATUS.DUE_REASSESSMENT;
        urgency = RETENTION_URGENCY.RECOMMENDED;
        isEligible = true;
        reason = `Evidence is maturing (${evidenceAgeDays} days old). Quick reassessment recommended to verify durable retention.`;
      } else {
        reviewStatus = RETENTION_REVIEW_STATUS.STALE_PRIORITY;
        urgency = RETENTION_URGENCY.PRIORITY;
        isEligible = true;
        reason = `Evidence is over ${policy.STALE_THRESHOLD_DAYS} days old (${evidenceAgeDays} days). Reassessment prioritized to refresh your learning profile.`;
      }
    }

    // Suppress eligibility if dismissed, lacks content, or unready
    let eligibilityNote = null;
    if (isEligible) {
      if (dismissed) {
        isEligible = false;
        eligibilityNote = `Review prompt temporarily dismissed for ${policy.COOL_OFF_HOURS}h.`;
      } else if (!contentCheck.hasContent) {
        isEligible = false;
        eligibilityNote = 'No active assessment items available in question bank for this topic.';
      }
    }

    const topicEntry = {
      topic: canonical,
      currentState,
      masteryScore,
      sampleSize,
      lastEvidenceDate,
      evidenceAgeDays,
      reviewStatus,
      urgency,
      isEligible,
      eligibilityNote,
      isDismissed: dismissed,
      hasContent: contentCheck.hasContent,
      availableQuestions: contentCheck.questionCount,
      isPrerequisiteReady: readiness.isReady,
      prerequisiteNotes: readiness.isReady ? null : readiness.guidance,
      reason
    };

    allTopics.push(topicEntry);
    if (isEligible) {
      eligibleTopics.push(topicEntry);
    }
  }

  // Sort eligible topics by urgency (priority > recommended > gentle) then age descending
  const urgencyWeight = {
    [RETENTION_URGENCY.PRIORITY]: 3,
    [RETENTION_URGENCY.RECOMMENDED]: 2,
    [RETENTION_URGENCY.GENTLE]: 1,
    [RETENTION_URGENCY.NONE]: 0
  };

  eligibleTopics.sort((a, b) => {
    const diff = (urgencyWeight[b.urgency] || 0) - (urgencyWeight[a.urgency] || 0);
    if (diff !== 0) return diff;
    return (b.evidenceAgeDays || 0) - (a.evidenceAgeDays || 0);
  });

  return {
    policy,
    summary: {
      totalTopicsTracked: allTopics.length,
      eligibleCount: eligibleTopics.length,
      staleCount: allTopics.filter((t) => t.reviewStatus === RETENTION_REVIEW_STATUS.STALE_PRIORITY).length,
      dueCount: allTopics.filter((t) => t.reviewStatus === RETENTION_REVIEW_STATUS.DUE_REASSESSMENT).length,
      gentleCount: allTopics.filter((t) => t.reviewStatus === RETENTION_REVIEW_STATUS.ELIGIBLE_GENTLE).length,
      freshCount: allTopics.filter((t) => t.reviewStatus === RETENTION_REVIEW_STATUS.FRESH).length,
      insufficientBaselineCount: allTopics.filter((t) => t.reviewStatus === RETENTION_REVIEW_STATUS.INSUFFICIENT_BASELINE).length
    },
    schedule: eligibleTopics,
    eligibleTopics,
    allTopics,
    disclosures: [
      'Inactivity is not evidence of forgetting; evidence age indicates when a check-in is helpful, not that competence has degraded.',
      'Topic proficiencies remain unaffected until a fresh, verified assessment is completed.',
      'Retention review prompts can be dismissed for 48 hours without penalty.'
    ]
  };
}
