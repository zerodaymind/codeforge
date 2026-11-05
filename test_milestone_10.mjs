import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, 'server', '.env') });

const API_BASE = 'http://localhost:5000';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/codeforge';
const JWT_SECRET = process.env.JWT_SECRET || 'codeforge_development_jwt_secret_key_2026';

let passed = 0;
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

async function runTests() {
  console.log('\n==================================================');
  console.log('  CODEFORGE MILESTONE 10 AUTOMATED VERIFICATION');
  console.log('==================================================\n');

  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  const testEmailA = `test.m10.a.${Date.now()}@codeforge.local`.toLowerCase();
  const testEmailB = `test.m10.b.${Date.now()}@codeforge.local`.toLowerCase();
  const testPassword = 'Password123!';

  let tokenA = null;
  let userAId = null;
  let tokenB = null;
  let userBId = null;

  let twoSumDoc = null;
  let twoSumId = null;

  const capturedResponses = [];

  try {
    // -------------------------------------------------------------------------
    // 1. GET /api/health -> 200
    // -------------------------------------------------------------------------
    console.log('[Test 1] GET /api/health -> 200');
    const healthRes = await fetch(`${API_BASE}/api/health`);
    const healthData = await healthRes.json();
    capturedResponses.push(healthData);
    assert(
      healthRes.status === 200 && healthData.success === true && healthData.database === 'connected',
      `Health check returned HTTP 200 and database is connected`
    );

    // -------------------------------------------------------------------------
    // 2. GET /api/problems -> 200
    // -------------------------------------------------------------------------
    console.log('\n[Test 2] GET /api/problems -> 200');
    const problemsRes = await fetch(`${API_BASE}/api/problems`);
    const problemsData = await problemsRes.json();
    capturedResponses.push(problemsData);
    assert(
      problemsRes.status === 200 && problemsData.success === true && Array.isArray(problemsData.problems),
      `GET /api/problems returned HTTP 200 with problem list array`
    );

    // -------------------------------------------------------------------------
    // 3. At least 12 problems exist
    // -------------------------------------------------------------------------
    console.log('\n[Test 3] At least 12 problems exist');
    const problemCount = problemsData.problems?.length || 0;
    assert(
      problemCount >= 12,
      `Problem catalog contains at least 12 problems in MongoDB (found: ${problemCount})`
    );

    // -------------------------------------------------------------------------
    // 4. GET /api/problems/two-sum -> 200
    // -------------------------------------------------------------------------
    console.log('\n[Test 4] GET /api/problems/two-sum -> 200');
    const singleProbRes = await fetch(`${API_BASE}/api/problems/two-sum`);
    const singleProbData = await singleProbRes.json();
    capturedResponses.push(singleProbData);
    twoSumDoc = singleProbData.problem;
    twoSumId = twoSumDoc?._id;
    assert(
      singleProbRes.status === 200 &&
      singleProbData.success === true &&
      (twoSumDoc?.slug === 'two-sum' || twoSumDoc?.id === 'two-sum') &&
      Boolean(twoSumId),
      `GET /api/problems/two-sum returned HTTP 200 with problem document (id: ${twoSumId})`
    );

    // -------------------------------------------------------------------------
    // 5. Register temporary test user
    // -------------------------------------------------------------------------
    console.log('\n[Test 5] Register temporary test user');
    const regResA = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Milestone 10 User A',
        email: testEmailA,
        password: testPassword,
        confirmPassword: testPassword,
        gender: 'Female',
        experience: 'Intermediate',
        interests: ['Algorithms', 'Data Structures']
      })
    });
    const regDataA = await regResA.json();
    capturedResponses.push(regDataA);
    userAId = regDataA.user?.id;
    assert(
      regResA.status === 201 && regDataA.success === true && Boolean(userAId),
      `Temporary test user registered with HTTP 201 (id: ${userAId})`
    );

    // -------------------------------------------------------------------------
    // 6. Login temporary test user
    // -------------------------------------------------------------------------
    console.log('\n[Test 6] Login temporary test user');
    const loginResA = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmailA, password: testPassword })
    });
    const loginDataA = await loginResA.json();
    capturedResponses.push(loginDataA);
    assert(
      loginResA.status === 200 && loginDataA.success === true,
      `Login succeeded with HTTP 200`
    );

    // -------------------------------------------------------------------------
    // 7. Receive JWT
    // -------------------------------------------------------------------------
    console.log('\n[Test 7] Receive JWT');
    tokenA = loginDataA.token;
    assert(
      typeof tokenA === 'string' && tokenA.length > 25,
      `Valid JWT session token received`
    );

    // -------------------------------------------------------------------------
    // 8. GET /api/progress without JWT -> 401
    // -------------------------------------------------------------------------
    console.log('\n[Test 8] GET /api/progress without JWT -> 401');
    const unauthProgRes = await fetch(`${API_BASE}/api/progress`);
    const unauthProgData = await unauthProgRes.json();
    capturedResponses.push(unauthProgData);
    assert(
      unauthProgRes.status === 401 && unauthProgData.success === false,
      `Unauthenticated progress request rejected with HTTP 401 Unauthorized`
    );

    // -------------------------------------------------------------------------
    // 9. GET /api/progress with JWT -> 200
    // -------------------------------------------------------------------------
    console.log('\n[Test 9] GET /api/progress with JWT -> 200');
    const authProgRes = await fetch(`${API_BASE}/api/progress`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const authProgData = await authProgRes.json();
    capturedResponses.push(authProgData);
    assert(
      authProgRes.status === 200 && authProgData.success === true && Array.isArray(authProgData.progress),
      `Authenticated progress endpoint returned HTTP 200 with progress array`
    );

    // -------------------------------------------------------------------------
    // 10. PUT progress for valid problem -> 200
    // -------------------------------------------------------------------------
    console.log('\n[Test 10] PUT progress for valid problem -> 200');
    const putProgRes = await fetch(`${API_BASE}/api/progress/${twoSumId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const putProgData = await putProgRes.json();
    capturedResponses.push(putProgData);
    assert(
      putProgRes.status === 200 && putProgData.success === true,
      `PUT /api/progress/:problemId returned HTTP 200`
    );

    // -------------------------------------------------------------------------
    // 11. Verify completed = true
    // -------------------------------------------------------------------------
    console.log('\n[Test 11] Verify completed = true');
    assert(
      putProgData.progress?.completed === true && Boolean(putProgData.progress?.completedAt),
      `Problem completion state verified as completed: true with timestamp`
    );

    // -------------------------------------------------------------------------
    // 12. GET progress -> completed problem appears
    // -------------------------------------------------------------------------
    console.log('\n[Test 12] GET progress -> completed problem appears');
    const getProgRes2 = await fetch(`${API_BASE}/api/progress`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const getProgData2 = await getProgRes2.json();
    capturedResponses.push(getProgData2);
    const foundInList = getProgData2.progress?.some(
      (p) => (p.problem?._id === twoSumId || p.problem === twoSumId) && p.completed === true
    );
    assert(
      getProgRes2.status === 200 && foundInList,
      `Completed problem appears in user's complete GET /api/progress list`
    );

    // -------------------------------------------------------------------------
    // 13. GET individual progress -> completed = true
    // -------------------------------------------------------------------------
    console.log('\n[Test 13] GET individual progress -> completed = true');
    const getIndivRes = await fetch(`${API_BASE}/api/progress/${twoSumId}`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const getIndivData = await getIndivRes.json();
    capturedResponses.push(getIndivData);
    assert(
      getIndivRes.status === 200 && getIndivData.success === true && getIndivData.progress?.completed === true,
      `GET /api/progress/:problemId confirmed problem is completed: true`
    );

    // -------------------------------------------------------------------------
    // 14. DELETE progress -> 200
    // -------------------------------------------------------------------------
    console.log('\n[Test 14] DELETE progress -> 200');
    const deleteProgRes = await fetch(`${API_BASE}/api/progress/${twoSumId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const deleteProgData = await deleteProgRes.json();
    capturedResponses.push(deleteProgData);
    assert(
      deleteProgRes.status === 200 && deleteProgData.success === true,
      `DELETE /api/progress/:problemId returned HTTP 200`
    );

    // -------------------------------------------------------------------------
    // 15. Verify completed = false
    // -------------------------------------------------------------------------
    console.log('\n[Test 15] Verify completed = false');
    assert(
      deleteProgData.progress?.completed === false && deleteProgData.progress?.completedAt === null,
      `Problem progress successfully unmarked (completed: false, completedAt: null)`
    );

    // -------------------------------------------------------------------------
    // 16. Invalid problem ID -> 400
    // -------------------------------------------------------------------------
    console.log('\n[Test 16] Invalid problem ID -> 400');
    const invalidIdRes = await fetch(`${API_BASE}/api/progress/not-a-valid-id-12345`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const invalidIdData = await invalidIdRes.json();
    capturedResponses.push(invalidIdData);
    assert(
      invalidIdRes.status === 400 && invalidIdData.success === false,
      `Invalid problem ObjectId rejected with HTTP 400 Bad Request`
    );

    // -------------------------------------------------------------------------
    // 17. Nonexistent problem -> 404
    // -------------------------------------------------------------------------
    console.log('\n[Test 17] Nonexistent problem -> 404');
    const nonExistentRes = await fetch(`${API_BASE}/api/progress/000000000000000000000000`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const nonExistentData = await nonExistentRes.json();
    capturedResponses.push(nonExistentData);
    assert(
      nonExistentRes.status === 404 && nonExistentData.success === false,
      `Nonexistent problem ObjectId returned HTTP 404 Not Found`
    );

    // -------------------------------------------------------------------------
    // 18. Verify another user cannot modify first user's progress
    // -------------------------------------------------------------------------
    console.log("\n[Test 18] Multi-tenant isolation: Verify another user cannot modify first user's progress");
    // Mark two-sum as completed for User A
    await fetch(`${API_BASE}/api/progress/${twoSumId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    // Register User B
    const regResB = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Milestone 10 User B',
        email: testEmailB,
        password: testPassword,
        confirmPassword: testPassword,
        gender: 'Male',
        experience: 'Beginner',
        interests: ['Web Development']
      })
    });
    const regDataB = await regResB.json();
    userBId = regDataB.user?.id;

    const loginResB = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmailB, password: testPassword })
    });
    const loginDataB = await loginResB.json();
    tokenB = loginDataB.token;

    // User B unmarks the problem
    await fetch(`${API_BASE}/api/progress/${twoSumId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` }
    });

    // Verify User A's progress is STILL completed = true
    const checkUserARes = await fetch(`${API_BASE}/api/progress/${twoSumId}`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const checkUserAData = await checkUserARes.json();
    assert(
      checkUserAData.progress?.completed === true,
      `User A's progress remains completed: true despite User B's actions (strict tenant isolation)`
    );

    // -------------------------------------------------------------------------
    // 19. Verify no passwordHash leaks
    // -------------------------------------------------------------------------
    console.log('\n[Test 19] Security audit: Verify no passwordHash or JWT_SECRET leaks');
    let leakDetected = false;
    for (const res of capturedResponses) {
      const serialized = JSON.stringify(res);
      if (
        serialized.includes('passwordHash') ||
        serialized.includes(JWT_SECRET) ||
        serialized.includes(testPassword)
      ) {
        leakDetected = true;
        break;
      }
    }
    assert(
      !leakDetected,
      `Zero leaks of passwordHash, JWT secret, or plain passwords across all API responses`
    );

    // -------------------------------------------------------------------------
    // 20. Cleanup temporary users/progress
    // -------------------------------------------------------------------------
    console.log('\n[Test 20] Cleanup temporary users/progress');
    const deleteUsersRes = await db.collection('users').deleteMany({
      email: { $in: [testEmailA, testEmailB] }
    });
    const deleteProgResDirect = await db.collection('problemprogresses').deleteMany({
      user: {
        $in: [
          new mongoose.Types.ObjectId(userAId),
          new mongoose.Types.ObjectId(userBId)
        ]
      }
    });
    assert(
      deleteUsersRes.acknowledged && deleteProgResDirect.acknowledged,
      `Cleaned up temporary users and problem progress documents`
    );

    // -------------------------------------------------------------------------
    // 21. Cleanup only temporary test data
    // -------------------------------------------------------------------------
    console.log('\n[Test 21] Cleanup only temporary test data');
    const remainingProblems = await db.collection('problems').countDocuments();
    assert(
      remainingProblems >= 12,
      `Seeded practice problems catalog remained completely intact (${remainingProblems} problems preserved)`
    );

    // -------------------------------------------------------------------------
    // 22. MongoDB persistence verified directly
    // -------------------------------------------------------------------------
    console.log('\n[Test 22] MongoDB persistence verified directly');
    const progressIndexes = await db.collection('problemprogresses').indexes();
    const hasCompoundUnique = progressIndexes.some(
      (idx) => idx.key?.user === 1 && idx.key?.problem === 1 && idx.unique === true
    );
    const problemIndexes = await db.collection('problems').indexes();
    const hasSlugIndex = problemIndexes.some((idx) => idx.key?.slug === 1);
    assert(
      hasCompoundUnique && hasSlugIndex,
      `Verified MongoDB schema indexes directly: { user: 1, problem: 1 } compound unique and slug index`
    );

  } catch (error) {
    console.error('Unexpected test error occurred:', error);
    failed++;
  } finally {
    await mongoose.disconnect();
    console.log('\n==================================================');
    console.log('CODEFORGE MILESTONE 10 AUTOMATED VERIFICATION');
    console.log('==================================================');
    console.log(`TOTAL TESTS: ${passed + failed}`);
    console.log(`PASSED: ${passed}`);
    console.log(`FAILED: ${failed}`);
    console.log('==================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  }
}

runTests();
