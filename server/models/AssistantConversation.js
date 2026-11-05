import mongoose from 'mongoose';

/**
 * ==============================================================================
 * Assistant Conversation Mongoose Schema (Milestone 16D)
 *
 * Persists user-scoped AI Learning Assistant conversations with compact history,
 * progressive hint tracking, mode metadata, and grounded catalog activities.
 *
 * SECURITY & PRIVACY PRINCIPLES:
 * 1. Strictly user-scoped (indexed by user ObjectId).
 * 2. Cross-user access is forbidden.
 * 3. Does not store sensitive system prompts or provider credentials.
 * ==============================================================================
 */

const activitySchema = new mongoose.Schema(
  {
    activityId: { type: String, required: true },
    title: { type: String, required: true },
    type: {
      type: String,
      enum: ['problem', 'quiz', 'topic', 'bundle'],
      default: 'problem'
    },
    url: { type: String, required: true },
    reason: { type: String, default: '' }
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true
    },
    content: {
      type: String,
      required: true,
      maxlength: [8000, 'Message content cannot exceed 8000 characters']
    },
    mode: {
      type: String,
      enum: [
        'explain_concept',
        'give_hint',
        'debug_code',
        'walkthrough',
        'roadmap_guidance',
        'general'
      ],
      default: 'general'
    },
    hintLevel: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    activities: {
      type: [activitySchema],
      default: []
    },
    disclosures: {
      type: [String],
      default: []
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const assistantConversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      default: 'New Tutoring Session',
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters']
    },
    targetTopic: {
      type: String,
      default: null,
      trim: true
    },
    problemSlug: {
      type: String,
      default: null,
      trim: true
    },
    currentMode: {
      type: String,
      enum: [
        'explain_concept',
        'give_hint',
        'debug_code',
        'walkthrough',
        'roadmap_guidance',
        'general'
      ],
      default: 'general'
    },
    currentHintLevel: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    messages: {
      type: [messageSchema],
      default: []
    },
    totalMessagesCount: {
      type: Number,
      default: 0
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound index for querying user's conversations sorted by recency
assistantConversationSchema.index({ user: 1, lastActivityAt: -1 });

const AssistantConversation = mongoose.model('AssistantConversation', assistantConversationSchema);

export default AssistantConversation;
