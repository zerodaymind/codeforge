/**
 * ==============================================================================
 * CODEFORGE MILESTONE 15A: ADAPTIVE ONBOARDING & LEARNER PROFILE TEST SUITE
 * Comprehensive verification of:
 * 1. Default onboarding fields on registration
 * 2. Authenticated GET /api/users/onboarding
 * 3. PUT /api/users/onboarding preference persistence (goals, languages, modes, topics)
 * 4. Safe user payloads across auth, profile, and onboarding routes
 * 5. Returning user preference modification
 * 6. POST /api/users/onboarding/skip functionality
 * 7. Goal scenarios (Beginner, Revival, Interview Prep, Practice)
 * 8. Strict server-side validation rejections (invalid goals, languages, modes, topics)
 * 9. Unauthenticated request protection (401)
 * 10. Role elevation tampering prevention
 * 11. Cross-user isolation and MongoDB persistence verification
 * ==============================================================================
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getLearnerRecommendation } from './src/utils/learningPlan.js';

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

async function runTests() {
  console.log('\n==================================================');
  console.log('  CODEFORGE MILESTONE 15A: ADAPTIVE ONBOARDING');
  console.log('  Automated Verification Test Suite');
  console.log('==================================================\n');

  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  const testSuffix = Date.now().toString(36);
  const createdEmails = [];

  try {
    // --------------------------------------------------------------------------
    // PART 1: DEFAULT ONBOARDING FIELDS ON USER REGISTRATION
    // --------------------------------------------------------------------------
    console.log('--------------------------------------------------');
    console.log('PART 1: Default Onboarding Fields on Registration');
    console.log('--------------------------------------------------');

    const userEmail1 = `m15a_user1_${testSuffix}@codeforge.dev`;
    createdEmails.push(userEmail1);

    const regRes1 = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        fullName: 'Learner One',
        email: userEmail1,
        password: 'Password123!',
        gender: 'Other',
        experience: 'Beginner',
        interests: ['Data Structures & Algorithms']
      })
    });

    assert(regRes1.status === 201, 'User 1 registered successfully (201)');
    assert(regRes1.data.user.onboardingCompleted === false, 'User payload has onboardingCompleted: false');
    assert(Array.isArray(regRes1.data.user.learningGoals) && regRes1.data.user.learningGoals.length === 0, 'User payload has empty learningGoals');
    assert(Array.isArray(regRes1.data.user.languages) && regRes1.data.user.languages.length === 0, 'User payload has empty languages');
    assert(regRes1.data.user.preferredStartingMode === 'practice', 'User payload has default preferredStartingMode: practice');
    assert(Array.isArray(regRes1.data.user.selectedTopics) && regRes1.data.user.selectedTopics.length === 0, 'User payload has empty selectedTopics');

    const loginRes1 = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: userEmail1,
        password: 'Password123!'
      })
    });
    assert(loginRes1.status === 200, 'User 1 logged in successfully (200)');
    const user1Token = loginRes1.data.token;

    // Check directly in MongoDB
    const userDoc1 = await db.collection('users').findOne({ email: userEmail1 });
    assert(userDoc1 !== null, 'User 1 exists in MongoDB');
    assert(userDoc1.onboardingCompleted === false, 'MongoDB stores onboardingCompleted: false');

    // --------------------------------------------------------------------------
    // PART 2: AUTHENTICATED GET /api/users/onboarding
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 2: Authenticated GET /api/users/onboarding');
    console.log('--------------------------------------------------');

    const getOnboardRes1 = await apiRequest('/api/users/onboarding', {
      method: 'GET',
      headers: { Authorization: `Bearer ${user1Token}` }
    });

    assert(getOnboardRes1.status === 200, 'GET /api/users/onboarding returns 200');
    assert(getOnboardRes1.data.success === true, 'Response returns success: true');
    assert(getOnboardRes1.data.onboarding.onboardingCompleted === false, 'Onboarding endpoint reports onboardingCompleted: false');
    assert(getOnboardRes1.data.onboarding.preferredStartingMode === 'practice', 'Onboarding endpoint reports preferredStartingMode: practice');

    // --------------------------------------------------------------------------
    // PART 3: SUBMITTING ONBOARDING PREFERENCES (HAPPY PATH)
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 3: Submitting Onboarding Preferences (PUT)');
    console.log('--------------------------------------------------');

    const onboardingPayload1 = {
      learningGoals: ['revival', 'interview'],
      languages: [
        { language: 'javascript', status: 'revision' },
        { language: 'python', status: 'new' }
      ],
      preferredStartingMode: 'diagnostic',
      selectedTopics: ['Arrays', 'Strings', 'JavaScript Fundamentals']
    };

    const putOnboardRes1 = await apiRequest('/api/users/onboarding', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify(onboardingPayload1)
    });

    assert(putOnboardRes1.status === 200, 'PUT /api/users/onboarding returns 200');
    assert(putOnboardRes1.data.success === true, 'Response returns success: true');
    assert(putOnboardRes1.data.user.onboardingCompleted === true, 'Returned user has onboardingCompleted: true');
    assert(putOnboardRes1.data.user.learningGoals.length === 2, 'Returned user has 2 learning goals');
    assert(putOnboardRes1.data.user.learningGoals.includes('revival'), 'Returned user includes revival goal');
    assert(putOnboardRes1.data.user.learningGoals.includes('interview'), 'Returned user includes interview goal');
    assert(putOnboardRes1.data.user.languages.length === 2, 'Returned user has 2 languages');
    assert(putOnboardRes1.data.user.languages[0].language === 'javascript', 'Returned user language 1 is javascript');
    assert(putOnboardRes1.data.user.languages[0].status === 'revision', 'Returned user status 1 is revision');
    assert(putOnboardRes1.data.user.languages[1].language === 'python', 'Returned user language 2 is python');
    assert(putOnboardRes1.data.user.languages[1].status === 'new', 'Returned user status 2 is new');
    assert(putOnboardRes1.data.user.selectedTopics.length === 3, 'Returned user has 3 selected topics');

    // Verify in MongoDB directly
    const userDoc1Updated = await db.collection('users').findOne({ email: userEmail1 });
    assert(userDoc1Updated.onboardingCompleted === true, 'MongoDB document updated with onboardingCompleted: true');
    assert(userDoc1Updated.learningGoals.length === 2, 'MongoDB document updated with 2 learning goals');
    assert(userDoc1Updated.languages.length === 2, 'MongoDB document updated with 2 languages');

    // Verify GET /api/users/me (Profile view) reflects onboarding fields
    const meProfileRes = await apiRequest('/api/users/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${user1Token}` }
    });
    assert(meProfileRes.status === 200, 'GET /api/users/me returns 200');
    assert(meProfileRes.data.user.onboardingCompleted === true, 'Profile response includes onboardingCompleted: true');
    assert(meProfileRes.data.user.learningGoals.includes('revival'), 'Profile response includes learningGoals');
    assert(meProfileRes.data.user.languages[0].language === 'javascript', 'Profile response includes languages');

    // Verify GET /api/auth/me (Auth session check) reflects onboarding fields
    const authMeRes = await apiRequest('/api/auth/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${user1Token}` }
    });
    assert(authMeRes.status === 200, 'GET /api/auth/me returns 200');
    assert(authMeRes.data.user.onboardingCompleted === true, 'Auth session response includes onboardingCompleted: true');

    // --------------------------------------------------------------------------
    // PART 4: RETURNING USER PREFERENCE MODIFICATION
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 4: Returning User Modifying Preferences');
    console.log('--------------------------------------------------');

    const updatePayload = {
      learningGoals: ['practice'],
      languages: [{ language: 'cpp', status: 'practicing' }],
      preferredStartingMode: 'practice',
      selectedTopics: ['Sorting', 'Searching']
    };

    const modifyRes = await apiRequest('/api/users/onboarding', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify(updatePayload)
    });

    assert(modifyRes.status === 200, 'PUT /api/users/onboarding update returns 200');
    assert(modifyRes.data.user.learningGoals.length === 1 && modifyRes.data.user.learningGoals[0] === 'practice', 'Updated goals to practice');
    assert(modifyRes.data.user.languages[0].language === 'cpp', 'Updated language to cpp');
    assert(modifyRes.data.user.preferredStartingMode === 'practice', 'Updated mode to practice');

    // Verify in MongoDB directly
    const userDoc1Modified = await db.collection('users').findOne({ email: userEmail1 });
    assert(userDoc1Modified.learningGoals[0] === 'practice', 'MongoDB reflects modified goal');
    assert(userDoc1Modified.languages[0].language === 'cpp', 'MongoDB reflects modified language');

    // --------------------------------------------------------------------------
    // PART 5: SKIPPING ONBOARDING
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 5: Skipping Onboarding (POST /api/users/onboarding/skip)');
    console.log('--------------------------------------------------');

    const userEmail2 = `m15a_skip_${testSuffix}@codeforge.dev`;
    createdEmails.push(userEmail2);

    const regRes2 = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        fullName: 'Skip User',
        email: userEmail2,
        password: 'Password123!',
        gender: 'Other',
        experience: 'Beginner',
        interests: ['Data Structures & Algorithms']
      })
    });
    const loginRes2 = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: userEmail2,
        password: 'Password123!'
      })
    });
    assert(loginRes2.status === 200, 'User 2 logged in successfully (200)');
    const user2Token = loginRes2.data.token;
    assert(regRes2.data.user.onboardingCompleted === false, 'User 2 initially has onboardingCompleted: false');

    const skipRes = await apiRequest('/api/users/onboarding/skip', {
      method: 'POST',
      headers: { Authorization: `Bearer ${user2Token}` }
    });

    assert(skipRes.status === 200, 'POST /api/users/onboarding/skip returns 200');
    assert(skipRes.data.success === true, 'Skip response returns success: true');
    assert(skipRes.data.user.onboardingCompleted === true, 'Returned user has onboardingCompleted: true after skip');

    // Verify in MongoDB
    const userDoc2 = await db.collection('users').findOne({ email: userEmail2 });
    assert(userDoc2.onboardingCompleted === true, 'MongoDB document has onboardingCompleted: true after skip');

    // --------------------------------------------------------------------------
    // PART 6: GOAL SCENARIOS & RECOMMENDATION LOGIC
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 6: Goal Scenarios & Recommendation Logic Parity');
    console.log('--------------------------------------------------');

    // 6.1 Beginner Goal
    const beginnerUser = {
      learningGoals: ['beginner'],
      languages: [{ language: 'javascript', status: 'new' }],
      preferredStartingMode: 'fundamentals',
      selectedTopics: ['JavaScript Fundamentals']
    };
    const beginnerRec = getLearnerRecommendation(beginnerUser);
    assert(beginnerRec.mode === 'fundamentals', 'Beginner profile recommends fundamentals mode');
    assert(beginnerRec.actionPath === '/practice', 'Beginner recommendation directs to /practice');
    assert(beginnerRec.suggestedAction.includes('Easy Practice'), 'Beginner recommendation suggests easy practice problems');

    // 6.2 Revival Goal
    const revivalUser = {
      learningGoals: ['revival'],
      languages: [{ language: 'javascript', status: 'revision' }],
      preferredStartingMode: 'diagnostic',
      selectedTopics: ['JavaScript Fundamentals', 'Arrays']
    };
    const revivalRec = getLearnerRecommendation(revivalUser);
    assert(revivalRec.mode === 'diagnostic', 'Revival profile recommends diagnostic mode');
    assert(revivalRec.actionPath === '/quiz', 'Revival recommendation directs to /quiz');
    assert(revivalRec.title.includes('Refresh & Revive'), 'Revival recommendation title emphasizes refreshing and reviving');

    // 6.3 Interview Prep Goal
    const interviewUser = {
      learningGoals: ['interview'],
      languages: [{ language: 'java', status: 'practicing' }],
      preferredStartingMode: 'diagnostic',
      selectedTopics: ['Arrays', 'Strings']
    };
    const interviewRec = getLearnerRecommendation(interviewUser);
    assert(interviewRec.mode === 'diagnostic', 'Interview prep recommends diagnostic assessment');
    assert(interviewRec.actionPath === '/quiz', 'Interview prep directs to /quiz');
    assert(interviewRec.title.includes('Interview & DSA'), 'Interview recommendation title emphasizes DSA readiness');

    // 6.4 General Practice Goal
    const practiceUser = {
      learningGoals: ['practice'],
      languages: [{ language: 'cpp', status: 'practicing' }],
      preferredStartingMode: 'practice',
      selectedTopics: ['Arrays']
    };
    const practiceRec = getLearnerRecommendation(practiceUser);
    assert(practiceRec.mode === 'practice', 'General practice recommends practice mode');
    assert(practiceRec.actionPath === '/practice', 'General practice directs to /practice');

    // --------------------------------------------------------------------------
    // PART 7: SERVER-SIDE VALIDATION & ERROR HANDLING (400 BAD REQUEST)
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 7: Server Validation & Error Handling (400)');
    console.log('--------------------------------------------------');

    const validBase = {
      learningGoals: ['revival'],
      languages: [{ language: 'javascript', status: 'revision' }],
      preferredStartingMode: 'diagnostic',
      selectedTopics: ['Arrays']
    };

    // 7.1 Invalid Goal
    const invalidGoalRes = await apiRequest('/api/users/onboarding', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ ...validBase, learningGoals: ['hacking_the_matrix'] })
    });
    assert(invalidGoalRes.status === 400 && invalidGoalRes.data.success === false, 'API rejects invalid learning goal with 400');
    assert(invalidGoalRes.data.message.includes('Invalid learning goal'), 'API returns descriptive error for invalid goal');

    // 7.2 Empty Goals Array
    const emptyGoalsRes = await apiRequest('/api/users/onboarding', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ ...validBase, learningGoals: [] })
    });
    assert(emptyGoalsRes.status === 400 && emptyGoalsRes.data.success === false, 'API rejects empty learning goals array with 400');

    // 7.3 Invalid Language
    const invalidLangRes = await apiRequest('/api/users/onboarding', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ ...validBase, languages: [{ language: 'brainfuck', status: 'new' }] })
    });
    assert(invalidLangRes.status === 400 && invalidLangRes.data.success === false, 'API rejects unsupported language with 400');

    // 7.4 Invalid Language Status
    const invalidStatusRes = await apiRequest('/api/users/onboarding', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ ...validBase, languages: [{ language: 'javascript', status: 'god_mode' }] })
    });
    assert(invalidStatusRes.status === 400 && invalidStatusRes.data.success === false, 'API rejects invalid language status with 400');

    // 7.5 Empty Languages Array
    const emptyLangsRes = await apiRequest('/api/users/onboarding', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ ...validBase, languages: [] })
    });
    assert(emptyLangsRes.status === 400 && emptyLangsRes.data.success === false, 'API rejects empty languages array with 400');

    // 7.6 Invalid Starting Mode
    const invalidModeRes = await apiRequest('/api/users/onboarding', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ ...validBase, preferredStartingMode: 'telepathy' })
    });
    assert(invalidModeRes.status === 400 && invalidModeRes.data.success === false, 'API rejects invalid starting mode with 400');

    // 7.7 Invalid Topic
    const invalidTopicRes = await apiRequest('/api/users/onboarding', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ ...validBase, selectedTopics: ['Quantum Computing 101'] })
    });
    assert(invalidTopicRes.status === 400 && invalidTopicRes.data.success === false, 'API rejects uncatalogued topic with 400');

    // 7.8 Non-Array Inputs
    const nonArrayGoalRes = await apiRequest('/api/users/onboarding', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ ...validBase, learningGoals: 'revival' })
    });
    assert(nonArrayGoalRes.status === 400, 'API rejects non-array learningGoals with 400');

    // --------------------------------------------------------------------------
    // PART 8: AUTHENTICATION & PERMISSION SECURITY CONTROLS
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 8: Authentication & Authorization Security (401)');
    console.log('--------------------------------------------------');

    const noAuthGetRes = await apiRequest('/api/users/onboarding', { method: 'GET' });
    assert(noAuthGetRes.status === 401, 'Unauthenticated GET /api/users/onboarding rejected with 401');

    const noAuthPutRes = await apiRequest('/api/users/onboarding', {
      method: 'PUT',
      body: JSON.stringify(validBase)
    });
    assert(noAuthPutRes.status === 401, 'Unauthenticated PUT /api/users/onboarding rejected with 401');

    const noAuthSkipRes = await apiRequest('/api/users/onboarding/skip', { method: 'POST' });
    assert(noAuthSkipRes.status === 401, 'Unauthenticated POST /api/users/onboarding/skip rejected with 401');

    const badTokenRes = await apiRequest('/api/users/onboarding', {
      method: 'GET',
      headers: { Authorization: 'Bearer invalid.fake.token' }
    });
    assert(badTokenRes.status === 401, 'Invalid token GET /api/users/onboarding rejected with 401');

    // --------------------------------------------------------------------------
    // PART 9: PRIVILEGE ESCALATION / TAMPERING PREVENTION
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 9: Privilege Escalation / Tampering Prevention');
    console.log('--------------------------------------------------');

    const tamperRes = await apiRequest('/api/users/onboarding', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({
        ...validBase,
        role: 'admin',
        isAdmin: true
      })
    });

    assert(tamperRes.status === 200, 'Request succeeds for valid fields');
    assert(tamperRes.data.user.role === 'user', 'Response retains role: user (role tampering blocked)');

    // Verify in MongoDB
    const userDoc1AfterTamper = await db.collection('users').findOne({ email: userEmail1 });
    assert(userDoc1AfterTamper.role === 'user', 'MongoDB document retains role: user');

    // --------------------------------------------------------------------------
    // PART 10: CROSS-USER DATA ISOLATION
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 10: Cross-User Data Isolation');
    console.log('--------------------------------------------------');

    const userEmail3 = `m15a_user3_${testSuffix}@codeforge.dev`;
    createdEmails.push(userEmail3);

    const regRes3 = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        fullName: 'Learner Three',
        email: userEmail3,
        password: 'Password123!',
        gender: 'Other',
        experience: 'Beginner',
        interests: ['Data Structures & Algorithms']
      })
    });
    assert(regRes3.status === 201, 'User 3 registered successfully (201)');
    const loginRes3 = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: userEmail3,
        password: 'Password123!'
      })
    });
    assert(loginRes3.status === 200, 'User 3 logged in successfully (200)');
    const user3Token = loginRes3.data.token;

    // User 3 sets their own preferences
    await apiRequest('/api/users/onboarding', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${user3Token}` },
      body: JSON.stringify({
        learningGoals: ['interview'],
        languages: [{ language: 'java', status: 'revision' }],
        preferredStartingMode: 'diagnostic',
        selectedTopics: ['Stack', 'Queue']
      })
    });

    // Check User 1's onboarding still has User 1's preferences
    const user1CheckRes = await apiRequest('/api/users/onboarding', {
      method: 'GET',
      headers: { Authorization: `Bearer ${user1Token}` }
    });
    assert(user1CheckRes.data.onboarding.learningGoals[0] === 'revival', 'User 1 preferences remain untouched');
    assert(user1CheckRes.data.onboarding.languages[0].language === 'javascript', 'User 1 language remains javascript');

    // Check User 3's onboarding
    const user3CheckRes = await apiRequest('/api/users/onboarding', {
      method: 'GET',
      headers: { Authorization: `Bearer ${user3Token}` }
    });
    assert(user3CheckRes.data.onboarding.learningGoals[0] === 'interview', 'User 3 preferences correctly isolated');
    assert(user3CheckRes.data.onboarding.languages[0].language === 'java', 'User 3 language is java');

  } catch (err) {
    console.error('Unhandled test suite error:', err);
    failed++;
  } finally {
    // Clean up created test users from MongoDB
    if (createdEmails.length > 0) {
      await db.collection('users').deleteMany({ email: { $in: createdEmails } });
      console.log(`\nCleaned up ${createdEmails.length} test users from MongoDB.`);
    }
    await mongoose.disconnect();
  }

  console.log('\n==================================================');
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
