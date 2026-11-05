import mongoose from 'mongoose';

/**
 * Roadmap Recommendation Item Sub-Schema
 * Represents a single actionable learning step grounded in real platform resources.
 */
const roadmapItemSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true
    },
    topic: {
      type: String,
      required: true
    },
    subtopic: {
      type: String,
      default: ''
    },
    state: {
      type: String,
      enum: ['needs_revision', 'promising', 'not_enough_evidence', 'unassessed', 'not_started'],
      required: true
    },
    actionType: {
      type: String,
      enum: ['review', 'diagnose', 'practice', 'quiz', 'advance'],
      default: 'practice'
    },
    priority: {
      type: Number,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    reason: {
      type: String,
      required: true
    },
    sampleSize: {
      type: Number,
      default: 0
    },
    difficulty: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard'],
      default: 'Medium'
    },
    destinationUrl: {
      type: String,
      required: true
    },
    resourceTitle: {
      type: String,
      required: true
    },
    resourceType: {
      type: String,
      enum: ['problem', 'quiz', 'diagnostic'],
      default: 'problem'
    },
    isCompleted: {
      type: Boolean,
      default: false
    },
    completedAt: {
      type: Date,
      default: null
    },
    evidenceSummary: {
      status: { type: String, default: 'not_started' },
      sampleSize: { type: Number, default: 0 },
      correct: { type: Number, default: 0 },
      accuracy: { type: Number, default: 0 },
      note: { type: String, default: '' }
    },
    reassessmentSummary: {
      status: { type: String, default: null },
      label: { type: String, default: null },
      deltaPercentage: { type: Number, default: null },
      interpretation: { type: String, default: null }
    }
  },
  { _id: false }
);

/**
 * Roadmap Mongoose Schema
 * Stores authenticated user's persistent, adaptive revision roadmap.
 * Unique compound index on { user: 1 } ensures exactly one roadmap document per user.
 */
const roadmapSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      unique: true,
      index: true
    },
    summary: {
      type: String,
      default: ''
    },
    activeGoals: {
      type: [String],
      default: []
    },
    activeLanguages: {
      type: [
        {
          language: { type: String },
          status: { type: String }
        }
      ],
      default: []
    },
    diagnosticSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DiagnosticSession',
      default: null
    },
    lastCalculatedAt: {
      type: Date,
      default: Date.now
    },
    stats: {
      totalItems: { type: Number, default: 0 },
      completedItems: { type: Number, default: 0 },
      needsRevisionCount: { type: Number, default: 0 },
      promisingCount: { type: Number, default: 0 },
      pendingCount: { type: Number, default: 0 }
    },
    recommendations: {
      type: [roadmapItemSchema],
      default: []
    },
    reassessmentComparison: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  {
    timestamps: true
  }
);

const Roadmap = mongoose.model('Roadmap', roadmapSchema);

export default Roadmap;
