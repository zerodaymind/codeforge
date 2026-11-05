import mongoose from 'mongoose';

/**
 * AuditLog Mongoose Schema
 * Records privileged administrative activities for governance, traceability,
 * and security monitoring.
 *
 * SECURITY:
 * Never logs raw passwords, plaintext hashes, tokens, or private secrets.
 */
const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Acting administrator ID is required'],
      index: true
    },
    actorEmail: {
      type: String,
      required: [true, 'Acting administrator email is required'],
      trim: true
    },
    action: {
      type: String,
      required: [true, 'Audit action type is required'],
      index: true
    },
    entityType: {
      type: String,
      required: [true, 'Entity type is required'],
      enum: ['Question', 'Quiz', 'User']
    },
    entityId: {
      type: String,
      required: [true, 'Target entity ID is required']
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: false // We use explicitly indexed timestamp field
  }
);

// Compound indexes for bounded audit querying
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ action: 1, timestamp: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema, 'audit_logs');

export default AuditLog;
