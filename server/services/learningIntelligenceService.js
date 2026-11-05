import DiagnosticSession from '../models/DiagnosticSession.js';
import Submission from '../models/Submission.js';
import ProblemAttempt from '../models/ProblemAttempt.js';
import QuizAttempt from '../models/QuizAttempt.js';
import User from '../models/User.js';
import { normalizeTopicName, CANONICAL_TOPICS } from './roadmapPlanner.js';

/**
 * ==============================================================================
 * Pure Deterministic Learning Intelligence Engine (Milestone 16A)
 *
 * Synthesizes multi-source authenticated learner evidence:
 * - Onboarding Profiles (Intent / Declared Familiarity)
 * - Diagnostic Assessments (Conceptual multiple-choice accuracy)
 * - Practice Submissions (Code execution verdicts & difficulty)
 * - Practice Problem Attempts (Direct problem problem-solving)
 * - Quiz Attempts (Topic knowledge assessments)
 *
 * CRITICAL SCIENTIFIC & MEASUREMENT PRINCIPLES:
 * 1. Separates learner intent from demonstrated competence.
 * 2. Does NOT equate opening a lesson, clicking a button, or manual roadmap
 *    checkbox toggles with verified mastery.
 * 3. Accounts for distinct problems vs. repeated submissions.
 * 4. Applies conservative sample-size guards (requires >= 2 samples for state).
 * 5. Applies time-decay weighting (stale evidence discounted vs. recent evidence).
 * 6. Applies difficulty multipliers (Easy=1.0, Medium=1.5, Hard=2.2).
 * 7. Discloses measurement limitations and strictly avoids causal claims.
 * ==============================================================================
 */

export const LEARNING_STATE = {
  UNASSESSED: 'unassessed',
  INSUFFICIENT_EVIDENCE: 'insufficient_evidence',
  STRUGGLING: 'struggling',
  DEVELOPING: 'developing',
  PROFICIENT: 'proficient',
  MASTERED: 'mastered'
};

export const CONFIDENCE_LEVEL = {
  NONE: 'none',
  LOW: 'low',
  MODERATE: 'moderate',
  HIGH: 'high'
};

export const MODALITY_WEIGHT = {
  PRACTICE_CODE: 1.4,      // Highest rigor: synthesized code tested against hidden test cases
  PRACTICE_ANSWER: 1.0,    // Standard direct problem attempt
  QUIZ: 1.1,               // Comprehensive topic quiz
  DIAGNOSTIC: 1.0          // Diagnostic question
};

export const DIFFICULTY_WEIGHT = {
  'Easy': 1.0,
  'Medium': 1.5,
  'Hard': 2.2,
  'Beginner': 1.0,
  'Intermediate': 1.5,
  'Advanced': 2.2
};

export const GLOBAL_INTELLIGENCE_LIMITATIONS = [
  'Learning states reflect observed performance in CodeForge exercises and assessments; they are directional indicators, not formal academic certifications.',
  'Sample sizes per topic are bounded by available practice problems and questions. High confidence requires multi-modality evidence across multiple sessions.',
  'Performance changes over time reflect cumulative exposure and prompt variation; they cannot be causally attributed to any single practice activity.',
  'Repeated submissions on identical problems or questions may reflect prompt recall rather than generalized problem-solving transfer.'
];

/**
 * Calculates a time-freshness decay multiplier based on the age of the evidence.
 *
 * @param {Date|string|number} timestamp
 * @param {Date} [referenceDate=new Date()]
 * @returns {number} Multiplier between 0.45 and 1.0
 */
export function calculateFreshnessWeight(timestamp, referenceDate = new Date()) {
  if (!timestamp) return 0.5;
  const time = new Date(timestamp).getTime();
  const now = referenceDate.getTime();
  const diffDays = Math.max(0, (now - time) / (1000 * 60 * 60 * 24));

  if (diffDays <= 14) return 1.0;     // Last 2 weeks: full weight
  if (diffDays <= 30) return 0.85;    // Within 1 month: 85%
  if (diffDays <= 60) return 0.65;    // Within 2 months: 65%
  return 0.45;                        // Older than 2 months: 45%
}

/**
 * Normalizes difficulty label and returns appropriate numerical weight.
 *
 * @param {string} [difficulty='Easy']
 * @returns {number}
 */
