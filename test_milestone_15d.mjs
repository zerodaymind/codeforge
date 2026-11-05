/**
 * ==============================================================================
 * CODEFORGE MILESTONE 15D: REINFORCEMENT & REASSESSMENT ENGINE TEST SUITE
 * Comprehensive verification of:
 * 1. Unauthenticated request guards (401 Unauthorized) on all reinforcement endpoints
 * 2. Cross-user tenant isolation (User A vs User B data isolation)
 * 3. Single-assessment user handling (hasComparison: false, reason: single_assessment)
 * 4. Exclusion of in-progress and abandoned diagnostic sessions
 * 5. Deterministic diagnostic comparison engine:
 *    - Overall percentage-point delta
 *    - Granular topic comparisons (sample sizes, shared vs new questions)
 *    - Conservative status classifications (encouraging_progress, further_revision_recommended, performance_stable, insufficient_sample, first_assessment, not_reassessed)
 *    - Explicit measurement limitations disclosures
 * 6. Authoritative activity outcome tracking:
 *    - Verified completions vs unverified attempts
 *    - Filter by type (practice, quiz, diagnostic) and verifiedOnly
 *    - Activity summary endpoint
 * 7. Roadmap adaptation upon reassessment:
 *    - Prior needs_revision transitions to promising on reassessment score >= 70%
 *    - Recommendations include reassessmentSummary and updated reasoning
 *    - Roadmap root includes reassessmentComparison
 * 8. Client-side tampering immunity (pure server-authoritative calculations)
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
import Quiz from './server/models/Quiz.js';
import Roadmap from './server/models/Roadmap.js';

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
    throw new Error(`Failed to login user ${prefix}: ${JSON.stringify(loginRes.data)}`);
  }

  return {
    id: loginRes.data.user.id || loginRes.data.user._id,
    token: loginRes.data.token,
    email
  };
}

async function runTestSuite() {
  console.log('==============================================================================');
  console.log('CODEFORGE MILESTONE 15D AUTOMATED VERIFICATION SUITE');
  console.log('Reinforcement & Reassessment Engine Verification');
  console.log('==============================================================================\n');

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB for direct verification assertions.\n');

  try {
    // --------------------------------------------------------------------------
    // SUITE 1: UNAUTHENTICATED GUARDS (401 Unauthorized)
    // --------------------------------------------------------------------------
    console.log('--- SUITE 1: Unauthenticated Endpoint Guards ---');
    {
      const compRes = await apiRequest('/api/reinforcement/comparison');
      assert(compRes.status === 401, 'GET /api/reinforcement/comparison returns 401 without token');

      const sessCompRes = await apiRequest('/api/reinforcement/comparison/507f1f77bcf86cd799439011');
      assert(sessCompRes.status === 401, 'GET /api/reinforcement/comparison/:sessionId returns 401 without token');

      const histRes = await apiRequest('/api/reinforcement/history');
      assert(histRes.status === 401, 'GET /api/reinforcement/history returns 401 without token');

      const summRes = await apiRequest('/api/reinforcement/summary');
      assert(summRes.status === 401, 'GET /api/reinforcement/summary returns 401 without token');
    }

    // --------------------------------------------------------------------------
    // SUITE 2: SINGLE-ASSESSMENT & EMPTY USER HANDLING
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 2: Single-Assessment & Empty User Handling ---');
    const userA = await registerTestUser('M15D_A');

    {
      // No assessments yet
      const emptyComp = await apiRequest('/api/reinforcement/comparison', {
        headers: { Authorization: `Bearer ${userA.token}` }
      });
      assert(emptyComp.status === 200, 'GET /api/reinforcement/comparison returns 200 for user with no assessments');
      assert(emptyComp.data?.data?.hasComparison === false, 'hasComparison is false when user has 0 assessments');
      assert(emptyComp.data?.data?.reason === 'no_assessments', 'reason is no_assessments');

      // Create Session 1 (Initial Diagnostic Session)
      const session1 = await DiagnosticSession.create({
        user: userA.id,
        status: 'submitted',
        score: 4,
        maxScore: 10,
        percentage: 40,
        assessedTopics: ['JavaScript', 'Data Structures & Algorithms', 'Operating Systems'],
        questions: [
          { questionId: 1, topic: 'JavaScript', question: 'JS Q1', options: ['A', 'B'], answer: 'A', explanation: 'exp 1' },
          { questionId: 2, topic: 'JavaScript', question: 'JS Q2', options: ['A', 'B'], answer: 'A', explanation: 'exp 2' },
          { questionId: 3, topic: 'Data Structures & Algorithms', question: 'DSA Q1', options: ['A', 'B'], answer: 'A', explanation: 'exp 3' },
          { questionId: 4, topic: 'Data Structures & Algorithms', question: 'DSA Q2', options: ['A', 'B'], answer: 'A', explanation: 'exp 4' },
          { questionId: 5, topic: 'Operating Systems', question: 'OS Q1', options: ['A', 'B'], answer: 'A', explanation: 'exp 5' }
        ],
        answers: [
          { questionId: 1, selectedOption: 'B', isCorrect: false, pointsAwarded: 0 },
          { questionId: 2, selectedOption: 'B', isCorrect: false, pointsAwarded: 0 },
          { questionId: 3, selectedOption: 'A', isCorrect: true, pointsAwarded: 1 },
          { questionId: 4, selectedOption: 'A', isCorrect: true, pointsAwarded: 1 },
          { questionId: 5, selectedOption: 'B', isCorrect: false, pointsAwarded: 0 }
        ],
        topicResults: [
          { topic: 'JavaScript', totalQuestions: 2, answeredQuestions: 2, correctAnswers: 0, accuracyPercentage: 0, status: 'needs_revision', explanation: 'JS gap detected' },
          { topic: 'Data Structures & Algorithms', totalQuestions: 2, answeredQuestions: 2, correctAnswers: 2, accuracyPercentage: 100, status: 'promising', explanation: 'DSA solid grasp' },
          { topic: 'Operating Systems', totalQuestions: 1, answeredQuestions: 1, correctAnswers: 0, accuracyPercentage: 0, status: 'not_enough_evidence', explanation: 'OS limited sample' }
        ],
        submittedAt: new Date(Date.now() - 86400000 * 2), // 2 days ago
        createdAt: new Date(Date.now() - 86400000 * 2)
      });

      // Now user has exactly 1 submitted assessment
      const singleComp = await apiRequest('/api/reinforcement/comparison', {
        headers: { Authorization: `Bearer ${userA.token}` }
      });
      assert(singleComp.status === 200, 'GET /api/reinforcement/comparison returns 200 with 1 assessment');
      assert(singleComp.data?.data?.hasComparison === false, 'hasComparison is false for single assessment');
      assert(singleComp.data?.data?.reason === 'single_assessment', 'reason is single_assessment');
      assert(singleComp.data?.data?.latestOverallScore?.percentage === 40, 'Returns latestOverallScore.percentage: 40');
      assert(singleComp.data?.data?.latestSessionId === session1._id.toString(), 'Returns latestSessionId');

      // Check session comparison for the single session against predecessor
      const singleSessComp = await apiRequest(`/api/reinforcement/comparison/${session1._id}`, {
        headers: { Authorization: `Bearer ${userA.token}` }
      });
      assert(singleSessComp.status === 200, 'GET /api/reinforcement/comparison/:sessionId returns 200 for initial session');
      assert(singleSessComp.data?.data?.hasComparison === false, 'hasComparison is false when session has no predecessor');
      assert(singleSessComp.data?.data?.reason === 'no_prior_assessment', 'reason is no_prior_assessment');
    }

    // --------------------------------------------------------------------------
    // SUITE 3: EXCLUSION OF IN-PROGRESS & ABANDONED SESSIONS
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 3: Exclusion of In-Progress & Abandoned Sessions ---');
    {
      // Create in-progress session
      await DiagnosticSession.create({
        user: userA.id,
        status: 'in_progress',
        score: 0,
        maxScore: 10,
        percentage: 0,
        questions: [{ questionId: 99, topic: 'JavaScript', question: 'Dummy Q', options: ['A', 'B'], answer: 'A', explanation: 'exp' }],
        topicResults: [],
        createdAt: new Date(Date.now() - 86400000)
      });

      // Create abandoned session
      await DiagnosticSession.create({
        user: userA.id,
        status: 'abandoned',
        score: 0,
        maxScore: 10,
        percentage: 0,
        questions: [{ questionId: 99, topic: 'JavaScript', question: 'Dummy Q', options: ['A', 'B'], answer: 'A', explanation: 'exp' }],
        topicResults: [],
        createdAt: new Date(Date.now() - 3600000)
      });

      // Verification: still only 1 valid assessment for comparison purposes
      const exclComp = await apiRequest('/api/reinforcement/comparison', {
        headers: { Authorization: `Bearer ${userA.token}` }
      });
      assert(exclComp.data?.data?.hasComparison === false, 'In-progress and abandoned sessions are strictly excluded from comparison');
      assert(exclComp.data?.data?.reason === 'single_assessment', 'Still reports single_assessment despite in-progress/abandoned sessions');
    }

    // --------------------------------------------------------------------------
    // SUITE 4: DETERMINISTIC REASSESSMENT COMPARISON ENGINE
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 4: Deterministic Reassessment Comparison Engine ---');
    let session2;
    {
      // Create Session 2 (Submitted Reassessment)
      // JS: improved from 0/2 (0%) to 2/2 (100%) -> delta +100pp -> encouraging_progress
      // DSA: was 2/2 (100%), now 2/2 (100%) -> delta 0pp -> performance_stable
      // OS: was 0/1 (sample <2), now 1/1 (sample <2) -> insufficient_sample
      // Computer Networks: brand new topic (2/2, 100%) -> first_assessment
      // Question overlap in JS: questionId 1 is shared, questionId 10 is new
      session2 = await DiagnosticSession.create({
        user: userA.id,
        status: 'submitted',
        score: 8,
        maxScore: 10,
        percentage: 80,
        assessedTopics: ['JavaScript', 'Data Structures & Algorithms', 'Operating Systems', 'Computer Networks'],
        questions: [
          { questionId: 1, topic: 'JavaScript', question: 'JS Q1 Shared', options: ['A', 'B'], answer: 'A', explanation: 'exp 1' },
          { questionId: 10, topic: 'JavaScript', question: 'JS Q10 New', options: ['A', 'B'], answer: 'A', explanation: 'exp 10' },
          { questionId: 3, topic: 'Data Structures & Algorithms', question: 'DSA Q1 Shared', options: ['A', 'B'], answer: 'A', explanation: 'exp 3' },
          { questionId: 11, topic: 'Data Structures & Algorithms', question: 'DSA Q11 New', options: ['A', 'B'], answer: 'A', explanation: 'exp 11' },
          { questionId: 12, topic: 'Operating Systems', question: 'OS Q12 New', options: ['A', 'B'], answer: 'A', explanation: 'exp 12' },
          { questionId: 13, topic: 'Computer Networks', question: 'CN Q13', options: ['A', 'B'], answer: 'A', explanation: 'exp 13' },
          { questionId: 14, topic: 'Computer Networks', question: 'CN Q14', options: ['A', 'B'], answer: 'A', explanation: 'exp 14' }
        ],
        answers: [
          { questionId: 1, selectedOption: 'A', isCorrect: true, pointsAwarded: 1 },
          { questionId: 10, selectedOption: 'A', isCorrect: true, pointsAwarded: 1 },
          { questionId: 3, selectedOption: 'A', isCorrect: true, pointsAwarded: 1 },
          { questionId: 11, selectedOption: 'A', isCorrect: true, pointsAwarded: 1 },
          { questionId: 12, selectedOption: 'A', isCorrect: true, pointsAwarded: 1 },
          { questionId: 13, selectedOption: 'A', isCorrect: true, pointsAwarded: 1 },
          { questionId: 14, selectedOption: 'A', isCorrect: true, pointsAwarded: 1 }
        ],
        topicResults: [
          { topic: 'JavaScript', totalQuestions: 2, answeredQuestions: 2, correctAnswers: 2, accuracyPercentage: 100, status: 'promising', explanation: 'JS improved' },
          { topic: 'Data Structures & Algorithms', totalQuestions: 2, answeredQuestions: 2, correctAnswers: 2, accuracyPercentage: 100, status: 'promising', explanation: 'DSA stable' },
          { topic: 'Operating Systems', totalQuestions: 1, answeredQuestions: 1, correctAnswers: 1, accuracyPercentage: 100, status: 'not_enough_evidence', explanation: 'OS limited' },
          { topic: 'Computer Networks', totalQuestions: 2, answeredQuestions: 2, correctAnswers: 2, accuracyPercentage: 100, status: 'promising', explanation: 'CN fresh' }
        ],
        submittedAt: new Date(),
        createdAt: new Date()
      });

      // Now query latest comparison
      const compRes = await apiRequest('/api/reinforcement/comparison', {
        headers: { Authorization: `Bearer ${userA.token}` }
      });

      assert(compRes.status === 200, 'GET /api/reinforcement/comparison returns 200');
      const comp = compRes.data?.data;
      assert(comp?.hasComparison === true, 'hasComparison is true with 2 submitted sessions');
      assert(comp?.overallDeltaPercentage === 40, `overallDeltaPercentage is +40pp (80% - 40%), received: ${comp?.overallDeltaPercentage}`);
      assert(comp?.previousOverallScore?.percentage === 40, 'previousOverallScore.percentage is 40');
      assert(comp?.currentOverallScore?.percentage === 80, 'currentOverallScore.percentage is 80');

      // Verify Topic Comparisons
      const tcList = comp?.topicComparisons || [];

      // 1. JavaScript: from 0% to 100% (delta +100pp) -> encouraging_progress
      const jsComp = tcList.find((t) => t.topic === 'JavaScript');
      assert(jsComp !== undefined, 'JavaScript topic comparison exists');
      assert(jsComp?.status === 'encouraging_progress', `JS status is encouraging_progress, got: ${jsComp?.status}`);
      assert(jsComp?.deltaPercentage === 100, `JS deltaPercentage is 100, got: ${jsComp?.deltaPercentage}`);
      assert(jsComp?.sharedQuestionsCount === 1, `JS sharedQuestionsCount is 1 (q-js-1), got: ${jsComp?.sharedQuestionsCount}`);
      assert(jsComp?.newQuestionsCount === 1, `JS newQuestionsCount is 1 (q-js-3), got: ${jsComp?.newQuestionsCount}`);

      // 2. Data Structures & Algorithms: from 100% to 100% (delta 0pp) -> performance_stable
      const dsaComp = tcList.find((t) => t.topic === 'Data Structures & Algorithms');
      assert(dsaComp !== undefined, 'DSA topic comparison exists');
      assert(dsaComp?.status === 'performance_stable', `DSA status is performance_stable, got: ${dsaComp?.status}`);
      assert(dsaComp?.deltaPercentage === 0, `DSA deltaPercentage is 0, got: ${dsaComp?.deltaPercentage}`);

      // 3. Operating Systems: sample size 1 in both sessions (< 2) -> insufficient_sample
      const osComp = tcList.find((t) => t.topic === 'Operating Systems');
      assert(osComp !== undefined, 'OS topic comparison exists');
      assert(osComp?.status === 'insufficient_sample', `OS status is insufficient_sample due to sample size < 2, got: ${osComp?.status}`);
      assert(osComp?.deltaPercentage === null, 'OS deltaPercentage is null due to insufficient sample size');

      // 4. Computer Networks: new in session 2 -> first_assessment
      const cnComp = tcList.find((t) => t.topic === 'Computer Networks');
      assert(cnComp !== undefined, 'Computer Networks topic comparison exists');
      assert(cnComp?.status === 'first_assessment', `CN status is first_assessment, got: ${cnComp?.status}`);

      // 5. Explicit Limitations Disclosures
      assert(Array.isArray(comp?.limitations) && comp.limitations.length >= 4, 'Includes required measurement limitations');
      const limitText = comp.limitations.join(' ');
      assert(limitText.includes('different prompt contexts') || limitText.includes('sample questions dynamically'), 'Discloses dynamic question sampling');
      assert(limitText.includes('causally attributed') || limitText.includes('causal'), 'Discloses non-causal claims limitation');
      assert(limitText.includes('prompt familiarity'), 'Discloses prompt familiarity limitation');

      // Verify specific session comparison endpoint
      const sessCompRes = await apiRequest(`/api/reinforcement/comparison/${session2._id}`, {
        headers: { Authorization: `Bearer ${userA.token}` }
      });
      assert(sessCompRes.status === 200, 'GET /api/reinforcement/comparison/:sessionId returns 200');
      assert(sessCompRes.data?.data?.hasComparison === true, 'Session comparison matches latest comparison');
      assert(sessCompRes.data?.data?.overallDeltaPercentage === 40, 'Session comparison has correct delta');
    }

    // --------------------------------------------------------------------------
    // SUITE 5: CROSS-USER TENANT ISOLATION
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 5: Cross-User Tenant Isolation ---');
    const userB = await registerTestUser('M15D_B');
    {
      // User B attempts to access User A's session comparison
      const crossSess = await apiRequest(`/api/reinforcement/comparison/${session2._id}`, {
        headers: { Authorization: `Bearer ${userB.token}` }
      });
      assert(crossSess.status === 404, 'User B cannot access User A session comparison (returns 404)');

      // User B attempts invalid ObjectId format
      const invalidSess = await apiRequest('/api/reinforcement/comparison/invalid-object-id', {
        headers: { Authorization: `Bearer ${userB.token}` }
      });
      assert(invalidSess.status === 400, 'Invalid ObjectId returns 400 Bad Request');
    }

    // --------------------------------------------------------------------------
    // SUITE 6: AUTHORITATIVE ACTIVITY OUTCOME TRACKING & INTEGRITY
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 6: Authoritative Activity Outcome Tracking & Integrity ---');
    {
      // Find a real problem in database
      const realProblem = await Problem.findOne().lean();
      assert(realProblem !== null, 'Found real Problem in database for activity recording');

      // 1. Record accepted code submission for User A
      await Submission.create({
        user: userA.id,
        problem: realProblem._id,
        sourceCode: 'function solve() { return true; }',
        language: 'javascript',
        verdict: 'Accepted',
        passedTests: 3,
        totalTests: 3,
        executionDuration: 42,
        createdAt: new Date()
      });

      // 2. Record rejected code submission for User A
      await Submission.create({
        user: userA.id,
        problem: realProblem._id,
        sourceCode: 'function solve() { return false; }',
        language: 'javascript',
        verdict: 'Wrong Answer',
        passedTests: 1,
        totalTests: 3,
        executionDuration: 35,
        createdAt: new Date(Date.now() - 60000)
      });

      // 3. Record passed quiz attempt for User A
      const realQuiz = await Quiz.findOne().lean();
      const quizDocId = realQuiz?._id || new mongoose.Types.ObjectId();

      await QuizAttempt.create({
        user: userA.id,
        quiz: quizDocId,
        quizId: 'javascript-fundamentals',
        quizTitle: 'JavaScript Fundamentals',
        topic: 'JavaScript',
        difficulty: 'Easy',
        status: 'submitted',
        isPassed: true,
        score: 9,
        maxScore: 10,
        percentage: 90,
        submittedAt: new Date(Date.now() - 120000)
      });

      // Query activity history
      const histAllRes = await apiRequest('/api/reinforcement/history', {
        headers: { Authorization: `Bearer ${userA.token}` }
      });
      assert(histAllRes.status === 200, 'GET /api/reinforcement/history returns 200');
      const allActivities = histAllRes.data?.data?.activities || [];
      assert(allActivities.length >= 4, `History contains submissions, quiz, and diagnostics (found ${allActivities.length})`);

      // Verify isVerifiedCompletion integrity rule:
      // Accepted submission -> isVerifiedCompletion: true
      // Rejected submission -> isVerifiedCompletion: false
      const acceptedSub = allActivities.find((a) => a.activityType === 'practice_code' && a.verdict === 'Accepted');
      assert(acceptedSub?.isVerifiedCompletion === true, 'Accepted code submission is verified completion');

      const rejectedSub = allActivities.find((a) => a.activityType === 'practice_code' && a.verdict === 'Wrong Answer');
      assert(rejectedSub?.isVerifiedCompletion === false, 'Wrong Answer submission is NOT verified completion');

      // Test ?verifiedOnly=true filter
      const histVerifiedRes = await apiRequest('/api/reinforcement/history?verifiedOnly=true', {
        headers: { Authorization: `Bearer ${userA.token}` }
      });
      const verifiedActivities = histVerifiedRes.data?.data?.activities || [];
      assert(verifiedActivities.every((a) => a.isVerifiedCompletion === true), 'verifiedOnly filter returns strictly verified completions');
      assert(!verifiedActivities.some((a) => a.verdict === 'Wrong Answer'), 'Rejected attempts excluded under verifiedOnly=true');

      // Test ?type=quiz filter
      const histQuizRes = await apiRequest('/api/reinforcement/history?type=quiz', {
        headers: { Authorization: `Bearer ${userA.token}` }
      });
      const quizActivities = histQuizRes.data?.data?.activities || [];
      assert(quizActivities.every((a) => a.activityType === 'quiz'), 'type=quiz filter returns strictly quiz attempts');

      // Test tenant isolation on history: User B sees NONE of User A's activities
      const userBHist = await apiRequest('/api/reinforcement/history', {
        headers: { Authorization: `Bearer ${userB.token}` }
      });
      assert(userBHist.data?.data?.activities?.length === 0, 'User B sees 0 activities (strict tenant isolation)');

      // Test activity summary endpoint
      const summaryRes = await apiRequest('/api/reinforcement/summary', {
        headers: { Authorization: `Bearer ${userA.token}` }
      });
      assert(summaryRes.status === 200, 'GET /api/reinforcement/summary returns 200');
      const summary = summaryRes.data?.data;
      assert(summary?.totalProblemsSolved >= 1, `Summary reports totalProblemsSolved >= 1 (got ${summary?.totalProblemsSolved})`);
      assert(summary?.totalQuizzesPassed >= 1, `Summary reports totalQuizzesPassed >= 1 (got ${summary?.totalQuizzesPassed})`);
      assert(summary?.totalDiagnosticsCompleted >= 2, `Summary reports totalDiagnosticsCompleted >= 2 (got ${summary?.totalDiagnosticsCompleted})`);
      assert(summary?.totalVerifiedActivities >= 4, `Summary reports totalVerifiedActivities >= 4 (got ${summary?.totalVerifiedActivities})`);
    }

    // --------------------------------------------------------------------------
    // SUITE 7: ROADMAP ADAPTATION UPON REASSESSMENT
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 7: Revision Roadmap Adaptation Upon Reassessment ---');
    {
      // Force recalculate roadmap for User A
      const recalcRes = await apiRequest('/api/roadmap/recalculate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userA.token}` }
      });

      assert(recalcRes.status === 200, 'POST /api/roadmap/recalculate returns 200');
      const roadmap = recalcRes.data?.data;

      // Verify reassessmentComparison is attached to roadmap root
      assert(roadmap?.reassessmentComparison !== null, 'reassessmentComparison attached to roadmap');
      assert(roadmap?.reassessmentComparison?.hasComparison === true, 'Roadmap includes valid comparison evidence');
      assert(roadmap?.reassessmentComparison?.overallDeltaPercentage === 40, 'Roadmap comparison reflects +40pp delta');

      // Verify that JavaScript item transitioned to promising (from 0% in sess 1 to 100% in sess 2)
      const jsRec = roadmap?.recommendations?.find((r) => r.topic === 'JavaScript');
      assert(jsRec !== undefined, 'JavaScript roadmap recommendation exists');
      assert(jsRec?.state === 'promising', `JavaScript transitioned to state 'promising' upon reassessment >=70% (received: ${jsRec?.state})`);
      assert(jsRec?.actionType === 'advance', `JavaScript actionType updated to 'advance' (received: ${jsRec?.actionType})`);

      // Verify reassessmentSummary on the recommendation item
      assert(jsRec?.reassessmentSummary !== null, 'reassessmentSummary attached to recommendation item');
      assert(jsRec?.reassessmentSummary?.status === 'encouraging_progress', `reassessmentSummary.status is encouraging_progress, got: ${jsRec?.reassessmentSummary?.status}`);
      assert(jsRec?.reassessmentSummary?.deltaPercentage === 100, `reassessmentSummary.deltaPercentage is 100, got: ${jsRec?.reassessmentSummary?.deltaPercentage}`);
      assert(jsRec?.reason?.includes('encouraging progress'), 'Recommendation reason incorporates encouraging progress evidence');

      // Verify MongoDB persistence of roadmap with reassessment fields
      const dbRoadmap = await Roadmap.findOne({ user: userA.id }).lean();
      assert(dbRoadmap !== null, 'Roadmap document persisted in MongoDB');
      assert(dbRoadmap.reassessmentComparison?.hasComparison === true, 'Roadmap.reassessmentComparison persisted in MongoDB');
      const dbJsRec = dbRoadmap.recommendations.find((r) => r.topic === 'JavaScript');
      assert(dbJsRec?.reassessmentSummary?.status === 'encouraging_progress', 'Item reassessmentSummary persisted in MongoDB');
    }

    // --------------------------------------------------------------------------
    // SUITE 8: IMMUNITY TO CLIENT-SIDE TAMPERING
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 8: Immunity to Client-Side Tampering ---');
    {
      // Attempt to send arbitrary fake delta scores or fabricated summary data
      const tamperRes = await apiRequest('/api/roadmap/recalculate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userA.token}` },
        body: JSON.stringify({
          overallDeltaPercentage: 999,
          fakeScore: 100,
          state: 'mastered'
        })
      });

      assert(tamperRes.status === 200, 'Recalculate handles body safely without trusting client payload');
      const sanitizedRoadmap = tamperRes.data?.data;
      assert(sanitizedRoadmap?.reassessmentComparison?.overallDeltaPercentage === 40, 'Reassessment delta is computed authoritatively by server (remains 40pp)');
    }

    console.log('\n==============================================================================');
    console.log(`TEST EXECUTION COMPLETE: ${passed} passed, ${failed} failed`);
    console.log('==============================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Unexpected error during test suite execution:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runTestSuite();
