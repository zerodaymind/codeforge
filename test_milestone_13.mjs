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
let blocked = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

function markBlocked(testNumber, name, reason) {
  console.log(`  ⚠ BLOCKED [${testNumber}]: ${name}`);
  console.log(`    Reason: ${reason}`);
  blocked++;
}

async function runTests() {
  console.log('\n==================================================');
  console.log('  CODEFORGE MILESTONE 13 AUTOMATED VERIFICATION');
  console.log('  Admin Panel, Question Bank & Quiz Management');
  console.log('==================================================\n');

  // Direct MongoDB connection for state verification and cleanup
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  const timestamp = Date.now();
  const learnerEmail = `learner_m13_${timestamp}@codeforge.dev`;
  const adminTestEmail = `admin_m13_${timestamp}@codeforge.dev`;
  const demoteTestEmail = `demote_admin_${timestamp}@codeforge.dev`;
  const password = 'Password123!';
  const adminPassword = 'TestAdminPass123!';

  let learnerToken = null;
  let learnerUserId = null;

  let adminToken = null;
  let adminUserId = null;

  let demoteToken = null;
  let demoteUserId = null;

  // Track created resources for verification
  let createdQuestionId = null;
  let createdQuizId = null;
  let quizSlug = `m13-quiz-${timestamp}`;
  let attemptId = null;

  async function registerUser(fullName, email, pass, requestedRole) {
    const payload = {
      fullName,
      email,
      password: pass,
      confirmPassword: pass,
      gender: 'Other',
      experience: 'Intermediate',
      interests: ['JavaScript']
    };
    if (requestedRole) {
      payload.role = requestedRole;
    }
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  async function loginUser(email, pass) {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass })
    });
    return res.json();
  }

  try {
    console.log('--------------------------------------------------');
    console.log('PART 1: Role-Based Authorization & RBAC Enforcement');
    console.log('--------------------------------------------------');

    // Test 1: Public registration enforces role: 'user' even if role: 'admin' is passed
    const regLearner = await registerUser('Learner Tester', learnerEmail, password, 'admin');
    assert(
      regLearner.success === true && regLearner.user?.role === 'user',
      'Test 1: Public registration strictly assigns role: "user" ignoring role elevation attempt'
    );
    const loginLearner = await loginUser(learnerEmail, password);
    learnerToken = loginLearner.token;
    learnerUserId = loginLearner.user?.id || loginLearner.user?._id;

    // Verify role in MongoDB
    const learnerDoc = await db.collection('users').findOne({ email: learnerEmail });
    assert(
      learnerDoc && learnerDoc.role === 'user',
      'Test 1b: MongoDB document confirms persisted user.role is "user"'
    );

    // Test 2: Profile update ignores/rejects attempt to change role to admin
    const profileRes = await fetch(`${API_BASE}/api/users/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${learnerToken}`
      },
      body: JSON.stringify({
        fullName: 'Learner Hacker Attempt',
        gender: 'Other',
        experience: 'Intermediate',
        interests: ['Data Structures & Algorithms'],
        role: 'admin'
      })
    });
    const profileData = await profileRes.json();
    const updatedLearnerDoc = await db.collection('users').findOne({ email: learnerEmail });
    assert(
      profileRes.ok && updatedLearnerDoc.role === 'user' && profileData.user?.role === 'user',
      'Test 2: Profile update strictly preserves role: "user" and prevents role elevation'
    );

    // Test 3: Unauthenticated request to /api/admin/overview returns 401
    const unauthRes = await fetch(`${API_BASE}/api/admin/overview`);
    assert(
      unauthRes.status === 401,
      'Test 3: Unauthenticated request to /api/admin/overview returns 401 Unauthorized'
    );

    // Test 4: Learner user request to /api/admin/overview returns 403 Forbidden
    const learnerAdminRes = await fetch(`${API_BASE}/api/admin/overview`, {
      headers: { Authorization: `Bearer ${learnerToken}` }
    });
    assert(
      learnerAdminRes.status === 403,
      'Test 4: Learner request to /api/admin/overview returns 403 Forbidden'
    );

    // Test 5: Provisioned admin user successfully authenticates and accesses /api/admin/overview (200 OK)
    // Register demote user first then promote
    await registerUser('Demote Admin', demoteTestEmail, password);
    await db.collection('users').updateOne({ email: demoteTestEmail }, { $set: { role: 'admin' } });
    const demoteLogin = await loginUser(demoteTestEmail, password);
    demoteToken = demoteLogin.token;
    demoteUserId = demoteLogin.user?.id || demoteLogin.user?._id;

    // Register test admin user and set role to admin
    await registerUser('Milestone13 Admin', adminTestEmail, adminPassword);
    await db.collection('users').updateOne({ email: adminTestEmail }, { $set: { role: 'admin' } });
    const adminLogin = await loginUser(adminTestEmail, adminPassword);
    adminToken = adminLogin.token;
    adminUserId = adminLogin.user?.id || adminLogin.user?._id;

    const adminOverviewRes = await fetch(`${API_BASE}/api/admin/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const overviewData = await adminOverviewRes.json();
    assert(
      adminOverviewRes.status === 200 && overviewData.success === true && overviewData.data?.questions,
      'Test 5: Authenticated administrator successfully accesses /api/admin/overview (200 OK)'
    );

    // Test 6: Learner user cannot access /api/admin/questions (403 Forbidden)
    const learnerQuestionsRes = await fetch(`${API_BASE}/api/admin/questions`, {
      headers: { Authorization: `Bearer ${learnerToken}` }
    });
    assert(
      learnerQuestionsRes.status === 403,
      'Test 6: Learner request to /api/admin/questions returns 403 Forbidden'
    );

    // Test 7: Learner user cannot access /api/admin/quizzes (403 Forbidden)
    const learnerQuizzesRes = await fetch(`${API_BASE}/api/admin/quizzes`, {
      headers: { Authorization: `Bearer ${learnerToken}` }
    });
    assert(
      learnerQuizzesRes.status === 403,
      'Test 7: Learner request to /api/admin/quizzes returns 403 Forbidden'
    );

    // Test 8: Immediate privilege revocation on demotion
    // Verify demote user can access admin endpoint first
    const demotePreRes = await fetch(`${API_BASE}/api/admin/overview`, {
      headers: { Authorization: `Bearer ${demoteToken}` }
    });
    assert(
      demotePreRes.status === 200,
      'Test 8a: Admin user prior to demotion can access admin endpoint'
    );
    // Demote user in database directly
    await db.collection('users').updateOne({ email: demoteTestEmail }, { $set: { role: 'user' } });
    // Same token used without re-login
    const demotePostRes = await fetch(`${API_BASE}/api/admin/overview`, {
      headers: { Authorization: `Bearer ${demoteToken}` }
    });
    assert(
      demotePostRes.status === 403,
      'Test 8b: Immediate privilege revocation: Demoted user instantly gets 403 Forbidden without waiting for token expiry'
    );

    console.log('\n--------------------------------------------------');
    console.log('PART 2: Question Bank Authoring, Filtering & Management');
    console.log('--------------------------------------------------');

    // Test 9: Admin can create a new active multiple-choice question in the bank
    const createQRes = await fetch(`${API_BASE}/api/admin/questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        prompt: `Which operator is used for strict equality in JavaScript? (Test ${timestamp})`,
        codeSnippet: 'const a = 5;\nconst b = "5";\nconsole.log(a === b);',
        topic: 'JavaScript',
        difficulty: 'Easy',
        points: 2,
        type: 'multiple-choice',
        status: 'active',
        options: ['==', '===', '=', '!='],
        answer: '===',
        explanation: 'The === operator checks both value and type without coercion.',
        tags: ['javascript', 'operators', 'equality']
      })
    });
    const createQData = await createQRes.json();
    createdQuestionId = createQData.data?.id;
    assert(
      createQRes.status === 201 && createQData.success === true && createdQuestionId,
      `Test 9: Admin creates active question in Question Bank (Assigned ID: #${createdQuestionId})`
    );

    // Test 10: Question creation rejects invalid payloads (missing prompt / < 2 options / mismatched answer)
    const invalidQRes = await fetch(`${API_BASE}/api/admin/questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        prompt: 'Invalid question missing required fields',
        options: ['Only One Option'],
        answer: 'Not In Options'
      })
    });
    assert(
      invalidQRes.status === 400,
      'Test 10: Question creation rejects invalid payload with 400 Bad Request'
    );

    // Test 11: Admin can retrieve paginated questions from the bank
    const listQRes = await fetch(`${API_BASE}/api/admin/questions?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const listQData = await listQRes.json();
    assert(
      listQRes.status === 200 &&
        listQData.success === true &&
        Array.isArray(listQData.data?.questions) &&
        listQData.data.pagination?.total > 0,
      'Test 11: Admin retrieves paginated questions with accurate pagination metadata'
    );

    // Test 12: Admin can search and filter questions by topic and difficulty
    const filterQRes = await fetch(
      `${API_BASE}/api/admin/questions?topic=JavaScript&difficulty=Easy`,
      {
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );
    const filterQData = await filterQRes.json();
    const matchedFiltered = filterQData.data?.questions?.every(
      (q) => q.topic === 'JavaScript' && q.difficulty === 'Easy'
    );
    assert(
      filterQRes.status === 200 && filterQData.data?.questions?.length > 0 && matchedFiltered,
      'Test 12: Admin filters question bank by topic and difficulty successfully'
    );

    // Test 13: Admin can filter questions by status
    const statusQRes = await fetch(`${API_BASE}/api/admin/questions?status=active`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const statusQData = await statusQRes.json();
    const allActive = statusQData.data?.questions?.every((q) => q.status === 'active');
    assert(
      statusQRes.status === 200 && allActive === true,
      'Test 13: Admin filters question bank by status: "active"'
    );

    // Test 14: Admin can retrieve single question by ID
    const singleQRes = await fetch(`${API_BASE}/api/admin/questions/${createdQuestionId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const singleQData = await singleQRes.json();
    assert(
      singleQRes.status === 200 &&
        singleQData.data?.id === createdQuestionId &&
        singleQData.data?.answer === '===',
      'Test 14: Admin retrieves single question by ID with complete answer and explanation'
    );

    // Test 15: Admin can update question prompt, options, and points
    const updateQRes = await fetch(`${API_BASE}/api/admin/questions/${createdQuestionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        prompt: `Updated question prompt for strict equality (Test ${timestamp})`,
        points: 3
      })
    });
    const updateQData = await updateQRes.json();
    assert(
      updateQRes.status === 200 &&
        updateQData.success === true &&
        updateQData.data?.points === 3 &&
        updateQData.data?.prompt.startsWith('Updated question prompt'),
      'Test 15: Admin updates question prompt and points allocation successfully'
    );

    // Test 16: Admin can archive and restore a question
    const archiveQRes = await fetch(
      `${API_BASE}/api/admin/questions/${createdQuestionId}/archive`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );
    const archiveQData = await archiveQRes.json();
    assert(
      archiveQRes.status === 200 && archiveQData.data?.status === 'archived',
      'Test 16a: Admin archives question, updating status to "archived"'
    );

    const restoreQRes = await fetch(
      `${API_BASE}/api/admin/questions/${createdQuestionId}/restore`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );
    const restoreQData = await restoreQRes.json();
    assert(
      restoreQRes.status === 200 && restoreQData.data?.status === 'active',
      'Test 16b: Admin restores question, reverting status to "active"'
    );

    console.log('\n--------------------------------------------------');
    console.log('PART 3: Quiz Builder, Validation & Publishing Control');
    console.log('--------------------------------------------------');

    // Test 17: Admin can create a new quiz in draft mode
    const createQuizRes = await fetch(`${API_BASE}/api/admin/quizzes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        title: `M13 Draft Quiz ${timestamp}`,
        slug: quizSlug,
        description: 'Comprehensive test quiz for Milestone 13 validation',
        topic: 'JavaScript',
        difficulty: 'Intermediate',
        timeLimitMinutes: 10,
        passingPercentage: 60,
        isPublished: false,
        questions: []
      })
    });
    const createQuizData = await createQuizRes.json();
    createdQuizId = createQuizData.data?._id;
    assert(
      createQuizRes.status === 201 &&
        createQuizData.success === true &&
        createQuizData.data?.isPublished === false &&
        createdQuizId,
      'Test 17: Admin creates new quiz blueprint in draft mode (isPublished: false)'
    );

    // Test 18: Admin can retrieve quizzes list
    const adminQuizzesRes = await fetch(`${API_BASE}/api/admin/quizzes`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const adminQuizzesData = await adminQuizzesRes.json();
    const hasCreatedDraft = adminQuizzesData.data?.quizzes?.some(
      (qz) => qz._id === createdQuizId
    );
    assert(
      adminQuizzesRes.status === 200 && hasCreatedDraft,
      'Test 18: Admin retrieves quiz catalog including drafts'
    );

    // Test 19: Learner catalog does NOT include draft quizzes
    const learnerCatalogRes = await fetch(`${API_BASE}/api/quizzes`);
    const learnerCatalogData = await learnerCatalogRes.json();
    const draftInCatalog = learnerCatalogData.data?.some((qz) => qz.slug === quizSlug);
    assert(
      learnerCatalogRes.status === 200 && !draftInCatalog,
      'Test 19: Learner public catalog strictly excludes draft quizzes'
    );

    // Test 20: Publishing validation rejects quiz with 0 questions
    const pubEmptyRes = await fetch(`${API_BASE}/api/admin/quizzes/${createdQuizId}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const pubEmptyData = await pubEmptyRes.json();
    assert(
      pubEmptyRes.status === 400 && pubEmptyData.success === false,
      'Test 20: Publishing validation rejects empty quiz with 0 questions (400 Bad Request)'
    );

    // Test 21: Publishing validation rejects questions with invalid options or mismatched answer
    await fetch(`${API_BASE}/api/admin/quizzes/${createdQuizId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        questions: [
          {
            prompt: 'Invalid Question with mismatched answer',
            options: ['Option A', 'Option B'],
            answer: 'Option C', // not in options!
            points: 1
          }
        ]
      })
    });
    const pubInvalidAnswerRes = await fetch(
      `${API_BASE}/api/admin/quizzes/${createdQuizId}/publish`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );
    assert(
      pubInvalidAnswerRes.status === 400,
      'Test 21: Publishing validation rejects quiz containing questions with mismatched answer keys'
    );

    // Test 22: Publishing validation rejects quiz referencing an archived bank question
    // Archive question #createdQuestionId
    await fetch(`${API_BASE}/api/admin/questions/${createdQuestionId}/archive`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    await fetch(`${API_BASE}/api/admin/quizzes/${createdQuizId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        questions: [
          {
            questionId: createdQuestionId,
            prompt: 'Question from bank that is archived',
            options: ['A', 'B'],
            answer: 'A',
            points: 1
          }
        ]
      })
    });
    const pubArchivedRefRes = await fetch(
      `${API_BASE}/api/admin/quizzes/${createdQuizId}/publish`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );
    assert(
      pubArchivedRefRes.status === 400,
      'Test 22: Publishing validation rejects quiz referencing an archived bank question'
    );

    // Restore bank question
    await fetch(`${API_BASE}/api/admin/questions/${createdQuestionId}/restore`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    // Test 23: Admin can add valid questions and successfully publish the quiz
    await fetch(`${API_BASE}/api/admin/quizzes/${createdQuizId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        questions: [
          {
            questionId: createdQuestionId,
            prompt: 'Which operator is used for strict equality in JavaScript?',
            options: ['==', '===', '=', '!='],
            answer: '===',
            explanation: 'The === operator checks value and type without coercion.',
            points: 2
          },
          {
            questionId: 9999,
            prompt: 'Which method adds an element to the end of an array?',
            options: ['push()', 'pop()', 'shift()', 'unshift()'],
            answer: 'push()',
            explanation: 'push() appends one or more elements to the end of an array.',
            points: 2
          }
        ]
      })
    });
    const pubValidRes = await fetch(`${API_BASE}/api/admin/quizzes/${createdQuizId}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const pubValidData = await pubValidRes.json();
    assert(
      pubValidRes.status === 200 &&
        pubValidData.success === true &&
        pubValidData.data?.isPublished === true,
      'Test 23: Admin successfully publishes validated quiz (isPublished: true)'
    );

    // Test 24: Published quiz is immediately visible in learner catalog
    const learnerCatPostRes = await fetch(`${API_BASE}/api/quizzes`);
    const learnerCatPostData = await learnerCatPostRes.json();
    const publishedFound = learnerCatPostData.data?.some((qz) => qz.slug === quizSlug);
    assert(
      learnerCatPostRes.status === 200 && publishedFound === true,
      'Test 24: Published quiz is immediately discoverable in learner catalog'
    );

    // Test 25: Admin can unpublish the quiz, removing it from learner catalog
    const unpublishRes = await fetch(
      `${API_BASE}/api/admin/quizzes/${createdQuizId}/unpublish`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );
    const unpublishData = await unpublishRes.json();
    const learnerCatUnpubRes = await fetch(`${API_BASE}/api/quizzes`);
    const learnerCatUnpubData = await learnerCatUnpubRes.json();
    const inUnpubCatalog = learnerCatUnpubData.data?.some((qz) => qz.slug === quizSlug);
    assert(
      unpublishRes.status === 200 &&
        unpublishData.data?.isPublished === false &&
        !inUnpubCatalog,
      'Test 25: Admin unpublishes quiz; quiz is immediately removed from learner catalog'
    );

    console.log('\n--------------------------------------------------');
    console.log('PART 4: Lifecycle, Safe Archiving & Historical Integrity');
    console.log('--------------------------------------------------');

    // Test 26: Re-publish quiz, learner starts attempt
    await fetch(`${API_BASE}/api/admin/quizzes/${createdQuizId}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const startAttemptRes = await fetch(`${API_BASE}/api/quizzes/${quizSlug}/attempts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${learnerToken}` }
    });
    const startAttemptData = await startAttemptRes.json();
    if (startAttemptRes.status !== 201) {
      console.log('DEBUG Test 26 startAttempt failure:', startAttemptRes.status, startAttemptData);
    }
    attemptId = startAttemptData.data?._id || startAttemptData.attempt?._id;
    assert(
      (startAttemptRes.status === 201 || startAttemptRes.status === 200) &&
        startAttemptData.success === true &&
        attemptId &&
        (startAttemptData.data?.status === 'in_progress' || startAttemptData.attempt?.status === 'in_progress'),
      'Test 26: Learner starts new attempt on published quiz (Attempt ID generated)'
    );

    // Test 27: Learner submits attempt and receives evaluation score
    const submitAttemptRes = await fetch(
      `${API_BASE}/api/quizzes/attempts/${attemptId}/submit`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${learnerToken}`
        },
        body: JSON.stringify({
          answers: [
            { questionId: createdQuestionId, selectedOption: '===' },
            { questionId: 9999, selectedOption: 'push()' }
          ]
        })
      }
    );
    const submitAttemptData = await submitAttemptRes.json();
    assert(
      submitAttemptRes.status === 200 &&
        (submitAttemptData.data?.status === 'submitted' || submitAttemptData.data?.status === 'completed') &&
        submitAttemptData.data?.percentage === 100 &&
        submitAttemptData.data?.isPassed === true,
      'Test 27: Learner submits attempt and authoritative server computes score (100% Passed)'
    );

    // Test 28: Admin archives the quiz
    const archiveQuizRes = await fetch(
      `${API_BASE}/api/admin/quizzes/${createdQuizId}/archive`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );
    const archiveQuizData = await archiveQuizRes.json();
    assert(
      archiveQuizRes.status === 200 && archiveQuizData.data?.isArchived === true,
      'Test 28: Admin safely archives quiz (isArchived: true)'
    );

    // Test 29: Archived quiz is excluded from learner catalog
    const catAfterArchiveRes = await fetch(`${API_BASE}/api/quizzes`);
    const catAfterArchiveData = await catAfterArchiveRes.json();
    const inCatArchived = catAfterArchiveData.data?.some((qz) => qz.slug === quizSlug);
    assert(
      catAfterArchiveRes.status === 200 && !inCatArchived,
      'Test 29: Archived quiz is excluded from learner catalog'
    );

    // Test 30: Learners cannot start a new attempt on an archived quiz
    const startArchivedRes = await fetch(`${API_BASE}/api/quizzes/${quizSlug}/attempts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${learnerToken}` }
    });
    assert(
      startArchivedRes.status === 404 || startArchivedRes.status === 400,
      'Test 30: Learner cannot start an attempt on archived quiz (returns 404/400)'
    );

    // Test 31: Learner can still review their historical completed attempt with review snapshot
    const reviewAttemptRes = await fetch(
      `${API_BASE}/api/quizzes/attempts/${attemptId}`,
      {
        headers: { Authorization: `Bearer ${learnerToken}` }
      }
    );
    const reviewAttemptData = await reviewAttemptRes.json();
    assert(
      reviewAttemptRes.status === 200 &&
        reviewAttemptData.data?.score === 4 &&
        reviewAttemptData.data?.reviewData?.length === 2 &&
        reviewAttemptData.data?.reviewData[0]?.isCorrect === true,
      'Test 31: Historical review integrity: Completed attempt remains fully reviewable with immutable snapshot preserved'
    );

    // Test 32: Learner quiz attempt history still lists the completed attempt despite quiz being archived
    const historyRes = await fetch(`${API_BASE}/api/quizzes/attempts`, {
      headers: { Authorization: `Bearer ${learnerToken}` }
    });
    const historyData = await historyRes.json();
    const foundInHistory = historyData.data?.some((att) => att._id === attemptId);
    assert(
      historyRes.status === 200 && foundInHistory === true,
      'Test 32: Learner attempt history preserves completed attempt record after quiz archiving'
    );

    console.log('\n--------------------------------------------------');
    console.log('PART 5: Audit Logging & Security Trail');
    console.log('--------------------------------------------------');

    // Test 33: Creating a question writes an audit log with action QUESTION_CREATE
    const qCreateLog = await db.collection('audit_logs').findOne({
      action: 'QUESTION_CREATE',
      entityId: String(createdQuestionId),
      actorEmail: adminTestEmail
    });
    assert(
      qCreateLog && qCreateLog.actorEmail === adminTestEmail,
      'Test 33: Creating a question recorded audit log with action QUESTION_CREATE and actor email'
    );

    // Test 34: Archiving a question writes an audit log with action QUESTION_ARCHIVE
    const qArchiveLog = await db.collection('audit_logs').findOne({
      action: 'QUESTION_ARCHIVE',
      entityId: String(createdQuestionId),
      actorEmail: adminTestEmail
    });
    assert(
      qArchiveLog && qArchiveLog.actorEmail === adminTestEmail,
      'Test 34: Archiving a question recorded audit log with action QUESTION_ARCHIVE'
    );

    // Test 35: Publishing a quiz writes an audit log with action QUIZ_PUBLISH
    const quizPubLog = await db.collection('audit_logs').findOne({
      action: 'QUIZ_PUBLISH',
      entityId: String(createdQuizId)
    });
    assert(
      quizPubLog && quizPubLog.actorEmail === adminTestEmail,
      'Test 35: Publishing a quiz recorded audit log with action QUIZ_PUBLISH'
    );

    // Test 36: Archiving a quiz writes an audit log with action QUIZ_ARCHIVE
    const quizArchiveLog = await db.collection('audit_logs').findOne({
      action: 'QUIZ_ARCHIVE',
      entityId: String(createdQuizId)
    });
    assert(
      quizArchiveLog && quizArchiveLog.actorEmail === adminTestEmail,
      'Test 36: Archiving a quiz recorded audit log with action QUIZ_ARCHIVE'
    );

    // Test 37: Admin can query paginated audit logs and filter by action
    const auditLogsRes = await fetch(
      `${API_BASE}/api/admin/audit-logs?action=QUIZ_ARCHIVE&page=1&limit=5`,
      {
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );
    const auditLogsData = await auditLogsRes.json();
    assert(
      auditLogsRes.status === 200 &&
        auditLogsData.success === true &&
        Array.isArray(auditLogsData.data?.logs) &&
        auditLogsData.data.logs.every((l) => l.action === 'QUIZ_ARCHIVE'),
      'Test 37: Admin queries paginated audit logs filtered by action'
    );

    console.log('\n--------------------------------------------------');
    console.log('PART 6: Platform Stability & Regression Verification');
    console.log('--------------------------------------------------');

    // Test 38: Auth registration and login for standard learners work as expected
    const authMeRes = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${learnerToken}` }
    });
    const authMeData = await authMeRes.json();
    assert(
      authMeRes.status === 200 && authMeData.user?.role === 'user',
      'Test 38: Auth session endpoint /api/auth/me accurately reports user role'
    );

    // Test 39: Practice problems catalog returns active problems
    const problemsRes = await fetch(`${API_BASE}/api/problems?limit=5`);
    const problemsData = await problemsRes.json();
    assert(
      problemsRes.status === 200 &&
        problemsData.success === true &&
        Array.isArray(problemsData.data),
      'Test 39: Practice problems catalog remains functional (Milestone 10 regression check)'
    );

    // Test 40: Single problem retrieval returns details without leaks
    const singleProbRes = await fetch(`${API_BASE}/api/problems/two-sum`);
    const singleProbData = await singleProbRes.json();
    assert(
      singleProbRes.status === 200 &&
        singleProbData.data?.title === 'Two Sum' &&
        singleProbData.data?.testCases,
      'Test 40: Single practice problem retrieval works as expected'
    );

    // Test 41: User profile retrieval and persistence work
    const getProfileRes = await fetch(`${API_BASE}/api/users/me`, {
      headers: { Authorization: `Bearer ${learnerToken}` }
    });
    const getProfileData = await getProfileRes.json();
    assert(
      getProfileRes.status === 200 && getProfileData.user?.email === learnerEmail,
      'Test 41: User profile persistence functions correctly (Milestone 9 regression check)'
    );

    // Test 42: Docker code execution status endpoint reports valid runtime status
    const dockerStatusRes = await fetch(`${API_BASE}/api/code/status`);
    const dockerStatusData = await dockerStatusRes.json();
    if (dockerStatusData.sandboxAvailable) {
      assert(
        dockerStatusRes.status === 200 && dockerStatusData.success === true,
        'Test 42: Docker container sandbox is active and ready for execution'
      );
    } else {
      markBlocked(
        '42',
        'Docker Sandbox Runtime Execution',
        'Docker Desktop daemon is offline. Sandboxed code execution safely reports SANDBOX_UNAVAILABLE without crashing.'
      );
    }

  } catch (error) {
    console.error('\nUnexpected verification error:', error);
    failed++;
  } finally {
    // Clean up temporary test data from MongoDB
    try {
      if (learnerUserId) {
        await db.collection('users').deleteOne({ _id: new mongoose.Types.ObjectId(learnerUserId) });
      }
      if (adminUserId) {
        await db.collection('users').deleteOne({ _id: new mongoose.Types.ObjectId(adminUserId) });
      }
      if (demoteUserId) {
        await db.collection('users').deleteOne({ _id: new mongoose.Types.ObjectId(demoteUserId) });
      }
      if (createdQuestionId) {
        await db.collection('questions').deleteOne({ id: createdQuestionId });
      }
      if (createdQuizId) {
        await db.collection('quizzes').deleteOne({ _id: new mongoose.Types.ObjectId(createdQuizId) });
      }
      if (attemptId) {
        await db.collection('quiz_attempts').deleteOne({ _id: new mongoose.Types.ObjectId(attemptId) });
      }
      await db.collection('audit_logs').deleteMany({
        actorEmail: { $in: [adminTestEmail, demoteTestEmail] }
      });
      console.log('\n[Cleanup] Test records cleaned up successfully.');
    } catch (cleanupErr) {
      console.warn('[Cleanup Warning]', cleanupErr.message);
    }

    await mongoose.disconnect();
  }

  console.log('\n==================================================');
  console.log(`VERIFICATION SUMMARY:`);
  console.log(`  Passed:  ${passed}`);
  console.log(`  Blocked: ${blocked}`);
  console.log(`  Failed:  ${failed}`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
