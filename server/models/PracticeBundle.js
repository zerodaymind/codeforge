import mongoose from 'mongoose';

/**
 * Practice Bundle Item Sub-Schema
 * Represents a single curated task within a personalized practice session.
 */
const practiceBundleItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ['problem', 'quiz'], required: true },
    identifier: { type: String, required: true },
    title: { type: String, required: true },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
    role: {
      type: String,
      enum: ['prerequisite_review', 'concept_review', 'core_practice', 'stretch_challenge'],
      default: 'core_practice'
    },
    selectionReason: { type: String, required: true },
    url: { type: String, required: true },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date, default: null }
  },
  { _id: false }
);

/**
 * PracticeBundle Mongoose Schema (Milestone 16B)
 * Stores authenticated user-specific targeted practice bundles.
 */
const practiceBundleSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true
    },
    bundleId: {
      type: String,
      required: [true, 'Bundle identifier is required'],
      index: true
    },
    targetTopic: {
      type: String,
      required: [true, 'Target topic is required'],
      trim: true
    },
    headline: {
      type: String,
      required: [true, 'Bundle headline is required']
    },
    targetState: {
      type: String,
      default: 'developing'
    },
    prerequisiteNotes: {
      type: String,
      default: ''
    },
    items: {
      type: [practiceBundleItemSchema],
      validate: {
        validator: function (val) {
          return Array.isArray(val) && val.length >= 1 && val.length <= 6;
        },
        message: 'A practice bundle must contain between 1 and 6 items'
      }
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'abandoned'],
      default: 'active',
      index: true
    },
    estimatedMinutes: {
      type: Number,
      default: 30
    }
  },
  {
    timestamps: true
  }
);

// Compound index for querying user's active and historical bundles
practiceBundleSchema.index({ user: 1, status: 1, createdAt: -1 });
practiceBundleSchema.index({ user: 1, bundleId: 1 }, { unique: true });

const PracticeBundle = mongoose.model('PracticeBundle', practiceBundleSchema);

export default PracticeBundle;
