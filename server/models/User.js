import mongoose from 'mongoose';

/**
 * User Mongoose Schema
 * Stores registered users with hashed passwords and profile attributes.
 *
 * SECURITY NOTE:
 * Plaintext passwords, confirmPassword, and raw credentials are NEVER stored.
 * Only bcrypt-generated passwordHash is saved.
 */
const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters'],
      maxlength: [70, 'Full name cannot exceed 70 characters']
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      trim: true,
      lowercase: true
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required']
    },
    gender: {
      type: String,
      required: [true, 'Gender is required'],
      enum: {
        values: ['Male', 'Female', 'Other'],
        message: 'Please select a valid gender option (Male, Female, Other)'
      }
    },
    experience: {
      type: String,
      required: [true, 'Programming experience is required'],
      enum: {
        values: ['Beginner', 'Intermediate', 'Advanced'],
        message: 'Please select a valid experience level (Beginner, Intermediate, Advanced)'
      }
    },
    interests: {
      type: [String],
      required: [true, 'Programming interests are required'],
      validate: {
        validator: function (val) {
          return Array.isArray(val) && val.length > 0;
        },
        message: 'At least one programming interest must be selected'
      }
    },
    role: {
      type: String,
      enum: {
        values: ['user', 'admin'],
        message: 'Role must be either user or admin'
      },
      default: 'user',
      index: true
    },
    // Adaptive Onboarding & Learner Profile (Milestone 15A)
    onboardingCompleted: {
      type: Boolean,
      default: false,
      index: true
    },
    learningGoals: {
      type: [String],
      default: []
    },
    languages: [
      {
        language: {
          type: String,
          required: true
        },
        status: {
          type: String,
          required: true,
          enum: ['new', 'revision', 'practicing'],
          default: 'new'
        }
      }
    ],
    preferredStartingMode: {
      type: String,
      enum: ['diagnostic', 'practice', 'fundamentals', 'custom'],
      default: 'practice'
    },
    selectedTopics: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);

const User = mongoose.model('User', userSchema);

export default User;
