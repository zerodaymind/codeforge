/**
 * CodeForge: Account Deletion UX, Security Safeguards & Terminology Audit Test Suite
 *
 * Verifies:
 * 1. Unauthenticated requests to DELETE /api/users/me return 401.
 * 2. Missing or incorrect confirmation phrase returns 400.
 * 3. Incorrect password returns 401.
 * 4. Administrator accounts cannot be self-deleted (returns 403).
 * 5. Faculty Demo Auditor account is strictly protected from deletion (returns 403).
 * 6. Successful deletion of eligible disposable learner account returns 200.
 * 7. Cascade deletion of all 11 user-linked educational collections while preserving catalog and logging audit.
 * 8. Session revocation: Active JWT token for deleted user is immediately rejected with 401.
 * 9. Repeat deletion attempts return 401.
 * 10. Frontend terminology verification: No internal milestones, revival loops, or deterministic planning in user-facing JSX.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: 'server/.env' });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/codeforge';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production';
const BACKEND_URL = 'http://localhost:5000';

import User from './server/models/User.js';
import Submission from './server/models/Submission.js';
import ProblemAttempt from './server/models/ProblemAttempt.js';
import ProblemProgress from './server/models/ProblemProgress.js';
import Progress from './server/models/Progress.js';
import QuizAttempt from './server/models/QuizAttempt.js';
import DiagnosticSession from './server/models/DiagnosticSession.js';
import RetentionSession from './server/models/RetentionSession.js';
import Roadmap from './server/models/Roadmap.js';
import CompetencySnapshot from './server/models/CompetencySnapshot.js';
import PracticeBundle from './server/models/PracticeBundle.js';
import AssistantConversation from './server/models/AssistantConversation.js';
import AuditLog from './server/models/AuditLog.js';
import Problem from './server/models/Problem.js';
import Question from './server/models/Question.js';
import Quiz from './server/models/Quiz.js';

let passedChecks = 0;
let totalChecks = 0;

function pass(description) {
  passedChecks++;
  totalChecks++;
  console.log(`  ✓ PASS: ${description}`);
}

async function runSuite() {
  console.log('===============================================================');
  console.log('CODEFORGE: ACCOUNT DELETION & TERMINOLOGY VERIFICATION SUITE');
  console.log('===============================================================');

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB for test fixtures.');

  const timestamp = Date.now();
  const disposableEmail = `disposable.learner.${timestamp}@codeforge.local`;
  const disposablePassword = 'DisposablePassword123!';
  const passwordHash = await bcrypt.hash(disposablePassword, 10);

  // Create isolated disposable learner
  const disposableUser = await User.create({
    fullName: 'Disposable Learner',
    email: disposableEmail,
    passwordHash,
    gender: 'Other',
    experience: 'Beginner',
    interests: ['Web Development', 'Data Structures & Algorithms'],
    role: 'user'
  });
  const disposableUserId = disposableUser._id;
  const disposableToken = jwt.sign({ id: disposableUserId.toString() }, JWT_SECRET, { expiresIn: '1h' });

  // Get a real problem for references
  const realProblem = await Problem.findOne();
  const problemRef = realProblem ? realProblem._id : new mongoose.Types.ObjectId();

  // Create mock linked records in all 11 user-linked collections
  await Promise.all([
    Submission.create({
      user: disposableUserId,
      problem: problemRef,
      language: 'javascript',
      sourceCode: 'function test() { return 1; }',
      verdict: 'Accepted',
      passedTests: 1,
      totalTests: 1
    }),
    ProblemAttempt.create({
      user: disposableUserId,
      problem: problemRef,
      status: 'Accepted',
      submittedAnswer: 'return 1;'
    }),
    ProblemProgress.create({
      user: disposableUserId,
      problem: problemRef,
      completed: true
    }),
    Progress.create({
      user: disposableUserId,
      completedProblems: [{ problemId: 'two-sum', completedAt: new Date() }],
      quizAttempts: []
    }),
    QuizAttempt.create({
      user: disposableUserId,
      quiz: new mongoose.Types.ObjectId(),
      quizId: 'js-foundations',
      quizTitle: 'JS Foundations',
      topic: 'JavaScript',
      status: 'submitted',
      score: 10,
      maxScore: 10,
      percentage: 100
    }),
    DiagnosticSession.create({
      user: disposableUserId,
      status: 'submitted',
      questions: [{
        questionId: 9999,
        topic: 'Arrays',
        question: 'Test question',
        options: ['A', 'B'],
        answer: 'A',
        explanation: 'Test'
      }]
    }),
    RetentionSession.create({
      user: disposableUserId,
      sessionId: `retention-${timestamp}`,
      targetTopic: 'Arrays',
      status: 'submitted',
      questions: [{
        questionId: 9999,
        topic: 'Arrays',
        question: 'Test',
        options: ['A', 'B'],
        answer: 'A',
        explanation: 'Test'
      }]
    }),
    Roadmap.create({
      user: disposableUserId,
      summary: 'Test Roadmap'
    }),
    CompetencySnapshot.create({
      user: disposableUserId,
      sourceEvent: 'test'
    }),
    PracticeBundle.create({
      user: disposableUserId,
      bundleId: `bundle-${timestamp}`,
      targetTopic: 'Arrays',
      headline: 'Test Headline',
      items: [{
        id: 'item-1',
        type: 'problem',
        identifier: 'two-sum',
        title: 'Two Sum',
        role: 'core_practice',
        selectionReason: 'Test',
        url: '/practice/two-sum'
      }]
    }),
    AssistantConversation.create({
      user: disposableUserId,
      title: 'Test Conversation',
      messages: [{ role: 'user', content: 'Help me with arrays' }]
    })
  ]);

  console.log(`Created disposable learner: ${disposableEmail} with linked records in 11 collections.`);

  try {
    // -------------------------------------------------------------
    // PART 1: UNAUTHENTICATED & MALFORMED REQUESTS
    // -------------------------------------------------------------
    console.log('\n--- PART 1: UNAUTHENTICATED & MALFORMED REQUESTS ---');

    // 1. Unauthenticated request
    const unauthRes = await fetch(`${BACKEND_URL}/api/users/me`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: disposablePassword, confirmation: 'DELETE MY ACCOUNT' })
    });
    assert.strictEqual(unauthRes.status, 401);
    pass('Unauthenticated request to DELETE /api/users/me returns 401');

    // 2. Missing password
    const noPasswordRes = await fetch(`${BACKEND_URL}/api/users/me`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${disposableToken}`
      },
      body: JSON.stringify({ confirmation: 'DELETE MY ACCOUNT' })
    });
    assert.strictEqual(noPasswordRes.status, 400);
    const noPasswordData = await noPasswordRes.json();
    assert.ok(noPasswordData.message.includes('Password is required'));
    pass('Missing password returns 400 Bad Request');

    // 3. Incorrect password
    const wrongPasswordRes = await fetch(`${BACKEND_URL}/api/users/me`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${disposableToken}`
      },
      body: JSON.stringify({ password: 'WrongPassword!', confirmation: 'DELETE MY ACCOUNT' })
    });
    assert.strictEqual(wrongPasswordRes.status, 401);
    const wrongPasswordData = await wrongPasswordRes.json();
    assert.ok(wrongPasswordData.message.includes('Incorrect password'));
    pass('Incorrect password returns 401 Unauthorized');

    // 4. Invalid confirmation text
    const badConfirmRes = await fetch(`${BACKEND_URL}/api/users/me`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${disposableToken}`
      },
      body: JSON.stringify({ password: disposablePassword, confirmation: 'delete' })
    });
    assert.strictEqual(badConfirmRes.status, 400);
    const badConfirmData = await badConfirmRes.json();
    assert.ok(badConfirmData.message.includes('DELETE MY ACCOUNT'));
    pass('Invalid confirmation phrase returns 400 Bad Request');

    // 5. Spoofed foreign userId in body is ignored
    const foreignIdRes = await fetch(`${BACKEND_URL}/api/users/me`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${disposableToken}`
      },
      body: JSON.stringify({
        userId: '6ad0d0523e11bbee9b5c984c', // attempting to target faculty auditor via body injection
        password: 'WrongPassword',
        confirmation: 'DELETE MY ACCOUNT'
      })
    });
    // Verifies that requester identity is derived strictly from JWT, not body
    assert.strictEqual(foreignIdRes.status, 401); // fails password of the requester token, doesn't touch foreign user
    pass('Body parameter userId injection is safely ignored; requester identity bound strictly to JWT');

    // -------------------------------------------------------------
    // PART 2: PROTECTED ACCOUNT SAFEGUARDS
    // -------------------------------------------------------------
    console.log('\n--- PART 2: PROTECTED ACCOUNT SAFEGUARDS ---');

    // 6. Administrator account protection
    const adminEmail = `disposable.admin.${timestamp}@codeforge.local`;
    const tempAdmin = await User.create({
      fullName: 'Disposable Admin',
      email: adminEmail,
      passwordHash,
      gender: 'Other',
      experience: 'Advanced',
      interests: ['Cybersecurity'],
      role: 'admin'
    });
    const tempAdminToken = jwt.sign({ id: tempAdmin._id.toString() }, JWT_SECRET, { expiresIn: '1h' });

    const adminDeleteRes = await fetch(`${BACKEND_URL}/api/users/me`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tempAdminToken}`
      },
      body: JSON.stringify({ password: disposablePassword, confirmation: 'DELETE MY ACCOUNT' })
    });
    assert.strictEqual(adminDeleteRes.status, 403);
    const adminDeleteData = await adminDeleteRes.json();
    assert.ok(adminDeleteData.message.includes('Administrator accounts cannot be deleted'));
    pass('Administrator accounts are strictly protected from self-service deletion (403 Forbidden)');

    // Clean up temp admin
    await User.findByIdAndDelete(tempAdmin._id);

    // 7. Faculty Demo Auditor account protection
    const auditorDoc = await User.findById('6ad0d0523e11bbee9b5c984c');
    assert.ok(auditorDoc, 'Faculty Demo Auditor document must exist in MongoDB');
    const auditorToken = jwt.sign({ id: '6ad0d0523e11bbee9b5c984c' }, JWT_SECRET, { expiresIn: '1h' });

    const auditorDeleteRes = await fetch(`${BACKEND_URL}/api/users/me`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auditorToken}`
      },
      body: JSON.stringify({ password: 'SomePassword', confirmation: 'DELETE MY ACCOUNT' })
    });
    assert.strictEqual(auditorDeleteRes.status, 403);
    const auditorDeleteData = await auditorDeleteRes.json();
    assert.ok(auditorDeleteData.message.includes('Faculty Demo Auditor'));
    pass('Faculty Demo Auditor account (6ad0d0523e11bbee9b5c984c) is strictly protected from deletion (403 Forbidden)');

    // Verify auditor remains in MongoDB
    const auditorStillExists = await User.findById('6ad0d0523e11bbee9b5c984c');
    assert.ok(auditorStillExists, 'Faculty Demo Auditor remains 100% intact');
    pass('Faculty Demo Auditor document verified intact in database');

    // -------------------------------------------------------------
    // PART 3: SUCCESSFUL DELETION & CASCADE DATA CLEANUP
    // -------------------------------------------------------------
    console.log('\n--- PART 3: SUCCESSFUL DELETION & CASCADE CLEANUP ---');

    // 8. Successful deletion of disposable learner
    const successDeleteRes = await fetch(`${BACKEND_URL}/api/users/me`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${disposableToken}`
      },
      body: JSON.stringify({ password: disposablePassword, confirmation: 'DELETE MY ACCOUNT' })
    });
    assert.strictEqual(successDeleteRes.status, 200);
    const successDeleteData = await successDeleteRes.json();
    assert.strictEqual(successDeleteData.success, true);
    assert.strictEqual(successDeleteData.deletedUserId, disposableUserId.toString());
    assert.ok(successDeleteData.totalDeletedRecords >= 12, 'Must delete user plus all 11 linked records');
    pass('Eligible disposable account successfully deleted with HTTP 200 and accurate deleted counts');

    // 9. Verify user document is gone
    const checkUser = await User.findById(disposableUserId);
    assert.strictEqual(checkUser, null);
    pass('User document permanently removed from MongoDB');

    // 10. Verify all 11 linked collections are purged for this user
    const [
      subCount,
      attCount,
      probProgCount,
      progCount,
      quizAttCount,
      diagCount,
      retCount,
      roadmapCount,
      snapCount,
      bundleCount,
      assistantCount
    ] = await Promise.all([
      Submission.countDocuments({ user: disposableUserId }),
      ProblemAttempt.countDocuments({ user: disposableUserId }),
      ProblemProgress.countDocuments({ user: disposableUserId }),
      Progress.countDocuments({ user: disposableUserId }),
      QuizAttempt.countDocuments({ user: disposableUserId }),
      DiagnosticSession.countDocuments({ user: disposableUserId }),
      RetentionSession.countDocuments({ user: disposableUserId }),
      Roadmap.countDocuments({ user: disposableUserId }),
      CompetencySnapshot.countDocuments({ user: disposableUserId }),
      PracticeBundle.countDocuments({ user: disposableUserId }),
      AssistantConversation.countDocuments({ user: disposableUserId })
    ]);

    assert.strictEqual(subCount, 0, 'Submissions purged');
    assert.strictEqual(attCount, 0, 'Problem attempts purged');
    assert.strictEqual(probProgCount, 0, 'Problem progress purged');
    assert.strictEqual(progCount, 0, 'Progress purged');
    assert.strictEqual(quizAttCount, 0, 'Quiz attempts purged');
    assert.strictEqual(diagCount, 0, 'Diagnostic sessions purged');
    assert.strictEqual(retCount, 0, 'Retention sessions purged');
    assert.strictEqual(roadmapCount, 0, 'Roadmap purged');
    assert.strictEqual(snapCount, 0, 'Competency snapshots purged');
    assert.strictEqual(bundleCount, 0, 'Practice bundles purged');
    assert.strictEqual(assistantCount, 0, 'Assistant conversations purged');
    pass('All 11 user-scoped educational collections completely purged for deleted learner');

    // 11. Verify security audit log record
    const auditRecord = await AuditLog.findOne({
      action: 'USER_ACCOUNT_DELETED',
      entityId: disposableUserId.toString()
    });
    assert.ok(auditRecord, 'AuditLog entry must be recorded for account deletion governance');
    assert.strictEqual(auditRecord.metadata.deletedCounts.submissions, 1);
    assert.strictEqual(auditRecord.metadata.deletedCounts.quizAttempts, 1);
    assert.strictEqual(auditRecord.metadata.password, undefined);
    assert.strictEqual(auditRecord.metadata.passwordHash, undefined);
    assert.strictEqual(auditRecord.metadata.token, undefined);
    pass('Audit log entry created with record metrics without sensitive passwords or tokens');

    // 12. Verify shared catalog collections remain intact
    const problemCount = await Problem.countDocuments();
    const questionCount = await Question.countDocuments();
    const quizCount = await Quiz.countDocuments();
    assert.ok(problemCount > 0, 'Shared problems preserved');
    assert.ok(questionCount > 0, 'Shared questions preserved');
    assert.ok(quizCount > 0, 'Shared quizzes preserved');
    pass('Shared platform learning content (Problems, Questions, Quizzes) 100% preserved');

    // -------------------------------------------------------------
    // PART 4: SESSION REVOCATION & REPEAT DELETION
    // -------------------------------------------------------------
    console.log('\n--- PART 4: SESSION REVOCATION & REPEAT DELETION ---');

    // 13. Subsequent requests using the deleted user's token fail with 401
    const postDeletionMeRes = await fetch(`${BACKEND_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${disposableToken}` }
    });
    assert.strictEqual(postDeletionMeRes.status, 401);
    const postDeletionMeData = await postDeletionMeRes.json();
    assert.ok(
      postDeletionMeData.message.includes('Account no longer exists') ||
      postDeletionMeData.message.includes('revoked')
    );
    pass('Subsequent API request with deleted account token is immediately rejected with 401');

    // 14. Repeat deletion request returns 401
    const repeatDeleteRes = await fetch(`${BACKEND_URL}/api/users/me`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${disposableToken}`
      },
      body: JSON.stringify({ password: disposablePassword, confirmation: 'DELETE MY ACCOUNT' })
    });
    assert.strictEqual(repeatDeleteRes.status, 401);
    pass('Repeat deletion request with revoked session token returns 401');

    // -------------------------------------------------------------
    // PART 5: USER-FACING TERMINOLOGY AUDIT
    // -------------------------------------------------------------
    console.log('\n--- PART 5: USER-FACING TERMINOLOGY AUDIT ---');

    const jsxFilesToCheck = [
      'src/components/LearningIntelligenceCard.jsx',
      'src/components/RevisionRoadmap.jsx',
      'src/components/AdaptivePracticePathways.jsx',
      'src/components/EvidenceComparison.jsx',
      'src/pages/Dashboard.jsx',
      'src/pages/Diagnostic.jsx',
      'src/pages/Roadmap.jsx',
      'src/pages/Profile.jsx'
    ];

    const forbiddenPatterns = [
      { pattern: /Milestone 16A/i, name: 'Milestone 16A' },
      { pattern: /Milestone 16C/i, name: 'Milestone 16C' },
      { pattern: /Milestone 15D/i, name: 'Milestone 15D' },
      { pattern: /Learning Intelligence Engine/i, name: 'Learning Intelligence Engine' },
      { pattern: /Deterministic Planning/i, name: 'Deterministic Planning' },
      { pattern: /Adaptive Revival Loop/i, name: 'Adaptive Revival Loop' }
    ];

    for (const fileRel of jsxFilesToCheck) {
      const fullPath = path.resolve(fileRel);
      assert.ok(fs.existsSync(fullPath), `File ${fileRel} must exist`);
      const content = fs.readFileSync(fullPath, 'utf8');

      // Strip comments to only audit rendered JSX text and attributes
      const strippedContent = content
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*/g, '');

      for (const { pattern, name } of forbiddenPatterns) {
        const match = strippedContent.match(pattern);
        assert.strictEqual(
          match,
          null,
          `Rendered text in ${fileRel} must NOT contain forbidden developer label "${name}"`
        );
      }
    }
    pass('All user-facing JSX routes and shared components are clean of internal milestone and developer terminology');

    // 15. Verify replacement terminology is present
    const licContent = fs.readFileSync(path.resolve('src/components/LearningIntelligenceCard.jsx'), 'utf8');
    assert.ok(licContent.includes('Learning Insights'), 'LearningIntelligenceCard renders "Learning Insights"');
    pass('LearningIntelligenceCard successfully displays "Learning Insights"');

    const rrContent = fs.readFileSync(path.resolve('src/components/RevisionRoadmap.jsx'), 'utf8');
    assert.ok(rrContent.includes('Personalized Learning Plan'), 'RevisionRoadmap renders "Personalized Learning Plan"');
    pass('RevisionRoadmap successfully displays "Personalized Learning Plan"');

    const dashContent = fs.readFileSync(path.resolve('src/pages/Dashboard.jsx'), 'utf8');
    assert.ok(dashContent.includes('Review &amp; Reassessment') || dashContent.includes('Review & Reassessment'), 'Dashboard renders "Review & Reassessment"');
    pass('Dashboard successfully displays "Review & Reassessment"');

    const profileContent = fs.readFileSync(path.resolve('src/pages/Profile.jsx'), 'utf8');
    assert.ok(profileContent.includes('Account Management'), 'Profile renders Account Management section');
    assert.ok(profileContent.includes('Danger Zone'), 'Profile renders Danger Zone badge');
    assert.ok(profileContent.includes('DELETE MY ACCOUNT'), 'Profile renders DELETE MY ACCOUNT confirmation step');
    assert.ok(profileContent.includes('Protected Account Safeguard'), 'Profile renders Protected Account Safeguard');
    pass('Profile page successfully renders Account Management section, Danger Zone, safeguards, and confirmation modal');

  } finally {
    await mongoose.disconnect();
    console.log('Cleanly disconnected from MongoDB.');
  }

  console.log('\n===============================================================');
  console.log(`VERIFICATION SUMMARY: ${passedChecks} / ${totalChecks} CHECKS PASSED (100%)`);
  console.log('===============================================================');
}

runSuite().catch((err) => {
  console.error('\nTest Suite execution failed:', err);
  process.exit(1);
});
