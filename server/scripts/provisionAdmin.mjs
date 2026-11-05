import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/codeforge';

const cliEmail = process.argv[2];
const cliPassword = process.argv[3];
const cliName = process.argv[4];

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || cliEmail || '').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || cliPassword || '';
const ADMIN_NAME = process.env.ADMIN_NAME || cliName || 'CodeForge Administrator';

/**
 * Provisions or promotes an administrator account.
 * Requires explicitly supplied credentials; never silently provisions with a known default password.
 *
 * Usage:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=StrongPassword123! npm run admin:provision
 *   or:
 *   node server/scripts/provisionAdmin.mjs admin@example.com StrongPassword123! "Platform Admin"
 */
export async function provisionAdmin(email = ADMIN_EMAIL, password = ADMIN_PASSWORD, name = ADMIN_NAME) {
  const targetEmail = (email || '').trim().toLowerCase();
  const targetPassword = password || '';
  const targetName = name || 'CodeForge Administrator';

  if (!targetEmail) {
    throw new Error(
      '[Security Error] ADMIN_EMAIL must be supplied via environment variable (ADMIN_EMAIL) or CLI argument:\n' +
      '  node server/scripts/provisionAdmin.mjs <admin_email> <admin_password>'
    );
  }

  if (!targetPassword) {
    throw new Error(
      '[Security Error] ADMIN_PASSWORD must be explicitly provided. Default passwords are prohibited.\n' +
      '  Supply via ADMIN_PASSWORD environment variable or CLI argument:\n' +
      '  node server/scripts/provisionAdmin.mjs <admin_email> <admin_password>'
    );
  }

  if (targetPassword.length < 8) {
    throw new Error('[Security Error] ADMIN_PASSWORD must be at least 8 characters long.');
  }

  console.log('[Admin Provisioning] Connecting to MongoDB:', MONGO_URI);
  let ownConnection = false;
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(MONGO_URI);
    ownConnection = true;
  }

  try {
    let user = await User.findOne({ email: targetEmail });

    if (user) {
      if (user.role === 'admin') {
        console.log(`[Admin Provisioning] User ${targetEmail} is already an Administrator.`);
      } else {
        user.role = 'admin';
        await user.save();
        console.log(`[Admin Provisioning] Promoted existing user ${targetEmail} to Administrator role.`);
      }
    } else {
      const passwordHash = await bcrypt.hash(targetPassword, 10);
      user = await User.create({
        fullName: targetName,
        email: targetEmail,
        passwordHash,
        gender: 'Other',
        experience: 'Advanced',
        interests: ['JavaScript', 'Data Structures & Algorithms', 'Cybersecurity'],
        role: 'admin'
      });
      console.log(`[Admin Provisioning] Successfully created new Administrator account for ${targetEmail}.`);
    }

    // Record audit log entry if AuditLog collection exists
    try {
      const db = mongoose.connection.db;
      await db.collection('auditlogs').insertOne({
        actor: user._id,
        actorEmail: targetEmail,
        action: 'ADMIN_PROVISION',
        entityType: 'User',
        entityId: user._id.toString(),
        metadata: {
          email: targetEmail,
          role: 'admin',
          timestamp: new Date()
        },
        timestamp: new Date()
      });
    } catch (auditErr) {
      console.warn('[Admin Provisioning] Notice: Could not record audit log:', auditErr.message);
    }

    if (ownConnection) {
      await mongoose.disconnect();
      console.log('[Admin Provisioning] Database connection closed.');
    }

    return user;
  } catch (error) {
    if (ownConnection) await mongoose.disconnect();
    throw error;
  }
}

// Execute if run directly
if (process.argv[1] && process.argv[1].endsWith('provisionAdmin.mjs')) {
  provisionAdmin()
    .then(() => {
      console.log('[Admin Provisioning] Done!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Admin Provisioning Error]:', err.message);
      process.exit(1);
    });
}
