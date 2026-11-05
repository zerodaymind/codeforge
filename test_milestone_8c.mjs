import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

const BACKEND_URL = 'http://localhost:5000';
const MONGO_URI = 'mongodb://127.0.0.1:27017/codeforge';
const JWT_SECRET = 'codeforge_jwt_secret_dev_2026_9b8c3f2a1d4e7';

console.log('====================================================');
console.log('       RUNNING MILESTONE 8C VERIFICATION SUITE');
console.log('====================================================\n');

let allPassed = true;
const assert = (condition, description) => {
  if (condition) {
    console.log(`[PASS] ${description}`);
  } else {
    console.error(`[FAIL] ${description}`);
    allPassed = false;
  }
};

// 1. Backend & Database Health
console.log('--- 1. BACKEND & DATABASE HEALTH ---');
const healthRes = await fetch(`${BACKEND_URL}/api/health`);
const healthData = await healthRes.json();
assert(healthRes.status === 200, 'GET /api/health returns HTTP 200');
assert(healthData.success === true, 'Health check indicates success: true');
assert(healthData.database === 'connected', 'Database connection status is connected');

// Connect to MongoDB directly to clean any previous test user
await mongoose.connect(MONGO_URI);
const userColl = mongoose.connection.collection('users');
await userColl.deleteMany({ email: 'milestone8c.tester@codeforge.io' });
console.log('✓ Cleaned up any existing test records\n');

// 2. Register temporary test user
console.log('--- 2. REGISTRATION OF TEST USER ---');
const regRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fullName: 'Milestone 8C Tester',
    email: 'milestone8c.tester@codeforge.io',
    password: 'SecurePassword123',
    gender: 'Other',
    experience: 'Advanced',
    interests: ['Data Structures & Algorithms', 'Web Development']
  })
});
const regData = await regRes.json();
assert(regRes.status === 201, 'POST /api/auth/register returns HTTP 201 Created');
assert(regData.success === true, 'Registration reports success: true');
assert(regData.user && regData.user.email === 'milestone8c.tester@codeforge.io', 'User object returned with normalized email');
assert(regData.user.password === undefined, 'Plaintext password is NOT in registration response');
assert(regData.user.passwordHash === undefined, 'passwordHash is NOT in registration response');

// 3 & 4. Login with correct credentials & verify HTTP 200
console.log('\n--- 3. LOGIN & JWT CREATION ---');
const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'milestone8c.tester@codeforge.io',
    password: 'SecurePassword123'
  })
});
const loginData = await loginRes.json();
assert(loginRes.status === 200, 'POST /api/auth/login returns HTTP 200 OK');
assert(loginData.success === true, 'Login response indicates success: true');
assert(typeof loginData.token === 'string' && loginData.token.length > 20, 'Response contains valid JWT string');
assert(loginData.user && loginData.user.email === 'milestone8c.tester@codeforge.io', 'Login returns safe user profile');
assert(loginData.user.password === undefined, 'Plaintext password NOT in login response');
assert(loginData.user.passwordHash === undefined, 'passwordHash NOT in login response');

// 5. Decode JWT without verification and check payload structure
console.log('\n--- 4. JWT PAYLOAD SECURITY INSPECTION ---');
const decodedPayload = jwt.decode(loginData.token);
assert(decodedPayload !== null, 'JWT is decodable');
assert(typeof decodedPayload.id === 'string', 'JWT payload contains user id string');
const payloadKeys = Object.keys(decodedPayload);
assert(!payloadKeys.includes('password'), 'JWT payload does NOT contain password');
assert(!payloadKeys.includes('passwordHash'), 'JWT payload does NOT contain passwordHash');
assert(!payloadKeys.includes('secret'), 'JWT payload does NOT contain secret');
assert(!payloadKeys.includes('email'), 'JWT payload does NOT contain email');
assert(!payloadKeys.includes('fullName'), 'JWT payload does NOT contain fullName');
assert(!payloadKeys.includes('interests'), 'JWT payload does NOT contain interests');
assert(!payloadKeys.includes('gender'), 'JWT payload does NOT contain gender');
assert(!payloadKeys.includes('experience'), 'JWT payload does NOT contain experience');
assert(
  payloadKeys.length === 3 &&
  payloadKeys.includes('id') &&
  payloadKeys.includes('iat') &&
  payloadKeys.includes('exp'),
  'JWT payload contains strictly only: id, iat, exp'
);

