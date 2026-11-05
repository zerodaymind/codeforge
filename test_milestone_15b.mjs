/**
 * ==============================================================================
 * CODEFORGE MILESTONE 15B: DIAGNOSTIC ASSESSMENT ENGINE TEST SUITE
 * Comprehensive verification of:
 * 1. Unauthenticated request protection (401)
 * 2. Session generation & question sampling with strict answer confidentiality
 * 3. Goal-based & topic-based targeting (Revival, Interview Prep, Beginner)
 * 4. Unassessed topics transparency (honest disclosure when bank has no questions)
 * 5. Cross-user isolation & tenant security (403 Forbidden)
 * 6. Authoritative server-side scoring & correct answer revelation post-submission
 * 7. Client score injection and answer tampering immunity
 * 8. Malformed payloads and invalid question rejection (400, 422)
 * 9. Duplicate submission prevention on finalized sessions (409 Conflict)
 * 10. Session abandonment lifecycle and handling (abandoned status, 409 on submit)
 * 11. Conservative evidence threshold rules (promising, needs_revision, not_enough_evidence)
 * 12. Grounded next action recommendations linking to genuine quizzes & problems
 * 13. Latest session and history retrieval APIs
 * 14. MongoDB persistence & schema integrity
 * 15. Question bank backward compatibility & integrity
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
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

async function registerTestUser(prefix, onboardingPrefs = {}) {
  const email = `${prefix}_${Date.now()}@codeforge.dev`;
  const password = 'Password123!';
  const registerRes = await apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Diagnostic Test User',
      email,
      password,
      gender: 'Other',
      experience: 'Intermediate',
      interests: ['JavaScript', 'Data Structures & Algorithms']
    })
  });

  if (!registerRes.ok) {
    throw new Error(`Failed to register test user ${email}: ${JSON.stringify(registerRes.data)}`);
  }

  const loginRes = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });

  if (!loginRes.ok || !loginRes.data?.token) {
    throw new Error(`Failed to login test user ${email}: ${JSON.stringify(loginRes.data)}`);
  }

  const token = loginRes.data.token;
  const user = loginRes.data.user;

  // If custom onboarding provided, save it
  if (Object.keys(onboardingPrefs).length > 0) {
    await apiRequest('/api/users/onboarding', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(onboardingPrefs)
    });
  }

  return { email, token, user };
}

async function runTests() {
  console.log('\n==================================================');
  console.log('  CODEFORGE MILESTONE 15B: DIAGNOSTIC ENGINE');
  console.log('  Automated Verification Test Suite');
  console.log('==================================================\n');

  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  const testSuffix = Date.now().toString(36);
  const createdEmails = [];

  try {
    // --------------------------------------------------------------------------
    // PART 1: UNAUTHENTICATED REQUEST PROTECTION (401)
    // --------------------------------------------------------------------------
    console.log('--------------------------------------------------');
    console.log('PART 1: UNAUTHENTICATED REQUEST GUARDS (401)');
    console.log('--------------------------------------------------');

    const unauthPostSession = await apiRequest('/api/diagnostics/sessions', {
      method: 'POST'
    });
    assert(
      unauthPostSession.status === 401,
      `Unauthenticated POST /api/diagnostics/sessions returns 401 (got ${unauthPostSession.status})`
    );

    const unauthGetSession = await apiRequest('/api/diagnostics/sessions/fake-id');
    assert(
      unauthGetSession.status === 401,
      `Unauthenticated GET /api/diagnostics/sessions/:id returns 401 (got ${unauthGetSession.status})`
    );

    const unauthSubmit = await apiRequest('/api/diagnostics/sessions/fake-id/submit', {
      method: 'POST',
      body: JSON.stringify({ answers: [] })
    });
    assert(
      unauthSubmit.status === 401,
      `Unauthenticated POST /api/diagnostics/sessions/:id/submit returns 401 (got ${unauthSubmit.status})`
    );

    const unauthAbandon = await apiRequest('/api/diagnostics/sessions/fake-id/abandon', {
      method: 'POST'
    });
    assert(
      unauthAbandon.status === 401,
      `Unauthenticated POST /api/diagnostics/sessions/:id/abandon returns 401 (got ${unauthAbandon.status})`
    );

    const unauthLatest = await apiRequest('/api/diagnostics/sessions/latest');
    assert(
      unauthLatest.status === 401,
      `Unauthenticated GET /api/diagnostics/sessions/latest returns 401 (got ${unauthLatest.status})`
    );

    const unauthHistory = await apiRequest('/api/diagnostics/history');
    assert(
      unauthHistory.status === 401,
      `Unauthenticated GET /api/diagnostics/history returns 401 (got ${unauthHistory.status})`
    );

    // --------------------------------------------------------------------------
    // PART 2: SESSION GENERATION & STRICT IN-PROGRESS CONFIDENTIALITY
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 2: SESSION GENERATION & IN-PROGRESS CONFIDENTIALITY');
    console.log('--------------------------------------------------');

    const userA = await registerTestUser(`diagA_${testSuffix}`, {
      learningGoals: ['revival'],
      languages: [{ language: 'javascript', status: 'revision' }],
      preferredStartingMode: 'diagnostic',
      selectedTopics: ['JavaScript', 'Data Structures & Algorithms']
    });
    createdEmails.push(userA.email);

    const userB = await registerTestUser(`diagB_${testSuffix}`, {
      learningGoals: ['interview'],
      languages: [{ language: 'javascript', status: 'practicing' }],
      preferredStartingMode: 'diagnostic',
      selectedTopics: ['Data Structures & Algorithms', 'Operating Systems']
    });
    createdEmails.push(userB.email);

    const createSessionA = await apiRequest('/api/diagnostics/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` }
    });

    assert(
      createSessionA.status === 201 && createSessionA.data?.success,
      `User A starts diagnostic session with HTTP 201 (got ${createSessionA.status})`
    );

    const sessionA = createSessionA.data?.data;
    assert(
      sessionA && sessionA._id && sessionA.status === 'in_progress',
      `Session A created with status 'in_progress' and valid ObjectId`
    );
    assert(
      Array.isArray(sessionA.questions) && sessionA.questions.length >= 5,
      `Session A contains curated questions array (count: ${sessionA.questions?.length})`
    );

    // Verify answers and explanations are strictly stripped while in_progress
    const exposedAnswer = sessionA.questions.find((q) => q.answer !== undefined || q.explanation !== undefined);
    assert(
      !exposedAnswer,
      `Strict Confidentiality: Questions while in_progress do NOT reveal 'answer' or 'explanation'`
    );

    // Verify GET /api/diagnostics/sessions/:id also hides answers
    const getSessionA = await apiRequest(`/api/diagnostics/sessions/${sessionA._id}`, {
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    assert(
      getSessionA.status === 200 && getSessionA.data?.data?.status === 'in_progress',
      `GET /api/diagnostics/sessions/:id succeeds for session owner`
    );
    const getExposed = getSessionA.data?.data?.questions.find((q) => q.answer !== undefined || q.explanation !== undefined);
    assert(
      !getExposed,
      `Strict Confidentiality: GET by ID while in_progress hides 'answer' and 'explanation'`
    );

    // Calling POST /api/diagnostics/sessions again while session is in_progress returns existing active session
    const resumeSessionA = await apiRequest('/api/diagnostics/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    assert(
      resumeSessionA.status === 200 && resumeSessionA.data?.data?._id === sessionA._id,
      `Re-calling start session resumes existing in-progress session (idempotent resume)`
    );

    // --------------------------------------------------------------------------
    // PART 3: GOAL-BASED TOPIC TARGETING
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 3: GOAL-BASED TOPIC TARGETING');
    console.log('--------------------------------------------------');

    const createSessionB = await apiRequest('/api/diagnostics/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userB.token}` }
    });
    assert(
      createSessionB.status === 201 && createSessionB.data?.data?.questions?.length > 0,
      `User B starts diagnostic session successfully`
    );
    const sessionB = createSessionB.data?.data;
    const sessionBTopics = sessionB.questions.map((q) => q.topic);
    const hasDsaOrOs = sessionBTopics.some((t) =>
      t.includes('Data Structures') || t.includes('Algorithms') || t.includes('Operating Systems')
    );
    assert(
      hasDsaOrOs,
      `Session B questions reflect interview goals (includes DSA / OS questions)`
    );

    // --------------------------------------------------------------------------
    // PART 4: UNASSESSED TOPICS TRANSPARENCY
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 4: UNASSESSED TOPICS TRANSPARENCY');
    console.log('--------------------------------------------------');

    const userC = await registerTestUser(`diagC_${testSuffix}`, {
      learningGoals: ['practice'],
      languages: [{ language: 'javascript', status: 'practicing' }],
      selectedTopics: ['JavaScript Fundamentals', 'Strings', 'General'] // Strings and General have no questions in question bank
    });
    createdEmails.push(userC.email);

    const createSessionC = await apiRequest('/api/diagnostics/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userC.token}` }
    });
    const sessionC = createSessionC.data?.data;
    assert(
      Array.isArray(sessionC?.unassessedTopics) && sessionC.unassessedTopics.length >= 2,
      `Unassessed topics recorded honestly for missing topics (count: ${sessionC?.unassessedTopics?.length})`
    );
    const missingTopicNames = sessionC.unassessedTopics.map((u) => u.topic);
    assert(
      missingTopicNames.includes('Strings') && missingTopicNames.includes('General'),
      `Unassessed topics list includes 'Strings' and 'General' with transparent reason`
    );

    // --------------------------------------------------------------------------
    // PART 5: TENANT ISOLATION & SECURITY (CROSS-USER 403)
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 5: CROSS-USER TENANT ISOLATION (403)');
    console.log('--------------------------------------------------');

    // User B attempts to GET User A's session
    const crossGet = await apiRequest(`/api/diagnostics/sessions/${sessionA._id}`, {
      headers: { Authorization: `Bearer ${userB.token}` }
    });
    assert(
      crossGet.status === 403,
      `User B GET /api/diagnostics/sessions/:userA_id blocked with 403 Forbidden`
    );

    // User B attempts to SUBMIT User A's session
    const crossSubmit = await apiRequest(`/api/diagnostics/sessions/${sessionA._id}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ answers: [] })
    });
    assert(
      crossSubmit.status === 403,
      `User B POST /api/diagnostics/sessions/:userA_id/submit blocked with 403 Forbidden`
    );

    // User B attempts to ABANDON User A's session
    const crossAbandon = await apiRequest(`/api/diagnostics/sessions/${sessionA._id}/abandon`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userB.token}` }
    });
    assert(
      crossAbandon.status === 403,
      `User B POST /api/diagnostics/sessions/:userA_id/abandon blocked with 403 Forbidden`
    );

    // --------------------------------------------------------------------------
    // PART 6: AUTHORITATIVE SERVER SCORING & ANSWER REVELATION
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 6: AUTHORITATIVE SERVER SCORING');
    console.log('--------------------------------------------------');

    // Find actual questions in DB to craft a controlled submission
    const questionDocs = await db.collection('questions').find({}).toArray();
    const qMap = new Map();
    questionDocs.forEach((q) => {
      qMap.set(q._id.toString(), q);
      if (q.id !== undefined) qMap.set(q.id, q);
      if (q.questionId !== undefined) qMap.set(q.questionId, q);
    });

    // Prepare answers for session A:
    // First 2 questions (JavaScript) answered correctly (>=2 answered, 100% accuracy -> promising)
    // One DSA question answered incorrectly, rest unanswered (1 answered <2 -> not_enough_evidence)
    const answersForA = sessionA.questions.map((q, idx) => {
      const dbQ = qMap.get(q.questionId);
      if (!dbQ) return { questionId: q.questionId, selectedOptionIndex: -1 };
      const correctIdx = dbQ.options.findIndex((opt) => opt === dbQ.answer);

      if (idx === 0 || idx === 1) {
        return { questionId: q.questionId, selectedOptionIndex: correctIdx };
      } else if (idx === 3) {
        const wrongIdx = (correctIdx + 1) % dbQ.options.length;
        return { questionId: q.questionId, selectedOptionIndex: wrongIdx };
      } else {
        return { questionId: q.questionId, selectedOptionIndex: -1 };
      }
    });

    const submitResA = await apiRequest(`/api/diagnostics/sessions/${sessionA._id}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ answers: answersForA })
    });

    assert(
      submitResA.status === 200 && submitResA.data?.success,
      `User A submits diagnostic session with HTTP 200`
    );

    const evaluatedA = submitResA.data?.data;
    assert(
      evaluatedA.status === 'submitted',
      `Session status transitioned to 'submitted'`
    );
    assert(
      evaluatedA.score === 2,
      `Authoritative server scoring calculated score = 2 points (got ${evaluatedA.score})`
    );
    assert(
      evaluatedA.maxScore === sessionA.questions.length,
      `MaxScore equals total questions points (${sessionA.questions.length})`
    );
    const expectedPct = Math.round((2 / sessionA.questions.length) * 100);
    assert(
      evaluatedA.percentage === expectedPct,
      `Percentage calculated correctly: ${expectedPct}% (got ${evaluatedA.percentage}%)`
    );

    // Verify that after submission, correct answers and explanations ARE revealed
    const revealedQuestions = evaluatedA.questions;
    assert(
      revealedQuestions.every((q) => typeof q.answer === 'string' && q.answer.length > 0),
      `Post-submission: Correct answers revealed for all questions`
    );
    assert(
      revealedQuestions[0].isCorrect === true && revealedQuestions[1].isCorrect === true && revealedQuestions[3].isCorrect === false,
      `Individual question isCorrect flags match expected outcomes (Q1: true, Q2: true, Q4: false)`
    );

    // --------------------------------------------------------------------------
    // PART 7: SCORE INJECTION & TAMPERING IMMUNITY
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 7: SCORE INJECTION & TAMPERING IMMUNITY');
    console.log('--------------------------------------------------');

    const userTamper = await registerTestUser(`diagTamper_${testSuffix}`);
    createdEmails.push(userTamper.email);

    const tamperSessionRes = await apiRequest('/api/diagnostics/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userTamper.token}` }
    });
    const tamperSession = tamperSessionRes.data?.data;

    // Send payload attempting to inject fake score: 1000, percentage: 100
    const tamperPayload = {
      score: 1000,
      percentage: 100,
      maxScore: 10,
      answers: tamperSession.questions.map((q) => ({
        questionId: q.questionId,
        selectedOptionIndex: 0,
        isCorrect: true, // injected
        score: 100 // injected
      }))
    };

    const tamperSubmitRes = await apiRequest(`/api/diagnostics/sessions/${tamperSession._id}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userTamper.token}` },
      body: JSON.stringify(tamperPayload)
    });

    assert(
      tamperSubmitRes.status === 200,
      `Tamper submission processed without server crash`
    );
    const tamperResult = tamperSubmitRes.data?.data;
    assert(
      tamperResult.score <= tamperResult.maxScore && tamperResult.score !== 1000,
      `Backend ignored injected score of 1000; scored authoritative result: ${tamperResult.score}/${tamperResult.maxScore}`
    );

    // --------------------------------------------------------------------------
    // PART 8: MALFORMED PAYLOADS AND INVALID QUESTION REJECTION
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 8: MALFORMED PAYLOADS AND INVALID REJECTIONS');
    console.log('--------------------------------------------------');

    const userReject = await registerTestUser(`diagReject_${testSuffix}`);
    createdEmails.push(userReject.email);

    const rejectSessionRes = await apiRequest('/api/diagnostics/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userReject.token}` }
    });
    const rejectSession = rejectSessionRes.data?.data;

    // Submitting with non-existent questionId
    const invalidQRes = await apiRequest(`/api/diagnostics/sessions/${rejectSession._id}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userReject.token}` },
      body: JSON.stringify({
        answers: [{ questionId: 'non-existent-question-id-xyz', selectedOptionIndex: 1 }]
      })
    });
    assert(
      invalidQRes.status === 422,
      `Submitting invalid questionId rejected with 422 Unprocessable Entity (got ${invalidQRes.status})`
    );

    // Submitting malformed answers body
    const malformedRes = await apiRequest(`/api/diagnostics/sessions/${rejectSession._id}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userReject.token}` },
      body: JSON.stringify({ answers: 'not-an-array' })
    });
    assert(
      malformedRes.status === 400,
      `Submitting malformed answers payload rejected with 400 Bad Request (got ${malformedRes.status})`
    );

    // --------------------------------------------------------------------------
    // PART 9: DUPLICATE SUBMISSION PREVENTION (409 CONFLICT)
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 9: DUPLICATE SUBMISSION PREVENTION (409)');
    console.log('--------------------------------------------------');

    // Attempting to submit session A again
    const dupSubmitRes = await apiRequest(`/api/diagnostics/sessions/${sessionA._id}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ answers: answersForA })
    });
    assert(
      dupSubmitRes.status === 409,
      `Resubmitting finalized session returns 409 Conflict (got ${dupSubmitRes.status})`
    );
    assert(
      dupSubmitRes.data?.message?.includes('already been submitted'),
      `Conflict message indicates session already submitted`
    );

    // --------------------------------------------------------------------------
    // PART 10: SESSION ABANDONMENT LIFECYCLE
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 10: SESSION ABANDONMENT LIFECYCLE');
    console.log('--------------------------------------------------');

    const abandonRes = await apiRequest(`/api/diagnostics/sessions/${sessionB._id}/abandon`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userB.token}` }
    });
    assert(
      abandonRes.status === 200 && abandonRes.data?.data?.status === 'abandoned',
      `Session B successfully abandoned with status 'abandoned'`
    );

    // Attempting to submit abandoned session returns 409
    const submitAbandoned = await apiRequest(`/api/diagnostics/sessions/${sessionB._id}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ answers: [] })
    });
    assert(
      submitAbandoned.status === 409,
      `Attempting to submit abandoned session returns 409 Conflict (got ${submitAbandoned.status})`
    );

    // Starting new session after abandonment creates fresh session
    const freshSessionB = await apiRequest('/api/diagnostics/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userB.token}` }
    });
    assert(
      freshSessionB.status === 201 && freshSessionB.data?.data?._id !== sessionB._id,
      `Starting session after abandonment creates brand new session (new ID)`
    );

    // --------------------------------------------------------------------------
    // PART 11: CONSERVATIVE EVIDENCE THRESHOLDS
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 11: CONSERVATIVE EVIDENCE THRESHOLDS');
    console.log('--------------------------------------------------');

    // Inspect topicResults from evaluated session A
    assert(
      Array.isArray(evaluatedA.topicResults) && evaluatedA.topicResults.length > 0,
      `Evaluated session contains topicResults breakdown`
    );

    for (const tr of evaluatedA.topicResults) {
      if (tr.answered < 2) {
        assert(
          tr.evidenceStatus === 'not_enough_evidence',
          `Topic '${tr.topic}' with ${tr.answered} answered (<2) is marked 'not_enough_evidence'`
        );
      } else {
        const accuracy = Math.round((tr.correct / tr.answered) * 100);
        if (accuracy >= 70) {
          assert(
            tr.evidenceStatus === 'promising',
            `Topic '${tr.topic}' with ${accuracy}% accuracy (>=70%) is marked 'promising'`
          );
        } else {
          assert(
            tr.evidenceStatus === 'needs_revision',
            `Topic '${tr.topic}' with ${accuracy}% accuracy (<70%) is marked 'needs_revision'`
          );
        }
      }
    }

    // --------------------------------------------------------------------------
    // PART 12: GROUNDED RECOMMENDATIONS GENERATION
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 12: GROUNDED RECOMMENDATIONS');
    console.log('--------------------------------------------------');

    assert(
      Array.isArray(evaluatedA.recommendations) && evaluatedA.recommendations.length > 0,
      `Recommendations generated based on evaluation (count: ${evaluatedA.recommendations.length})`
    );

    for (const rec of evaluatedA.recommendations) {
      assert(
        rec.link.startsWith('/quiz') || rec.link.startsWith('/practice'),
        `Recommendation links to genuine platform route: ${rec.link}`
      );
      assert(
        typeof rec.title === 'string' && typeof rec.reason === 'string',
        `Recommendation contains valid title and reasoning: "${rec.title}"`
      );
    }

    // --------------------------------------------------------------------------
    // PART 13: LATEST SESSION AND HISTORY APIS
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 13: LATEST SESSION AND HISTORY RETRIEVAL');
    console.log('--------------------------------------------------');

    const latestA = await apiRequest('/api/diagnostics/sessions/latest', {
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    assert(
      latestA.status === 200 && latestA.data?.data?._id === sessionA._id,
      `GET /api/diagnostics/sessions/latest returns User A's submitted session`
    );

    const historyA = await apiRequest('/api/diagnostics/history', {
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    assert(
      historyA.status === 200 && Array.isArray(historyA.data?.data) && historyA.data.data.length >= 1,
      `GET /api/diagnostics/history returns session list (count: ${historyA.data?.data?.length})`
    );

    // --------------------------------------------------------------------------
    // PART 14: DIRECT MONGODB PERSISTENCE & SCHEMA INTEGRITY
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 14: DIRECT MONGODB PERSISTENCE');
    console.log('--------------------------------------------------');

    const dbSessionA = await db.collection('diagnosticsessions').findOne({
      _id: new mongoose.Types.ObjectId(sessionA._id)
    });
    assert(
      dbSessionA !== null,
      `DiagnosticSession document exists in MongoDB 'diagnosticsessions' collection`
    );
    assert(
      dbSessionA.status === 'submitted' && dbSessionA.score === 2,
      `MongoDB document holds status 'submitted' and score = 2`
    );
    assert(
      dbSessionA.user.toString() === userA.user.id || dbSessionA.user.toString() === userA.user._id,
      `MongoDB document correctly associates with user ObjectId`
    );

    // --------------------------------------------------------------------------
    // PART 15: QUESTION BANK BACKWARD COMPATIBILITY
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 15: QUESTION BANK BACKWARD COMPATIBILITY');
    console.log('--------------------------------------------------');

    const totalQuestionsInDb = await db.collection('questions').countDocuments({});
    assert(
      totalQuestionsInDb >= 42,
      `Question bank contains 42+ high-quality questions (found ${totalQuestionsInDb})`
    );

    const sampleQ = await db.collection('questions').findOne({});
    assert(
      sampleQ && ['Easy', 'Medium', 'Hard'].includes(sampleQ.difficulty),
      `Questions adhere to controlled difficulty taxonomy: '${sampleQ.difficulty}'`
    );
    assert(
      Array.isArray(sampleQ.options) && sampleQ.options.length >= 2,
      `Questions have valid options array`
    );
    assert(
      typeof sampleQ.answer === 'string' && sampleQ.options.includes(sampleQ.answer),
      `Correct answer is member of options array`
    );

  } finally {
    // Clean up created test users and test diagnostic sessions
    console.log('\nCleaning up test artifacts...');
    if (createdEmails.length > 0) {
      const normalizedEmails = createdEmails.map((e) => e.toLowerCase());
      const users = await db.collection('users').find({ email: { $in: normalizedEmails } }).toArray();
      const userIds = users.map((u) => u._id);
      await db.collection('diagnosticsessions').deleteMany({ user: { $in: userIds } });
      await db.collection('users').deleteMany({ _id: { $in: userIds } });
      console.log(`Cleaned up ${userIds.length} test users and their diagnostic sessions.`);
    }
    await mongoose.connection.close();
  }

  console.log('\n==================================================');
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
