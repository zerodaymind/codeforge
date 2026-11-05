import mongoose from 'mongoose';

/**
 * Quiz Question Embedded Schema
 * Stores question prompts, choices, authoritative answers, and explanations.
 * 
 * SECURITY:
 * 'answer' and 'explanation' fields must never be exposed to clients prior to submission.
 */
const quizQuestionSchema = new mongoose.Schema(
  {
    questionId: {
      type: Number,
      required: [true, 'Question numerical ID is required']
    },
    question: {
      type: String,
      required: [true, 'Question prompt is required'],
      trim: true
    },
    options: {
      type: [String],
      required: [true, 'Question options are required'],
      validate: {
        validator: function (val) {
          return Array.isArray(val) && val.length >= 2;
        },
        message: 'A question must provide at least 2 options'
      }
    },
    answer: {
      type: String,
      required: [true, 'Correct answer is required']
    },
    explanation: {
      type: String,
      required: [true, 'Explanation is required'],
      trim: true
    },
    points: {
      type: Number,
      default: 1,
      min: 1
    }
  },
  { _id: true }
);

/**
 * Quiz Mongoose Schema
 * Stores catalog quizzes with topics, difficulty, points, publication status, and questions.
 */
const quizSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: [true, 'Quiz slug identifier is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    title: {
      type: String,
      required: [true, 'Quiz title is required'],
      trim: true
    },
    description: {
      type: String,
      required: [true, 'Quiz description is required'],
      trim: true
    },
    topic: {
      type: String,
      required: [true, 'Topic/Category is required'],
      trim: true,
      index: true
    },
    difficulty: {
      type: String,
      enum: ['Beginner', 'Easy', 'Intermediate', 'Medium', 'Advanced', 'Hard'],
      default: 'Medium',
      index: true
    },
    pointsPerQuestion: {
      type: Number,
      default: 1,
      min: 1
    },
    isPublished: {
      type: Boolean,
      default: true,
      index: true
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true
    },
    instructions: {
      type: String,
      default: '',
      trim: true
    },
    version: {
      type: Number,
      default: 1
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    questions: {
      type: [quizQuestionSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for catalog filtering
quizSchema.index({ isPublished: 1, isArchived: 1, topic: 1, difficulty: 1 });

/**
 * Helper to produce client-safe quiz payload without answers or explanations.
 * @param {Object} quizDoc 
 * @returns {Object}
 */
quizSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  if (Array.isArray(obj.questions)) {
    obj.questions = obj.questions.map((q) => {
      const { answer: _ans, explanation: _exp, ...safeQ } = q;
      return safeQ;
    });
  }
  return obj;
};

const Quiz = mongoose.model('Quiz', quizSchema);

export default Quiz;
