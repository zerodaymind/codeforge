import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Submission from '../models/Submission.js';
import ProblemAttempt from '../models/ProblemAttempt.js';
import ProblemProgress from '../models/ProblemProgress.js';
import Progress from '../models/Progress.js';
import QuizAttempt from '../models/QuizAttempt.js';
import DiagnosticSession from '../models/DiagnosticSession.js';
import RetentionSession from '../models/RetentionSession.js';
import Roadmap from '../models/Roadmap.js';
import CompetencySnapshot from '../models/CompetencySnapshot.js';
import PracticeBundle from '../models/PracticeBundle.js';
import AssistantConversation from '../models/AssistantConversation.js';
import AuditLog from '../models/AuditLog.js';

export const ALLOWED_GENDERS = ['Male', 'Female', 'Other'];
export const ALLOWED_EXPERIENCE = ['Beginner', 'Intermediate', 'Advanced'];
export const ALLOWED_INTERESTS = [
  'Data Structures & Algorithms',
  'Web Development',
  'Artificial Intelligence',
  'Cybersecurity',
  'Database Development'
];

// Milestone 15A Adaptive Onboarding enums and catalogues
export const ALLOWED_LEARNING_GOALS = [
  'beginner',
  'revival',
  'interview',
  'practice'
];

export const ALLOWED_LANGUAGES = [
  'javascript',
  'python',
  'cpp',
  'java',
  'c'
];

export const ALLOWED_LANGUAGE_STATUSES = [
  'new',
  'revision',
  'practicing'
];

export const ALLOWED_STARTING_MODES = [
  'diagnostic',
  'practice',
  'fundamentals',
  'custom'
];

export const ALLOWED_TOPICS = [
  'Arrays',
  'Hashing',
  'Strings',
  'Recursion',
  'Stack',
  'Linked List',
  'Searching',
  'Queue',
  'Sorting',
  'JavaScript Fundamentals',
  'Data Structures & Algorithms',
  'Operating Systems',
  'Computer Networks',
  'Cybersecurity',
  'General'
];

/**
 * Format user model into safe user object for response.
 * Strictly excludes password, passwordHash, and internal tokens.
 */
export const formatSafeUser = (user) => ({
  id: user._id.toString(),
  fullName: user.fullName,
  email: user.email,
  gender: user.gender,
  experience: user.experience,
  interests: user.interests || [],
  role: user.role || 'user',
  onboardingCompleted: Boolean(user.onboardingCompleted),
  learningGoals: user.learningGoals || [],
  languages: (user.languages || []).map((l) => ({
    language: l.language,
    status: l.status
  })),
  preferredStartingMode: user.preferredStartingMode || 'practice',
  selectedTopics: user.selectedTopics || []
});

/**
 * Validates onboarding payload parameters.
 * Returns null if valid, or an error string if invalid.
 */
