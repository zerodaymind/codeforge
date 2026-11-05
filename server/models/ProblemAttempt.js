import mongoose from 'mongoose';

/**
 * ProblemAttempt Mongoose Schema
 * Records an individual user's code/answer attempt on a practice problem.
 * Associated strictly with authenticated req.user.id.
 */
const problemAttemptSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true
    },
    problem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Problem',
      required: [true, 'Problem reference is required'],
      index: true
    },
    status: {
      type: String,
      required: [true, 'Attempt status is required'],
      enum: {
        values: ['Accepted', 'Incorrect'],
        message: 'Status must be Accepted or Incorrect'
      }
    },
    submittedAnswer: {
      type: String,
      default: ''
    },
    executionTime: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// Compound index for fast queries by user and problem
problemAttemptSchema.index({ user: 1, problem: 1, createdAt: -1 });

const ProblemAttempt = mongoose.model('ProblemAttempt', problemAttemptSchema);

export default ProblemAttempt;
