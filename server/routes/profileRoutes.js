import express from 'express';
import {
  getProfile,
  updateProfile,
  getOnboarding,
  updateOnboarding,
  skipOnboarding,
  deleteAccount
} from '../controllers/profileController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Primary Profile endpoints
router.get('/me', authenticateToken, getProfile);
router.put('/me', authenticateToken, updateProfile);
router.delete('/me', authenticateToken, deleteAccount);

// Adaptive Onboarding endpoints (Milestone 15A)
router.get('/onboarding', authenticateToken, getOnboarding);
router.put('/onboarding', authenticateToken, updateOnboarding);
router.post('/onboarding/skip', authenticateToken, skipOnboarding);

// Backward-compatible aliases
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);
router.delete('/account', authenticateToken, deleteAccount);

export default router;
