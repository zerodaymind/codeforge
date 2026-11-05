import mongoose from 'mongoose';

/**
 * Question Mongoose Schema (Centralized Question Bank)
 * Stores assessment and quiz questions across all computer science topics.
 *
 * CRITICAL SECURITY NOTE:
 * 'answer' and 'explanation' fields must NEVER be returned by learner-facing public GET endpoints!
 * They are only accessed server-side for authoritative quiz evaluation or by verified administrators.
 */
const questionSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
      required: [true, 'Question numerical ID is required'],
      unique: true,
      index: true
    },
    topic: {
      type: String,
      required: [true, 'Topic is required'],
      trim: true,
      index: true
    },
    question: {
      type: String,
      required: [true, 'Question prompt is required'],
      trim: true
    },
    codeSnippet: {
      type: String,
      default: '',
      trim: true
    },
    options: {
      type: [String],
      required: [true, 'Options are required'],
      validate: {
        validator: function (val) {
          return Array.isArray(val) && val.length >= 2 && val.length <= 6;
        },
        message: 'A question must provide between 2 and 6 options'
      }
    },
    answer: {
      type: String,
      required: [true, 'Correct answer is required'],
      validate: {
        validator: function (val) {
          return this.options && this.options.includes(val);
        },
        message: 'Correct answer must be one of the provided options'
      }
    },
    explanation: {
      type: String,
      required: [true, 'Explanation is required'],
      trim: true
    },
    difficulty: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard'],
      default: 'Medium',
      index: true
    },
    type: {
      type: String,
      enum: ['multiple-choice'],
      default: 'multiple-choice'
    },
    points: {
      type: Number,
      default: 1,
      min: [1, 'Points must be at least 1']
    },
    tags: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: ['active', 'draft', 'archived'],
      default: 'active',
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for searching and filtering
questionSchema.index({ status: 1, topic: 1, difficulty: 1 });
questionSchema.index({ question: 'text', topic: 'text' });

const Question = mongoose.model('Question', questionSchema);

export default Question;
