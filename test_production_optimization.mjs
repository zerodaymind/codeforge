/**
 * ==============================================================================
 * CODEFORGE FRONTEND OPTIMIZATION & PRODUCTION DEPLOYMENT VALIDATION SUITE
 * Verifies bundle sizes, code splitting, deferred routes, direct URL access,
 * production deployment configs, security hardening, and safe backup/restore.
 * ==============================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, 'server', '.env') });

const API_BASE = 'http://localhost:5000';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/codeforge';
const TEST_RESTORE_URI = 'mongodb://127.0.0.1:27017/codeforge_restore_test';

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

async function runValidation() {
  console.log('\n==================================================');
  console.log('  CODEFORGE FRONTEND OPTIMIZATION & DEPLOYMENT');
  console.log('  Automated Verification & Audit Suite');
  console.log('==================================================\n');

  try {
    // --------------------------------------------------------------------------
    // PART 1: BUNDLE SIZE, CODE SPLITTING & ASSET METRICS
    // --------------------------------------------------------------------------
    console.log('--------------------------------------------------');
    console.log('PART 1: Frontend Bundle Size & Code Splitting');
    console.log('--------------------------------------------------');

    const distDir = path.resolve(__dirname, 'dist');
    const assetsDir = path.join(distDir, 'assets');

    assert(fs.existsSync(distDir), 'Production dist directory exists');
    assert(fs.existsSync(assetsDir), 'Production dist/assets directory exists');

    const files = fs.readdirSync(assetsDir);
    const jsFiles = files.filter((f) => f.endsWith('.js'));
    const cssFiles = files.filter((f) => f.endsWith('.css'));

    assert(jsFiles.length > 5, `Code splitting active: generated ${jsFiles.length} separate JS chunks`);

    // Find main entry chunk
    const entryChunk = jsFiles.find((f) => f.startsWith('index-'));
    assert(Boolean(entryChunk), `Main entry chunk found: ${entryChunk}`);

    const entryStat = fs.statSync(path.join(assetsDir, entryChunk));
    const entrySizeKb = (entryStat.size / 1024).toFixed(2);
    console.log(`    -> Entry chunk size: ${entrySizeKb} kB (Target: < 50 kB)`);
    assert(entryStat.size < 50 * 1024, `Initial JS entry chunk is small (${entrySizeKb} kB < 50 kB)`);

    // Verify no single JS chunk exceeds 500 kB
    let anyOversized = false;
    for (const f of jsFiles) {
      const stat = fs.statSync(path.join(assetsDir, f));
      if (stat.size > 500 * 1024) {
        anyOversized = true;
        console.error(`    Chunk ${f} exceeds 500 kB: ${(stat.size / 1024).toFixed(2)} kB`);
      }
    }
    assert(!anyOversized, 'Zero JS chunks exceed the 500 kB threshold (warning eliminated)');

    // Verify vendor-monaco chunk isolation
    const monacoChunk = jsFiles.find((f) => f.startsWith('vendor-monaco'));
    assert(Boolean(monacoChunk), `Monaco Editor isolated into dedicated chunk: ${monacoChunk}`);

    // Verify vendor-jquery chunk isolation
    const jqueryChunk = jsFiles.find((f) => f.startsWith('vendor-jquery'));
    assert(Boolean(jqueryChunk), `jQuery isolated into dedicated chunk: ${jqueryChunk}`);

    // Verify vendor-react chunk isolation
    const reactChunk = jsFiles.find((f) => f.startsWith('vendor-react'));
    assert(Boolean(reactChunk), `React runtime isolated into dedicated chunk: ${reactChunk}`);

    // Verify admin routes are deferred
    const adminChunks = jsFiles.filter(
      (f) =>
        f.startsWith('AdminDashboard') ||
        f.startsWith('QuestionList') ||
        f.startsWith('QuestionForm') ||
        f.startsWith('QuizManagement') ||
        f.startsWith('QuizBuilder') ||
        f.startsWith('AdminAuditLog')
    );
    assert(adminChunks.length >= 5, `Admin routes deferred into separate chunks (Found: ${adminChunks.length})`);

    // Verify quiz routes are deferred
    const quizChunks = jsFiles.filter(
      (f) => f.startsWith('Quiz-') || f.startsWith('QuizResult') || f.startsWith('QuizHistory')
    );
    assert(quizChunks.length >= 3, `Quiz routes deferred into separate chunks (Found: ${quizChunks.length})`);

    // Verify coding workspace is deferred
    const problemChunk = jsFiles.find((f) => f.startsWith('ProblemDetails'));
    const editorChunk = jsFiles.find((f) => f.startsWith('CodeEditor'));
    assert(Boolean(problemChunk), `Coding workspace ProblemDetails deferred: ${problemChunk}`);
    assert(Boolean(editorChunk), `CodeEditor component deferred: ${editorChunk}`);

    // Verify CSS chunks exist
    assert(cssFiles.length >= 1, `CSS stylesheets generated (Found: ${cssFiles.length})`);

    // --------------------------------------------------------------------------
    // PART 2: DIRECT URL NAVIGATION & SPA FALLBACK AUDIT
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 2: Direct URL Navigation & SPA Routing Configuration');
    console.log('--------------------------------------------------');

    const nginxConfPath = path.resolve(__dirname, 'nginx.conf');
    assert(fs.existsSync(nginxConfPath), 'Production nginx.conf exists');
    const nginxContent = fs.readFileSync(nginxConfPath, 'utf8');

    assert(
      nginxContent.includes('try_files $uri $uri/ /index.html;'),
      'Nginx configured with try_files fallback for client-side SPA routing'
    );
    assert(
      nginxContent.includes('location /assets/'),
      'Nginx configured with dedicated /assets/ caching block'
    );
    assert(
      nginxContent.includes('max-age=31536000, immutable'),
      'Nginx enforces 1-year immutable caching on hashed static assets'
    );
    assert(
      nginxContent.includes('gzip on;'),
      'Nginx gzip compression enabled for text, css, json, and js assets'
    );
    assert(
      nginxContent.includes('proxy_pass http://backend:5000/api/;'),
      'Nginx proxies /api/ requests to upstream backend container'
    );

    // --------------------------------------------------------------------------
    // PART 3: PRODUCTION CONTAINER & ORCHESTRATION INTEGRITY
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 3: Containerization & Security Controls Audit');
    console.log('--------------------------------------------------');

    // 3.1 Backend Dockerfile
    const backendDockerPath = path.resolve(__dirname, 'Dockerfile');
    const backendDockerContent = fs.readFileSync(backendDockerPath, 'utf8');
    assert(
      backendDockerContent.includes('FROM node:20-alpine AS dependencies'),
      'Backend Dockerfile uses multi-stage build (dependencies -> runner)'
    );
    assert(
      backendDockerContent.includes('npm ci --omit=dev'),
      'Backend production stage installs only production dependencies'
    );
    assert(
      backendDockerContent.includes('USER node'),
      'Backend runs under non-privileged "node" user (least privilege)'
    );
    assert(
      backendDockerContent.includes('HEALTHCHECK'),
      'Backend Dockerfile specifies container health check probe'
    );

    // 3.2 Frontend Dockerfile
    const frontendDockerPath = path.resolve(__dirname, 'Dockerfile.frontend');
    const frontendDockerContent = fs.readFileSync(frontendDockerPath, 'utf8');
    assert(
      frontendDockerContent.includes('FROM node:20-alpine AS builder'),
      'Frontend Dockerfile uses multi-stage build (builder -> runner)'
    );
    assert(
      frontendDockerContent.includes('FROM nginx:alpine AS runner'),
      'Frontend runner uses hardened minimal nginx:alpine image'
    );

    // 3.3 Docker Compose
    const composePath = path.resolve(__dirname, 'docker-compose.yml');
    const composeContent = fs.readFileSync(composePath, 'utf8');
    assert(
      composeContent.includes('internal-net') ||
        (composeContent.includes('runner-net') && composeContent.includes('data-net')),
      'Docker Compose establishes isolated internal network tier(s)'
    );
    assert(
      composeContent.includes('mongo-data:/data/db'),
      'Docker Compose persists MongoDB data to dedicated volume'
    );
    assert(
      !composeContent.includes('"27017:27017"'),
      'MongoDB host port 27017 is NOT published (prevents external exposure)'
    );
    assert(
      composeContent.includes('depends_on'),
      'Container startup order explicitly defined with service dependencies'
    );

    // 3.4 Production Environment Safety Validation
    const { validateEnvironment } = await import('./server/config/env.js');

    const origNodeEnv = process.env.NODE_ENV;
    const origJwt = process.env.JWT_SECRET;
    const origMongo = process.env.MONGO_URI;

    try {
      // Test production rejection of weak JWT secret
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'short_secret';
      let jwtRejected = false;
      try {
        validateEnvironment();
      } catch {
        jwtRejected = true;
      }
      assert(jwtRejected, 'Production mode strictly rejects insecure/short JWT_SECRET (< 32 chars)');

      // Test production rejection of invalid mongo URI
      process.env.JWT_SECRET = 'a_secure_production_secret_with_more_than_32_characters_12345';
      process.env.MONGO_URI = 'invalid://bad-uri';
      let mongoRejected = false;
      try {
        validateEnvironment();
      } catch {
        mongoRejected = true;
      }
      assert(mongoRejected, 'Production mode strictly rejects malformed MONGO_URI');
    } finally {
      process.env.NODE_ENV = origNodeEnv;
      process.env.JWT_SECRET = origJwt;
      process.env.MONGO_URI = origMongo;
    }

    // --------------------------------------------------------------------------
    // PART 4: LIVE BACKEND HEALTH, APIS & SANDBOX STATUS
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 4: Live Observability & Sandbox Execution Checks');
    console.log('--------------------------------------------------');

    // Health probes
    const healthRes = await fetch(`${API_BASE}/api/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200 && healthData.database === 'connected', 'GET /api/health reports database connected');

    const liveRes = await fetch(`${API_BASE}/api/health/live`);
    const liveData = await liveRes.json();
    assert(liveRes.status === 200 && liveData.status === 'ok', 'GET /api/health/live reports ok');

    const readyRes = await fetch(`${API_BASE}/api/health/ready`);
    const readyData = await readyRes.json();
    assert(readyRes.status === 200 && readyData.status === 'ready', 'GET /api/health/ready reports ready');

    // Sandbox execution probe
    const sandboxRes = await fetch(`${API_BASE}/api/code/status`);
    const sandboxData = await sandboxRes.json();
    assert(sandboxRes.status === 200 && sandboxData.success === true, 'GET /api/code/status responds successfully');
    if (sandboxData.sandboxAvailable) {
      assert(
        sandboxData.engine === 'docker',
        'Sandbox reports Docker engine active and sandbox execution available'
      );
    } else {
      assert(
        sandboxData.status === 'SANDBOX_UNAVAILABLE' || sandboxData.setupGuide?.status === 'SANDBOX_UNAVAILABLE',
        'Sandbox reports safe fail-closed SANDBOX_UNAVAILABLE when Docker engine is offline'
      );
    }

    // --------------------------------------------------------------------------
    // PART 5: SAFE DATABASE BACKUP & RESTORATION PROCEDURE TEST
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 5: Safe Backup & Test Restoration Procedure');
    console.log('--------------------------------------------------');

    // Connect to primary DB
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;

    // Create a temporary backup artifact directory for testing
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const testBackupDir = path.resolve(__dirname, 'server', 'backups', `test-backup-${timestamp}`);
    fs.mkdirSync(testBackupDir, { recursive: true });

    const collections = await db.listCollections().toArray();
    const manifest = {
      timestamp: new Date().toISOString(),
      database: 'codeforge',
      collections: {}
    };

    const { EJSON } = mongoose.mongo.BSON;
    let totalDocsExported = 0;
    for (const col of collections) {
      if (col.name.startsWith('system.')) continue;
      const docs = await db.collection(col.name).find({}).toArray();
      fs.writeFileSync(path.join(testBackupDir, `${col.name}.json`), EJSON.stringify(docs, null, 2), 'utf8');
      manifest.collections[col.name] = docs.length;
      totalDocsExported += docs.length;
    }
    fs.writeFileSync(path.join(testBackupDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

    assert(fs.existsSync(path.join(testBackupDir, 'manifest.json')), `Backup manifest generated (${totalDocsExported} documents)`);

    // Disconnect primary
    await mongoose.disconnect();

    // Connect to isolated test database (codeforge_restore_test) to verify restoration
    await mongoose.connect(TEST_RESTORE_URI);
    const testDb = mongoose.connection.db;

    let restoredDocs = 0;
    for (const [colName, expectedCount] of Object.entries(manifest.collections)) {
      const jsonPath = path.join(testBackupDir, `${colName}.json`);
      if (fs.existsSync(jsonPath)) {
        const docs = EJSON.parse(fs.readFileSync(jsonPath, 'utf8'), { relaxed: false });
        if (docs.length > 0) {
          await testDb.collection(colName).insertMany(docs);
          const count = await testDb.collection(colName).countDocuments();
          assert(count === expectedCount, `Restored ${colName} to test DB: ${count} / ${expectedCount} docs`);
          restoredDocs += count;
        }
      }
    }

    assert(restoredDocs === totalDocsExported, `Full restoration verified on isolated test DB (${restoredDocs} docs)`);

    // Clean up isolated test DB
    await testDb.dropDatabase();
    await mongoose.disconnect();
    console.log('    ✓ Isolated restore test database dropped cleanly');

    // Clean up temporary test backup artifact
    fs.rmSync(testBackupDir, { recursive: true, force: true });
    console.log('    ✓ Temporary test backup artifact cleaned up');

  } catch (err) {
    console.error('Validation suite error:', err);
    failed++;
  }

  // ----------------------------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------------------------
  console.log('\n==================================================');
  console.log(`VALIDATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runValidation().catch((err) => {
  console.error('Unhandled validation error:', err);
  process.exit(1);
});
