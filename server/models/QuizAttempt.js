import mongoose from 'mongoose';

/**
 * Selected Answer Sub-Schema
 * Tracks the user's choice for each question in the attempt.
 */
const selectedAnswerSchema = new mongoose.Schema(
  {
    questionId: {
      type: Number,
      required: true
    },
    selectedOption: {
      type: String,
      default: null
    },
    isCorrect: {
      type: Boolean,
      default: false
    },
    pointsAwarded: {
      type: Number,
      default: 0
    }
  },
  { _id: false }
);

/**
 * Historical Review Item Sub-Schema
 * Preserves a snapshot of questions and answers at submission time
 * so future edits to the Quiz model do not corrupt past review records.
 */
const reviewItemSchema = new mongoose.Schema(
  {
    questionId: { type: Number, required: true },
    question: { type: String, required: true },
    options: { type: [String], required: true },
    selectedOption: { type: String, default: null },
    correctAnswer: { type: String, required: true },
    explanation: { type: String, required: true },
    isCorrect: { type: Boolean, required: true },
    points: { type: Number, default: 1 }
  },
  { _id: false }
);

/**
 * QuizAttempt Mongoose Schema
 * Stores authenticated user quiz attempts, statuses, server-calculated scores,
 * and immutable review snapshots.
 */
const quizAttemptSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true
    },
    quiz: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz',
      required: [true, 'Quiz reference is required']
    },
    quizId: {
      type: String,
      required: [true, 'Quiz slug identifier is required'],
      index: true
    },
    quizTitle: {
      type: String,
      required: [true, 'Quiz title snapshot is required']
    },
    topic: {
      type: String,
      required: [true, 'Topic snapshot is required'],
      index: true
    },
    difficulty: {
      type: String,
      enum: ['Beginner', 'Easy', 'Intermediate', 'Medium', 'Advanced', 'Hard'],
      default: 'Medium'
    },
    status: {
      type: String,
      enum: ['in_progress', 'submitted', 'completed'],
      default: 'in_progress',
      index: true
    },
    selectedAnswers: {
      type: [selectedAnswerSchema],
      default: []
    },
    score: {
      type: Number,
      default: 0
    },
    maxScore: {
      type: Number,
      default: 0
    },
    percentage: {
      type: Number,
      default: 0
    },
    isPassed: {
      type: Boolean,
      default: false
    },
    correctAnswers: {
      type: Number,
      default: 0
    },
    incorrectAnswers: {
      type: Number,
      default: 0
    },
    unanswered: {
      type: Number,
      default: 0
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
    },
    reviewData: {
      type: [reviewItemSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for user history queries and analytics aggregations
quizAttemptSchema.index({ user: 1, createdAt: -1 });
quizAttemptSchema.index({ user: 1, status: 1, createdAt: -1 });
quizAttemptSchema.index({ user: 1, topic: 1, status: 1 });
quizAttemptSchema.index({ user: 1, quizId: 1, status: 1 });

const QuizAttempt = mongoose.model('QuizAttempt', quizAttemptSchema);

export default QuizAttempt;