// 6. GET /api/auth/me with valid JWT
console.log('\n--- 5. GET /api/auth/me ENDPOINT VERIFICATION ---');
const meRes = await fetch(`${BACKEND_URL}/api/auth/me`, {
  headers: {
    Authorization: `Bearer ${loginData.token}`
  }
});
const meData = await meRes.json();
assert(meRes.status === 200, 'GET /api/auth/me with valid JWT returns HTTP 200 OK');
assert(meData.success === true, 'GET /api/auth/me indicates success: true');
assert(meData.user.email === 'milestone8c.tester@codeforge.io', 'Returns correct authenticated user email');
assert(meData.user.fullName === 'Milestone 8C Tester', 'Returns correct user fullName');
assert(meData.user.gender === 'Other', 'Returns correct user gender');
assert(meData.user.experience === 'Advanced', 'Returns correct user experience');
assert(meData.user.interests.length === 2, 'Returns correct user interests');
assert(meData.user.password === undefined, 'User object does NOT expose password');
assert(meData.user.passwordHash === undefined, 'User object does NOT expose passwordHash');

// 7. GET /api/auth/me without token -> 401
const noTokenRes = await fetch(`${BACKEND_URL}/api/auth/me`);
const noTokenData = await noTokenRes.json();
assert(noTokenRes.status === 401, 'GET /api/auth/me without token returns HTTP 401');
assert(noTokenData.success === false, 'no-token response indicates success: false');
assert(noTokenData.message === 'Access denied. No token provided.', 'Appropriate error message for missing token');

// 8. GET /api/auth/me with malformed token -> 401
const malformedRes = await fetch(`${BACKEND_URL}/api/auth/me`, {
  headers: {
    Authorization: 'Bearer malformed.invalid.token'
  }
});
const malformedData = await malformedRes.json();
assert(malformedRes.status === 401, 'GET /api/auth/me with malformed token returns HTTP 401');
assert(malformedData.message === 'Invalid or expired token.', 'Generic error message for malformed token');

// 9. GET /api/auth/me with tampered token -> 401
const tamperedToken = loginData.token.slice(0, -6) + 'xyz123';
const tamperedRes = await fetch(`${BACKEND_URL}/api/auth/me`, {
  headers: {
    Authorization: `Bearer ${tamperedToken}`
  }
});
const tamperedData = await tamperedRes.json();
assert(tamperedRes.status === 401, 'GET /api/auth/me with tampered signature returns HTTP 401');
assert(tamperedData.message === 'Invalid or expired token.', 'Generic error message for tampered token');

// 10. GET /api/auth/me with expired token -> 401
const expiredToken = jwt.sign(
  { id: loginData.user.id },
  JWT_SECRET,
  { expiresIn: '0s' }
);
await new Promise((resolve) => setTimeout(resolve, 50));
const expiredRes = await fetch(`${BACKEND_URL}/api/auth/me`, {
  headers: {
    Authorization: `Bearer ${expiredToken}`
  }
});
const expiredData = await expiredRes.json();
assert(expiredRes.status === 401, 'GET /api/auth/me with expired token returns HTTP 401');
assert(expiredData.message === 'Invalid or expired token.', 'Generic error message for expired token');

// 11. Verify MongoDB document security
console.log('\n--- 6. MONGODB DOCUMENT SECURITY INSPECTION ---');
const storedDoc = await userColl.findOne({ email: 'milestone8c.tester@codeforge.io' });
assert(storedDoc !== null, 'User document found in MongoDB users collection');
assert(storedDoc.passwordHash && (storedDoc.passwordHash.startsWith('$2a$') || storedDoc.passwordHash.startsWith('$2b$')), 'passwordHash is a valid bcrypt hash');
assert(storedDoc.password === undefined, 'MongoDB document NEVER stores plaintext password');
assert(storedDoc.confirmPassword === undefined, 'MongoDB document NEVER stores confirmPassword');

// 12. Clean up temporary test user
await userColl.deleteMany({ email: 'milestone8c.tester@codeforge.io' });
await mongoose.disconnect();
console.log('✓ Cleaned up temporary test user from MongoDB\n');

if (allPassed) {
  console.log('====================================================');
  console.log('  🎉 ALL MILESTONE 8C TEST SUITE ASSERTIONS PASSED (100%)');
  console.log('====================================================');
} else {
  console.error('❌ Some assertions failed.');
  process.exit(1);
}
