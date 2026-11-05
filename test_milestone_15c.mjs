/**
 * ==============================================================================
 * CODEFORGE MILESTONE 15C: ADAPTIVE REVISION ROADMAP TEST SUITE
 * Comprehensive verification of:
 * 1. Unauthenticated request guards (401 Unauthorized)
 * 2. Roadmap generation for fresh users without diagnostic (not_started state)
 * 3. Cross-user tenant isolation (User A vs User B data isolation)
 * 4. Exclusion of in-progress and abandoned diagnostic sessions from evidence
 * 5. Deterministic evidence adaptation upon submitted diagnostic:
 *    - needs_revision (<70% accuracy, >=2 questions)
 *    - promising (>=70% accuracy, >=2 questions)
 *    - not_enough_evidence (<2 questions)
 *    - unassessed (topic not assessed)
 * 6. Deterministic priority tie-breaking rules
 * 7. Completion preservation across recalculations
 * 8. Completion toggle endpoint (complete / incomplete)
 * 9. Practice problem progress integration (advancing to unsolved challenges)
 * 10. Genuine URLs and non-fabrication guarantees (no fake links or mentors)
 * 11. Client-side tampering rejection (server authoritative calculations)
 * 12. Direct MongoDB persistence and schema integrity
 * ==============================================================================
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

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
  const email = `${prefix.toLowerCase()}_${rand}@codeforge.test`;
  const password = 'Password123!';
  const userPayload = {
    fullName: `Test ${prefix} User`,
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
    user: loginRes.data.user || res.data.user,
    token: loginRes.data.token,
    authHeader: { Authorization: `Bearer ${loginRes.data.token}` }
  };
}

async function runTestSuite() {
  console.log('\n===============================================================');
  console.log('🚀 CODEFORGE MILESTONE 15C: ADAPTIVE REVISION ROADMAP TEST SUITE');
  console.log('===============================================================\n');

  let dbConnection = null;

  try {
    // -------------------------------------------------------------------------
    // PART 1: UNAUTHENTICATED REQUEST GUARDS
    // -------------------------------------------------------------------------
    console.log('--- PART 1: UNAUTHENTICATED REQUEST GUARDS ---');

    const unauthGet = await apiRequest('/api/roadmap');
    assert(unauthGet.status === 401, 'GET /api/roadmap returns 401 Unauthorized without token');

    const unauthRecalc = await apiRequest('/api/roadmap/recalculate', { method: 'POST' });
    assert(unauthRecalc.status === 401, 'POST /api/roadmap/recalculate returns 401 Unauthorized without token');

    const unauthComplete = await apiRequest('/api/roadmap/recommendations/rec-test/complete', {
      method: 'PATCH',
      body: JSON.stringify({ isCompleted: true })
    });
    assert(unauthComplete.status === 401, 'PATCH /api/roadmap/recommendations/:id/complete returns 401 without token');

    // -------------------------------------------------------------------------
    // PART 2: FRESH ONBOARDING USER ROADMAP GENERATION (WITHOUT DIAGNOSTIC)
    // -------------------------------------------------------------------------
    console.log('\n--- PART 2: FRESH ONBOARDING USER ROADMAP GENERATION ---');
    const userA = await registerTestUser('FreshUser');

    // Configure onboarding preferences for userA
    const onboardPayload = {
      learningGoals: ['beginner', 'practice'],
      languages: [{ language: 'javascript', status: 'new' }],
      preferredStartingMode: 'fundamentals',
      selectedTopics: ['JavaScript Fundamentals', 'Arrays']
    };

    const onboardRes = await apiRequest('/api/users/onboarding', {
      method: 'PUT',
      headers: userA.authHeader,
      body: JSON.stringify(onboardPayload)
    });
    assert(onboardRes.status === 200, 'User A onboarding preferences saved successfully');

    // Retrieve initial roadmap
    const freshRoadmapRes = await apiRequest('/api/roadmap', {
      headers: userA.authHeader
    });
    assert(freshRoadmapRes.status === 200, 'GET /api/roadmap generates and returns roadmap for fresh user');
    const freshRoadmap = freshRoadmapRes.data?.data;

    assert(freshRoadmap && Array.isArray(freshRoadmap.recommendations), 'Roadmap contains recommendations array');
    assert(freshRoadmap.recommendations.length >= 2, 'Roadmap generated recommendations for selected topics');

    // In the absence of a diagnostic, topics must have state: 'not_started'
    const notStartedItems = freshRoadmap.recommendations.filter((r) => r.state === 'not_started');
    assert(notStartedItems.length === freshRoadmap.recommendations.length, 'All recommendations have state "not_started" prior to diagnostic');
    assert(freshRoadmap.stats.completedItems === 0, 'Initial completed items count is 0');
    assert(freshRoadmap.stats.totalItems === freshRoadmap.recommendations.length, 'Initial stats.totalItems matches recommendations length');

    // Check genuine URL targets
    for (const rec of freshRoadmap.recommendations) {
      assert(
        rec.destinationUrl.startsWith('/practice') || rec.destinationUrl.startsWith('/quiz'),
        `Recommendation '${rec.title}' points to genuine URL: ${rec.destinationUrl}`
      );
    }

    // -------------------------------------------------------------------------
    // PART 3: CROSS-USER TENANT ISOLATION
    // -------------------------------------------------------------------------
    console.log('\n--- PART 3: CROSS-USER TENANT ISOLATION ---');
    const userB = await registerTestUser('OtherUser');

    const userBRoadmapRes = await apiRequest('/api/roadmap', {
      headers: userB.authHeader
    });
    assert(userBRoadmapRes.status === 200, 'GET /api/roadmap succeeds for User B');
    assert(userBRoadmapRes.data.data.userId === userB.user.id, "User B's roadmap strictly belongs to User B");
    assert(userBRoadmapRes.data.data.userId !== userA.user.id, "User B cannot access User A's roadmap data");

    // Attempting to modify User A's item using User B's token
    const firstItemUserA = freshRoadmap.recommendations[0];
    const userBModifyRes = await apiRequest(`/api/roadmap/recommendations/${firstItemUserA.id}/complete`, {
      method: 'PATCH',
      headers: userB.authHeader,
      body: JSON.stringify({ isCompleted: true })
    });
    assert(userBModifyRes.status === 200 || userBModifyRes.status === 404, 'User B request handled safely');
    // User B modifying this item only updates User B's own roadmap, not User A's!
    const userACheck = await apiRequest('/api/roadmap', { headers: userA.authHeader });
    const userAItemStillIncomplete = userACheck.data.data.recommendations.find((r) => r.id === firstItemUserA.id);
    assert(userAItemStillIncomplete.isCompleted === false, "User A's recommendation item remained incomplete (tenant isolated)");

    // -------------------------------------------------------------------------
    // PART 4: EXCLUSION OF IN-PROGRESS AND ABANDONED SESSIONS
    // -------------------------------------------------------------------------
    console.log('\n--- PART 4: EXCLUSION OF IN-PROGRESS AND ABANDONED SESSIONS ---');
    const userC = await registerTestUser('SessionUser');

    // Setup User C onboarding
    await apiRequest('/api/users/onboarding', {
      method: 'PUT',
      headers: userC.authHeader,
      body: JSON.stringify({
        learningGoals: ['revival'],
        languages: [{ language: 'javascript', status: 'revision' }],
        selectedTopics: ['JavaScript Fundamentals', 'Operating Systems']
      })
    });

    // Start a diagnostic session (in_progress)
    const sessionRes = await apiRequest('/api/diagnostics/sessions', {
      method: 'POST',
      headers: userC.authHeader,
      body: JSON.stringify({ topics: ['JavaScript Fundamentals'] })
    });
    assert(sessionRes.status === 200 || sessionRes.status === 201, 'User C started diagnostic session (status: in_progress)');
    const sessionC = sessionRes.data?.data || sessionRes.data?.session;

    // Recalculate roadmap while session is in_progress
    const recalcInProgress = await apiRequest('/api/roadmap/recalculate', {
      method: 'POST',
      headers: userC.authHeader
    });
    const cRecsInProgress = recalcInProgress.data?.data?.recommendations || [];
    const jsItemInProgress = cRecsInProgress.find((r) => r.topic === 'JavaScript');
    assert(
      jsItemInProgress && jsItemInProgress.state === 'not_started',
      'In-progress diagnostic session questions are strictly EXCLUDED from roadmap evidence'
    );

    // Abandon the diagnostic session
    const sessionId = sessionC.id || sessionC._id;
    const abandonRes = await apiRequest(`/api/diagnostics/sessions/${sessionId}/abandon`, {
      method: 'POST',
      headers: userC.authHeader
    });
    assert(abandonRes.status === 200, 'Diagnostic session marked as abandoned');

    // Recalculate roadmap after abandonment
    const recalcAfterAbandon = await apiRequest('/api/roadmap/recalculate', {
      method: 'POST',
      headers: userC.authHeader
    });
    const jsItemAfterAbandon = recalcAfterAbandon.data?.data?.recommendations?.find((r) => r.topic === 'JavaScript');
    assert(
      jsItemAfterAbandon && jsItemAfterAbandon.state === 'not_started',
      'Abandoned diagnostic session is strictly EXCLUDED from roadmap evidence'
    );

    // -------------------------------------------------------------------------
    // PART 5: EVIDENCE-DRIVEN ADAPTATION UPON SUBMITTED DIAGNOSTIC
    // -------------------------------------------------------------------------
    console.log('\n--- PART 5: EVIDENCE-DRIVEN ADAPTATION UPON SUBMITTED DIAGNOSTIC ---');
    const userD = await registerTestUser('DiagnosticUser');

    // Setup User D with onboarding
    await apiRequest('/api/users/onboarding', {
      method: 'PUT',
      headers: userD.authHeader,
      body: JSON.stringify({
        learningGoals: ['revival', 'interview'],
        languages: [{ language: 'javascript', status: 'revision' }],
        selectedTopics: ['JavaScript Fundamentals', 'Data Structures & Algorithms', 'Operating Systems', 'Strings']
      })
    });

    // Start a new diagnostic session for user D covering JavaScript, DSA, and OS
    const userDSessionRes = await apiRequest('/api/diagnostics/sessions', {
      method: 'POST',
      headers: userD.authHeader,
      body: JSON.stringify({
        topics: ['JavaScript Fundamentals', 'Data Structures & Algorithms', 'Operating Systems']
      })
    });
    assert(userDSessionRes.status === 200 || userDSessionRes.status === 201, 'Started diagnostic session for User D');
    const userDSession = userDSessionRes.data?.data || userDSessionRes.data?.session;
    const qList = userDSession.questions || [];

    // Connect to MongoDB to find authoritative answers so we can craft intentional scores:
    // JavaScript: 3 questions, answer 1 correct, 2 incorrect -> 33% accuracy (< 70% with >= 2 questions) -> needs_revision
    // Data Structures & Algorithms: 2 questions, answer both correct -> 100% accuracy (>= 70% with >= 2 questions) -> promising
    // Operating Systems: answer only 1 question -> sampleSize = 1 (< 2 questions) -> not_enough_evidence
    // Strings: not in questions -> unassessed

    dbConnection = await mongoose.createConnection(MONGO_URI).asPromise();
    const Question = dbConnection.model('Question', new mongoose.Schema({}, { strict: false }));
    const allDbQuestions = await Question.find({}).lean();
    const answerMap = new Map(allDbQuestions.map((q) => [q.id ?? q.questionId, q.answer]));

    const answersToSubmit = [];
    let jsAnswered = 0;
    let dsaAnswered = 0;
    let osAnswered = 0;

    for (const q of qList) {
      const canonicalTopic = q.topic;
      const correctAnswer = answerMap.get(q.questionId);
      const wrongAnswer = q.options.find((opt) => opt !== correctAnswer) || q.options[0];

      if (canonicalTopic === 'JavaScript' && jsAnswered < 3) {
        // First correct, next 2 incorrect
        answersToSubmit.push({
          questionId: q.questionId,
          selectedOption: jsAnswered === 0 ? correctAnswer : wrongAnswer
        });
        jsAnswered++;
      } else if (canonicalTopic === 'Data Structures & Algorithms' && dsaAnswered < 2) {
        // 2 correct
        answersToSubmit.push({
          questionId: q.questionId,
          selectedOption: correctAnswer
        });
        dsaAnswered++;
      } else if (canonicalTopic === 'Operating Systems' && osAnswered < 1) {
        // 1 question answered
        answersToSubmit.push({
          questionId: q.questionId,
          selectedOption: correctAnswer
        });
        osAnswered++;
      }
    }

    // Submit diagnostic assessment
    const submitDiagRes = await apiRequest(`/api/diagnostics/sessions/${userDSession.id || userDSession._id}/submit`, {
      method: 'POST',
      headers: userD.authHeader,
      body: JSON.stringify({ answers: answersToSubmit })
    });
    assert(submitDiagRes.status === 200, 'User D submitted diagnostic assessment session');

    // Recalculate roadmap for User D
    const userDRoadmapRes = await apiRequest('/api/roadmap/recalculate', {
      method: 'POST',
      headers: userD.authHeader
    });
    assert(userDRoadmapRes.status === 200, 'POST /api/roadmap/recalculate succeeded after diagnostic submission');
    const userDRoadmap = userDRoadmapRes.data.data;
    const recsD = userDRoadmap.recommendations;

    // Verify 5 explicit states mapping:
    const jsRec = recsD.find((r) => r.topic === 'JavaScript');
    assert(jsRec !== undefined, 'JavaScript recommendation exists');
    assert(jsRec.state === 'needs_revision', 'JavaScript classified as "needs_revision" (<70% accuracy, >=2 questions)');
    assert(jsRec.actionType === 'review', 'needs_revision item assigned actionType "review"');
    assert(jsRec.difficulty === 'Easy', 'needs_revision item assigned difficulty "Easy"');

    const dsaRec = recsD.find((r) => r.topic === 'Data Structures & Algorithms');
    assert(dsaRec !== undefined, 'DSA recommendation exists');
    assert(dsaRec.state === 'promising', 'DSA classified as "promising" (>=70% accuracy, >=2 questions)');
    assert(dsaRec.actionType === 'advance', 'promising item assigned actionType "advance"');

    const osRec = recsD.find((r) => r.topic === 'Operating Systems');
    assert(osRec !== undefined, 'Operating Systems recommendation exists');
    assert(osRec.state === 'not_enough_evidence', 'Operating Systems classified as "not_enough_evidence" (<2 questions)');

    const stringsRec = recsD.find((r) => r.topic === 'Strings');
    assert(stringsRec !== undefined, 'Strings recommendation exists');
    assert(stringsRec.state === 'unassessed', 'Strings classified as "unassessed" (no diagnostic coverage)');

    // -------------------------------------------------------------------------
    // PART 6: DETERMINISTIC PRIORITY TIE-BREAKING
    // -------------------------------------------------------------------------
    console.log('\n--- PART 6: DETERMINISTIC PRIORITY TIE-BREAKING ---');
    // Expected order:
    // needs_revision (priority #1)
    // not_enough_evidence (priority #2)
    // unassessed (priority #3)
    // promising (priority #4)
    assert(jsRec.priority < osRec.priority, 'needs_revision (JavaScript) has higher priority than not_enough_evidence (OS)');
    assert(osRec.priority < stringsRec.priority, 'not_enough_evidence (OS) has higher priority than unassessed (Strings)');
    assert(stringsRec.priority < dsaRec.priority, 'unassessed (Strings) has higher priority than promising (DSA)');

    // Priorities must be 1-indexed sequential integers
    const priorities = recsD.map((r) => r.priority);
    const expectedSeq = Array.from({ length: recsD.length }, (_, i) => i + 1);
    assert(JSON.stringify(priorities) === JSON.stringify(expectedSeq), 'Priorities are strictly sequential 1, 2, 3, ...');

    // -------------------------------------------------------------------------
    // PART 7: COMPLETION PRESERVATION ACROSS RECALCULATIONS
    // -------------------------------------------------------------------------
    console.log('\n--- PART 7: COMPLETION PRESERVATION ACROSS RECALCULATIONS ---');
    // User D completes the JavaScript revision recommendation
    const completePatchRes = await apiRequest(`/api/roadmap/recommendations/${jsRec.id}/complete`, {
      method: 'PATCH',
      headers: userD.authHeader,
      body: JSON.stringify({ isCompleted: true })
    });
    assert(completePatchRes.status === 200, 'PATCH /api/roadmap/recommendations/:id/complete succeeded');
    const patchedRoadmap = completePatchRes.data.data;
    const patchedJsRec = patchedRoadmap.recommendations.find((r) => r.id === jsRec.id);
    assert(patchedJsRec.isCompleted === true, 'JavaScript recommendation isCompleted updated to true');
    assert(patchedJsRec.completedAt !== null, 'completedAt timestamp recorded');
    assert(patchedRoadmap.stats.completedItems === 1, 'stats.completedItems updated to 1');

    // Force recalculate the roadmap
    const afterRecalcRes = await apiRequest('/api/roadmap/recalculate', {
      method: 'POST',
      headers: userD.authHeader
    });
    const recalcRecs = afterRecalcRes.data.data.recommendations;
    const recalcJsRec = recalcRecs.find((r) => r.id === jsRec.id);
    assert(recalcJsRec.isCompleted === true, 'isCompleted: true is PRESERVED across recalculations');
    assert(recalcJsRec.completedAt !== null, 'completedAt timestamp is PRESERVED across recalculations');
    assert(afterRecalcRes.data.data.stats.completedItems === 1, 'stats.completedItems is preserved across recalculations');

    // Toggle back to incomplete
    const uncompletePatchRes = await apiRequest(`/api/roadmap/recommendations/${jsRec.id}/complete`, {
      method: 'PATCH',
      headers: userD.authHeader,
      body: JSON.stringify({ isCompleted: false })
    });
    const uncompleteRoadmap = uncompletePatchRes.data.data;
    const uncompleteJsRec = uncompleteRoadmap.recommendations.find((r) => r.id === jsRec.id);
    assert(uncompleteJsRec.isCompleted === false, 'Recommendation toggled back to incomplete (isCompleted: false)');
    assert(uncompleteJsRec.completedAt === null, 'completedAt reset to null');
    assert(uncompleteRoadmap.stats.completedItems === 0, 'stats.completedItems decremented to 0');

    // -------------------------------------------------------------------------
    // PART 8: PROBLEM SOLVING PROGRESS INTEGRATION
    // -------------------------------------------------------------------------
    console.log('\n--- PART 8: PROBLEM SOLVING PROGRESS INTEGRATION ---');
    const userE = await registerTestUser('SolverUser');

    await apiRequest('/api/users/onboarding', {
      method: 'PUT',
      headers: userE.authHeader,
      body: JSON.stringify({
        learningGoals: ['practice'],
        languages: [{ language: 'javascript', status: 'practicing' }],
        selectedTopics: ['Arrays']
      })
    });

    // Initial roadmap recommends two-sum (Easy)
    const initialERes = await apiRequest('/api/roadmap', { headers: userE.authHeader });
    const initialArraysRec = initialERes.data.data.recommendations.find((r) => r.topic === 'Arrays');
    assert(initialArraysRec.destinationUrl === '/practice/two-sum', 'Initial Arrays recommendation points to /practice/two-sum');

    // User solves two-sum
    const submitTwoSumRes = await apiRequest('/api/problems/two-sum/submit', {
      method: 'POST',
      headers: userE.authHeader,
      body: JSON.stringify({ answer: '[0,1]' })
    });
    assert(submitTwoSumRes.status === 200, 'User E solved two-sum problem');

    // Recalculate roadmap for User E
    const recalcERes = await apiRequest('/api/roadmap/recalculate', {
      method: 'POST',
      headers: userE.authHeader
    });
    const updatedArraysRec = recalcERes.data.data.recommendations.find((r) => r.topic === 'Arrays');
    // Since two-sum is solved, the roadmap must advance to the next challenge: container-with-most-water!
    assert(
      updatedArraysRec.destinationUrl === '/practice/container-with-most-water',
      'Roadmap advanced to next unsolved challenge: /practice/container-with-most-water'
    );
    assert(
      updatedArraysRec.resourceTitle === 'Container With Most Water',
      'Resource title updated to "Container With Most Water"'
    );

    // -------------------------------------------------------------------------
    // PART 9: CLIENT-SIDE TAMPERING IMMUNITY
    // -------------------------------------------------------------------------
    console.log('\n--- PART 9: CLIENT-SIDE TAMPERING IMMUNITY ---');
    // Attempt to inject client fake priority, fake state, fake sample size
    const tamperRes = await apiRequest('/api/roadmap/recalculate', {
      method: 'POST',
      headers: userE.authHeader,
      body: JSON.stringify({
        priority: 1,
        state: 'promising',
        sampleSize: 9999,
        summary: 'Injected Fake Summary'
      })
    });
    assert(tamperRes.status === 200, 'POST /api/roadmap/recalculate accepted valid token');
    assert(tamperRes.data.data.summary !== 'Injected Fake Summary', 'Server rejected client-injected summary');
    const arraysTamperRec = tamperRes.data.data.recommendations.find((r) => r.topic === 'Arrays');
    assert(arraysTamperRec.sampleSize !== 9999, 'Server rejected client-injected sampleSize');

    // -------------------------------------------------------------------------
    // PART 10: DIRECT MONGODB PERSISTENCE VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n--- PART 10: DIRECT MONGODB PERSISTENCE VERIFICATION ---');
    const RoadmapModel = dbConnection.model('Roadmap', new mongoose.Schema({}, { strict: false }));
    const savedRoadmap = await RoadmapModel.findOne({ user: new mongoose.Types.ObjectId(userD.user.id) }).lean();

    assert(savedRoadmap !== null, 'Roadmap document persisted in MongoDB "roadmaps" collection');
    assert(Array.isArray(savedRoadmap.recommendations), 'MongoDB roadmap has recommendations array');
    assert(savedRoadmap.stats && typeof savedRoadmap.stats.totalItems === 'number', 'MongoDB roadmap has valid stats subdocument');
    assert(savedRoadmap.lastCalculatedAt instanceof Date || typeof savedRoadmap.lastCalculatedAt === 'string', 'MongoDB roadmap has lastCalculatedAt');

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    if (dbConnection) {
      await dbConnection.close();
    }
  }

  console.log('\n===============================================================');
  console.log(`MILESTONE 15C TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite();
