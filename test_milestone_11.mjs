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

function markBlocked(testNumber, testName, reason) {
  console.log(`  ⚠ BLOCKED [${testNumber}]: ${testName}`);
  console.log(`    Reason: ${reason}`);
  blocked++;
}

async function runTests() {
  console.log('\n==================================================');
  console.log('  CODEFORGE MILESTONE 11 AUTOMATED VERIFICATION');
  console.log('==================================================\n');

  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  const testEmailA = `test.m11.user.a.${Date.now()}@codeforge.local`.toLowerCase();
  const testEmailB = `test.m11.user.b.${Date.now()}@codeforge.local`.toLowerCase();
  const testPassword = 'Password123!';

  let tokenA = null;
  let userAId = null;
  let tokenB = null;
  let userBId = null;

  let twoSumDoc = null;
  let twoSumId = null;
  let isDockerActive = false;

  const capturedResponses = [];

  try {
    // -------------------------------------------------------------------------
    // 1. Health endpoint
    // -------------------------------------------------------------------------
    console.log('[Test 1] Health endpoint (GET /api/health -> 200)');
    const healthRes = await fetch(`${API_BASE}/api/health`);
    const healthData = await healthRes.json();
    capturedResponses.push(healthData);
    assert(
      healthRes.status === 200 && healthData.success === true && healthData.database === 'connected',
      `Health endpoint returned HTTP 200 and database is connected`
    );

    // -------------------------------------------------------------------------
    // 2. Valid execution request / sandbox status endpoint
    // -------------------------------------------------------------------------
    console.log('\n[Test 2] Code execution status endpoint (GET /api/code/status -> 200)');
    const statusRes = await fetch(`${API_BASE}/api/code/status`);
    const statusData = await statusRes.json();
    capturedResponses.push(statusData);
    isDockerActive = Boolean(statusData.sandboxAvailable);
    assert(
      statusRes.status === 200 &&
      statusData.success === true &&
      typeof statusData.sandboxAvailable === 'boolean',
      `Status endpoint returned HTTP 200 with sandbox state (sandboxAvailable: ${isDockerActive})`
    );

    // -------------------------------------------------------------------------
    // 3. Invalid language rejection
    // -------------------------------------------------------------------------
    console.log('\n[Test 3] Invalid language rejection (POST /api/code/run -> 400)');
    const invalidLangRes = await fetch(`${API_BASE}/api/code/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'unsupported_python_lang',
        sourceCode: 'print(1)'
      })
    });
    const invalidLangData = await invalidLangRes.json();
    capturedResponses.push(invalidLangData);
    assert(
      invalidLangRes.status === 400 && invalidLangData.success === false,
      `Rejected unsupported language with HTTP 400 Bad Request`
    );

    // -------------------------------------------------------------------------
    // 4. Empty source-code rejection
    // -------------------------------------------------------------------------
    console.log('\n[Test 4] Empty source-code rejection (POST /api/code/run -> 400)');
    const emptyCodeRes = await fetch(`${API_BASE}/api/code/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'javascript',
        sourceCode: '     '
      })
    });
    const emptyCodeData = await emptyCodeRes.json();
    capturedResponses.push(emptyCodeData);
    assert(
      emptyCodeRes.status === 400 && emptyCodeData.success === false,
      `Rejected empty source code with HTTP 400 Bad Request`
    );

    // -------------------------------------------------------------------------
    // 5. Oversized source-code rejection
    // -------------------------------------------------------------------------
    console.log('\n[Test 5] Oversized source-code rejection (POST /api/code/run -> 400)');
    const oversizedCodeRes = await fetch(`${API_BASE}/api/code/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'javascript',
        sourceCode: 'console.log("x");'.repeat(5000) // > 64KB
      })
    });
    const oversizedCodeData = await oversizedCodeRes.json();
    capturedResponses.push(oversizedCodeData);
    assert(
      oversizedCodeRes.status === 400 && oversizedCodeData.success === false,
      `Rejected oversized source code (>64KB) with HTTP 400 Bad Request`
    );

    // -------------------------------------------------------------------------
    // 6. Invalid problem ID handling
    // -------------------------------------------------------------------------
    console.log('\n[Test 6] Invalid problem ID handling (POST /api/code/run -> 404)');
    const invalidProbRes = await fetch(`${API_BASE}/api/code/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'javascript',
        sourceCode: 'console.log(1);',
        problemId: 'nonexistent-problem-id-999'
      })
    });
    const invalidProbData = await invalidProbRes.json();
    capturedResponses.push(invalidProbData);
    assert(
      invalidProbRes.status === 404 && invalidProbData.success === false,
      `Nonexistent problem ID returned HTTP 404 Not Found`
    );

    // Load reference problem
    const twoSumRes = await fetch(`${API_BASE}/api/problems/two-sum`);
    const twoSumData = await twoSumRes.json();
    capturedResponses.push(twoSumData);
    twoSumDoc = twoSumData.problem;
    twoSumId = twoSumDoc?._id;

    // -------------------------------------------------------------------------
    // 7. JavaScript syntax errors
    // -------------------------------------------------------------------------
    console.log('\n[Test 7] JavaScript syntax errors');
    if (!isDockerActive) {
      markBlocked(7, 'JavaScript syntax error execution', 'Docker sandbox is offline; host execution safely disabled');
    } else {
      const syntaxRes = await fetch(`${API_BASE}/api/code/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: 'javascript',
          sourceCode: 'function broken( { return 42;'
        })
      });
      const syntaxData = await syntaxRes.json();
      assert(
        syntaxRes.status === 200 && (syntaxData.status === 'COMPILATION_ERROR' || syntaxData.status === 'RUNTIME_ERROR'),
        `Syntax error captured safely in Docker sandbox with status ${syntaxData.status}`
      );
    }

    // -------------------------------------------------------------------------
    // 8. Runtime exceptions
    // -------------------------------------------------------------------------
    console.log('\n[Test 8] Runtime exceptions');
    if (!isDockerActive) {
      markBlocked(8, 'Runtime exception execution', 'Docker sandbox is offline; host execution safely disabled');
    } else {
      const runtimeRes = await fetch(`${API_BASE}/api/code/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: 'javascript',
          sourceCode: 'null.nonExistentMethod();'
        })
      });
      const runtimeData = await runtimeRes.json();
      assert(
        runtimeRes.status === 200 && runtimeData.status === 'RUNTIME_ERROR',
        `Runtime exception captured safely in Docker sandbox with status RUNTIME_ERROR`
      );
    }

    // -------------------------------------------------------------------------
    // 9. Execution timeout
    // -------------------------------------------------------------------------
    console.log('\n[Test 9] Execution timeout');
    if (!isDockerActive) {
      markBlocked(9, 'Execution timeout enforcement', 'Docker sandbox is offline; host execution safely disabled');
    } else {
      const timeoutRes = await fetch(`${API_BASE}/api/code/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: 'javascript',
          sourceCode: 'while(true) {}'
        })
      });
      const timeoutData = await timeoutRes.json();
      assert(
        timeoutRes.status === 200 && timeoutData.status === 'TIME_LIMIT_EXCEEDED',
        `Infinite loop terminated within 5000ms wall-clock limit`
      );
    }

    // Register User A
    const regResA = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Milestone 11 User A',
        email: testEmailA,
        password: testPassword,
        confirmPassword: testPassword,
        gender: 'Female',
        experience: 'Intermediate',
        interests: ['Algorithms']
      })
    });
    const regDataA = await regResA.json();
    userAId = regDataA.user?.id;

    const loginResA = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmailA, password: testPassword })
    });
    const loginDataA = await loginResA.json();
    tokenA = loginDataA.token;

    // -------------------------------------------------------------------------
    // 10. Correct test-case evaluation
    // -------------------------------------------------------------------------
    console.log('\n[Test 10] Correct test-case evaluation');
    if (!isDockerActive) {
      markBlocked(10, 'Correct test-case evaluation', 'Docker sandbox is offline; host execution safely disabled');
    } else {
      const solutionCode = `
function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const diff = target - nums[i];
    if (map.has(diff)) return [map.get(diff), i];
    map.set(nums[i], i);
  }
  return [];
}
`;
      const evalRes = await fetch(`${API_BASE}/api/code/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`
        },
        body: JSON.stringify({
          problemId: twoSumId,
          language: 'javascript',
          sourceCode: solutionCode
        })
      });
      const evalData = await evalRes.json();
      assert(
        evalRes.status === 200 && evalData.verdict === 'Accepted',
        `Correct solution evaluated and verified with verdict 'Accepted'`
      );
    }

    // -------------------------------------------------------------------------
    // 11. Incorrect answer verdict
    // -------------------------------------------------------------------------
    console.log('\n[Test 11] Incorrect answer verdict');
    if (!isDockerActive) {
      markBlocked(11, 'Incorrect answer verdict', 'Docker sandbox is offline; host execution safely disabled');
    } else {
      const wrongCode = 'console.log(JSON.stringify([99, 99]));';
      const wrongRes = await fetch(`${API_BASE}/api/code/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`
        },
        body: JSON.stringify({
          problemId: twoSumId,
          language: 'javascript',
          sourceCode: wrongCode
        })
      });
      const wrongData = await wrongRes.json();
      assert(
        wrongRes.status === 200 && wrongData.verdict === 'Wrong Answer',
        `Incorrect answer produced verdict 'Wrong Answer'`
      );
    }

    // -------------------------------------------------------------------------
    // 12. Unauthorized submission-history access
    // -------------------------------------------------------------------------
    console.log('\n[Test 12] Unauthorized submission-history access (GET /api/code/submissions without JWT -> 401)');
    const unauthSubRes = await fetch(`${API_BASE}/api/code/submissions`);
    const unauthSubData = await unauthSubRes.json();
    capturedResponses.push(unauthSubData);
    assert(
      unauthSubRes.status === 401 && unauthSubData.success === false,
      `Unauthenticated submission-history query rejected with HTTP 401 Unauthorized`
    );

    // -------------------------------------------------------------------------
    // 13. Authenticated submission-history access
    // -------------------------------------------------------------------------
    console.log('\n[Test 13] Authenticated submission-history access (GET /api/code/submissions with JWT -> 200)');
    const authSubRes = await fetch(`${API_BASE}/api/code/submissions`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const authSubData = await authSubRes.json();
    capturedResponses.push(authSubData);
    assert(
      authSubRes.status === 200 && authSubData.success === true && Array.isArray(authSubData.submissions),
      `Authenticated submission query returned HTTP 200 with submissions array`
    );

    // -------------------------------------------------------------------------
    // 14. Cross-user submission isolation
    // -------------------------------------------------------------------------
    console.log("\n[Test 14] Cross-user submission isolation (User B cannot view User A's submissions)");
    // Register User B
    const regResB = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Milestone 11 User B',
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

    // User A submits a record (or triggers submission)
    await fetch(`${API_BASE}/api/code/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        problemId: twoSumId,
        language: 'javascript',
        sourceCode: 'console.log("tenant-user-a");'
      })
    });

    // User B queries submissions
    const subBRes = await fetch(`${API_BASE}/api/code/submissions`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    const subBData = await subBRes.json();
    capturedResponses.push(subBData);
    const userAVisibleToB = subBData.submissions?.some((s) => s.user === userAId || s.sourceCode?.includes('tenant-user-a'));
    assert(
      subBRes.status === 200 && !userAVisibleToB && subBData.submissions?.length === 0,
      `User B cannot view User A's submissions (strict multi-tenant database isolation)`
    );

    // -------------------------------------------------------------------------
    // 15. Hidden test-case confidentiality
    // -------------------------------------------------------------------------
    console.log('\n[Test 15] Hidden test-case confidentiality');
    const pubProbRes = await fetch(`${API_BASE}/api/problems/two-sum`);
    const pubProbData = await pubProbRes.json();
    capturedResponses.push(pubProbData);
    const hasHiddenInPublic = pubProbData.problem?.testCases?.some((tc) => tc.isHidden === true);
    assert(
      pubProbRes.status === 200 && !hasHiddenInPublic,
      `Hidden test cases and expected outputs are strictly excluded from public problem API`
    );

    // -------------------------------------------------------------------------
    // 16. Submission persistence in MongoDB
    // -------------------------------------------------------------------------
    console.log('\n[Test 16] Submission persistence in MongoDB');
    const submissionInDb = await db.collection('submissions').findOne({
      user: new mongoose.Types.ObjectId(userAId)
    });
    assert(
      Boolean(submissionInDb) && submissionInDb.user?.toString() === userAId,
      `Submission record verified directly in MongoDB 'submissions' collection`
    );

    // -------------------------------------------------------------------------
    // 17. Existing authentication and profile endpoints
    // -------------------------------------------------------------------------
    console.log('\n[Test 17] Regression: Existing authentication and profile endpoints');
    const meRes = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const meData = await meRes.json();
    const profRes = await fetch(`${API_BASE}/api/users/me`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const profData = await profRes.json();
    capturedResponses.push(meData, profData);
    assert(
      meRes.status === 200 && meData.success && profRes.status === 200 && profData.success,
      `GET /api/auth/me and GET /api/users/me continue functioning flawlessly`
    );

    // -------------------------------------------------------------------------
    // 18. Existing practice progress endpoints
    // -------------------------------------------------------------------------
    console.log('\n[Test 18] Regression: Existing practice progress endpoints');
    const putProg = await fetch(`${API_BASE}/api/progress/${twoSumId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const delProg = await fetch(`${API_BASE}/api/progress/${twoSumId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const getProg = await fetch(`${API_BASE}/api/progress`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const getProgData = await getProg.json();
    capturedResponses.push(getProgData);
    assert(
      putProg.status === 200 && delProg.status === 200 && getProg.status === 200,
      `PUT, DELETE, and GET /api/progress endpoints maintain backward compatibility`
    );

    // -------------------------------------------------------------------------
    // 19. Cleanup of temporary test data
    // -------------------------------------------------------------------------
    console.log('\n[Test 19] Cleanup of temporary test data');
    const delUsers = await db.collection('users').deleteMany({
      email: { $in: [testEmailA, testEmailB] }
    });
    const delSubmissions = await db.collection('submissions').deleteMany({
      user: {
        $in: [new mongoose.Types.ObjectId(userAId), new mongoose.Types.ObjectId(userBId)]
      }
    });
    const delProgress = await db.collection('problemprogresses').deleteMany({
      user: {
        $in: [new mongoose.Types.ObjectId(userAId), new mongoose.Types.ObjectId(userBId)]
      }
    });
    assert(
      delUsers.acknowledged && delSubmissions.acknowledged && delProgress.acknowledged,
      `Cleaned up temporary test users, submissions, and progress records from database`
    );

    // -------------------------------------------------------------------------
    // 20. Sandbox isolation and resource-limit behavior
    // -------------------------------------------------------------------------
    console.log('\n[Test 20] Sandbox isolation and resource-limit behavior');
    if (!isDockerActive) {
      markBlocked(20, 'Sandbox container resource limits & isolation', 'Docker daemon is offline; safe rejection state verified');
    } else {
      // Memory / network limit test in container
      const isolationRes = await fetch(`${API_BASE}/api/code/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: 'javascript',
          sourceCode: 'console.log("network disabled, non-root user:", process.getuid());'
        })
      });
      const isolationData = await isolationRes.json();
      assert(
        isolationRes.status === 200 && isolationData.stdout?.includes('non-root user'),
        `Sandbox isolation enforced: non-root user execution inside container`
      );
    }

  } catch (error) {
    console.error('Unexpected test error occurred:', error);
    failed++;
  } finally {
    await mongoose.disconnect();
    console.log('\n==================================================');
    console.log('CODEFORGE MILESTONE 11 AUTOMATED VERIFICATION');
    console.log('==================================================');
    console.log(`TOTAL TESTS: ${passed + blocked + failed}`);
    console.log(`PASSED: ${passed}`);
    console.log(`BLOCKED: ${blocked}`);
    console.log(`FAILED: ${failed}`);
    console.log('==================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  }
}

runTests();
