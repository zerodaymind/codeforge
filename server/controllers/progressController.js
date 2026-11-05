import mongoose from 'mongoose';
import Problem from '../models/Problem.js';
import ProblemProgress from '../models/ProblemProgress.js';
import Progress from '../models/Progress.js';

/**
 * Validates a MongoDB ObjectId.
 * @param {string} id
 * @returns {boolean}
 */
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id) && new mongoose.Types.ObjectId(id).toString() === id;
};

/**
 * GET /api/progress
 * Retrieves authenticated user's complete problem progress list from MongoDB.
 */
export const getMyProgress = async (req, res, next) => {
  try {
    const progress = await ProblemProgress.find({ user: req.user.id })
      .populate('problem')
      .sort({ updatedAt: -1 });

    const legacy = await Progress.findOne({ user: req.user.id });
    const quizAttempts = legacy ? legacy.quizAttempts : [];

    return res.status(200).json({
      success: true,
      progress,
      quizAttempts
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/progress/:problemId
 * Retrieves authenticated user's progress for a single problem.
 */
export const getProblemProgress = async (req, res, next) => {
  try {
    const { problemId } = req.params;

    if (!isValidObjectId(problemId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid problem ID format.'
      });
    }

    const problem = await Problem.findById(problemId);
    if (!problem) {
      return res.status(404).json({
        success: false,
        message: 'Problem not found.'
      });
    }

    let progress = await ProblemProgress.findOne({
      user: req.user.id,
      problem: problem._id
    }).populate('problem');

    if (!progress) {
      return res.status(200).json({
        success: true,
        progress: {
          problem: problem._id,
          completed: false,
          completedAt: null
        }
      });
    }

    return res.status(200).json({
      success: true,
      progress
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/progress/:problemId
 * Marks a problem as completed for the authenticated user.
 */
export const markProblemCompleted = async (req, res, next) => {
  try {
    const { problemId } = req.params;

    if (!isValidObjectId(problemId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid problem ID format.'
      });
    }

    const problem = await Problem.findById(problemId);
    if (!problem) {
      return res.status(404).json({
        success: false,
        message: 'Problem not found.'
      });
    }

    const progress = await ProblemProgress.findOneAndUpdate(
      { user: req.user.id, problem: problem._id },
      {
        $set: {
          completed: true,
          completedAt: new Date()
        }
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    ).populate('problem');

    return res.status(200).json({
      success: true,
      message: 'Problem marked as completed.',
      progress
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * DELETE /api/progress/:problemId
 * Marks a problem as incomplete for the authenticated user.
 */
export const unmarkProblemCompleted = async (req, res, next) => {
  try {
    const { problemId } = req.params;

    if (!isValidObjectId(problemId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid problem ID format.'
      });
    }

    const problem = await Problem.findById(problemId);
    if (!problem) {
      return res.status(404).json({
        success: false,
        message: 'Problem not found.'
      });
    }

    const progress = await ProblemProgress.findOneAndUpdate(
      { user: req.user.id, problem: problem._id },
      {
        $set: {
          completed: false,
          completedAt: null
        }
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    ).populate('problem');

    return res.status(200).json({
      success: true,
      message: 'Problem marked as incomplete.',
      progress
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Legacy helper for Milestone 9 compatibility:
 * POST /api/progress/problems/:problemId/complete
 */
export const completeProblemLegacy = async (req, res, next) => {
  try {
    const { problemId } = req.params;
    if (!problemId) {
      return res.status(400).json({ success: false, message: 'Valid problem ID is required.' });
    }

    // Try finding problem by slug or id
    const problem = await Problem.findOne({
      $or: [
        { slug: problemId },
        { id: problemId },
        ...(isValidObjectId(problemId) ? [{ _id: new mongoose.Types.ObjectId(problemId) }] : [])
      ]
    });

    if (problem) {
      const prog = await ProblemProgress.findOneAndUpdate(
        { user: req.user.id, problem: problem._id },
        {
          $set: {
            completed: true,
            completedAt: new Date()
          }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      return res.status(200).json({
        success: true,
        message: 'Problem marked as completed successfully.',
        progress: prog
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Problem marked as completed.'
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/progress/quiz
 * Records a quiz attempt for the authenticated user with validated score metrics.
 */
export const recordQuizAttempt = async (req, res, next) => {
  try {
    const { quizId, score, totalQuestions, percentage } = req.body;

    if (!quizId || typeof quizId !== 'string' || quizId.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid quiz ID is required.'
      });
    }

    if (typeof totalQuestions !== 'number' || totalQuestions <= 0 || !Number.isInteger(totalQuestions)) {
      return res.status(400).json({
        success: false,
        message: 'Total questions must be a positive integer.'
      });
    }

    if (typeof score !== 'number' || score < 0 || score > totalQuestions) {
      return res.status(400).json({
        success: false,
        message: 'Score must be a number between 0 and total questions.'
      });
    }

    if (typeof percentage !== 'number' || percentage < 0 || percentage > 100) {
      return res.status(400).json({
        success: false,
        message: 'Percentage must be a number between 0 and 100.'
      });
    }

    let progress = await Progress.findOne({ user: req.user.id });
    if (!progress) {
      progress = await Progress.create({
        user: req.user.id,
        completedProblems: [],
        quizAttempts: []
      });
    }

    progress.quizAttempts.push({
      quizId: quizId.trim(),
      score,
      totalQuestions,
      percentage,
      completedAt: new Date()
    });

    await progress.save();

    return res.status(200).json({
      success: true,
      message: 'Quiz attempt recorded successfully.',
      progress: {
        completedProblems: progress.completedProblems,
        quizAttempts: progress.quizAttempts
      }
    });
  } catch (error) {
    return next(error);
  }
};
