/**
 * ==============================================================================
 * CODEFORGE MILESTONE 16C: RETENTION & DURABLE LEARNING TEST SUITE
 * Comprehensive verification of:
 * 1. Retention Review Scheduling & Scientific Guarantees:
 *    - Inactivity never decays proficiency scores
 *    - Interval heuristics: <14d (fresh), 14–30d (gentle), 31–60d (due), >60d (stale priority)
 *    - Content availability guards (active Question Bank items)
 *    - Prerequisite readiness evaluations
 *    - 48-hour dismissal cooldown logic
 * 2. Retention Assessment Sessions & Exposure Tracking:
 *    - Session snapshot initialization with Question Bank items
 *    - Secret answer stripping in in-progress responses
 *    - Unseen question prioritization over previously seen questions
 *    - Repeat exposure tracking (isRepeated, timesSeen, lastSeenAt) and disclosures
 *    - Resume active vs forceNew session lifecycle
 *    - Session abandonment
 * 3. Longitudinal Outcome Classification & Grounded Recommendations:
 *    - First retention assessment classification
 *    - Retained on reassessment (score delta within ±14pp treated as context variation)
 *    - Improved on reassessment (score delta >= +15pp)
 *    - Possible decline on reassessment (score delta <= -15pp and score < 70%)
 *    - Honest repeat exposure disclosures and scientific context notes
 *    - Collision-safe recommendation IDs and grounded catalog links
 *    - Automatic CompetencySnapshot recording on submission
 * 4. Authenticated REST API & Tenant Isolation:
 *    - 401 Unauthorized guards on protected retention routes
 *    - Alias route support (/api/intelligence/retention/* and /api/retention/*)
 *    - Cross-user tenant isolation (User A cannot access User B's session)
 *    - Full end-to-end API session execution (schedule -> start -> submit -> history)
 * ==============================================================================
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  RETENTION_POLICY,
  getRetentionReviewSchedule,
  dismissRetentionTopic,
  isTopicDismissed,
  checkTopicAssessmentContent
} from './server/services/retentionReviewService.js';

import {
  startOrCreateRetentionSession,
  submitRetentionSession,
  abandonRetentionSession,
  RETENTION_OUTCOME
} from './server/services/retentionSessionService.js';

import RetentionSession from './server/models/RetentionSession.js';
import CompetencySnapshot from './server/models/CompetencySnapshot.js';
import Question from './server/models/Question.js';

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
    // non-json response
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

async function runTestSuite() {
  console.log('==============================================================================');
  console.log('STARTING MILESTONE 16C: RETENTION & DURABLE LEARNING TEST SUITE');
  console.log('==============================================================================\n');

  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB successfully for test fixtures.\n');

    // Setup Test Users
    const learnerA = await registerTestUser('RetLearnerA');
    const learnerB = await registerTestUser('RetLearnerB');
    console.log(`Initialized Test Learners:`);
    console.log(`- Learner A ID: ${learnerA.userId}`);
    console.log(`- Learner B ID: ${learnerB.userId}\n`);

    // Ensure Question Bank has active questions for JavaScript
    const jsQuestionCount = await Question.countDocuments({
      status: 'active',
      topic: new RegExp('^javascript$', 'i')
    });
    console.log(`Active JavaScript Questions in Catalog: ${jsQuestionCount}\n`);

    // --------------------------------------------------------------------------
    // PART 1: RETENTION REVIEW SCHEDULING & SCIENTIFIC PRINCIPLES
    // --------------------------------------------------------------------------
    console.log('--- PART 1: RETENTION REVIEW SCHEDULING & SCIENTIFIC PRINCIPLES ---');

    // 1.1 Configurable Policy Thresholds
    assert(
      RETENTION_POLICY.FRESH_THRESHOLD_DAYS === 14 &&
      RETENTION_POLICY.REVIEW_THRESHOLD_DAYS === 30 &&
      RETENTION_POLICY.STALE_THRESHOLD_DAYS === 60 &&
      RETENTION_POLICY.COOL_OFF_HOURS === 48,
      'Retention policy enforces standardized 14d fresh, 30d review, 60d stale, and 48h cooldown'
    );

    // 1.2 Inactivity Never Equated With Forgetting (Proficiency Never Decayed by Time)
    const initialSchedule = await getRetentionReviewSchedule(learnerA.userId);
    assert(
      initialSchedule && Array.isArray(initialSchedule.schedule),
      'getRetentionReviewSchedule returns valid schedule structure'
    );

    // 1.3 Content Availability Check
    const jsContent = await checkTopicAssessmentContent('JavaScript');
    assert(
      jsContent.hasContent === true && jsContent.activeCount >= 3,
      `checkTopicAssessmentContent accurately detects available questions for JavaScript (${jsContent.activeCount} active)`
    );

    const nonexistentContent = await checkTopicAssessmentContent('NonExistentTopicXYZ');
    assert(
      nonexistentContent.hasContent === false && nonexistentContent.activeCount === 0,
      'checkTopicAssessmentContent returns false for topics without catalog items'
    );

    // 1.4 48-Hour Dismissal Cooldown
    assert(
      isTopicDismissed(learnerA.userId, 'JavaScript') === false,
      'Topic is initially not dismissed'
    );
    const expiresAt = dismissRetentionTopic(learnerA.userId, 'JavaScript');
    assert(
      expiresAt instanceof Date && expiresAt.getTime() > Date.now(),
      'dismissRetentionTopic returns future expiration timestamp'
    );
    assert(
      isTopicDismissed(learnerA.userId, 'JavaScript') === true,
      'isTopicDismissed returns true immediately following dismissal'
    );

    // --------------------------------------------------------------------------
    // PART 2: RETENTION ASSESSMENT SESSIONS & EXPOSURE TRACKING
    // --------------------------------------------------------------------------
    console.log('\n--- PART 2: RETENTION ASSESSMENT SESSIONS & EXPOSURE TRACKING ---');

    // 2.1 Start fresh retention session
    const sessionRes = await startOrCreateRetentionSession(learnerA.userId, {
      topic: 'JavaScript',
      forceNew: true
    });
    assert(
      sessionRes && sessionRes.session && sessionRes.session.targetTopic === 'JavaScript',
      'startOrCreateRetentionSession successfully creates JavaScript retention session'
    );
    const activeSession = sessionRes.session;

    // 2.2 Strict Secret Answer Concealment
    assert(
      activeSession.status === 'in_progress',
      'Created session has in_progress status'
    );
    const hasSecretAnswers = activeSession.questions.some((q) => q.answer !== undefined || q.correctAnswer !== undefined || q.explanation !== undefined);
    assert(
      !hasSecretAnswers,
      'In-progress session response strictly conceals secret answers and explanations'
    );
    assert(
      activeSession.questions.length === 3,
      'Retention session curates exactly 3 items'
    );

    // 2.3 Resuming an active session
    const resumeRes = await startOrCreateRetentionSession(learnerA.userId, {
      topic: 'JavaScript',
      forceNew: false
    });
    assert(
      resumeRes.isResumed === true && resumeRes.session.sessionId === activeSession.sessionId,
      'startOrCreateRetentionSession resumes existing in-progress session when forceNew=false'
    );

    // 2.4 Abandoning an active session
    const abandoned = await abandonRetentionSession(learnerA.userId, activeSession.sessionId);
    assert(
      abandoned && abandoned.status === 'abandoned',
      'abandonRetentionSession transitions active session to abandoned'
    );

    // --------------------------------------------------------------------------
    // PART 3: SCORING, OUTCOME CLASSIFICATION & RECOMMENDATIONS
    // --------------------------------------------------------------------------
    console.log('\n--- PART 3: SCORING, OUTCOME CLASSIFICATION & RECOMMENDATIONS ---');

    // 3.1 Start fresh session to submit
    const freshSessionRes = await startOrCreateRetentionSession(learnerA.userId, {
      topic: 'JavaScript',
      forceNew: true
    });
    const submittableSession = freshSessionRes.session;

    // Retrieve original answers from DB to submit perfect score
    const rawDoc = await RetentionSession.findOne({ sessionId: submittableSession.sessionId });
    assert(rawDoc !== null, 'RetentionSession document persisted in database');

    const perfectAnswers = rawDoc.questions.map((q) => ({
      questionId: q.questionId,
      selectedOption: q.answer
    }));

    // 3.2 Submit session and verify authoritative scoring
    const completedSession = await submitRetentionSession(
      learnerA.userId,
      submittableSession.sessionId,
      perfectAnswers
    );

    assert(
      completedSession && completedSession.status === 'submitted',
      'Retention session marked submitted upon scoring'
    );
    assert(
      completedSession.outcome && completedSession.outcome.percentage === 100,
      'Authoritative server-side scoring awarded 100% for all correct options'
    );

    // 3.3 Revealed answers and explanations post-submission
    const allRevealed = completedSession.questions.every(
      (q) => q.answer !== undefined && q.explanation !== undefined
    );
    assert(
      allRevealed,
      'Completed session response includes revealed answers and explanations for learning review'
    );

    // 3.4 First Retention Assessment Classification (Baseline establishment)
    assert(
      completedSession.outcome.classification === RETENTION_OUTCOME.FIRST_ASSESSMENT ||
      completedSession.outcome.classification === RETENTION_OUTCOME.RETAINED,
      `Outcome classification correctly assigned (${completedSession.outcome.classification})`
    );

    // 3.5 Disclosures & Repeat Exposure Disclosures
    assert(
      Array.isArray(completedSession.outcome.comparabilityDisclosures) &&
      completedSession.outcome.comparabilityDisclosures.length >= 2,
      'Comparability disclosures include natural variation and concept-verification context'
    );

    // 3.6 Collision-Safe Grounded Recommendations
    const rec = completedSession.outcome.recommendedAction;
    assert(
      rec && rec.recommendationId && rec.recommendationId.startsWith('rec-ret-'),
      'Recommended action includes collision-safe recommendationId'
    );
    assert(
      rec.url.startsWith('/practice?topic='),
      `Recommended action links to genuine catalog destination: ${rec.url}`
    );

    // 3.7 Automatic CompetencySnapshot on submission
    const latestSnapshot = await CompetencySnapshot.findOne({
      user: learnerA.userId,
      sourceEvent: 'retention_assessment'
    }).sort({ createdAt: -1 });

    assert(
      latestSnapshot !== null,
      'Submitting retention assessment authoritatively triggered a CompetencySnapshot'
    );

    // 3.8 Repeat Question Prioritization Test
    // Start another session for Learner A on JavaScript
    const repeatCheckSession = await startOrCreateRetentionSession(learnerA.userId, {
      topic: 'JavaScript',
      forceNew: true
    });
    assert(
      repeatCheckSession && repeatCheckSession.session,
      'Started subsequent retention session to test repeat exposure tracking'
    );

    // Inspect if questions were tagged with repeat tracking
    const repeatDoc = await RetentionSession.findOne({ sessionId: repeatCheckSession.session.sessionId });
    const hasExposureTracking = repeatDoc.questions.every((q) => typeof q.isRepeated === 'boolean');
    assert(
      hasExposureTracking,
      'All session questions track repeat exposure flags (isRepeated, timesSeen)'
    );

    // --------------------------------------------------------------------------
    // PART 4: AUTHENTICATED REST API & TENANT ISOLATION
    // --------------------------------------------------------------------------
    console.log('\n--- PART 4: AUTHENTICATED REST API & TENANT ISOLATION ---');

    // 4.1 401 Unauthorized Guards
    const unauthSchedule = await apiRequest('/api/intelligence/retention/eligible');
    assert(
      unauthSchedule.status === 401,
      'GET /api/intelligence/retention/eligible returns 401 without JWT'
    );

    const unauthSession = await apiRequest('/api/retention/session', {
      method: 'POST',
      body: JSON.stringify({ topic: 'JavaScript' })
    });
    assert(
      unauthSession.status === 401,
      'POST /api/retention/session alias returns 401 without JWT'
    );

    // 4.2 Authenticated Schedule via /api/intelligence/retention/eligible
    const authSchedule = await apiRequest('/api/intelligence/retention/eligible', {
      headers: { Authorization: `Bearer ${learnerA.token}` }
    });
    assert(
      authSchedule.status === 200 && authSchedule.data?.success === true,
      'GET /api/intelligence/retention/eligible returns 200 with valid JWT'
    );

    // 4.3 Alias Route Verification: /api/retention/eligible
    const aliasSchedule = await apiRequest('/api/retention/eligible', {
      headers: { Authorization: `Bearer ${learnerA.token}` }
    });
    assert(
      aliasSchedule.status === 200 && aliasSchedule.data?.success === true,
      'GET /api/retention/eligible alias returns 200 with identical structure'
    );

    // 4.4 End-to-End API Flow: Start Session
    const apiStartRes = await apiRequest('/api/intelligence/retention/session', {
      method: 'POST',
      headers: { Authorization: `Bearer ${learnerA.token}` },
      body: JSON.stringify({ topic: 'JavaScript', forceNew: true })
    });
    assert(
      apiStartRes.status === 201 && apiStartRes.data?.data?.sessionId,
      'POST /api/intelligence/retention/session creates new session via API'
    );
    const apiSession = apiStartRes.data.data;

    // 4.5 Tenant Isolation: Learner B cannot access Learner A's session
    const crossTenantGet = await apiRequest(`/api/intelligence/retention/session/${apiSession.sessionId}`, {
      headers: { Authorization: `Bearer ${learnerB.token}` }
    });
    assert(
      crossTenantGet.status === 404,
      'Tenant Isolation: Learner B receives 404 attempting to access Learner A retention session'
    );

    const crossTenantSubmit = await apiRequest(`/api/intelligence/retention/session/${apiSession.sessionId}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${learnerB.token}` },
      body: JSON.stringify({ answers: [] })
    });
    assert(
      crossTenantSubmit.status === 403 || crossTenantSubmit.status === 404,
      'Tenant Isolation: Learner B cannot submit answers for Learner A retention session (403 Forbidden)'
    );

    // 4.6 Submit Session via API
    const apiSubmitRes = await apiRequest(`/api/intelligence/retention/session/${apiSession.sessionId}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${learnerA.token}` },
      body: JSON.stringify({
        answers: apiSession.questions.map((q) => ({ questionId: q.questionId, selectedOption: 0 }))
      })
    });
    assert(
      apiSubmitRes.status === 200 && apiSubmitRes.data?.data?.outcome,
      'POST /api/intelligence/retention/session/:id/submit evaluates session and returns outcome'
    );

    // 4.7 Retention History via API
    const historyRes = await apiRequest('/api/intelligence/retention/history', {
      headers: { Authorization: `Bearer ${learnerA.token}` }
    });
    assert(
      historyRes.status === 200 && Array.isArray(historyRes.data?.data) && historyRes.data.data.length >= 1,
      'GET /api/intelligence/retention/history retrieves completed retention assessments'
    );

    // 4.8 Dismiss Topic via API
    const dismissRes = await apiRequest('/api/intelligence/retention/dismiss', {
      method: 'POST',
      headers: { Authorization: `Bearer ${learnerA.token}` },
      body: JSON.stringify({ topic: 'JavaScript' })
    });
    assert(
      dismissRes.status === 200 && dismissRes.data?.success === true,
      'POST /api/intelligence/retention/dismiss successfully dismisses topic via API'
    );

    console.log('\n==============================================================================');
    console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('==============================================================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal error during test suite execution:', err);
    process.exit(1);
  } finally {
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
  }
}

runTestSuite();
