/**
 * ==============================================================================
 * CODEFORGE ADAPTIVE RECOMMENDATION SCENARIOS VERIFICATION SUITE
 * 
 * Verifies Part B requirements across all 5 controlled scenarios:
 * 
 * Scenario 1: New learner with no history (baseline onboarding suggestions)
 * Scenario 2: Learner repeatedly struggles with a topic (targeted practice with evidence)
 * Scenario 3: Learner demonstrates strong performance (advances to next challenge)
 * Scenario 4: Learner improves after reassessment (progress delta & state transition)
 * Scenario 5: Insufficient or contradictory data (sample size limit disclosure)
 * 
 * Guarantees:
 * - Read-only / isolated test data: Zero mutations to production database
 * - Zero impact on Faculty Demo Auditor or Admin records
 * - Complete audit of data sources and recommendation ordering rules
 * ==============================================================================
 */

import {
  generateRoadmap,
  TOPIC_STATE,
  ACTION_TYPE
} from './server/services/roadmapPlanner.js';
import { compareDiagnosticSessions } from './server/services/reassessmentService.js';

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

async function runScenarioAudit() {
  console.log('\n===============================================================');
  console.log('CODEFORGE: ADAPTIVE RECOMMENDATION SCENARIO AUDIT SUITE');
  console.log('===============================================================\n');

  // ---------------------------------------------------------------------------
  // SCENARIO 1: New learner with no history
  // ---------------------------------------------------------------------------
  console.log('--- SCENARIO 1: New Learner with No Assessment History ---');
  const user1 = {
    _id: 'mock-user-1',
    selectedTopics: ['JavaScript', 'Arrays'],
    languages: [{ language: 'javascript', status: 'new' }]
  };

  const roadmap1 = generateRoadmap({
    user: user1,
    latestDiagnostic: null,
    completedProblemSlugs: new Set(),
    passedQuizIds: new Set()
  });

  assert(roadmap1.stats.totalItems === 2, 'Scenario 1: Generates 2 baseline recommendations');
  assert(roadmap1.stats.completedItems === 0, 'Scenario 1: Completed items is 0 (0% progress)');
  assert(roadmap1.stats.needsRevisionCount === 0, 'Scenario 1: Needs revision count is 0 (no false gaps)');
  assert(roadmap1.stats.promisingCount === 0, 'Scenario 1: Promising count is 0 (no false mastery)');

  const rec1_js = roadmap1.recommendations.find(r => r.topic === 'JavaScript');
  const rec1_arr = roadmap1.recommendations.find(r => r.topic === 'Arrays');

  assert(rec1_js && rec1_js.state === TOPIC_STATE.NOT_STARTED, 'Scenario 1: JavaScript state is NOT_STARTED');
  assert(rec1_arr && rec1_arr.state === TOPIC_STATE.NOT_STARTED, 'Scenario 1: Arrays state is NOT_STARTED');
  assert(
    rec1_js.reason.includes('No learning activity recorded yet'),
    'Scenario 1: JavaScript reason explicitly discloses no prior learning activity'
  );
  assert(
    rec1_arr.destinationUrl === '/practice/two-sum',
    'Scenario 1: Arrays recommends baseline entry problem Two Sum (/practice/two-sum)'
  );
  assert(
    rec1_js.destinationUrl.includes('/quiz?quizId=javascript-fundamentals'),
    'Scenario 1: JavaScript recommends diagnostic quiz to establish initial baseline'
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 2: Learner repeatedly struggles with a topic
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO 2: Learner Repeatedly Struggles With a Topic ---');
  const user2 = {
    _id: 'mock-user-2',
    selectedTopics: ['JavaScript', 'Arrays']
  };

  const diagnosticStruggle = {
    status: 'submitted',
    submittedAt: new Date(),
    score: 3,
    maxScore: 5,
    percentage: 60,
    topicResults: [
      {
        topic: 'JavaScript',
        answeredQuestions: 3,
        totalQuestions: 3,
        correctAnswers: 1,
        accuracyPercentage: 33,
        evidenceStatus: 'needs_revision'
      },
      {
        topic: 'Arrays',
        answeredQuestions: 2,
        totalQuestions: 2,
        correctAnswers: 2,
        accuracyPercentage: 100,
        evidenceStatus: 'solid_evidence'
      }
    ]
  };

  const roadmap2 = generateRoadmap({
    user: user2,
    latestDiagnostic: diagnosticStruggle,
    completedProblemSlugs: new Set(),
    passedQuizIds: new Set()
  });

  const rec2_js = roadmap2.recommendations.find(r => r.topic === 'JavaScript');
  assert(rec2_js && rec2_js.state === TOPIC_STATE.NEEDS_REVISION, 'Scenario 2: Low score (<70%) triggers NEEDS_REVISION');
  assert(rec2_js.actionType === ACTION_TYPE.REVIEW, 'Scenario 2: Action type is REVIEW');
  assert(rec2_js.difficulty === 'Easy', 'Scenario 2: Difficulty calibrated to Easy for foundational rebuilding');
  assert(
    rec2_js.evidenceSummary.accuracy === 33 && rec2_js.evidenceSummary.correct === 1,
    'Scenario 2: Evidence summary preserves exact test scores (1/3, 33%)'
  );
  assert(
    rec2_js.reason.includes('33% accuracy') || rec2_js.reason.includes('foundational gaps'),
    'Scenario 2: Recommendation explanation cites diagnostic evidence (33% accuracy)'
  );
  assert(
    roadmap2.recommendations[0].topic === 'JavaScript',
    'Scenario 2: Priority ordering places needs_revision at top of roadmap ahead of promising topics'
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 3: Learner demonstrates strong performance
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO 3: Learner Demonstrates Strong Performance ---');
  const rec2_arr = roadmap2.recommendations.find(r => r.topic === 'Arrays');
  assert(rec2_arr && rec2_arr.state === TOPIC_STATE.PROMISING, 'Scenario 3: High score (100%) triggers PROMISING');
  assert(rec2_arr.actionType === ACTION_TYPE.ADVANCE, 'Scenario 3: Action type is ADVANCE');
  assert(
    rec2_arr.reason.includes('100%') || rec2_arr.reason.includes('Solid'),
    'Scenario 3: Recommendation acknowledges strong diagnostic performance (100%)'
  );

  // When learner already solved Two Sum, roadmap should advance to next difficulty
  const roadmap3_advanced = generateRoadmap({
    user: user2,
    latestDiagnostic: diagnosticStruggle,
    completedProblemSlugs: new Set(['two-sum']),
    passedQuizIds: new Set()
  });
  const rec3_arr_advanced = roadmap3_advanced.recommendations.find(r => r.topic === 'Arrays');
  assert(
    rec3_arr_advanced.destinationUrl === '/practice/container-with-most-water',
    'Scenario 3: Solved beginner problem Two Sum advances to Container With Most Water (Medium)'
  );
  assert(
    rec3_arr_advanced.difficulty === 'Medium',
    'Scenario 3: Recommended challenge difficulty upgraded to Medium'
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 4: Learner improves after reassessment
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO 4: Learner Improves After Reassessment ---');
  
  const diagnosticReassessment = {
    status: 'submitted',
    submittedAt: new Date(Date.now() + 60000),
    score: 5,
    maxScore: 5,
    percentage: 100,
    topicResults: [
      {
        topic: 'JavaScript',
        answeredQuestions: 3,
        totalQuestions: 3,
        correctAnswers: 3,
        accuracyPercentage: 100,
        evidenceStatus: 'solid_evidence'
      },
      {
        topic: 'Arrays',
        answeredQuestions: 2,
        totalQuestions: 2,
        correctAnswers: 2,
        accuracyPercentage: 100,
        evidenceStatus: 'solid_evidence'
      }
    ]
  };

  // Compare sessions
  const comparison = compareDiagnosticSessions(diagnosticStruggle, diagnosticReassessment);
  assert(comparison.hasComparison === true, 'Scenario 4: Reassessment engine detects two submitted sessions');
  assert(comparison.overallDeltaPercentage > 0, 'Scenario 4: Calculates positive overall percentage delta');

  const jsComparison = comparison.topicComparisons.find(t => t.topic === 'JavaScript');
  assert(jsComparison && jsComparison.status === 'encouraging_progress', 'Scenario 4: JavaScript classified as encouraging_progress');
  assert(jsComparison.deltaPercentage === 67, 'Scenario 4: JavaScript delta computed as +67 percentage points');

  // Generate roadmap with reassessment comparison
  const roadmap4 = generateRoadmap({
    user: user2,
    latestDiagnostic: diagnosticReassessment,
    completedProblemSlugs: new Set(['two-sum']),
    passedQuizIds: new Set(),
    reassessmentComparison: comparison
  });

  const rec4_js = roadmap4.recommendations.find(r => r.topic === 'JavaScript');
  assert(
    rec4_js.state === TOPIC_STATE.PROMISING,
    'Scenario 4: Prior needs_revision topic transitions to PROMISING upon score improvement'
  );
  assert(
    rec4_js.reassessmentSummary !== null && rec4_js.reassessmentSummary.status === 'encouraging_progress',
    'Scenario 4: Recommendation includes reassessmentSummary object with status encouraging_progress'
  );
  assert(
    rec4_js.reason.includes('encouraging progress (+67%)'),
    'Scenario 4: Recommendation reason text highlights observed reassessment improvement (+67%)'
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 5: Insufficient or Contradictory Data
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO 5: Insufficient or Contradictory Data ---');

  const diagnosticSmallSample = {
    status: 'submitted',
    submittedAt: new Date(),
    topicResults: [
      {
        topic: 'Operating Systems',
        answeredQuestions: 1, // Only 1 question answered
        totalQuestions: 1,
        correctAnswers: 1,
        accuracyPercentage: 100, // 100% on 1 question
        evidenceStatus: 'not_enough_evidence'
      }
    ],
    unassessedTopics: [
      { topic: 'Cybersecurity', reason: 'unassessed' }
    ]
  };

  const user5 = {
    _id: 'mock-user-5',
    selectedTopics: ['Operating Systems', 'Cybersecurity']
  };

  const roadmap5 = generateRoadmap({
    user: user5,
    latestDiagnostic: diagnosticSmallSample,
    completedProblemSlugs: new Set(),
    passedQuizIds: new Set()
  });

  const rec5_os = roadmap5.recommendations.find(r => r.topic === 'Operating Systems');
  assert(
    rec5_os && rec5_os.state === TOPIC_STATE.NOT_ENOUGH_EVIDENCE,
    'Scenario 5: Sample size < 2 is classified NOT_ENOUGH_EVIDENCE despite 100% score'
  );
  assert(
    rec5_os.evidenceSummary.sampleSize === 1,
    'Scenario 5: Evidence summary records sampleSize = 1'
  );
  assert(
    rec5_os.reason.includes('Only 1 question was assessed') || rec5_os.reason.includes('too small'),
    'Scenario 5: Explicitly discloses sample size limitation in recommendation reason'
  );
  assert(
    rec5_os.actionType === ACTION_TYPE.QUIZ || rec5_os.actionType === ACTION_TYPE.DIAGNOSE,
    'Scenario 5: Action guides learner to dedicated quiz or diagnostic to build evidence'
  );

  const rec5_cyber = roadmap5.recommendations.find(r => r.topic === 'Cybersecurity');
  assert(
    rec5_cyber && rec5_cyber.state === TOPIC_STATE.UNASSESSED,
    'Scenario 5: Unassessed topic is honestly labeled UNASSESSED without claiming false ability'
  );
  assert(
    rec5_cyber.reason.includes('not assessed') || rec5_cyber.reason.includes('not been assessed'),
    'Scenario 5: Unassessed reason honestly explains no diagnostic data is available'
  );

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`SCENARIO AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runScenarioAudit();
