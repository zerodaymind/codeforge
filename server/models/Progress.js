import mongoose from 'mongoose';

/**
 * Progress Mongoose Schema
 * Stores practice problem completions and quiz attempt history associated
 * uniquely with an authenticated user.
 */
const progressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    completedProblems: [
      {
        problemId: {
          type: String,
          required: true
        },
        completedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    quizAttempts: [
      {
        quizId: {
          type: String,
          required: true
        },
        score: {
          type: Number,
          required: true
        },
        totalQuestions: {
          type: Number,
          required: true
        },
        percentage: {
          type: Number,
          required: true
        },
        completedAt: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

const Progress = mongoose.model('Progress', progressSchema);

export default Progress;