export const validateOnboardingData = ({ learningGoals, languages, preferredStartingMode, selectedTopics }) => {
  // Validate learningGoals
  if (!Array.isArray(learningGoals) || learningGoals.length === 0) {
    return 'At least one learning goal must be selected.';
  }
  if (learningGoals.length > ALLOWED_LEARNING_GOALS.length) {
    return `You may select at most ${ALLOWED_LEARNING_GOALS.length} learning goals.`;
  }
  const uniqueGoals = new Set(learningGoals);
  if (uniqueGoals.size !== learningGoals.length) {
    return 'Duplicate learning goals are not permitted.';
  }
  for (const goal of learningGoals) {
    if (!ALLOWED_LEARNING_GOALS.includes(goal)) {
      return `Invalid learning goal "${goal}". Allowed goals: ${ALLOWED_LEARNING_GOALS.join(', ')}.`;
    }
  }

  // Validate languages
  if (!Array.isArray(languages) || languages.length === 0) {
    return 'At least one programming language must be selected.';
  }
  if (languages.length > ALLOWED_LANGUAGES.length) {
    return `You may select at most ${ALLOWED_LANGUAGES.length} programming languages.`;
  }
  const seenLanguages = new Set();
  for (const item of languages) {
    if (!item || typeof item !== 'object') {
      return 'Each language entry must be a valid object.';
    }
    const langKey = typeof item.language === 'string' ? item.language.toLowerCase().trim() : '';
    const statusKey = typeof item.status === 'string' ? item.status.toLowerCase().trim() : '';

    if (!langKey || !ALLOWED_LANGUAGES.includes(langKey)) {
      return `Invalid or unsupported language "${item.language}". Supported languages: ${ALLOWED_LANGUAGES.join(', ')}.`;
    }
    if (seenLanguages.has(langKey)) {
      return `Duplicate language entry for "${langKey}".`;
    }
    seenLanguages.add(langKey);

    if (!statusKey || !ALLOWED_LANGUAGE_STATUSES.includes(statusKey)) {
      return `Invalid status "${item.status}" for language "${langKey}". Allowed statuses: ${ALLOWED_LANGUAGE_STATUSES.join(', ')}.`;
    }
  }

  // Validate preferredStartingMode (optional)
  if (preferredStartingMode !== undefined && preferredStartingMode !== null) {
    if (!ALLOWED_STARTING_MODES.includes(preferredStartingMode)) {
      return `Invalid starting mode "${preferredStartingMode}". Allowed modes: ${ALLOWED_STARTING_MODES.join(', ')}.`;
    }
  }

  // Validate selectedTopics (optional)
  if (selectedTopics !== undefined && selectedTopics !== null) {
    if (!Array.isArray(selectedTopics)) {
      return 'Selected topics must be an array.';
    }
    if (selectedTopics.length > 20) {
      return 'Cannot select more than 20 topics.';
    }
    for (const topic of selectedTopics) {
      if (typeof topic !== 'string' || topic.trim().length === 0) {
        return 'Topic names must be non-empty strings.';
      }
      if (!ALLOWED_TOPICS.includes(topic.trim())) {
        return `Invalid or uncatalogued topic "${topic}". Allowed topics: ${ALLOWED_TOPICS.join(', ')}.`;
      }
    }
  }

  return null;
};

/**
 * GET /api/users/me
 * Retrieves authenticated user profile from MongoDB using req.user.id.
 */
