import mongoose from 'mongoose';

/**
 * Diagnostic Question Snapshot Schema
 * Preserves questions at the time the diagnostic session was initiated.
 *
 * CRITICAL SECURITY GUARANTEE:
 * 'answer' and 'explanation' fields are strictly hidden from clients while status is 'in_progress'.
 */
const diagnosticQuestionSnapshotSchema = new mongoose.Schema(
  {
    questionId: { type: Number, required: true },
    topic: { type: String, required: true },
    subtopic: { type: String, default: '' },
    question: { type: String, required: true },
    codeSnippet: { type: String, default: '' },
    options: { type: [String], required: true },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
    points: { type: Number, default: 1 },
    answer: { type: String, required: true }, // Stripped from client response while in_progress
    explanation: { type: String, required: true } // Stripped from client response while in_progress
  },
  { _id: false }
);

/**
 * Diagnostic Answer Schema
 * Stores learner's submitted option and server-calculated accuracy.
 */
const diagnosticAnswerSchema = new mongoose.Schema(
  {
    questionId: { type: Number, required: true },
    selectedOption: { type: String, default: null },
    isCorrect: { type: Boolean, default: false },
    pointsAwarded: { type: Number, default: 0 }
  },
  { _id: false }
);

/**
 * Topic Evidence Sub-Schema
 * Transparent classification of learner understanding per topic based on conservative thresholds.
 */
const topicEvidenceSchema = new mongoose.Schema(
  {
    topic: { type: String, required: true },
    totalQuestions: { type: Number, default: 0 },
    answeredQuestions: { type: Number, default: 0 },
    correctAnswers: { type: Number, default: 0 },
    accuracyPercentage: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['promising', 'needs_revision', 'not_enough_evidence'],
      required: true
    },
    confidence: {
      type: String,
      enum: ['high', 'moderate', 'low'],
      default: 'moderate'
    },
    sampleSizeWarning: { type: Boolean, default: false },
    explanation: { type: String, required: true }
  },
  { _id: false }
);

/**
 * Unassessed Topic Sub-Schema
 * Explains content availability gaps honestly without fabricating questions.
 */
const unassessedTopicSchema = new mongoose.Schema(
  {
    topic: { type: String, required: true },
    reason: { type: String, required: true }
  },
  { _id: false }
);

/**
 * Recommendation Item Sub-Schema
 * Grounded in CodeForge's genuine quiz and practice challenge catalogues.
 */
const recommendationItemSchema = new mongoose.Schema(
  {
    topic: { type: String, required: true },
    title: { type: String, required: true },
    recommendation: { type: String, required: true },
    actionText: { type: String, required: true },
    actionPath: { type: String, required: true },
    status: { type: String, default: 'needs_revision' }
  },
  { _id: false }
);

/**
 * DiagnosticSession Mongoose Schema
 * Tracks evidence-based diagnostic assessment lifecycle, server-side scoring,
 * topic-level diagnostics, and conservative recommendations.
 */
const diagnosticSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true
    },
    status: {
      type: String,
      enum: ['in_progress', 'submitted', 'abandoned'],
      default: 'in_progress',
      index: true
    },
    learningGoals: {
      type: [String],
      default: []
    },
    targetLanguages: {
      type: [
        {
          language: { type: String },
          status: { type: String }
        }
      ],
      default: []
    },
    requestedTopics: {
      type: [String],
      default: []
    },
    assessedTopics: {
      type: [String],
      default: []
    },
    unassessedTopics: {
      type: [unassessedTopicSchema],
      default: []
    },
    questions: {
      type: [diagnosticQuestionSnapshotSchema],
      required: true
    },
    selectedAnswers: {
      type: [diagnosticAnswerSchema],
      default: []
    },
    totalQuestions: { type: Number, default: 0 },
    answeredQuestions: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    incorrectCount: { type: Number, default: 0 },
    unansweredCount: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    topicResults: {
      type: [topicEvidenceSchema],
      default: []
    },
    recommendations: {
      type: [recommendationItemSchema],
      default: []
    },
    seed: {
      type: String,
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

// Query indexes for tenant isolation and history
diagnosticSessionSchema.index({ user: 1, createdAt: -1 });
diagnosticSessionSchema.index({ user: 1, status: 1 });

const DiagnosticSession = mongoose.model('DiagnosticSession', diagnosticSessionSchema);

export default DiagnosticSession;
