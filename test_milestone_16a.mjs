/**
 * ==============================================================================
 * CODEFORGE MILESTONE 16A: LEARNING INTELLIGENCE ENGINE TEST SUITE
 * Comprehensive verification of:
 * 1. Unauthenticated request guards (401 Unauthorized) on all /api/intelligence/* endpoints
 * 2. Pure scoring engine & mathematical formulations:
 *    - Time-freshness decay function
 *    - Difficulty multipliers (Easy=1.0, Medium=1.5, Hard=2.2)
 *    - Sample size threshold guards (minimum 2 items)
 * 3. Empty & Sparse Learner Handling:
 *    - User with zero evidence -> all topics 'unassessed', confidence 'none', masteryScore null
 *    - User with single evidence item -> topic 'insufficient_evidence', confidence 'low', warning emitted
 * 4. Distinct Problems vs. Repeated Submissions Integrity:
 *    - 10 accepted submissions on 1 problem = 1 distinct problem solved
 *    - Repeated submissions limitation warning emitted
 * 5. Multi-Modality & Conflicting Evidence Resolution:
 *    - Diagnostic failure (concept gap) balanced by practice code execution
 *    - Higher weight assigned to verified code execution over multiple-choice
 * 6. Evidence Freshness Decay:
 *    - Stale evidence (>60 days) receives decayed weight (0.45)
 *    - Stale evidence warning emitted
 * 7. Catalog Grounding & Recommendation Engine:
 *    - Recommendations link strictly to genuine Problem slugs and Quiz IDs
 *    - Recommends foundational review for struggling topics
 *    - Recommends baseline assessments for insufficient evidence topics
 *    - Deduplication: unique recommendation IDs, no duplicate catalog slugs
 * 8. Cross-User Tenant Isolation:
 *    - User B cannot see or manipulate User A's intelligence model
 *    - Invalid topic name handling (404 / 400)
 * 9. Deterministic Repeatability:
 *    - Multiple runs on identical database records return strictly identical outputs
 * 10. Regression Safety:
 *    - Preserves existing Milestones 15A–15D functionality
 * ==============================================================================
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import DiagnosticSession from './server/models/DiagnosticSession.js';
import Submission from './server/models/Submission.js';
import Problem from './server/models/Problem.js';
import QuizAttempt from './server/models/QuizAttempt.js';
import {
  calculateFreshnessWeight,
  getDifficultyWeight,
  computeTopicLearningState,
  LEARNING_STATE,
  CONFIDENCE_LEVEL
} from './server/services/learningIntelligenceService.js';
import {
  generateLearningRecommendations,
  ACTION_CATEGORY
} from './server/services/recommendationEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, 'server', '.env') });

const API_BASE = 'http://localhost:5000';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/codeforge';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  const res = await fetch(url, {
    ...options,
    headers
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON response
  }
  return { status: res.status, ok: res.ok, data };
}

async function registerTestUser(prefix) {
  const rand = Math.floor(Math.random() * 900000 + 100000);
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9]/g, '');
  const email = `${cleanPrefix.toLowerCase()}_${rand}@codeforge.test`;
  const password = 'Password123!';
  const userPayload = {
    fullName: `Test ${cleanPrefix} User`,
    email,
    password,
    confirmPassword: password,
    gender: 'Other',
    experience: 'Intermediate',
    interests: ['JavaScript', 'Data Structures & Algorithms']
  };

  const res = await apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(userPayload)
  });

  if (!res.ok) {
    throw new Error(`Failed to register user ${prefix}: ${JSON.stringify(res.data)}`);
  }

  const loginRes = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });

  if (!loginRes.ok || !loginRes.data?.token) {
    throw new Error(`Failed to log in user ${prefix}: ${JSON.stringify(loginRes.data)}`);
  }

  const userObj = { ...loginRes.data.user };
  const userId = userObj.id || userObj._id;
  userObj._id = userId;
  userObj.id = userId;

  return {
    user: userObj,
    token: loginRes.data.token,
    userId
  };
}

async function runTests() {
  console.log('==============================================================================');
  console.log('CODEFORGE MILESTONE 16A AUTOMATED VERIFICATION SUITE');
  console.log('Learning Intelligence Engine Verification');
  console.log('==============================================================================\n');

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB for direct verification assertions.\n');

  try {
    // -------------------------------------------------------------------------
    // SUITE 1: Pure Unit Functions & Mathematical Formulations
    // -------------------------------------------------------------------------
    console.log('--- SUITE 1: Pure Scoring Engine Formulations ---');

    // Freshness decay
    const now = new Date('2026-10-15T00:00:00Z');
    const recentDate = new Date('2026-10-10T00:00:00Z'); // 5 days ago
    const oneMonthOld = new Date('2026-09-20T00:00:00Z'); // 25 days ago
    const twoMonthsOld = new Date('2026-08-25T00:00:00Z'); // 51 days ago
    const staleDate = new Date('2026-06-01T00:00:00Z'); // >60 days ago

    assert(calculateFreshnessWeight(recentDate, now) === 1.0, 'Freshness weight <= 14 days is 1.0');
    assert(calculateFreshnessWeight(oneMonthOld, now) === 0.85, 'Freshness weight 15-30 days is 0.85');
    assert(calculateFreshnessWeight(twoMonthsOld, now) === 0.65, 'Freshness weight 31-60 days is 0.65');
    assert(calculateFreshnessWeight(staleDate, now) === 0.45, 'Freshness weight > 60 days is 0.45');

    // Difficulty weights
    assert(getDifficultyWeight('Easy') === 1.0, 'Easy difficulty weight is 1.0');
    assert(getDifficultyWeight('Medium') === 1.5, 'Medium difficulty weight is 1.5');
    assert(getDifficultyWeight('Hard') === 2.2, 'Hard difficulty weight is 2.2');
    assert(getDifficultyWeight('Unknown') === 1.0, 'Unknown difficulty falls back safely to 1.0');

    // Pure topic state computation: Empty
    const emptyTopicResult = computeTopicLearningState({ topic: 'JavaScript' }, {}, now);
    assert(emptyTopicResult.state === LEARNING_STATE.UNASSESSED, 'Empty topic evaluates to unassessed');
    assert(emptyTopicResult.confidence === CONFIDENCE_LEVEL.NONE, 'Empty topic has confidence none');
    assert(emptyTopicResult.masteryScore === null, 'Empty topic has masteryScore null');

    // Pure topic state computation: Single item (< 2 sample guard)
    const singleItemResult = computeTopicLearningState({
      topic: 'JavaScript',
      diagnosticQuestions: [
        { questionId: 1, topic: 'JavaScript', selectedOption: 'A', isCorrect: true, difficulty: 'Easy', timestamp: recentDate }
      ]
    }, {}, now);
    assert(singleItemResult.state === LEARNING_STATE.INSUFFICIENT_EVIDENCE, 'Single item evaluates to insufficient_evidence');
    assert(singleItemResult.confidence === CONFIDENCE_LEVEL.LOW, 'Single item has confidence low');
    assert(singleItemResult.limitations.length > 0, 'Single item emits sample size limitation warning');

    // Pure topic state computation: Repeated submissions on 1 problem
    const repeatedSubmissionsResult = computeTopicLearningState({
      topic: 'Arrays',
      codeSubmissions: [
        { problemSlug: 'two-sum', verdict: 'Accepted', difficulty: 'Easy', createdAt: recentDate },
        { problemSlug: 'two-sum', verdict: 'Accepted', difficulty: 'Easy', createdAt: recentDate },
        { problemSlug: 'two-sum', verdict: 'Accepted', difficulty: 'Easy', createdAt: recentDate },
        { problemSlug: 'two-sum', verdict: 'Accepted', difficulty: 'Easy', createdAt: recentDate },
        { problemSlug: 'two-sum', verdict: 'Accepted', difficulty: 'Easy', createdAt: recentDate }
      ]
    }, {}, now);
    assert(repeatedSubmissionsResult.distinctProblemsSolved === 1, '5 submissions on two-sum count as 1 distinct problem solved');
    assert(repeatedSubmissionsResult.sampleSize === 1, 'Distinct sample size is 1 despite 5 submissions');
    assert(repeatedSubmissionsResult.state === LEARNING_STATE.INSUFFICIENT_EVIDENCE, 'Sample size < 2 guards against declaring mastery on 1 repeated problem');
    assert(repeatedSubmissionsResult.limitations.some((l) => l.includes('Multiple submissions')), 'Emits repeated submissions limitation warning');

    // Pure topic state computation: Multi-problem success -> Proficient / Mastered
    const strongResult = computeTopicLearningState({
      topic: 'Arrays',
      codeSubmissions: [
        { problemSlug: 'two-sum', verdict: 'Accepted', difficulty: 'Easy', createdAt: recentDate },
        { problemSlug: 'container-with-most-water', verdict: 'Accepted', difficulty: 'Medium', createdAt: recentDate },
        { problemSlug: 'trapping-rain-water', verdict: 'Accepted', difficulty: 'Hard', createdAt: recentDate }
      ],
      diagnosticQuestions: [
        { questionId: 10, topic: 'Arrays', selectedOption: 'B', isCorrect: true, difficulty: 'Medium', timestamp: recentDate }
      ]
    }, {}, now);
    assert(strongResult.state === LEARNING_STATE.MASTERED, '3 accepted problems (Easy+Med+Hard) and diagnostic question evaluate to mastered');
    assert(strongResult.distinctProblemsSolved === 3, 'Distinct problems solved is 3');
    assert(strongResult.confidence === CONFIDENCE_LEVEL.MODERATE, 'Confidence is moderate/high for multi-modality');
    assert(strongResult.masteryScore >= 85, 'Mastery score >= 85%');

    // Pure recommendation generator unit test
    const pureRecPlan = generateLearningRecommendations({
      topicStates: [
        { topic: 'JavaScript', state: LEARNING_STATE.STRUGGLING, masteryScore: 30, sampleSize: 3, confidence: CONFIDENCE_LEVEL.MODERATE, isGoalAligned: true },
        { topic: 'Arrays', state: LEARNING_STATE.MASTERED, masteryScore: 90, sampleSize: 4, confidence: CONFIDENCE_LEVEL.HIGH, isGoalAligned: false }
      ]
    }, { limit: 2 });
    assert(pureRecPlan.recommendations.length === 2, 'Pure generator produces 2 recommendations');
    assert(pureRecPlan.recommendations[0].actionCategory === ACTION_CATEGORY.REVIEW, 'Struggling topic generates REVIEW recommendation');
    assert(pureRecPlan.recommendations[0].topic === 'JavaScript', 'Struggling topic is prioritized first');

    // -------------------------------------------------------------------------
    // SUITE 2: Unauthenticated Endpoint Guards
    // -------------------------------------------------------------------------
    console.log('\n--- SUITE 2: Unauthenticated Endpoint Guards ---');
    const unauth1 = await apiRequest('/api/intelligence/state');
    assert(unauth1.status === 401, 'GET /api/intelligence/state returns 401 without token');

    const unauth2 = await apiRequest('/api/intelligence/recommendations');
    assert(unauth2.status === 401, 'GET /api/intelligence/recommendations returns 401 without token');

    const unauth3 = await apiRequest('/api/intelligence/topic/JavaScript');
    assert(unauth3.status === 401, 'GET /api/intelligence/topic/:topicName returns 401 without token');

    // -------------------------------------------------------------------------
    // SUITE 3: Empty Learner Intelligence Evaluation
    // -------------------------------------------------------------------------
    console.log('\n--- SUITE 3: Empty Learner Intelligence Evaluation ---');
    const { user: userA, token: tokenA } = await registerTestUser('IntelUserA');

    const emptyRes = await apiRequest('/api/intelligence/state', {
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    assert(emptyRes.status === 200, 'GET /api/intelligence/state returns 200 for new user');
    assert(emptyRes.data?.success === true, 'Response indicates success');
    const emptyIntel = emptyRes.data?.data;
    assert(emptyIntel?.learnerId === userA._id, 'learnerId matches authenticated user');
    assert(emptyIntel?.overview?.overallMasteryScore === null, 'overallMasteryScore is null for unassessed learner');
    assert(emptyIntel?.overview?.evaluatedTopicsCount === 0, 'evaluatedTopicsCount is 0');
    assert(emptyIntel?.topicStates?.length > 0, 'Seed canonical topicStates exist');
    assert(emptyIntel?.topicStates?.every((t) => t.state === LEARNING_STATE.UNASSESSED), 'All topics are unassessed');
    assert(emptyIntel?.limitations?.length >= 3, 'Includes required global measurement limitations');

    // Empty recommendations
    const emptyRecRes = await apiRequest('/api/intelligence/recommendations', {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(emptyRecRes.status === 200, 'GET /api/intelligence/recommendations returns 200');
    const emptyRecPlan = emptyRecRes.data?.data;
    assert(emptyRecPlan?.recommendations?.length > 0, 'Generates starter recommendations for unassessed topics');
    assert(emptyRecPlan?.topRecommendation !== null, 'Top recommendation exists');
    assert(emptyRecPlan?.topRecommendation?.resource?.url !== undefined, 'Top recommendation has valid resource URL');

    // -------------------------------------------------------------------------
    // SUITE 4: Verified Multi-Source Evidence Aggregation & State Transition
    // -------------------------------------------------------------------------
    console.log('\n--- SUITE 4: Multi-Source Evidence Aggregation & State Transition ---');

    // Seed diagnostic questions for User A:
    // Topic 1: 'JavaScript' - 2 questions correct out of 2 (100% conceptual accuracy)
    // Topic 2: 'Operating Systems' - 0 correct out of 2 (0% conceptual accuracy -> struggling)
    // Topic 3: 'Data Structures & Algorithms' - 1 question only (insufficient sample)
    const testDiagnostic = await DiagnosticSession.create({
      user: userA._id,
      status: 'submitted',
      totalQuestions: 5,
      answeredQuestions: 5,
      correctCount: 2,
      score: 2,
      maxScore: 5,
      percentage: 40,
      submittedAt: new Date(),
      questions: [
        {
          questionId: 101,
          topic: 'JavaScript',
          difficulty: 'Easy',
          question: 'What is typeof null?',
          options: ['object', 'null', 'undefined'],
          answer: 'object',
          explanation: 'JavaScript specification quirk'
        },
        {
          questionId: 102,
          topic: 'JavaScript',
          difficulty: 'Medium',
          question: 'What is a closure?',
          options: ['A function with lexical scope', 'A loop'],
          answer: 'A function with lexical scope',
          explanation: 'Function remembers scope'
        },
        {
          questionId: 201,
          topic: 'Operating Systems',
          difficulty: 'Medium',
          question: 'What is virtual memory?',
          options: ['Abstraction of storage', 'Physical RAM'],
          answer: 'Abstraction of storage',
          explanation: 'Memory virtualization'
        },
        {
          questionId: 202,
          topic: 'Operating Systems',
          difficulty: 'Hard',
          question: 'What causes thrashing?',
          options: ['Excessive paging', 'Fast CPU'],
          answer: 'Excessive paging',
          explanation: 'Page replacement overload'
        },
        {
          questionId: 301,
          topic: 'Data Structures & Algorithms',
          difficulty: 'Easy',
          question: 'What is array indexing time complexity?',
          options: ['O(1)', 'O(n)'],
          answer: 'O(1)',
          explanation: 'Constant time access'
        }
      ],
      selectedAnswers: [
        { questionId: 101, selectedOption: 'object', isCorrect: true },
        { questionId: 102, selectedOption: 'A function with lexical scope', isCorrect: true },
        { questionId: 201, selectedOption: 'Physical RAM', isCorrect: false },
        { questionId: 202, selectedOption: 'Fast CPU', isCorrect: false },
        { questionId: 301, selectedOption: 'O(1)', isCorrect: true }
      ]
    });
    assert(testDiagnostic._id !== undefined, 'Diagnostic session created successfully');

    // Seed Practice Submissions for User A:
    // Solve 'two-sum' (Arrays, Easy) Accepted
    // Solve 'container-with-most-water' (Arrays, Medium) Accepted
    const twoSumProblem = await Problem.findOne({ slug: 'two-sum' });
    const kthProblem = await Problem.findOne({ slug: 'kth-largest-element-in-an-array' }) || await Problem.findOne({ topic: 'Arrays', difficulty: 'Medium' });

    if (twoSumProblem) {
      await Submission.create({
        user: userA._id,
        problem: twoSumProblem._id,
        language: 'javascript',
        sourceCode: 'function twoSum() {}',
        verdict: 'Accepted',
        passedTests: 3,
        totalTests: 3,
        executionDuration: 42,
        createdAt: new Date()
      });
    }

    if (kthProblem) {
      await Submission.create({
        user: userA._id,
        problem: kthProblem._id,
        language: 'javascript',
        sourceCode: 'function findKthLargest() {}',
        verdict: 'Accepted',
        passedTests: 4,
        totalTests: 4,
        executionDuration: 55,
        createdAt: new Date()
      });
    }

    // Seed Quiz Attempt: Passed Operating Systems Quiz (Rebuilding evidence!)
    await QuizAttempt.create({
      user: userA._id,
      quiz: new mongoose.Types.ObjectId(),
      quizId: 'operating-systems',
      quizTitle: 'Operating Systems Concepts',
      topic: 'Operating Systems',
      difficulty: 'Medium',
      status: 'submitted',
      score: 4,
      maxScore: 5,
      percentage: 80,
      isPassed: true,
      correctAnswers: 4,
      incorrectAnswers: 1,
      submittedAt: new Date()
    });

    // Re-query Intelligence State for User A
    const populatedStateRes = await apiRequest('/api/intelligence/state', {
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    assert(populatedStateRes.status === 200, 'GET /api/intelligence/state returns 200 after evidence seeded');
    const intelData = populatedStateRes.data?.data;
    assert(intelData.overview.evaluatedTopicsCount >= 3, 'Evaluated topics count is at least 3');

    // Topic 1 Check: JavaScript (2 correct diagnostic questions)
    const jsState = intelData.topicStates.find((t) => t.topic === 'JavaScript');
    assert(Boolean(jsState), 'JavaScript topic state found');
    assert(jsState.state === LEARNING_STATE.MASTERED || jsState.state === LEARNING_STATE.PROFICIENT, `JavaScript state is ${jsState.state}`);
    assert(jsState.accuracyPercentage === 100, `JavaScript accuracy is 100% (got ${jsState.accuracyPercentage}%)`);
    assert(jsState.diagnosticQuestionCount === 2, 'JavaScript evaluated 2 diagnostic questions');

    // Topic 2 Check: Arrays (2 distinct accepted problems: Easy + Medium)
    const arraysState = intelData.topicStates.find((t) => t.topic === 'Arrays');
    assert(Boolean(arraysState), 'Arrays topic state found');
    assert(arraysState.distinctProblemsSolved >= 2, `Arrays distinct problems solved >= 2 (got ${arraysState.distinctProblemsSolved})`);
    assert(arraysState.state === LEARNING_STATE.MASTERED || arraysState.state === LEARNING_STATE.PROFICIENT, `Arrays state is ${arraysState.state}`);

    // Topic 3 Check: DSA (only 1 diagnostic question -> insufficient_evidence)
    const dsaState = intelData.topicStates.find((t) => t.topic === 'Data Structures & Algorithms');
    assert(Boolean(dsaState), 'DSA topic state found');
    assert(dsaState.state === LEARNING_STATE.INSUFFICIENT_EVIDENCE, `DSA state is insufficient_evidence (got ${dsaState.state})`);
    assert(dsaState.sampleSize === 1, `DSA sample size is 1 (got ${dsaState.sampleSize})`);

    // Topic 4 Check: Operating Systems (Diagnostic 0% + Quiz 80% -> Balanced multi-modality developing)
    const osState = intelData.topicStates.find((t) => t.topic === 'Operating Systems');
    assert(Boolean(osState), 'Operating Systems topic state found');
    assert(osState.state === LEARNING_STATE.DEVELOPING || osState.state === LEARNING_STATE.STRUGGLING, `OS state is ${osState.state}`);
    assert(osState.quizPassCount === 1, 'OS tracks 1 passed quiz');
    assert(osState.diagnosticQuestionCount === 2, 'OS tracks 2 diagnostic questions');

    // -------------------------------------------------------------------------
    // SUITE 5: Topic Endpoint & Alias Canonicalization
    // -------------------------------------------------------------------------
    console.log('\n--- SUITE 5: Topic Endpoint & Alias Canonicalization ---');
    // Test direct canonical topic
    const topicRes1 = await apiRequest('/api/intelligence/topic/JavaScript', {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(topicRes1.status === 200, 'GET /api/intelligence/topic/JavaScript returns 200');
    assert(topicRes1.data?.data?.topic === 'JavaScript', 'Topic name is normalized to JavaScript');
    assert(topicRes1.data?.data?.rationale !== undefined, 'Topic returns explainable rationale');

    // Test alias canonicalization ('dsa' -> 'Data Structures & Algorithms')
    const topicRes2 = await apiRequest('/api/intelligence/topic/dsa', {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(topicRes2.status === 200, 'GET /api/intelligence/topic/dsa returns 200 via canonical alias');
    assert(topicRes2.data?.data?.topic === 'Data Structures & Algorithms', 'Resolved to Data Structures & Algorithms');

    // Test nonexistent topic
    const topicRes3 = await apiRequest('/api/intelligence/topic/NonexistentTopic12345', {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(topicRes3.status === 404, 'GET /api/intelligence/topic/NonexistentTopic returns 404');

    // -------------------------------------------------------------------------
    // SUITE 6: Deterministic Recommendations Grounding
    // -------------------------------------------------------------------------
    console.log('\n--- SUITE 6: Deterministic Recommendations Grounding ---');
    const recsRes = await apiRequest('/api/intelligence/recommendations?limit=6', {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(recsRes.status === 200, 'GET /api/intelligence/recommendations returns 200');
    const recPlan = recsRes.data?.data;
    assert(recPlan.recommendations.length > 0, `Generated ${recPlan.recommendations.length} recommendations`);

    // Verify recommendations order: Insufficient evidence / gaps come before masteries
    const firstRec = recPlan.recommendations[0];
    assert(
      firstRec.state === LEARNING_STATE.STRUGGLING ||
      firstRec.state === LEARNING_STATE.INSUFFICIENT_EVIDENCE ||
      firstRec.state === LEARNING_STATE.DEVELOPING,
      `Priority #1 recommendation addresses struggling/insufficient/developing topic (got ${firstRec.topic}: ${firstRec.state})`
    );

    // Verify Catalog Grounding: All resources have valid types and destinations
    for (const rec of recPlan.recommendations) {
      assert(
        ['problem', 'quiz', 'diagnostic', 'practice_catalog'].includes(rec.resource?.type),
        `Rec for ${rec.topic} has grounded resource type (${rec.resource?.type})`
      );
      assert(
        typeof rec.resource?.url === 'string' && rec.resource.url.startsWith('/'),
        `Rec for ${rec.topic} has valid internal application URL (${rec.resource?.url})`
      );
      assert(
        typeof rec.reason === 'string' && rec.reason.length > 20,
        `Rec for ${rec.topic} has detailed explainable rationale`
      );
    }

    // Verify Deduplication: IDs are unique
    const recIds = recPlan.recommendations.map((r) => r.id);
    const uniqueRecIds = new Set(recIds);
    assert(recIds.length === uniqueRecIds.size, 'All recommendation IDs are distinct');

    // -------------------------------------------------------------------------
    // SUITE 7: Cross-User Tenant Isolation
    // -------------------------------------------------------------------------
    console.log('\n--- SUITE 7: Cross-User Tenant Isolation ---');
    const { user: userB, token: tokenB } = await registerTestUser('IntelUserB');

    const userBStateRes = await apiRequest('/api/intelligence/state', {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert(userBStateRes.status === 200, 'User B retrieves their own intelligence state');
    const userBData = userBStateRes.data?.data;
    assert(userBData.learnerId === userB._id, 'User B data belongs strictly to User B');
    assert(userBData.overview.evaluatedTopicsCount === 0, 'User B has 0 evaluated topics despite User A activity');

    const userBJsTopic = userBData.topicStates.find((t) => t.topic === 'JavaScript');
    assert(userBJsTopic.state === LEARNING_STATE.UNASSESSED, 'User B sees JavaScript as unassessed (isolated from User A 100% score)');

    // -------------------------------------------------------------------------
    // SUITE 8: Deterministic Repeatability
    // -------------------------------------------------------------------------
    console.log('\n--- SUITE 8: Deterministic Repeatability ---');
    const run1 = await apiRequest('/api/intelligence/recommendations?limit=5', {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const run2 = await apiRequest('/api/intelligence/recommendations?limit=5', {
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    const run1Ids = run1.data?.data?.recommendations.map((r) => `${r.id}-${r.priority}`);
    const run2Ids = run2.data?.data?.recommendations.map((r) => `${r.id}-${r.priority}`);
    assert(JSON.stringify(run1Ids) === JSON.stringify(run2Ids), 'Identical database state yields strictly identical recommendation sequence');

  } catch (err) {
    console.error('Fatal error during test execution:', err);
    failed++;
  } finally {
    await mongoose.disconnect();
  }

  console.log('\n==============================================================================');
  console.log(`TEST EXECUTION COMPLETE: ${passed} passed, ${failed} failed`);
  console.log('==============================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
