import User from '../models/User.js';

const ALLOWED_GENDERS = ['Male', 'Female', 'Other'];
const ALLOWED_EXPERIENCE = ['Beginner', 'Intermediate', 'Advanced'];
const ALLOWED_INTERESTS = [
  'Data Structures & Algorithms',
  'Web Development',
  'Artificial Intelligence',
  'Cybersecurity',
  'Database Development'
];

/**
 * Format user model into safe user object for response.
 * Strictly excludes password, passwordHash, and internal tokens.
 */
const formatSafeUser = (user) => ({
  id: user._id.toString(),
  fullName: user.fullName,
  email: user.email,
  gender: user.gender,
  experience: user.experience,
  interests: user.interests || [],
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

/**
 * GET /api/users/profile
 * Retrieves profile for authenticated user (req.user.id).
 */
export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.'
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
 * PUT /api/users/profile
 * Updates fullName, gender, experience, and interests for authenticated user.
 * Rejects modifications to email, _id, passwordHash, createdAt, updatedAt.
 */
export const updateProfile = async (req, res, next) => {
  try {
    const { fullName, gender, experience, interests } = req.body;

    // Validate fullName
    if (typeof fullName !== 'string' || fullName.trim().length === 0) {
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

    // Fetch user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.'
      });
    }

    // Apply allowed updates only (email and credentials remain untouched)
    user.fullName = trimmedFullName;
    user.gender = gender;
    user.experience = experience;
    user.interests = interests;

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
