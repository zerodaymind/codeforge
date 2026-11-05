import mongoose from 'mongoose';

/**
 * ProblemProgress Mongoose Schema
 * Tracks authenticated user-specific problem completion progress in MongoDB.
 * Unique compound index on { user, problem } prevents duplicate progress records.
 */
const problemProgressSchema = new mongoose.Schema(
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
    completed: {
      type: Boolean,
      default: false
    },
    completedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index ensuring one progress document per user and problem
problemProgressSchema.index({ user: 1, problem: 1 }, { unique: true });

const ProblemProgress = mongoose.model('ProblemProgress', problemProgressSchema);

export default ProblemProgress;
