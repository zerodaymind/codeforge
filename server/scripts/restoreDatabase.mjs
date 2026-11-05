import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const { EJSON } = mongoose.mongo.BSON;

async function restoreDatabase() {
  const args = process.argv.slice(2);
  const targetDirArg = args.find((a) => !a.startsWith('--'));
  const hasConfirm = args.includes('--confirm');
  const targetUriArg = args.find((a) => a.startsWith('--target-uri='));

  if (!targetDirArg) {
    console.error('Usage: node restoreDatabase.mjs <backup-directory-path> --confirm [--target-uri=<uri>]');
    console.error('Example: node restoreDatabase.mjs ../backups/backup-2026-10-10T17-30-00-000Z --confirm');
    process.exit(1);
  }

  if (!hasConfirm) {
    console.error('[Restore Safety Error] Database restore requires explicit "--confirm" flag to prevent accidental overwrites.');
    process.exit(1);
  }

  const backupDir = path.resolve(process.cwd(), targetDirArg);
  if (!fs.existsSync(backupDir)) {
    console.error(`[Restore Error] Backup directory does not exist: ${backupDir}`);
    process.exit(1);
  }

  const manifestPath = path.join(backupDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(`[Restore Error] manifest.json not found in backup directory.`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const isEjson = manifest.formatVersion === 2 || manifest.bsonEngine === 'EJSON';

  console.log(`[Restore] Restoring backup (formatVersion: ${manifest.formatVersion || 1}, BSON Engine: ${isEjson ? 'EJSON' : 'Standard JSON'})`);
  console.log(`[Restore] Source database: "${manifest.database}", Created: ${manifest.timestamp}`);

  const uri = targetUriArg
    ? targetUriArg.replace('--target-uri=', '').trim()
    : (process.env.RESTORE_TARGET_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/codeforge');

  try {
    const conn = await mongoose.connect(uri);
    console.log(`[Restore] Connected to target database: ${conn.connection.name}`);
    const db = mongoose.connection.db;

    for (const [colName, expectedCount] of Object.entries(manifest.collections)) {
      const jsonFile = path.join(backupDir, `${colName}.json`);
      if (!fs.existsSync(jsonFile)) {
        console.warn(`  ⚠ Warning: file not found for ${colName}`);
        continue;
      }

      const fileContent = fs.readFileSync(jsonFile, 'utf8');

      // Parse with EJSON when formatVersion is 2, preserving ObjectId and Date instances
      const docs = isEjson
        ? EJSON.parse(fileContent, { relaxed: false })
        : JSON.parse(fileContent);

      const collection = db.collection(colName);

      // Clean existing documents in target collection
      await collection.deleteMany({});

      if (docs.length > 0) {
        await collection.insertMany(docs);
      }

      // Recreate custom indexes if present in manifest
      let recreatedIndexes = 0;
      if (manifest.indexes && Array.isArray(manifest.indexes[colName])) {
        const customIndexes = manifest.indexes[colName].filter((idx) => idx.name !== '_id_');
        if (customIndexes.length > 0) {
          try {
            await collection.createIndexes(
              customIndexes.map((idx) => {
                const spec = { key: idx.key, name: idx.name };
                if (idx.unique) spec.unique = true;
                if (idx.sparse) spec.sparse = true;
                return spec;
              })
            );
            recreatedIndexes = customIndexes.length;
          } catch (idxErr) {
            console.warn(`    ⚠ Index recreation notice for ${colName}: ${idxErr.message}`);
          }
        }
      }

      console.log(`  ✓ Restored ${colName}: ${docs.length} / ${expectedCount} documents (${recreatedIndexes} indexes recreated)`);
    }

    console.log(`\n[Restore] Database restoration completed successfully.`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error(`[Restore Error] Restoration failed: ${error.message}`);
    process.exit(1);
  }
}

restoreDatabase();
