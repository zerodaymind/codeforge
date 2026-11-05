import { Router } from 'express';
import { registerUser, loginUser, getCurrentUser } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { authLoginLimiter, authRegisterLimiter } from '../middleware/securityMiddleware.js';

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user in MongoDB
 * @access  Public (Rate limited to mitigate automated account creation)
 */
router.post('/register', authRegisterLimiter, registerUser);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user against MongoDB and return JWT token
 * @access  Public (Rate limited to mitigate brute force & credential stuffing)
 */
router.post('/login', authLoginLimiter, loginUser);

/**
 * @route   GET /api/auth/me
 * @desc    Get authenticated user profile using JWT token
 * @access  Private (Requires valid JWT)
 */
router.get('/me', authenticateToken, getCurrentUser);

export default router;