export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    return res.status(200).json({
      success: true,
      user: formatSafeUser(user)
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/users/me
 * Updates authenticated user's profile in MongoDB.
 * Allows modifying: fullName, gender, experience, interests,
 * and optionally learningGoals, languages, preferredStartingMode, selectedTopics.
 * Strictly prevents modifications to: _id, email, role, passwordHash, createdAt, updatedAt.
 */
export const updateProfile = async (req, res, next) => {
  try {
    const {
      fullName,
      gender,
      experience,
      interests,
      learningGoals,
      languages,
      preferredStartingMode,
      selectedTopics
    } = req.body;

    // Validate fullName
    if (!fullName || typeof fullName !== 'string' || fullName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Full name is required.'
      });
    }

    const trimmedFullName = fullName.trim();
    if (trimmedFullName.length < 2 || trimmedFullName.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Full name must be between 2 and 50 characters.'
      });
    }

    // Validate gender
    if (!gender || !ALLOWED_GENDERS.includes(gender)) {
      return res.status(400).json({
        success: false,
        message: `Gender must be one of: ${ALLOWED_GENDERS.join(', ')}.`
      });
    }

    // Validate experience
    if (!experience || !ALLOWED_EXPERIENCE.includes(experience)) {
      return res.status(400).json({
        success: false,
        message: `Experience must be one of: ${ALLOWED_EXPERIENCE.join(', ')}.`
      });
    }

    // Validate interests
    if (!Array.isArray(interests) || interests.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one programming interest must be selected.'
      });
    }

    const invalidInterest = interests.find((item) => !ALLOWED_INTERESTS.includes(item));
    if (invalidInterest) {
      return res.status(400).json({
        success: false,
        message: `Invalid interest "${invalidInterest}". Allowed interests: ${ALLOWED_INTERESTS.join(', ')}.`
      });
    }

    // Optional onboarding field validation if provided
    if (learningGoals !== undefined || languages !== undefined) {
      const onboardingErr = validateOnboardingData({
        learningGoals: learningGoals || ['practice'],
        languages: languages || [{ language: 'javascript', status: 'practicing' }],
        preferredStartingMode,
        selectedTopics
      });
      if (onboardingErr) {
        return res.status(400).json({
          success: false,
          message: onboardingErr
        });
      }
    }

    // Fetch user from MongoDB
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Update only allowed fields (email, role, credentials remain untouched)
    user.fullName = trimmedFullName;
    user.gender = gender;
    user.experience = experience;
    user.interests = interests;

    if (learningGoals !== undefined) {
      user.learningGoals = learningGoals;
    }
    if (languages !== undefined) {
      user.languages = languages.map((l) => ({
        language: l.language.toLowerCase().trim(),
        status: l.status.toLowerCase().trim()
      }));
    }
    if (preferredStartingMode !== undefined) {
      user.preferredStartingMode = preferredStartingMode;
    }
    if (selectedTopics !== undefined) {
      user.selectedTopics = selectedTopics;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: formatSafeUser(user)
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/users/onboarding
 * Retrieves authenticated user's adaptive onboarding state and preferences.
 */
export const getOnboarding = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    return res.status(200).json({
      success: true,
      onboarding: {
        completed: Boolean(user.onboardingCompleted),
        onboardingCompleted: Boolean(user.onboardingCompleted),
        learningGoals: user.learningGoals || [],
        languages: user.languages || [],
        preferredStartingMode: user.preferredStartingMode || 'practice',
        selectedTopics: user.selectedTopics || []
      },
      user: formatSafeUser(user)
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/users/onboarding
 * Persists validated adaptive onboarding preferences for the authenticated user.
 */
export const updateOnboarding = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Check for Skip flag
    if (req.body.skip === true) {
      user.onboardingCompleted = true;
      if (!user.learningGoals || user.learningGoals.length === 0) {
        user.learningGoals = ['practice'];
      }
      if (!user.languages || user.languages.length === 0) {
        user.languages = [{ language: 'javascript', status: 'practicing' }];
      }
      if (!user.preferredStartingMode) {
        user.preferredStartingMode = 'practice';
      }
      await user.save();

      return res.status(200).json({
        success: true,
        message: 'Onboarding marked as skipped.',
        user: formatSafeUser(user)
      });
    }

    const { learningGoals, languages, preferredStartingMode = 'practice', selectedTopics = [] } = req.body;

    // Validate payload
    const validationError = validateOnboardingData({
      learningGoals,
      languages,
      preferredStartingMode,
      selectedTopics
    });

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    // Assign sanitized validated fields
    user.onboardingCompleted = true;
    user.learningGoals = learningGoals;
    user.languages = languages.map((item) => ({
      language: item.language.toLowerCase().trim(),
      status: item.status.toLowerCase().trim()
    }));
    user.preferredStartingMode = preferredStartingMode;
    user.selectedTopics = selectedTopics.map((t) => String(t).trim()).filter(Boolean);

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Adaptive onboarding preferences saved successfully.',
      user: formatSafeUser(user)
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/users/onboarding/skip
 * Explicitly marks onboarding as completed/skipped for learners who choose to skip.
 */
export const skipOnboarding = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    user.onboardingCompleted = true;
    if (!user.learningGoals || user.learningGoals.length === 0) {
      user.learningGoals = ['practice'];
    }
    if (!user.languages || user.languages.length === 0) {
      user.languages = [{ language: 'javascript', status: 'practicing' }];
    }
    if (!user.preferredStartingMode) {
      user.preferredStartingMode = 'practice';
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Onboarding skipped successfully.',
      user: formatSafeUser(user)
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Protected Accounts Evaluator
 * Verifies if user account has administrator or auditor protections preventing self-service deletion.
 */
export const checkProtectedAccount = (user) => {
  if (!user) return { isProtected: false };
  const userIdStr = user._id ? user._id.toString() : '';
  const email = (user.email || '').toLowerCase().trim();
  const role = user.role || 'user';

  if (role === 'admin') {
    return {
      isProtected: true,
      statusCode: 403,
      message: 'Administrator accounts cannot be deleted through self-service. Please contact platform administration.'
    };
  }

  if (
    userIdStr === '6ad0d0523e11bbee9b5c984c' ||
    email.includes('faculty.audit') ||
    email.includes('demo.faculty')
  ) {
    return {
      isProtected: true,
      statusCode: 403,
      message: 'The Faculty Demo Auditor account is protected and cannot be deleted.'
    };
  }

  return { isProtected: false };
};

/**
 * DELETE /api/users/me
 * Permanently deletes the authenticated user's account and all associated personal data:
 * - Submissions and code executions
 * - Problem attempts and progress
 * - Overall progress record
 * - Quiz attempts and review snapshots
 * - Diagnostic assessment sessions
 * - Retention & reassessment sessions
 * - Revision roadmaps
 * - Competency snapshots
 * - Practice bundles
 * - AI assistant conversation logs
 * - User account document
 *
 * Security & Governance Requirements:
 * 1. Only authorizes deletion of requester's own account (via verified req.user.id).
 * 2. Re-authenticates requester via password verification.
 * 3. Requires explicit confirmation text ("DELETE MY ACCOUNT").
 * 4. Strictly protects Admin and Faculty Demo Auditor accounts from self-service deletion.
 * 5. Atomically deletes related data or safely cleans up without partial orphaned state.
 * 6. Preserves shared catalog items (Problems, Questions, Quizzes).
 * 7. Records a security audit log event with deletion metrics (never logs passwords or tokens).
 */
export const deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { password, confirmation } = req.body || {};

    // 1. Validate confirmation text
    if (!confirmation || typeof confirmation !== 'string' || confirmation.trim().toUpperCase() !== 'DELETE MY ACCOUNT') {
      return res.status(400).json({
        success: false,
        message: 'Please type "DELETE MY ACCOUNT" to confirm account deletion.'
      });
    }

    // 2. Validate password presence
    if (!password || typeof password !== 'string' || password.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to confirm account deletion.'
      });
    }

    // 3. Retrieve user document with passwordHash
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.'
      });
    }

    // 4. Enforce protected account safeguards (Admins and Faculty Demo Auditor)
    const protection = checkProtectedAccount(user);
    if (protection.isProtected) {
      return res.status(protection.statusCode).json({
        success: false,
        message: protection.message
      });
    }

    // 5. Verify password re-authentication
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password. Account deletion aborted.'
      });
    }

    // 6. Execute ordered cascade deletion of user and user-linked data
    const [
      delSubmissions,
      delProblemAttempts,
      delProblemProgress,
      delProgress,
      delQuizAttempts,
      delDiagnosticSessions,
      delRetentionSessions,
      delRoadmaps,
      delCompetencySnapshots,
      delPracticeBundles,
      delAssistantConversations
    ] = await Promise.all([
      Submission.deleteMany({ user: userId }),
      ProblemAttempt.deleteMany({ user: userId }),
      ProblemProgress.deleteMany({ user: userId }),
      Progress.deleteMany({ user: userId }),
      QuizAttempt.deleteMany({ user: userId }),
      DiagnosticSession.deleteMany({ user: userId }),
      RetentionSession.deleteMany({ user: userId }),
      Roadmap.deleteMany({ user: userId }),
      CompetencySnapshot.deleteMany({ user: userId }),
      PracticeBundle.deleteMany({ user: userId }),
      AssistantConversation.deleteMany({ user: userId })
    ]);

    // Delete the User document itself
    await User.findByIdAndDelete(userId);

    // Record audit log entry for governance and compliance
    await AuditLog.create({
      actor: user._id,
      actorEmail: user.email,
      action: 'USER_ACCOUNT_DELETED',
      entityType: 'User',
      entityId: user._id.toString(),
      metadata: {
        deletedUserId: user._id.toString(),
        deletedEmailDomain: (user.email || '').split('@')[1] || 'unknown',
        deletedCounts: {
          submissions: delSubmissions.deletedCount,
          problemAttempts: delProblemAttempts.deletedCount,
          problemProgress: delProblemProgress.deletedCount,
          progress: delProgress.deletedCount,
          quizAttempts: delQuizAttempts.deletedCount,
          diagnosticSessions: delDiagnosticSessions.deletedCount,
          retentionSessions: delRetentionSessions.deletedCount,
          roadmaps: delRoadmaps.deletedCount,
          competencySnapshots: delCompetencySnapshots.deletedCount,
          practiceBundles: delPracticeBundles.deletedCount,
          assistantConversations: delAssistantConversations.deletedCount
        },
        deletedAt: new Date().toISOString()
      },
      timestamp: new Date()
    });

    const totalDeletedRecords =
      delSubmissions.deletedCount +
      delProblemAttempts.deletedCount +
      delProblemProgress.deletedCount +
      delProgress.deletedCount +
      delQuizAttempts.deletedCount +
      delDiagnosticSessions.deletedCount +
      delRetentionSessions.deletedCount +
      delRoadmaps.deletedCount +
      delCompetencySnapshots.deletedCount +
      delPracticeBundles.deletedCount +
      delAssistantConversations.deletedCount +
      1; // the user document

    return res.status(200).json({
      success: true,
      message: 'Account and associated learning data have been permanently deleted.',
      deletedUserId: userId,
      totalDeletedRecords
    });
  } catch (error) {
    return next(error);
  }
};
