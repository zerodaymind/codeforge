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
const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/codeforge';

async function backupDatabase() {
  console.log('[Backup] Starting CodeForge database backup with BSON Extended JSON...');

  const args = process.argv.slice(2);
  const customOutArg = args.find((a) => !a.startsWith('--'));

  try {
    const conn = await mongoose.connect(uri);
    console.log(`[Backup] Connected to database: ${conn.connection.name}`);

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = customOutArg
      ? path.resolve(process.cwd(), customOutArg)
      : path.resolve(__dirname, '..', 'backups', `backup-${timestamp}`);

    fs.mkdirSync(backupDir, { recursive: true });

    const manifest = {
      formatVersion: 2,
      bsonEngine: 'EJSON',
      timestamp: new Date().toISOString(),
      database: conn.connection.name,
      collections: {},
      indexes: {}
    };

    for (const col of collections) {
      const colName = col.name;
      // Skip system collections
      if (colName.startsWith('system.')) continue;

      const collection = db.collection(colName);
      const documents = await collection.find({}).toArray();

      let indexes = [];
      try {
        indexes = await collection.indexes();
      } catch (err) {
        console.warn(`  ⚠ Could not read indexes for ${colName}: ${err.message}`);
      }

      const customIndexes = indexes.filter((idx) => idx.name !== '_id_');

      // Canonical Extended JSON serialization preserves BSON types (ObjectId, Date, Decimal128, etc.)
      const filePath = path.join(backupDir, `${colName}.json`);
      fs.writeFileSync(filePath, EJSON.stringify(documents, null, 2), 'utf8');

      manifest.collections[colName] = documents.length;
      if (customIndexes.length > 0) {
        manifest.indexes[colName] = customIndexes;
      }

      console.log(`  ✓ Exported ${colName}: ${documents.length} documents (${customIndexes.length} custom indexes)`);
    }

    fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

    console.log(`\n[Backup] Backup completed successfully.`);
    console.log(`[Backup] Artifact location: ${backupDir}`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error(`[Backup Error] Backup failed: ${error.message}`);
    process.exit(1);
  }
}

backupDatabase();
