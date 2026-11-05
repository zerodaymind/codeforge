import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import {
  validateName,
  validateEmail,
  validatePassword,
  isValidEmail
} from '../utils/validation.js';
import { formatSafeUser } from './profileController.js';

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user and store credentials securely in MongoDB
 * @access  Public
 */
export const registerUser = async (req, res, next) => {
  try {
    const { fullName, email, password, gender, experience, interests } = req.body || {};

    const errors = {};

    // 1. Authoritative validation
    const nameResult = validateName(fullName);
    if (!nameResult.isValid) {
      errors.fullName = nameResult.message;
    }

    const emailResult = validateEmail(email);
    if (!emailResult.isValid) {
      errors.email = emailResult.message;
    }

    const passwordResult = validatePassword(password);
    if (!passwordResult.isValid) {
      errors.password = passwordResult.message;
    }

    const allowedGenders = ['Male', 'Female', 'Other'];
    if (!gender || !allowedGenders.includes(gender)) {
      errors.gender = 'Please select a valid gender option.';
    }

    const allowedExperience = ['Beginner', 'Intermediate', 'Advanced'];
    if (!experience || !allowedExperience.includes(experience)) {
      errors.experience = 'Please select a valid programming experience level.';
    }

    if (!interests || !Array.isArray(interests) || interests.length === 0) {
      errors.interests = 'Please select at least one programming interest.';
    }

    if (Object.keys(errors).length > 0) {
      const firstErrorMessage =
        errors.fullName ||
        errors.email ||
        errors.password ||
        errors.gender ||
        errors.experience ||
        errors.interests;

      return res.status(400).json({
        success: false,
        message: firstErrorMessage,
        errors
      });
    }

    // 2. Normalized values
    const normalizedName = nameResult.normalized;
    const normalizedEmail = emailResult.normalized;

    // 3. Check for existing user (case-insensitive via normalized email)
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
        errors: { email: 'An account with this email already exists.' }
      });
    }

    // 4. Hash password with bcryptjs (salt rounds = 10)
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 5. Create user in MongoDB with strict field allowlist and enforced role
    try {
      const user = await User.create({
        fullName: normalizedName,
        email: normalizedEmail,
        passwordHash,
        gender,
        experience,
        interests,
        role: 'user'
      });

      // 6. Return response (never expose passwordHash or password)
      return res.status(201).json({
        success: true,
        message: 'Registration successful',
        user: formatSafeUser(user)
      });
    } catch (dbError) {
      // Handle race-condition duplicate key error on email (E11000)
      if (dbError.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email already exists.',
          errors: { email: 'An account with this email already exists.' }
        });
      }
      throw dbError;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user against MongoDB and return safe user data
 * @access  Public
 */
export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Validate inputs
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.'
      });
    }

    if (!password || typeof password !== 'string' || password.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Password is required.'
      });
    }

    // 2. Find user by normalized email
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    // 3. Generic error if user not found (security: do not reveal email existence)
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // 4. Verify password against passwordHash
    const isPasswordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // 5. Generate JWT containing only the user ID in payload
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 6. Return token and safe user data (never expose password or passwordHash)
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: formatSafeUser(user)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user profile
 * @access  Private (Protected by authenticateToken middleware)
 */
export const getCurrentUser = async (req, res, next) => {
  try {
    // req.user.id is attached by authenticateToken middleware
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
    next(error);
  }
};
