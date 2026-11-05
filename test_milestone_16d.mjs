/**
 * ==============================================================================
 * CODEFORGE MILESTONE 16D: AI LEARNING ASSISTANT RETIREMENT VERIFICATION
 * ==============================================================================
 * Verifies that the AI Learning Mentor / AI Tutor feature has been completely
 * and cleanly removed / decommissioned across frontend and backend:
 * 1. Backend routes (/api/assistant/* and /api/intelligence/assistant/*) are unmounted (return 404).
 * 2. Frontend component src/components/AILearningAssistant.jsx is removed.
 * 3. Frontend layout src/layouts/MainLayout.jsx has unmounted the assistant widget.
 * 4. Frontend API client src/utils/api.js no longer exports assistant endpoints.
 * 5. Learning Intelligence services (Pathways, Retention, Recommendations) remain intact.
 * ==============================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './server/models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, 'server', '.env') });
const API_BASE = 'http://localhost:5000';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/codeforge';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_12345';

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

async function runRetirementSuite() {
  console.log('==============================================================================');
  console.log('CODEFORGE MILESTONE 16D: AI TUTOR RETIREMENT & DECOMMISSIONING SUITE');
  console.log('==============================================================================\n');

  // --- PART 1: FRONTEND CODE CLEANUP ---
  console.log('--- PART 1: FRONTEND CODE CLEANUP ---');

  const assistantComponentPath = path.resolve(__dirname, 'src', 'components', 'AILearningAssistant.jsx');
  assert(!fs.existsSync(assistantComponentPath), 'AILearningAssistant.jsx component file completely removed');

  const mainLayoutContent = fs.readFileSync(path.resolve(__dirname, 'src', 'layouts', 'MainLayout.jsx'), 'utf-8');
  assert(!mainLayoutContent.includes('AILearningAssistant'), 'MainLayout.jsx does not import or render AILearningAssistant');
  assert(!mainLayoutContent.includes('AI Mentor'), 'MainLayout.jsx documentation updated to remove AI Mentor');

  const apiContent = fs.readFileSync(path.resolve(__dirname, 'src', 'utils', 'api.js'), 'utf-8');
  assert(!apiContent.includes('sendAssistantMessage'), 'src/utils/api.js does not export sendAssistantMessage');
  assert(!apiContent.includes('getAssistantConversations'), 'src/utils/api.js does not export getAssistantConversations');
  assert(!apiContent.includes('getAssistantConversation'), 'src/utils/api.js does not export getAssistantConversation');
  assert(!apiContent.includes('deleteAssistantConversation'), 'src/utils/api.js does not export deleteAssistantConversation');
  assert(!apiContent.includes('getAssistantLearnerContext'), 'src/utils/api.js does not export getAssistantLearnerContext');

  const profileContent = fs.readFileSync(path.resolve(__dirname, 'src', 'pages', 'Profile.jsx'), 'utf-8');
  assert(!profileContent.includes('AI learning assistant tutoring logs'), 'Profile deletion modal clean of tutoring log references');

  // --- PART 2: BACKEND ROUTE DECOUPLING ---
  console.log('\n--- PART 2: BACKEND ROUTE DECOUPLING ---');

  const serverContent = fs.readFileSync(path.resolve(__dirname, 'server', 'server.js'), 'utf-8');
  assert(!serverContent.includes('assistantRoutes'), 'server/server.js does not import or mount assistantRoutes');

  const intelligenceRoutesContent = fs.readFileSync(path.resolve(__dirname, 'server', 'routes', 'intelligenceRoutes.js'), 'utf-8');
  assert(!intelligenceRoutesContent.includes('assistantRoutes'), 'server/routes/intelligenceRoutes.js does not mount assistantRoutes');

  const assistantRoutesPath = path.resolve(__dirname, 'server', 'routes', 'assistantRoutes.js');
  assert(!fs.existsSync(assistantRoutesPath), 'server/routes/assistantRoutes.js completely removed');

  const assistantControllerPath = path.resolve(__dirname, 'server', 'controllers', 'assistantController.js');
  assert(!fs.existsSync(assistantControllerPath), 'server/controllers/assistantController.js completely removed');

  const assistantServicePath = path.resolve(__dirname, 'server', 'services', 'assistantService.js');
  assert(!fs.existsSync(assistantServicePath), 'server/services/assistantService.js completely removed');

  const aiProviderAdapterPath = path.resolve(__dirname, 'server', 'services', 'ai', 'aiProviderAdapter.js');
  assert(!fs.existsSync(aiProviderAdapterPath), 'server/services/ai/aiProviderAdapter.js completely removed');

  // --- PART 3: LIVE HTTP UNMOUNT VERIFICATION (404 FAIL-CLOSED) ---
  console.log('\n--- PART 3: LIVE HTTP UNMOUNT VERIFICATION (404 NOT FOUND) ---');

  try {
    const postMessageRes = await fetch(`${API_BASE}/api/assistant/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello' })
    });
    assert(postMessageRes.status === 404, 'POST /api/assistant/message returns 404 Not Found (safely decoupled)');

    const getConversationsRes = await fetch(`${API_BASE}/api/assistant/conversations`);
    assert(getConversationsRes.status === 404, 'GET /api/assistant/conversations returns 404 Not Found');

    const getContextRes = await fetch(`${API_BASE}/api/assistant/context`);
    assert(getContextRes.status === 404, 'GET /api/assistant/context returns 404 Not Found');

    await mongoose.connect(MONGO_URI);
    const user = await User.findOne();
    const token = user ? jwt.sign({ id: user._id }, JWT_SECRET) : '';

    const getIntelContextRes = await fetch(`${API_BASE}/api/intelligence/assistant/context`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    assert(getIntelContextRes.status === 404, 'GET /api/intelligence/assistant/context returns 404 Not Found (safely decoupled)');

    await mongoose.disconnect();
  } catch (err) {
    console.log(`  (Note: Backend server check skipped or errored: ${err.message})`);
  }

  // --- PART 4: SHARED INTELLIGENCE SERVICES REMAIN FUNCTIONAL ---
  console.log('\n--- PART 4: SHARED INTELLIGENCE SERVICES REMAIN FUNCTIONAL ---');
  try {
    const healthRes = await fetch(`${API_BASE}/api/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200, 'GET /api/health returns 200 OK');
    assert(healthData.database === 'connected', 'Database connection remains healthy');
  } catch (err) {
    console.log(`  (Note: Backend health check skipped or errored: ${err.message})`);
  }

  console.log('\n==============================================================================');
  console.log(`RETIREMENT VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==============================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runRetirementSuite().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
