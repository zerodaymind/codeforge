import mongoose from 'mongoose';

const exampleSchema = new mongoose.Schema(
  {
    input: { type: String, default: '' },
    output: { type: String, default: '' },
    explanation: { type: String, default: '' }
  },
  { _id: false }
);

const testCaseSchema = new mongoose.Schema(
  {
    input: { type: String, default: '' },
    expectedOutput: { type: String, default: '' },
    explanation: { type: String, default: '' },
    isHidden: { type: Boolean, default: false }
  },
  { _id: false }
);

/**
 * Problem Mongoose Schema
 * Stores programming practice problems, topics, tags, examples, starter code,
 * solution explanation, and metadata.
 */
const problemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Problem title is required'],
      trim: true
    },
    slug: {
      type: String,
      required: [true, 'Problem slug is required'],
      unique: true,
      trim: true,
      index: true
    },
    id: {
      type: String,
      trim: true,
      index: true
    },
    description: {
      type: String,
      required: [true, 'Problem description is required'],
      trim: true
    },
    difficulty: {
      type: String,
      required: [true, 'Difficulty is required'],
      enum: {
        values: ['Easy', 'Medium', 'Hard'],
        message: 'Difficulty must be Easy, Medium, or Hard'
      }
    },
    topic: {
      type: String,
      required: [true, 'Topic is required'],
      trim: true
    },
    tags: {
      type: [String],
      default: []
    },
    topics: {
      type: [String],
      default: []
    },
    language: {
      type: String,
      default: 'JavaScript'
    },
    examples: {
      type: [exampleSchema],
      default: []
    },
    testCases: {
      type: [testCaseSchema],
      default: []
    },
    constraints: {
      type: [String],
      default: []
    },
    starterCode: {
      type: mongoose.Schema.Types.Mixed,
      default: ''
    },
    solutionExplanation: {
      type: String,
      default: ''
    },
    explanation: {
      type: String,
      default: ''
    },
    expectedAnswer: {
      type: String,
      select: false,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Pre-validate hook to sync slug <-> id, topic <-> topics <-> tags
problemSchema.pre('validate', function () {
  if (this.slug && !this.id) {
    this.id = this.slug;
  }
  if (this.id && !this.slug) {
    this.slug = this.id;
  }
  if (this.topic && (!this.topics || this.topics.length === 0)) {
    this.topics = [this.topic];
  }
  if (this.tags && this.tags.length > 0 && (!this.topics || this.topics.length === 0)) {
    this.topics = [...this.tags];
  }
  if (this.topics && this.topics.length > 0 && (!this.tags || this.tags.length === 0)) {
    this.tags = [...this.topics];
  }
  if ((!this.topic || this.topic.trim() === '') && this.topics && this.topics.length > 0) {
    this.topic = this.topics[0];
  }
  if (this.solutionExplanation && !this.explanation) {
    this.explanation = this.solutionExplanation;
  }
  if (this.explanation && !this.solutionExplanation) {
    this.solutionExplanation = this.explanation;
  }
});

// Indexes for search and filters
problemSchema.index(
  { title: 'text', description: 'text', topic: 'text', tags: 'text' },
  { language_override: 'none' }
);
problemSchema.index({ difficulty: 1, topic: 1 });

const Problem = mongoose.model('Problem', problemSchema);

export default Problem;