export function getDifficultyWeight(difficulty) {
  if (!difficulty || typeof difficulty !== 'string') return 1.0;
  return DIFFICULTY_WEIGHT[difficulty] || 1.0;
}

/**
 * Pure function: Evaluates topic-level learning state, confidence, and explainable rationale
 * from aggregated raw evidence for a single topic.
 *
 * @param {Object} topicData - Raw evidence collected for the topic
 * @param {Object} [userContext={}] - User preferences & profile context
 * @param {Date} [referenceDate=new Date()]
 * @returns {Object} Topic learning state analysis
 */
export function computeTopicLearningState(topicData, userContext = {}, referenceDate = new Date()) {
  const {
    topic,
    diagnosticQuestions = [],
    codeSubmissions = [],
    problemAttempts = [],
    quizAttempts = []
  } = topicData;

  const canonicalTopic = normalizeTopicName(topic);
  const limitations = [];

  // 1. Audit Distinct Problems vs Repeated Submissions
  const solvedProblemSlugs = new Set();
  const attemptedProblemSlugs = new Set();
  const problemSubmissionsMap = new Map();

  for (const sub of codeSubmissions) {
    const slug = sub.problemSlug || sub.problem?.slug || String(sub.problem);
    attemptedProblemSlugs.add(slug);

    if (!problemSubmissionsMap.has(slug)) {
      problemSubmissionsMap.set(slug, []);
    }
    problemSubmissionsMap.get(slug).push(sub);

    if (sub.verdict === 'Accepted') {
      solvedProblemSlugs.add(slug);
    }
  }

  for (const att of problemAttempts) {
    const slug = att.problemSlug || att.problem?.slug || String(att.problem);
    attemptedProblemSlugs.add(slug);
    if (att.status === 'Accepted') {
      solvedProblemSlugs.add(slug);
    }
  }

  // Count distinct problem difficulty breakdown
  const solvedDifficultyCounts = { Easy: 0, Medium: 0, Hard: 0 };
  for (const slug of solvedProblemSlugs) {
    const matchingSub = codeSubmissions.find((s) => (s.problemSlug || s.problem?.slug) === slug);
    const diff = matchingSub?.difficulty || 'Medium';
    if (diff in solvedDifficultyCounts) {
      solvedDifficultyCounts[diff]++;
    } else {
      solvedDifficultyCounts.Medium++;
    }
  }

  // 2. Audit Quizzes
  const passedQuizzes = quizAttempts.filter((q) => Boolean(q.isPassed));
  const distinctQuizzesPassed = new Set(passedQuizzes.map((q) => q.quizId || q.title)).size;

  // 3. Audit Diagnostic Questions
  const diagAnswered = diagnosticQuestions.filter((q) => q.selectedOption !== null && q.selectedOption !== undefined);
  const diagCorrect = diagAnswered.filter((q) => Boolean(q.isCorrect));

  // 4. Calculate Total Sample Size (Distinct evidence items)
  // Each distinct problem attempted, each distinct quiz attempt, each diagnostic question
  const totalDistinctEvidenceCount =
    attemptedProblemSlugs.size +
    quizAttempts.length +
    diagAnswered.length;

  // Check for Empty / Unassessed state
  if (totalDistinctEvidenceCount === 0) {
    const userSelected = (userContext.selectedTopics || []).map(normalizeTopicName).includes(canonicalTopic);
    return {
      topic: canonicalTopic,
      state: LEARNING_STATE.UNASSESSED,
      confidence: CONFIDENCE_LEVEL.NONE,
      masteryScore: null,
      accuracyPercentage: null,
      sampleSize: 0,
      distinctProblemsSolved: 0,
      distinctProblemsAttempted: 0,
      quizPassCount: 0,
      diagnosticQuestionCount: 0,
      freshnessScore: 1.0,
      isGoalAligned: userSelected,
      rationale: userSelected
        ? `Selected as a focus topic in your profile, but no diagnostic or practice evidence has been recorded yet.`
        : `No diagnostic questions, quizzes, or practice submissions recorded for this topic.`,
      limitations: ['No verified performance data exists for this topic.'],
      evidenceBreakdown: {
        diagnostic: { count: 0, correct: 0, accuracy: null },
        practice: {
          distinctSolved: 0,
          distinctAttempted: 0,
          totalSubmissions: codeSubmissions.length + problemAttempts.length,
          solvedDifficulty: solvedDifficultyCounts
        },
        quiz: { attempts: 0, passed: 0, distinctPassed: 0 }
      }
    };
  }

  // 5. Compute Weighted Scoring with Modality, Difficulty & Time Decay
  let totalWeightedScore = 0;
  let totalWeight = 0;
  let freshnessAccumulator = 0;
  let evidenceItemCount = 0;

  // (a) Diagnostic Questions
  for (const dq of diagAnswered) {
    const freshness = calculateFreshnessWeight(dq.timestamp, referenceDate);
    const diffWeight = getDifficultyWeight(dq.difficulty || 'Medium');
    const w = MODALITY_WEIGHT.DIAGNOSTIC * diffWeight * freshness;

    const score = dq.isCorrect ? 1.0 : 0.0;
    totalWeightedScore += score * w;
    totalWeight += w;
    freshnessAccumulator += freshness;
    evidenceItemCount++;
  }

  // (b) Practice Problems (Evaluated per distinct problem)
  for (const slug of attemptedProblemSlugs) {
    const isSolved = solvedProblemSlugs.has(slug);
    const submissionsForSlug = problemSubmissionsMap.get(slug) || [];
    const latestSub = submissionsForSlug[0] || {};
    const freshness = calculateFreshnessWeight(latestSub.createdAt, referenceDate);
    const diffWeight = getDifficultyWeight(latestSub.difficulty || 'Medium');
    const w = MODALITY_WEIGHT.PRACTICE_CODE * diffWeight * freshness;

    // Credit solved problems, partial credit for high test-pass ratio
    let score = isSolved ? 1.0 : 0.0;
    if (!isSolved && latestSub.totalTests > 0 && latestSub.passedTests > 0) {
      score = (latestSub.passedTests / latestSub.totalTests) * 0.5; // partial credit up to 50%
    }

    totalWeightedScore += score * w;
    totalWeight += w;
    freshnessAccumulator += freshness;
    evidenceItemCount++;
  }

  // (c) Quiz Attempts
  for (const qa of quizAttempts) {
    const freshness = calculateFreshnessWeight(qa.submittedAt || qa.createdAt, referenceDate);
    const diffWeight = getDifficultyWeight(qa.difficulty || 'Medium');
    const w = MODALITY_WEIGHT.QUIZ * diffWeight * freshness;

    // Normalizing percentage to 0.0 - 1.0
    const pct = typeof qa.percentage === 'number' ? Math.max(0, Math.min(100, qa.percentage)) : 0;
    const score = pct / 100;

    totalWeightedScore += score * w;
    totalWeight += w;
    freshnessAccumulator += freshness;
    evidenceItemCount++;
  }

  const weightedAccuracyRatio = totalWeight > 0 ? (totalWeightedScore / totalWeight) : 0;
  const weightedPercentage = Math.round(weightedAccuracyRatio * 100);
  const averageFreshness = evidenceItemCount > 0 ? Math.round((freshnessAccumulator / evidenceItemCount) * 100) / 100 : 1.0;

  // 6. Check for Repeated Submissions Bias
  const totalSubmissions = codeSubmissions.length + problemAttempts.length;
  if (totalSubmissions >= 5 && attemptedProblemSlugs.size === 1) {
    limitations.push(`Multiple submissions (${totalSubmissions}) recorded on a single problem (${Array.from(attemptedProblemSlugs)[0]}). Breadth of problem-solving is limited.`);
  }

  // 7. Check for Stale Evidence Warning
  if (averageFreshness <= 0.65) {
    limitations.push(`Evidence for this topic is older than 30 days (freshness index: ${averageFreshness}). A refresher assessment is recommended.`);
  }

  // 8. Audit Small Sample Size Guard (< 2 distinct samples)
  if (totalDistinctEvidenceCount < 2) {
    limitations.push(`Sample size is insufficient (${totalDistinctEvidenceCount} item evaluated; minimum 2 required).`);
    return {
      topic: canonicalTopic,
      state: LEARNING_STATE.INSUFFICIENT_EVIDENCE,
      confidence: CONFIDENCE_LEVEL.LOW,
      masteryScore: weightedPercentage,
      accuracyPercentage: weightedPercentage,
      sampleSize: totalDistinctEvidenceCount,
      distinctProblemsSolved: solvedProblemSlugs.size,
      distinctProblemsAttempted: attemptedProblemSlugs.size,
      quizPassCount: distinctQuizzesPassed,
      diagnosticQuestionCount: diagAnswered.length,
      freshnessScore: averageFreshness,
      isGoalAligned: (userContext.selectedTopics || []).map(normalizeTopicName).includes(canonicalTopic),
      rationale: `Only ${totalDistinctEvidenceCount} evidence item recorded for ${canonicalTopic}. Additional practice or assessment is needed to establish a defensible baseline.`,
      limitations,
      evidenceBreakdown: {
        diagnostic: {
          count: diagAnswered.length,
          correct: diagCorrect.length,
          accuracy: diagAnswered.length > 0 ? Math.round((diagCorrect.length / diagAnswered.length) * 100) : null
        },
        practice: {
          distinctSolved: solvedProblemSlugs.size,
          distinctAttempted: attemptedProblemSlugs.size,
          totalSubmissions,
          solvedDifficulty: solvedDifficultyCounts
        },
        quiz: { attempts: quizAttempts.length, passed: passedQuizzes.length, distinctPassed: distinctQuizzesPassed }
      }
    };
  }

  // 9. Assign Confidence Level
  let confidence = CONFIDENCE_LEVEL.LOW;
  const hasMultiModality = (diagAnswered.length > 0 && solvedProblemSlugs.size > 0) ||
                           (quizAttempts.length > 0 && solvedProblemSlugs.size > 0);

  if (totalDistinctEvidenceCount >= 6 && hasMultiModality) {
    confidence = CONFIDENCE_LEVEL.HIGH;
  } else if (totalDistinctEvidenceCount >= 3) {
    confidence = CONFIDENCE_LEVEL.MODERATE;
  } else {
    confidence = CONFIDENCE_LEVEL.LOW;
  }

  // 10. Infer Topic Learning State
  let state = LEARNING_STATE.DEVELOPING;
  let rationale = '';

  const hasMediumOrHardSolved = (solvedDifficultyCounts.Medium + solvedDifficultyCounts.Hard) > 0;

  if (weightedPercentage < 50) {
    state = LEARNING_STATE.STRUGGLING;
    rationale = `Observed accuracy (${weightedPercentage}%) indicates foundational concept gaps across ${totalDistinctEvidenceCount} evaluated items. Foundational review is recommended.`;
  } else if (weightedPercentage >= 85 && (totalDistinctEvidenceCount >= 4 || hasMediumOrHardSolved)) {
    // Requires both high accuracy AND demonstrating problem-solving on harder challenges or multiple items
    state = LEARNING_STATE.MASTERED;
    rationale = `Demonstrated high accuracy (${weightedPercentage}%) across ${totalDistinctEvidenceCount} distinct items including Medium/Hard problem-solving. Concepts appear solid.`;
  } else if (weightedPercentage >= 75) {
    state = LEARNING_STATE.PROFICIENT;
    rationale = `Consistent performance (${weightedPercentage}% accuracy) across ${totalDistinctEvidenceCount} evaluated items. Ready for more challenging problem sets.`;
  } else {
    // 50% to 74%
    state = LEARNING_STATE.DEVELOPING;
    rationale = `Demonstrated partial competence (${weightedPercentage}% accuracy across ${totalDistinctEvidenceCount} items). Core concepts are emerging; continued practice will solidify proficiency.`;
  }

  return {
    topic: canonicalTopic,
    state,
    confidence,
    masteryScore: weightedPercentage,
    accuracyPercentage: weightedPercentage,
    sampleSize: totalDistinctEvidenceCount,
    distinctProblemsSolved: solvedProblemSlugs.size,
    distinctProblemsAttempted: attemptedProblemSlugs.size,
    quizPassCount: distinctQuizzesPassed,
    diagnosticQuestionCount: diagAnswered.length,
    freshnessScore: averageFreshness,
    isGoalAligned: (userContext.selectedTopics || []).map(normalizeTopicName).includes(canonicalTopic),
    rationale,
    limitations,
    evidenceBreakdown: {
      diagnostic: {
        count: diagAnswered.length,
        correct: diagCorrect.length,
        accuracy: diagAnswered.length > 0 ? Math.round((diagCorrect.length / diagAnswered.length) * 100) : null
      },
      practice: {
        distinctSolved: solvedProblemSlugs.size,
        distinctAttempted: attemptedProblemSlugs.size,
        totalSubmissions,
        solvedDifficulty: solvedDifficultyCounts
      },
      quiz: { attempts: quizAttempts.length, passed: passedQuizzes.length, distinctPassed: distinctQuizzesPassed }
    }
  };
}

