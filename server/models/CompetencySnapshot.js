import mongoose from 'mongoose';

/**
 * Topic Competency Metric Sub-Schema
 * Preserves an immutable snapshot of competency metrics per topic at a specific point in time.
 */
const topicCompetencyMetricSchema = new mongoose.Schema(
  {
    topic: { type: String, required: true },
    state: {
      type: String,
      default: 'unassessed'
    },
    learningState: { type: String },
    confidence: {
      type: String,
      default: 'none'
    },
    confidenceLevel: { type: String },
    masteryScore: { type: Number, default: null },
    accuracyPercentage: { type: Number, default: null },
    confidenceScore: { type: Number, default: null },
    sampleSize: { type: Number, default: 0 },
    evidenceCount: { type: Number, default: 0 },
    distinctProblemsSolved: { type: Number, default: 0 },
    quizPassCount: { type: Number, default: 0 },
    diagnosticQuestionCount: { type: Number, default: 0 },
    evidenceBreakdown: { type: mongoose.Schema.Types.Mixed },
    freshnessScore: { type: Number, default: 1.0 },
    solvedDifficulty: {
      Easy: { type: Number, default: 0 },
      Medium: { type: Number, default: 0 },
      Hard: { type: Number, default: 0 }
    }
  },
  { _id: false, strict: false }
);

/**
 * CompetencySnapshot Mongoose Schema (Milestone 16B)
 * Tracks dated topic-level competency snapshots over time for longitudinal analysis.
 */
const competencySnapshotSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true
    },
    snapshotDate: {
      type: Date,
      default: Date.now,
      index: true
    },
    sourceEvent: {
      type: String,
      default: 'manual_checkpoint'
    },
    trigger: {
      type: String
    },
    notes: {
      type: String,
      default: ''
    },
    overallMasteryScore: {
      type: Number,
      default: null
    },
    evaluatedTopicsCount: {
      type: Number,
      default: 0
    },
    summary: {
      type: mongoose.Schema.Types.Mixed
    },
    topicMetrics: {
      type: [topicCompetencyMetricSchema],
      default: []
    },
    topicSnapshots: {
      type: [topicCompetencyMetricSchema],
      default: []
    }
  },
  {
    timestamps: true,
    strict: false
  }
);

// Compound index for time-window queries (e.g. 30, 60, 90 days)
competencySnapshotSchema.index({ user: 1, snapshotDate: -1 });

const CompetencySnapshot = mongoose.model('CompetencySnapshot', competencySnapshotSchema);

export default CompetencySnapshot;
