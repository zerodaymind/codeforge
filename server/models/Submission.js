import mongoose from 'mongoose';

/**
 * Submission Mongoose Schema
 * Stores authenticated code execution submission history.
 *
 * Retention & Privacy Policy:
 * - Each submission is strictly associated with req.user.id.
 * - Source code is retained for educational review and progress tracking.
 * - Source code length is bounded to 64KB (65,536 characters).
 * - Sensitive credentials, tokens, or environment values are never stored.
 * - Only the owning authenticated user can query their own submissions.
 */
const submissionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true
    },
    problem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Problem',
      required: [true, 'Problem reference is required'],
      index: true
    },
    language: {
      type: String,
      required: [true, 'Language is required'],
      enum: {
        values: ['javascript', 'nodejs', 'python', 'c', 'cpp', 'java'],
        message: 'Currently supported languages: javascript, python, c, cpp, java'
      },
      default: 'javascript'
    },
    sourceCode: {
      type: String,
      required: [true, 'Source code is required'],
      maxlength: [65536, 'Source code cannot exceed 64KB']
    },
    verdict: {
      type: String,
      required: [true, 'Verdict is required'],
      enum: {
        values: [
          'Accepted',
          'Wrong Answer',
          'Time Limit Exceeded',
          'Runtime Error',
          'Compilation Error',
          'Sandbox Unavailable',
          'Pending'
        ],
        message: 'Invalid submission verdict'
      }
    },
    passedTests: {
      type: Number,
      default: 0
    },
    totalTests: {
      type: Number,
      default: 0
    },
    executionDuration: {
      type: Number,
      default: 0
    },
    stdout: {
      type: String,
      default: ''
    },
    stderr: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Indexes for fast, isolated tenant queries
submissionSchema.index({ user: 1, createdAt: -1 });
submissionSchema.index({ problem: 1, createdAt: -1 });

const Submission = mongoose.model('Submission', submissionSchema);

export default Submission;
