/**
 * ==============================================================================
 * CODEFORGE BSON-SAFE DATABASE BACKUP & RESTORE TEST SUITE
 * Validates Canonical Extended JSON serialization, BSON ObjectId/Date preservation,
 * custom index restoration, and isolated test database recovery.
 * ==============================================================================
 */

import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, 'server', '.env') });

const PRIMARY_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/codeforge';
const ISOLATED_TEST_URI = 'mongodb://127.0.0.1:27017/codeforge_restore_test';

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

async function runTests() {
  console.log('\n==================================================');
  console.log('  CODEFORGE BSON-SAFE BACKUP & RESTORE VERIFICATION');
  console.log('==================================================\n');

  const testBackupDir = path.resolve(__dirname, 'server', 'backups', `test-bson-backup-${Date.now()}`);

  try {
    // --------------------------------------------------------------------------
    // PART 1: Source Database Inspection (BSON Baseline)
    // --------------------------------------------------------------------------
    console.log('--------------------------------------------------');
    console.log('PART 1: Source Database BSON Baseline Inspection');
    console.log('--------------------------------------------------');

    await mongoose.connect(PRIMARY_URI);
    const db = mongoose.connection.db;

    const sampleUser = await db.collection('users').findOne({});
    assert(sampleUser !== null, 'Found representative user in source database');
    assert(
      sampleUser._id.constructor.name === 'ObjectId',
      `Source user _id is a native BSON ObjectId (${sampleUser._id.constructor.name})`
    );
    assert(
      sampleUser.createdAt instanceof Date,
      `Source user createdAt is a native BSON Date (${sampleUser.createdAt.constructor.name})`
    );

    const sourceIndexes = await db.collection('users').indexes();
    const sourceHasEmailUnique = sourceIndexes.some(
      (idx) => idx.name === 'email_1' && idx.unique === true
    );
    assert(sourceHasEmailUnique, 'Source users collection contains unique index on email');

    const sourceTotalUsers = await db.collection('users').countDocuments();
    const sampleUserId = sampleUser._id.toString();

    await mongoose.disconnect();

    // --------------------------------------------------------------------------
    // PART 2: Execute Upgraded BSON Backup Script
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 2: Execute backupDatabase.mjs with EJSON Engine');
    console.log('--------------------------------------------------');

    execFileSync(process.execPath, ['server/scripts/backupDatabase.mjs', testBackupDir], {
      cwd: __dirname,
      stdio: 'pipe'
    });

    assert(fs.existsSync(testBackupDir), 'Backup output directory generated');
    const manifestPath = path.join(testBackupDir, 'manifest.json');
    assert(fs.existsSync(manifestPath), 'Backup manifest.json generated');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert(manifest.formatVersion === 2, `Manifest records formatVersion: 2 (${manifest.formatVersion})`);
    assert(manifest.bsonEngine === 'EJSON', `Manifest records bsonEngine: "EJSON" (${manifest.bsonEngine})`);
    assert(manifest.collections.users === sourceTotalUsers, `Manifest documents users count: ${manifest.collections.users}`);
    assert(Array.isArray(manifest.indexes.users), 'Manifest records custom indexes for users collection');

    // Inspect exported users.json for Canonical EJSON markers ($oid, $date)
    const usersJsonRaw = fs.readFileSync(path.join(testBackupDir, 'users.json'), 'utf8');
    assert(usersJsonRaw.includes('"$oid"'), 'users.json contains Canonical BSON "$oid" type descriptors');
    assert(usersJsonRaw.includes('"$date"'), 'users.json contains Canonical BSON "$date" type descriptors');

    // --------------------------------------------------------------------------
    // PART 3: Execute Upgraded Restore Script targeting Isolated Test DB
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 3: Restore into Isolated Test Database');
    console.log('--------------------------------------------------');

    execFileSync(
      process.execPath,
      [
        'server/scripts/restoreDatabase.mjs',
        testBackupDir,
        '--confirm',
        `--target-uri=${ISOLATED_TEST_URI}`
      ],
      { cwd: __dirname, stdio: 'pipe' }
    );

    // --------------------------------------------------------------------------
    // PART 4: Verification of Isolated Restored Database Integrity
    // --------------------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('PART 4: Verify Restored BSON Types, Queries & Indexes');
    console.log('--------------------------------------------------');

    await mongoose.connect(ISOLATED_TEST_URI);
    const testDb = mongoose.connection.db;

    const restoredTotalUsers = await testDb.collection('users').countDocuments();
    assert(
      restoredTotalUsers === sourceTotalUsers,
      `Restored collection count exactly matches source (${restoredTotalUsers} / ${sourceTotalUsers})`
    );

    // Query restored document by ObjectId
    const restoredUser = await testDb.collection('users').findOne({
      _id: new mongoose.Types.ObjectId(sampleUserId)
    });

    assert(restoredUser !== null, 'Restored document retrieved successfully using BSON ObjectId query');
    assert(
      restoredUser._id.constructor.name === 'ObjectId',
      `Restored _id preserved as BSON ObjectId (constructor: ${restoredUser._id.constructor.name})`
    );
    assert(
      typeof restoredUser._id === 'object' && typeof restoredUser._id !== 'string',
      'Restored _id is NOT a degraded plain string'
    );
    assert(
      restoredUser.createdAt instanceof Date,
      `Restored createdAt preserved as BSON Date (instanceof Date: ${restoredUser.createdAt instanceof Date})`
    );
    assert(
      restoredUser.createdAt.toISOString() === sampleUser.createdAt.toISOString(),
      `Restored timestamp exact match: "${restoredUser.createdAt.toISOString()}"`
    );

    // Verify index restoration
    const restoredIndexes = await testDb.collection('users').indexes();
    const restoredHasEmailUnique = restoredIndexes.some(
      (idx) => idx.name === 'email_1' && idx.unique === true
    );
    assert(restoredHasEmailUnique, 'Restored users collection preserved unique index on email');

    // Clean up isolated test DB
    await testDb.dropDatabase();
    await mongoose.disconnect();
    console.log('    ✓ Isolated restore test database cleanly dropped');

  } finally {
    // Clean up temporary test backup artifact
    if (fs.existsSync(testBackupDir)) {
      fs.rmSync(testBackupDir, { recursive: true, force: true });
      console.log('    ✓ Temporary test backup artifact directory cleaned up');
    }
  }

  // ----------------------------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------------------------
  console.log('\n==================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled error in test_bson_backup_restore.mjs:', err);
  process.exit(1);
});
