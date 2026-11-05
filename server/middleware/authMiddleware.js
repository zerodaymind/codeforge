import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Authentication Middleware for CodeForge
 * Verifies JWT tokens from Authorization: Bearer <token> header.
 * Attaches decoded user payload ({ id }) to req.user.
 */
export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Verify presence and format of Authorization header
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.'
    });
  }

  const token = authHeader.substring(7).trim(); // Remove 'Bearer ' prefix

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.'
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    // Reject invalid or expired token with generic 401 without leaking internal error details
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.'
    });
  }

  try {
    // Check if user account still exists in MongoDB (ensures deleted accounts cannot continue using session)
    const userExists = await User.exists({ _id: decoded.id });
    if (!userExists) {
      return res.status(401).json({
        success: false,
        message: 'Account no longer exists or session has been revoked.'
      });
    }

    // Attach only the decoded payload to req.user (contains { id })
    req.user = decoded;
    next();
  } catch (dbError) {
    return next(dbError);
  }
};

/**
 * Admin Authorization Middleware
 * Verifies that the authenticated user possesses genuine 'admin' role in MongoDB.
 * Reads user role directly from database to ensure immediate privilege revocation on demotion.
 */
export const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account not found.'
      });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Administrator privileges required.'
      });
    }

    // Attach verified user with role
    req.adminUser = user;
    next();
  } catch (error) {
    next(error);
  }
};
