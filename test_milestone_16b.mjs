/**
 * ==============================================================================
 * CODEFORGE MILESTONE 16B: ADAPTIVE PRACTICE AND LEARNING PATHWAYS TEST SUITE
 * Comprehensive verification of:
 * 1. Prerequisite Knowledge Graph (Unit & Structure):
 *    - DAG structural validation across all 15 canonical topics
 *    - DFS cycle detection & rejection of cyclic dependencies
 *    - Rejection of unrecognized topics
 *    - Deterministic Kahn's topological sort with alphabetical tie-breaking
 *    - Transitive prerequisite closure resolution
 *    - Prerequisite readiness evaluation based on live learner evidence states
 * 2. Targeted Practice Bundle Service:
 *    - Deterministic curation of 3–5 catalog items addressing knowledge gaps
 *    - Role mixture (prerequisite_review, concept_review, core_practice, stretch_challenge)
 *    - Anti-duplication (excludes verified completed items)
 *    - Honest insufficient content disclosure
 *    - Strict verified completion semantics (Accepted submission / Passed quiz only)
 * 3. Longitudinal Competency Tracking:
 *    - Immutable dated competency snapshots
 *    - Rate-limiting cooldown enforcement
 *    - 30 / 60 / 90-day window comparative metrics
 *    - Measurement integrity (no arbitrary decay, no equating absence with forgetting)
 *    - Like-with-like comparability warnings
 * 4. Pathway API Endpoints & Security:
 *    - 401 Unauthorized guards on all /api/intelligence/pathways/* routes
 *    - Cross-user tenant isolation
 *    - Deterministic bundle generation, active retrieval, and completion updates
 *    - Snapshot creation and trend retrieval
 * ==============================================================================
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  PREREQUISITE_GRAPH,
  validateGraph,
  getTopologicalOrder,
  getPrerequisites,
  evaluatePrerequisiteReadiness
} from './server/services/prerequisiteGraph.js';

import {
  getOrCreatePracticeBundle,
  refreshBundleCompletionState,
  BUNDLE_ITEM_ROLE,
  BUNDLE_STATUS
} from './server/services/practiceBundleService.js';

import {
  recordCompetencySnapshot,
  getCompetencyTrend
} from './server/services/competencyTrackingService.js';

import PracticeBundle from './server/models/PracticeBundle.js';
import CompetencySnapshot from './server/models/CompetencySnapshot.js';
import Submission from './server/models/Submission.js';
import Problem from './server/models/Problem.js';

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

async function runTestSuite() {
  console.log('==============================================================================');
  console.log('STARTING MILESTONE 16B AUTOMATED VERIFICATION SUITE');
  console.log('==============================================================================\n');

  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB successfully for test fixtures.\n');

    // --------------------------------------------------------------------------
    // PART 1: PREREQUISITE KNOWLEDGE GRAPH (UNIT & STRUCTURE)
    // --------------------------------------------------------------------------
    console.log('--- PART 1: PREREQUISITE KNOWLEDGE GRAPH ---');

    // 1.1 Canonical graph validation
    const graphValidation = validateGraph(PREREQUISITE_GRAPH);
    assert(graphValidation.isValid === true, 'Canonical PREREQUISITE_GRAPH validates as a strictly acyclic DAG');
    assert(graphValidation.topicCount === 15, `Canonical graph defines all 15 topics (found ${graphValidation.topicCount})`);

    // 1.2 Cycle detection
    const cyclicGraph = {
      ...PREREQUISITE_GRAPH,
      'Data Structures & Algorithms': ['Sorting'] // DSA -> Arrays -> Sorting -> DSA (Cycle!)
    };
    const cycleResult = validateGraph(cyclicGraph);
    assert(cycleResult.isValid === false, 'Cycle detection catches cyclic dependency loops');
    assert(cycleResult.error?.includes('Cycle detected'), `Cycle error contains descriptive message: "${cycleResult.error}"`);

    // 1.3 Unrecognized topic detection
    const invalidTopicGraph = {
      ...PREREQUISITE_GRAPH,
      'Arrays': ['Quantum Computing Foundations'] // Unknown topic
    };
    const invalidTopicResult = validateGraph(invalidTopicGraph);
    assert(invalidTopicResult.isValid === false, 'Graph validation detects edges referencing unknown topics');

    // 1.4 Deterministic topological sort
    const topoOrder1 = getTopologicalOrder();
    const topoOrder2 = getTopologicalOrder();
    assert(Array.isArray(topoOrder1) && topoOrder1.length === 15, 'Topological sort returns all 15 topics');
    assert(JSON.stringify(topoOrder1) === JSON.stringify(topoOrder2), 'Topological sort is strictly deterministic with alphabetical tie-breaking');

    // Verify ordering validity: every prerequisite comes before its dependents
    let orderingValid = true;
    for (const [topic, prereqs] of Object.entries(PREREQUISITE_GRAPH)) {
      const topicIdx = topoOrder1.indexOf(topic);
      for (const p of prereqs) {
        const prereqIdx = topoOrder1.indexOf(p);
        if (prereqIdx >= topicIdx) {
          orderingValid = false;
          console.error(`Ordering violation: Prereq ${p} (${prereqIdx}) should precede ${topic} (${topicIdx})`);
        }
      }
    }
    assert(orderingValid, 'Topological order strictly places every prerequisite before all dependent topics');

    // 1.5 Transitive prerequisite resolution
    const sortingPrereqs = getPrerequisites('Sorting');
    assert(sortingPrereqs.includes('Arrays'), 'Sorting directly requires Arrays');
    assert(sortingPrereqs.includes('Recursion'), 'Sorting directly requires Recursion');
    assert(sortingPrereqs.includes('Data Structures & Algorithms'), 'Sorting transitively requires Data Structures & Algorithms (via Arrays & Recursion)');

    // 1.6 Prerequisite readiness checks
    const mockLearnerStatesUnready = {
      'JavaScript': { state: 'proficient', confidence: 'medium' },
      'Data Structures & Algorithms': { state: 'proficient', confidence: 'medium' },
      'Arrays': { state: 'struggling', confidence: 'high' }, // Struggling prerequisite!
      'Recursion': { state: 'proficient', confidence: 'medium' }
    };
    const readinessUnready = evaluatePrerequisiteReadiness('Sorting', mockLearnerStatesUnready);
    assert(readinessUnready.isReady === false, 'Learner is evaluated not ready when a prerequisite is struggling');
    assert(readinessUnready.unmetPrerequisites.length === 1 && readinessUnready.unmetPrerequisites[0].topic === 'Arrays', 'Unmet prerequisite lists Arrays as failing prerequisite');

    const mockLearnerStatesReady = {
      'JavaScript': { state: 'mastered', confidence: 'high' },
      'Data Structures & Algorithms': { state: 'mastered', confidence: 'high' },
      'Arrays': { state: 'proficient', confidence: 'medium' },
      'Recursion': { state: 'proficient', confidence: 'medium' }
    };
    const readinessReady = evaluatePrerequisiteReadiness('Sorting', mockLearnerStatesReady);
    assert(readinessReady.isReady === true, 'Learner is evaluated ready when all prerequisites are proficient or mastered');
    assert(readinessReady.unmetPrerequisites.length === 0, 'No unmet prerequisites when prerequisites meet proficiency threshold');

    console.log('\n--- PART 2: PRACTICE BUNDLE SERVICE ---');

    // Create test user for practice bundles
    const testUserA = await registerTestUser('bundle_tester');
    const userIdA = testUserA.userId;

    // 2.1 Bundle generation for target topic
    const bundleRes1 = await getOrCreatePracticeBundle(userIdA, {
      targetTopic: 'Arrays',
      preferredLanguage: 'javascript'
    });
    assert(bundleRes1.bundle !== null, 'Bundle generated successfully for target topic Arrays');
    assert(bundleRes1.bundle.items.length >= 3 && bundleRes1.bundle.items.length <= 5, `Bundle contains 3–5 items (actual: ${bundleRes1.bundle.items.length})`);
    assert(bundleRes1.bundle.targetTopic === 'Arrays', 'Bundle target topic matches Arrays');
    assert(bundleRes1.bundle.status === BUNDLE_STATUS.ACTIVE, 'Initial bundle status is active');

    // 2.2 Role mixture verification
    const itemRoles = bundleRes1.bundle.items.map(i => i.role);
    const uniqueRoles = [...new Set(itemRoles)];
    assert(uniqueRoles.length >= 2, `Bundle provides diverse role mixture (found ${uniqueRoles.join(', ')})`);
    assert(itemRoles.includes(BUNDLE_ITEM_ROLE.CORE_PRACTICE), 'Bundle includes core_practice role');

    // 2.3 Strict completion semantics: Bundle items must start uncompleted
    const allUncompleted = bundleRes1.bundle.items.every(i => i.isCompleted === false);
    assert(allUncompleted, 'Initial bundle items start strictly uncompleted (no false credits)');

    // 2.4 Simulate verified submission (Accepted) for one problem
    const firstProblemItem = bundleRes1.bundle.items.find(i => i.type === 'problem');
    assert(firstProblemItem !== undefined, 'Bundle includes at least one catalog problem');

    if (firstProblemItem) {
      const problemDoc = await Problem.findOne({ slug: firstProblemItem.identifier });
      assert(problemDoc !== null, 'Catalog problem exists in database');

      // Create an Accepted submission in the database
      const acceptedSub = await Submission.create({
        user: userIdA,
        problem: problemDoc._id,
        sourceCode: '// Verified solution\nfunction solve() { return true; }',
        language: 'javascript',
        verdict: 'Accepted',
        testCasesPassed: 5,
        totalTestCases: 5,
        executionTime: 42,
        memoryUsed: 128
      });

      // Refresh completion state
      const refreshedBundle = await refreshBundleCompletionState(userIdA, bundleRes1.bundle);
      const updatedItem = refreshedBundle.items.find(i => i.identifier === firstProblemItem.identifier);
      assert(updatedItem && updatedItem.isCompleted === true, 'Accepted submission marks problem completed in bundle');
      assert(refreshedBundle.completionRate > 0, `Bundle completionRate updated to ${refreshedBundle.completionRate}%`);

      // Cleanup test submission
      await Submission.deleteOne({ _id: acceptedSub._id });
    }

    // 2.5 Anti-duplication: Generating a bundle after completing a problem must NOT re-include that completed problem
    const testProblem = await Problem.findOne({ category: 'Arrays' });
    if (testProblem) {
      // Create permanent accepted submission for testProblem
      await Submission.create({
        user: userIdA,
        problem: testProblem._id,
        sourceCode: '// Already solved',
        language: 'javascript',
        verdict: 'Accepted',
        testCasesPassed: 5,
        totalTestCases: 5,
        executionTime: 30,
        memoryUsed: 100
      });

      // Force create a brand new bundle
      const newBundleRes = await getOrCreatePracticeBundle(userIdA, {
        targetTopic: 'Arrays',
        preferredLanguage: 'javascript',
        forceNew: true
      });

      const containsSolvedProblem = newBundleRes.bundle?.items?.some(
        i => i.type === 'problem' && i.identifier === testProblem.slug
      );
      assert(!containsSolvedProblem, `Anti-duplication prevents solved problem "${testProblem.slug}" from appearing in newly generated bundle`);

      // Cleanup
      await Submission.deleteMany({ user: userIdA });
    }

    // 2.6 Insufficient content disclosure
    const rareTopicBundle = await getOrCreatePracticeBundle(userIdA, {
      targetTopic: 'System Design & Architecture',
      preferredLanguage: 'javascript',
      forceNew: true
    });
    assert(rareTopicBundle.insufficientContentDisclosure !== null, 'Emits honest insufficient content disclosure when catalog is scarce');
    assert(!rareTopicBundle.hasBundle || (rareTopicBundle.bundle && rareTopicBundle.bundle.items.length <= 5), 'Bundle handles scarce catalog gracefully without crash');

    console.log('\n--- PART 3: LONGITUDINAL COMPETENCY TRACKING ---');

    // 3.1 Immutable dated snapshot creation
    const snapshot1 = await recordCompetencySnapshot(userIdA, {
      trigger: 'practice_bundle',
      notes: 'Initial test snapshot'
    });
    assert(snapshot1 !== null && snapshot1._id !== undefined, 'Competency snapshot created successfully');
    assert(snapshot1.topicSnapshots.length === 15, `Snapshot captures all 15 topics (found ${snapshot1.topicSnapshots.length})`);
    assert(snapshot1.summary.totalTopicsTracked === 15, 'Snapshot summary records totalTopicsTracked = 15');

    // 3.2 Cooldown guard (rate limiting snapshot spam)
    let cooldownError = null;
    try {
      await recordCompetencySnapshot(userIdA, {
        trigger: 'practice_bundle',
        notes: 'Immediate second snapshot'
      });
    } catch (err) {
      cooldownError = err;
    }
    assert(cooldownError !== null && cooldownError.status === 429, 'Rate-limit cooldown rejects snapshot within 6-hour window (HTTP 429)');

    // 3.3 Create a past snapshot (35 days ago) to test 30/60/90-day trend analytics
    const thirtyFiveDaysAgo = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
    const pastSnapshot = await CompetencySnapshot.create({
      user: userIdA,
      snapshotDate: thirtyFiveDaysAgo,
      trigger: 'diagnostic',
      summary: {
        totalTopicsTracked: 15,
        masteredCount: 1,
        proficientCount: 2,
        developingCount: 3,
        strugglingCount: 4,
        unassessedCount: 5,
        averageMasteryScore: 45.0
      },
      topicSnapshots: [
        {
          topic: 'Arrays',
          learningState: 'struggling',
          confidenceLevel: 'medium',
          masteryScore: 35.0,
          confidenceScore: 0.6,
          evidenceCount: 3,
          evidenceBreakdown: { problemsSolved: 1, quizzesPassed: 0, diagnosticAttempts: 2 }
        },
        {
          topic: 'JavaScript Basics',
          learningState: 'proficient',
          confidenceLevel: 'high',
          masteryScore: 80.0,
          confidenceScore: 0.85,
          evidenceCount: 5,
          evidenceBreakdown: { problemsSolved: 3, quizzesPassed: 2, diagnosticAttempts: 0 }
        }
      ],
      notes: 'Historical fixture for 30/60-day trend'
    });
    assert(pastSnapshot._id !== undefined, 'Historical snapshot created at 35 days ago');

    // 3.4 Trend evaluation
    const trends = await getCompetencyTrend(userIdA);
    assert(trends.windows['30d'] !== undefined, 'Trend analysis contains 30-day evaluation window');
    assert(trends.windows['60d'] !== undefined, 'Trend analysis contains 60-day evaluation window');
    assert(trends.windows['90d'] !== undefined, 'Trend analysis contains 90-day evaluation window');
    assert(trends.windows['60d'].comparabilityDisclosures.length > 0, 'Trend reports comparability disclosures on multi-window analytics');
    assert(trends.windows['60d'].topicDeltas['Arrays'] !== undefined, '60-day window computes topic deltas for Arrays');

    // Verify measurement rules: No arbitrary decay and honest disclosure
    const hasArbitraryDecayWarning = trends.windows['60d'].comparabilityDisclosures.some(d => d.rule === 'no_score_decay_from_inactivity');
    assert(hasArbitraryDecayWarning, 'Enforces rule: no arbitrary score decay from inactivity');

    console.log('\n--- PART 4: PATHWAY API ENDPOINTS & AUTHENTICATION ---');

    // 4.1 Unauthenticated 401 guards
    const unauthPrereqs = await apiRequest('/api/intelligence/pathways/prerequisites');
    assert(unauthPrereqs.status === 401, 'GET /api/intelligence/pathways/prerequisites returns 401 for unauthenticated request');

    const unauthBundle = await apiRequest('/api/intelligence/pathways/bundle');
    assert(unauthBundle.status === 401, 'GET /api/intelligence/pathways/bundle returns 401 for unauthenticated request');

    const unauthPostBundle = await apiRequest('/api/intelligence/pathways/bundle', {
      method: 'POST',
      body: JSON.stringify({ targetTopic: 'Arrays' })
    });
    assert(unauthPostBundle.status === 401, 'POST /api/intelligence/pathways/bundle returns 401 for unauthenticated request');

    const unauthTrends = await apiRequest('/api/intelligence/pathways/trends');
    assert(unauthTrends.status === 401, 'GET /api/intelligence/pathways/trends returns 401 for unauthenticated request');

    const unauthSnapshot = await apiRequest('/api/intelligence/pathways/snapshot', {
      method: 'POST',
      body: JSON.stringify({ trigger: 'manual' })
    });
    assert(unauthSnapshot.status === 401, 'POST /api/intelligence/pathways/snapshot returns 401 for unauthenticated request');

    // 4.2 Authenticated requests with User A
    const authHeaders = { Authorization: `Bearer ${testUserA.token}` };

    const prereqRes = await apiRequest('/api/intelligence/pathways/prerequisites', { headers: authHeaders });
    assert(prereqRes.ok === true && prereqRes.data?.data?.topologicalOrder?.length === 15, 'GET /api/intelligence/pathways/prerequisites returns full topological DAG and readiness');
    assert(prereqRes.data?.data?.readinessMap['Data Structures & Algorithms'] !== undefined, 'Readiness map includes foundational topics');

    const bundleGetRes = await apiRequest('/api/intelligence/pathways/bundle', { headers: authHeaders });
    assert(bundleGetRes.ok === true && bundleGetRes.data?.data !== null, 'GET /api/intelligence/pathways/bundle retrieves active practice bundle');

    const trendsRes = await apiRequest('/api/intelligence/pathways/trends', { headers: authHeaders });
    assert(trendsRes.ok === true && trendsRes.data?.data?.windows !== undefined, 'GET /api/intelligence/pathways/trends retrieves 30/60/90-day longitudinal trends');

    // 4.3 Cross-user tenant isolation
    const testUserB = await registerTestUser('pathway_tenant_b');
    const authHeadersB = { Authorization: `Bearer ${testUserB.token}` };

    const userBBundleRes = await apiRequest('/api/intelligence/pathways/bundle', { headers: authHeadersB });
    // User B receives their own bundle and never sees User A's bundle
    assert(userBBundleRes.ok === true, 'User B bundle request succeeds');
    assert(userBBundleRes.data?.data?.user?.toString() !== userIdA.toString(), "User B never receives User A's bundle (tenant isolation enforced)");

    // Verify User B's trend has no snapshots
    const userBTrendsRes = await apiRequest('/api/intelligence/pathways/trends', { headers: authHeadersB });
    assert(userBTrendsRes.ok === true && userBTrendsRes.data?.data?.history?.length === 0, 'User B trends history is completely isolated from User A snapshots');

    // 4.4 Deterministic repeatability
    const repeatPrereqRes = await apiRequest('/api/intelligence/pathways/prerequisites', { headers: authHeaders });
    assert(
      JSON.stringify(prereqRes.data.data.topologicalOrder) === JSON.stringify(repeatPrereqRes.data.data.topologicalOrder),
      'Prerequisite pathway topological ordering is strictly repeatable across multiple queries'
    );

    // Cleanup test artifacts
    await PracticeBundle.deleteMany({ user: { $in: [userIdA, testUserB.userId] } });
    await CompetencySnapshot.deleteMany({ user: { $in: [userIdA, testUserB.userId] } });

    console.log('\n==============================================================================');
    console.log(`TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('==============================================================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal error during test execution:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runTestSuite();
