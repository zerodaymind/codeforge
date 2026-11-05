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
  console.log('  CODEFORGE MILESTONE 9 AUTOMATED VERIFICATION');
  console.log('==================================================\n');

  // Connect directly to MongoDB for verification and teardown
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  const testEmail = `m9.test.user.${Date.now()}@codeforge.local`.toLowerCase();
  const testPassword = 'Password123!';
  let token = null;
  let userId = null;
  let initialPasswordHash = null;

  try {
    // -------------------------------------------------------------------------
    // 1. GET /api/health -> 200
    // -------------------------------------------------------------------------
    console.log('[Test 1] GET /api/health -> 200');
    const healthRes = await fetch(`${API_BASE}/api/health`);
    const healthData = await healthRes.json();
    assert(
      healthRes.status === 200 && healthData.success && healthData.database === 'connected',
      `Health check returned 200 and DB is connected (status: ${healthRes.status})`
    );

    // -------------------------------------------------------------------------
    // 2. Register temporary test user
    // -------------------------------------------------------------------------
    console.log('\n[Test 2] Register temporary test user');
    const regRes = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Grace Hopper M9',
        email: testEmail,
        password: testPassword,
        confirmPassword: testPassword,
        gender: 'Female',
        experience: 'Intermediate',
        interests: ['Data Structures & Algorithms', 'Web Development']
      })
    });
    const regData = await regRes.json();
    userId = regData.user?.id;
    assert(
      regRes.status === 201 && regData.success && Boolean(userId),
      `Test user registered with HTTP 201 (id: ${userId})`
    );

    // -------------------------------------------------------------------------
    // 3. Login test user
    // -------------------------------------------------------------------------
    console.log('\n[Test 3] Login test user');
    const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword
      })
    });
    const loginData = await loginRes.json();
    assert(
      loginRes.status === 200 && loginData.success,
      `Login succeeded with HTTP 200`
    );

    // -------------------------------------------------------------------------
    // 4. Receive JWT
    // -------------------------------------------------------------------------
    console.log('\n[Test 4] Receive JWT');
    token = loginData.token;
    assert(
      typeof token === 'string' && token.length > 20,
      `Valid JWT received from login response`
    );

    // -------------------------------------------------------------------------
    // 5. GET /api/users/me with valid JWT -> 200
    // -------------------------------------------------------------------------
    console.log('\n[Test 5] GET /api/users/me with valid JWT -> 200');
    const getMeRes = await fetch(`${API_BASE}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const getMeData = await getMeRes.json();
    assert(
      getMeRes.status === 200 && getMeData.success && Boolean(getMeData.user),
      `GET /api/users/me returned HTTP 200 with user profile`
    );

    // -------------------------------------------------------------------------
    // 6. Verify returned profile contains no passwordHash
    // -------------------------------------------------------------------------
    console.log('\n[Test 6] Verify returned profile contains no passwordHash');
    const hasPasswordHash = 'passwordHash' in (getMeData.user || {}) || 'password' in (getMeData.user || {});
    const getMeStr = JSON.stringify(getMeData);
    const leaksSecret = getMeStr.includes('passwordHash') || getMeStr.includes(JWT_SECRET) || getMeStr.includes(testPassword);
    assert(
      !hasPasswordHash && !leaksSecret,
      `Profile response strictly excludes password, passwordHash, and JWT secret`
    );

    // -------------------------------------------------------------------------
    // 7. Verify email is returned
    // -------------------------------------------------------------------------
    console.log('\n[Test 7] Verify email is returned');
    assert(
      getMeData.user?.email === testEmail,
      `Email is correctly returned (${getMeData.user?.email})`
    );

    // Record initial password hash from database directly
    const userDocBefore = await db.collection('users').findOne({ email: testEmail });
    initialPasswordHash = userDocBefore?.passwordHash;
    assert(
      Boolean(initialPasswordHash) && initialPasswordHash.startsWith('$2'),
      `Retrieved initial bcrypt passwordHash from MongoDB directly`
    );

    // -------------------------------------------------------------------------
    // 8. PUT /api/users/me with valid data -> 200
    // -------------------------------------------------------------------------
    console.log('\n[Test 8] PUT /api/users/me with valid data -> 200');
    const putRes = await fetch(`${API_BASE}/api/users/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        fullName: 'Rear Admiral Grace Hopper',
        gender: 'Female',
        experience: 'Advanced',
        interests: ['Data Structures & Algorithms', 'Artificial Intelligence', 'Cybersecurity'],
        email: 'attacker.override@test.com', // Attempt to modify email (must be ignored)
        password: 'HackedPassword123!' // Attempt to modify password (must be ignored)
      })
    });
    const putData = await putRes.json();
    assert(
      putRes.status === 200 &&
      putData.success &&
      putData.user?.fullName === 'Rear Admiral Grace Hopper' &&
      putData.user?.experience === 'Advanced' &&
      putData.user?.gender === 'Female' &&
      putData.user?.interests?.length === 3 &&
      putData.user?.email === testEmail, // Email remains immutable
      `PUT /api/users/me updated fields and ignored immutable fields (email, credentials)`
    );

    // -------------------------------------------------------------------------
    // 9. Verify MongoDB contains updated profile
    // -------------------------------------------------------------------------
    console.log('\n[Test 9] Verify MongoDB contains updated profile');
    const userDocAfter = await db.collection('users').findOne({ email: testEmail });
    assert(
      userDocAfter &&
      userDocAfter.fullName === 'Rear Admiral Grace Hopper' &&
      userDocAfter.gender === 'Female' &&
      userDocAfter.experience === 'Advanced' &&
      userDocAfter.interests.includes('Cybersecurity'),
      `Direct MongoDB inspection confirms persistent profile updates`
    );

    // -------------------------------------------------------------------------
    // 10. GET /api/users/me again -> updated data
    // -------------------------------------------------------------------------
    console.log('\n[Test 10] GET /api/users/me again -> updated data');
    const getMeAgainRes = await fetch(`${API_BASE}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const getMeAgainData = await getMeAgainRes.json();
    assert(
      getMeAgainRes.status === 200 &&
      getMeAgainData.success &&
      getMeAgainData.user?.fullName === 'Rear Admiral Grace Hopper' &&
      getMeAgainData.user?.experience === 'Advanced',
      `Subsequent GET /api/users/me reflects all updated profile fields`
    );

    // -------------------------------------------------------------------------
    // 11. PUT invalid name -> 400
    // -------------------------------------------------------------------------
    console.log('\n[Test 11] PUT invalid name -> 400');
    const badNameRes = await fetch(`${API_BASE}/api/users/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        fullName: 'A', // Too short (must be >= 2 characters)
        gender: 'Female',
        experience: 'Advanced',
        interests: ['Web Development']
      })
    });
    const badNameData = await badNameRes.json();
    assert(
      badNameRes.status === 400 && badNameData.success === false,
      `PUT with invalid name (length < 2) rejected with HTTP 400`
    );

    // -------------------------------------------------------------------------
    // 12. PUT invalid gender -> 400
    // -------------------------------------------------------------------------
    console.log('\n[Test 12] PUT invalid gender -> 400');
    const badGenderRes = await fetch(`${API_BASE}/api/users/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        fullName: 'Grace Hopper',
        gender: 'Alien', // Invalid option
        experience: 'Advanced',
        interests: ['Web Development']
      })
    });
    const badGenderData = await badGenderRes.json();
    assert(
      badGenderRes.status === 400 && badGenderData.success === false,
      `PUT with invalid gender rejected with HTTP 400`
    );

    // -------------------------------------------------------------------------
    // 13. PUT invalid experience -> 400
    // -------------------------------------------------------------------------
    console.log('\n[Test 13] PUT invalid experience -> 400');
    const badExpRes = await fetch(`${API_BASE}/api/users/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        fullName: 'Grace Hopper',
        gender: 'Female',
        experience: 'Master', // Invalid experience
        interests: ['Web Development']
      })
    });
    const badExpData = await badExpRes.json();
    assert(
      badExpRes.status === 400 && badExpData.success === false,
      `PUT with invalid experience rejected with HTTP 400`
    );

    // -------------------------------------------------------------------------
    // 14. PUT empty interests -> 400
    // -------------------------------------------------------------------------
    console.log('\n[Test 14] PUT empty interests -> 400');
    const emptyIntRes = await fetch(`${API_BASE}/api/users/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        fullName: 'Grace Hopper',
        gender: 'Female',
        experience: 'Intermediate',
        interests: [] // Empty array
      })
    });
    const emptyIntData = await emptyIntRes.json();
    assert(
      emptyIntRes.status === 400 && emptyIntData.success === false,
      `PUT with empty interests array rejected with HTTP 400`
    );

    // -------------------------------------------------------------------------
    // 15. GET without JWT -> 401
    // -------------------------------------------------------------------------
    console.log('\n[Test 15] GET without JWT -> 401');
    const unauthGetRes = await fetch(`${API_BASE}/api/users/me`);
    assert(
      unauthGetRes.status === 401,
      `Unauthenticated GET /api/users/me rejected with HTTP 401 (got ${unauthGetRes.status})`
    );

    // -------------------------------------------------------------------------
    // 16. PUT without JWT -> 401
    // -------------------------------------------------------------------------
    console.log('\n[Test 16] PUT without JWT -> 401');
    const unauthPutRes = await fetch(`${API_BASE}/api/users/me`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Grace Hopper',
        gender: 'Female',
        experience: 'Intermediate',
        interests: ['Web Development']
      })
    });
    assert(
      unauthPutRes.status === 401,
      `Unauthenticated PUT /api/users/me rejected with HTTP 401 (got ${unauthPutRes.status})`
    );

    // -------------------------------------------------------------------------
    // 17. Verify passwordHash remains unchanged
    // -------------------------------------------------------------------------
    console.log('\n[Test 17] Verify passwordHash remains unchanged');
    const userDocFinal = await db.collection('users').findOne({ email: testEmail });
    const finalPasswordHash = userDocFinal?.passwordHash;
    assert(
      finalPasswordHash === initialPasswordHash,
      `MongoDB passwordHash remained completely unchanged after profile updates`
    );

    // -------------------------------------------------------------------------
    // 18. Cleanup temporary test user
    // -------------------------------------------------------------------------
    console.log('\n[Test 18] Cleanup temporary test user');
    const deleteResult = await db.collection('users').deleteOne({ email: testEmail });
    assert(
      deleteResult.deletedCount === 1,
      `Cleaned up temporary test user from MongoDB (${testEmail})`
    );

  } catch (error) {
    console.error('Unexpected test error:', error);
    failed++;
  } finally {
    await mongoose.disconnect();
    console.log('\n==================================================');
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
