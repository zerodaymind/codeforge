import mongoose from 'mongoose';

/**
 * Retention Question Snapshot Sub-Schema
 * Preserves the exact question state at the moment the retention check was initiated.
 *
 * CRITICAL SECURITY GUARANTEE:
 * 'answer' and 'explanation' fields are strictly hidden from clients while status is 'in_progress'.
 */
const retentionQuestionSnapshotSchema = new mongoose.Schema(
  {
    questionId: { type: Number, required: true },
    topic: { type: String, required: true },
    subtopic: { type: String, default: '' },
    question: { type: String, required: true },
    codeSnippet: { type: String, default: '' },
    options: { type: [String], required: true },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
    points: { type: Number, default: 1 },
    answer: { type: String, required: true },
    explanation: { type: String, required: true },
    isRepeated: { type: Boolean, default: false },
    timesSeen: { type: Number, default: 0 },
    lastSeenAt: { type: Date, default: null }
  },
  { _id: false }
);

/**
 * Retention Answer Sub-Schema
 * Stores learner's submitted option and server-calculated score.
 */
const retentionAnswerSchema = new mongoose.Schema(
  {
    questionId: { type: Number, required: true },
    selectedOption: { type: String, default: null },
    isCorrect: { type: Boolean, default: false },
    pointsAwarded: { type: Number, default: 0 }
  },
  { _id: false }
);

/**
 * Historical Baseline Sub-Schema
 * Preserves the comparative baseline evaluated against the retention assessment.
 */
const historicalBaselineSchema = new mongoose.Schema(
  {
    baselineScore: { type: Number, default: null },
    baselineDate: { type: Date, default: null },
    baselineSampleSize: { type: Number, default: 0 },
    baselineModality: { type: String, default: 'diagnostic' },
    baselineDifficulty: { type: mongoose.Schema.Types.Mixed, default: {} },
    source: { type: String, default: 'diagnostic' }
  },
  { _id: false }
);

/**
 * Retention Recommended Action Sub-Schema
 * Grounded catalog recommendation following the outcome.
 */
const retentionRecommendedActionSchema = new mongoose.Schema(
  {
    actionCategory: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    url: { type: String, required: true },
    recommendationId: { type: String, required: true }
  },
  { _id: false }
);

/**
 * Retention Outcome Sub-Schema
 * Authoritative server-side evaluation comparing current result to historical baseline.
 */
const retentionOutcomeSchema = new mongoose.Schema(
  {
    classification: {
      type: String,
      enum: [
        'retained_on_reassessment',
        'improved_on_reassessment',
        'possible_decline_on_reassessment',
        'insufficient_evidence',
        'first_retention_assessment',
        'not_comparable'
      ],
      default: 'insufficient_evidence'
    },
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    scoreDelta: { type: Number, default: null },
    isComparable: { type: Boolean, default: false },
    repeatedQuestionsCount: { type: Number, default: 0 },
    repeatedPercentage: { type: Number, default: 0 },
    reason: { type: String, default: '' },
    comparabilityDisclosures: { type: [String], default: [] },
    recommendedAction: { type: retentionRecommendedActionSchema, default: null }
  },
  { _id: false }
);

/**
 * RetentionSession Mongoose Schema (Milestone 16C)
 * Tracks authentic retention assessments, server-side scoring, repeat-exposure records,
 * and longitudinal comparisons against prior learning evidence.
 */
const retentionSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true
    },
    sessionId: {
      type: String,
      required: [true, 'Session ID is required'],
      unique: true,
      index: true
    },
    targetTopic: {
      type: String,
      required: [true, 'Target topic is required'],
      trim: true,
      index: true
    },
    status: {
      type: String,
      enum: ['in_progress', 'submitted', 'abandoned'],
      default: 'in_progress',
      index: true
    },
    questions: {
      type: [retentionQuestionSnapshotSchema],
      required: true,
      validate: {
        validator: function (val) {
          return Array.isArray(val) && val.length >= 1 && val.length <= 10;
        },
        message: 'A retention session must contain between 1 and 10 questions'
      }
    },
    selectedAnswers: {
      type: [retentionAnswerSchema],
      default: []
    },
    historicalBaseline: {
      type: historicalBaselineSchema,
      default: () => ({})
    },
    outcome: {
      type: retentionOutcomeSchema,
      default: null
    },
    startedAt: {
      type: Date,
      default: Date.now
    },
    submittedAt: {
      type: Date,
      default: null
    },
    durationSeconds: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for history, tenant isolation, and quick lookup
retentionSessionSchema.index({ user: 1, targetTopic: 1, status: 1 });
retentionSessionSchema.index({ user: 1, createdAt: -1 });

const RetentionSession = mongoose.model('RetentionSession', retentionSessionSchema);

export default RetentionSession;