/**
 * Fetches and synthesizes complete authenticated learner intelligence from MongoDB.
 *
 * @param {string} userId - Authenticated user ObjectId string
 * @param {Date} [referenceDate=new Date()]
 * @returns {Promise<Object>} Comprehensive Learner Intelligence Model
 */
export async function getLearnerIntelligence(userId, referenceDate = new Date()) {
  if (!userId) {
    throw new Error('User ID is required for intelligence evaluation.');
  }

  // 1. Fetch User Profile
  const user = await User.findById(userId)
    .select('learningGoals languages preferredStartingMode selectedTopics experience interests')
    .lean();

  if (!user) {
    throw new Error('User not found.');
  }

  // 2. Query All Evidence Sources Concurrently
  const [diagnosticSessions, codeSubmissions, problemAttempts, quizAttempts] = await Promise.all([
    DiagnosticSession.find({ user: userId, status: 'submitted' })
      .select('questions selectedAnswers topicResults assessedTopics unassessedTopics score maxScore percentage submittedAt')
      .sort({ submittedAt: -1 })
      .lean(),
    Submission.find({ user: userId })
      .populate('problem', 'title slug topic topics difficulty')
      .select('problem verdict passedTests totalTests language executionDuration createdAt')
      .sort({ createdAt: -1 })
      .lean(),
    ProblemAttempt.find({ user: userId })
      .populate('problem', 'title slug topic topics difficulty')
      .select('problem status executionTime createdAt')
      .sort({ createdAt: -1 })
      .lean(),
    QuizAttempt.find({ user: userId, status: { $in: ['submitted', 'completed'] } })
      .select('quizId quizTitle topic difficulty score maxScore percentage isPassed correctAnswers incorrectAnswers submittedAt createdAt')
      .sort({ submittedAt: -1, createdAt: -1 })
      .lean()
  ]);

  // 3. Bucket Evidence by Canonical Topic
  const topicEvidenceMap = new Map();

  function ensureTopicEntry(topicName) {
    const canonical = normalizeTopicName(topicName);
    if (!topicEvidenceMap.has(canonical)) {
      topicEvidenceMap.set(canonical, {
        topic: canonical,
        diagnosticQuestions: [],
        codeSubmissions: [],
        problemAttempts: [],
        quizAttempts: []
      });
    }
    return topicEvidenceMap.get(canonical);
  }

  // Seed with all known canonical topics and user's selected topics
  Object.values(CANONICAL_TOPICS).forEach((t) => ensureTopicEntry(t));
  if (Array.isArray(user.selectedTopics)) {
    user.selectedTopics.forEach((t) => ensureTopicEntry(t));
  }

  // (a) Populate Diagnostic Questions
  for (const session of diagnosticSessions) {
    const answerMap = new Map();
    for (const ans of session.selectedAnswers || []) {
      answerMap.set(ans.questionId, ans);
    }

    for (const q of session.questions || []) {
      const entry = ensureTopicEntry(q.topic);
      const answer = answerMap.get(q.questionId);
      entry.diagnosticQuestions.push({
        questionId: q.questionId,
        topic: q.topic,
        difficulty: q.difficulty,
        selectedOption: answer ? answer.selectedOption : (q.selectedOption ?? null),
        isCorrect: answer ? Boolean(answer.isCorrect) : Boolean(q.isCorrect),
        timestamp: session.submittedAt || session.createdAt
      });
    }
  }

  // (b) Populate Code Submissions
  for (const sub of codeSubmissions) {
    if (!sub.problem) continue;
    const probTopic = sub.problem.topic || sub.problem.topics?.[0] || 'General';
    const entry = ensureTopicEntry(probTopic);
    entry.codeSubmissions.push({
      problemId: sub.problem._id.toString(),
      problemSlug: sub.problem.slug,
      problemTitle: sub.problem.title,
      difficulty: sub.problem.difficulty || 'Medium',
      verdict: sub.verdict,
      passedTests: sub.passedTests || 0,
      totalTests: sub.totalTests || 0,
      language: sub.language,
      createdAt: sub.createdAt
    });
  }

  // (c) Populate Problem Attempts
  for (const att of problemAttempts) {
    if (!att.problem) continue;
    const probTopic = att.problem.topic || att.problem.topics?.[0] || 'General';
    const entry = ensureTopicEntry(probTopic);
    entry.problemAttempts.push({
      problemId: att.problem._id.toString(),
      problemSlug: att.problem.slug,
      problemTitle: att.problem.title,
      difficulty: att.problem.difficulty || 'Medium',
      status: att.status,
      createdAt: att.createdAt
    });
  }

  // (d) Populate Quiz Attempts
  for (const qa of quizAttempts) {
    const entry = ensureTopicEntry(qa.topic);
    entry.quizAttempts.push({
      quizId: qa.quizId,
      title: qa.quizTitle,
      difficulty: qa.difficulty || 'Medium',
      score: qa.score || 0,
      maxScore: qa.maxScore || 0,
      percentage: qa.percentage || 0,
      isPassed: Boolean(qa.isPassed),
      submittedAt: qa.submittedAt || qa.createdAt
    });
  }

  // 4. Compute Topic State for Each Topic
  const topicStates = [];
  const countsByState = {
    [LEARNING_STATE.UNASSESSED]: 0,
    [LEARNING_STATE.INSUFFICIENT_EVIDENCE]: 0,
    [LEARNING_STATE.STRUGGLING]: 0,
    [LEARNING_STATE.DEVELOPING]: 0,
    [LEARNING_STATE.PROFICIENT]: 0,
    [LEARNING_STATE.MASTERED]: 0
  };

  let totalMasterySum = 0;
  let evaluatedTopicsCount = 0;

  for (const [, rawData] of topicEvidenceMap.entries()) {
    const evaluated = computeTopicLearningState(rawData, user, referenceDate);
    topicStates.push(evaluated);
    countsByState[evaluated.state]++;

    if (evaluated.masteryScore !== null && evaluated.state !== LEARNING_STATE.UNASSESSED) {
      totalMasterySum += evaluated.masteryScore;
      evaluatedTopicsCount++;
    }
  }

  // 5. Sort Topics by Priority (Struggling -> Developing -> Insufficient -> Unassessed -> Proficient -> Mastered)
  const STATE_ORDER = {
    [LEARNING_STATE.STRUGGLING]: 1,
    [LEARNING_STATE.INSUFFICIENT_EVIDENCE]: 2,
    [LEARNING_STATE.DEVELOPING]: 3,
    [LEARNING_STATE.UNASSESSED]: 4,
    [LEARNING_STATE.PROFICIENT]: 5,
    [LEARNING_STATE.MASTERED]: 6
  };

  topicStates.sort((a, b) => {
    const orderDiff = (STATE_ORDER[a.state] || 99) - (STATE_ORDER[b.state] || 99);
    if (orderDiff !== 0) return orderDiff;
    // Tie breaker 1: Goal aligned first
    if (a.isGoalAligned !== b.isGoalAligned) return a.isGoalAligned ? -1 : 1;
    // Tie breaker 2: Alphabetical
    return a.topic.localeCompare(b.topic);
  });

  // 6. Global Competency Metrics
  const overallMasteryScore = evaluatedTopicsCount > 0 ? Math.round(totalMasterySum / evaluatedTopicsCount) : null;

  const topicsNeedingAttention = topicStates
    .filter((t) => t.state === LEARNING_STATE.STRUGGLING || t.state === LEARNING_STATE.INSUFFICIENT_EVIDENCE)
    .map((t) => t.topic);

  const strongestTopics = topicStates
    .filter((t) => t.state === LEARNING_STATE.MASTERED || t.state === LEARNING_STATE.PROFICIENT)
    .map((t) => t.topic);

  return {
    learnerId: userId,
    calculatedAt: referenceDate,
    intentProfile: {
      goals: user.learningGoals || [],
      declaredLanguages: user.languages || [],
      startingMode: user.preferredStartingMode || 'practice',
      selectedTopics: (user.selectedTopics || []).map(normalizeTopicName),
      experienceTier: user.experience || 'Beginner'
    },
    overview: {
      overallMasteryScore,
      evaluatedTopicsCount,
      totalKnownTopics: topicStates.length,
      countsByState,
      strongestTopics,
      topicsNeedingAttention
    },
    topicStates,
    limitations: GLOBAL_INTELLIGENCE_LIMITATIONS
  };
}
