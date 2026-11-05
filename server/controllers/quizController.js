import mongoose from 'mongoose';
import Quiz from '../models/Quiz.js';
import QuizAttempt from '../models/QuizAttempt.js';
import Progress from '../models/Progress.js';

/**
 * Helper to escape regex special characters.
 * @param {string} str
 */
const escapeRegex = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * GET /api/quizzes
 * Public endpoint to list published quizzes with catalog metadata.
 * Strips questions to keep payloads lightweight and protect answer confidentiality.
 */
export const getQuizzes = async (req, res, next) => {
  try {
    const { topic, difficulty, search, page = 1, limit = 12 } = req.query;

    const query = { isPublished: true, isArchived: { $ne: true } };

    if (topic && topic !== 'All') {
      query.topic = new RegExp(`^${escapeRegex(topic.trim())}$`, 'i');
    }

    if (difficulty && difficulty !== 'All') {
      query.difficulty = difficulty.trim();
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
      query.$or = [{ title: searchRegex }, { description: searchRegex }, { topic: searchRegex }];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    const [quizzes, total] = await Promise.all([
      Quiz.find(query)
        .select('id title description topic difficulty pointsPerQuestion isPublished createdAt questions')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Quiz.countDocuments(query)
    ]);

    // Format safe catalog items with question count
    const safeQuizzes = quizzes.map((q) => ({
      id: q.id,
      slug: q.id,
      title: q.title,
      description: q.description,
      topic: q.topic,
      difficulty: q.difficulty,
      pointsPerQuestion: q.pointsPerQuestion || 1,
      questionCount: Array.isArray(q.questions) ? q.questions.length : 0,
      createdAt: q.createdAt
    }));

    res.status(200).json({
      success: true,
      data: safeQuizzes,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/quizzes/:id
 * Public endpoint to retrieve quiz specifications and question choices.
 *
 * CRITICAL SECURITY GUARANTEE:
 * 'answer' and 'explanation' fields are strictly stripped from all questions.
 */
export const getQuizById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const query = {
      isPublished: true,
      isArchived: { $ne: true },
      $or: [
        { id: id.toLowerCase().trim() },
        ...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: new mongoose.Types.ObjectId(id) }] : [])
      ]
    };

    const quiz = await Quiz.findOne(query).lean();

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found or is currently unpublished.'
      });
    }

    // Strip answer and explanation from questions
    const safeQuestions = (quiz.questions || []).map((q) => ({
      questionId: q.questionId,
      question: q.question,
      options: q.options,
      points: q.points || 1
    }));

    res.status(200).json({
      success: true,
      data: {
        id: quiz.id,
        _id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        topic: quiz.topic,
        difficulty: quiz.difficulty,
        pointsPerQuestion: quiz.pointsPerQuestion || 1,
        questionCount: safeQuestions.length,
        questions: safeQuestions
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/quizzes/:id/attempts
 * Authenticated endpoint to start or resume a quiz attempt.
 */
export const createAttempt = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const quiz = await Quiz.findOne({
      isPublished: true,
      isArchived: { $ne: true },
      $or: [
        { id: id.toLowerCase().trim() },
        ...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: new mongoose.Types.ObjectId(id) }] : [])
      ]
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found or is currently unpublished.'
      });
    }

    // Check for existing in-progress attempt to resume
    const existingAttempt = await QuizAttempt.findOne({
      user: userId,
      quiz: quiz._id,
      status: 'in_progress'
    }).sort({ createdAt: -1 });

    if (existingAttempt) {
      return res.status(200).json({
        success: true,
        message: 'Resuming existing in-progress attempt.',
        attempt: existingAttempt,
        isResumed: true
      });
    }

    // Create a new in-progress attempt
    const newAttempt = await QuizAttempt.create({
      user: userId,
      quiz: quiz._id,
      quizId: quiz.id,
      quizTitle: quiz.title,
      topic: quiz.topic,
      difficulty: quiz.difficulty,
      status: 'in_progress',
      startedAt: new Date(),
      selectedAnswers: []
    });

    res.status(201).json({
      success: true,
      message: 'Quiz attempt started successfully.',
      attempt: newAttempt,
      data: newAttempt,
      isResumed: false
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/quizzes/attempts
 * Authenticated endpoint to fetch current user's attempt history.
 * Multi-tenant isolation: strictly scoped to req.user.id.
 */
export const getAttemptHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status, topic, quizId } = req.query;

    const query = { user: userId };

    if (status) {
      if (status === 'submitted' || status === 'completed') {
        query.status = { $in: ['submitted', 'completed'] };
      } else if (status === 'in_progress') {
        query.status = 'in_progress';
      }
    }

    if (topic && topic !== 'All') {
      query.topic = new RegExp(`^${escapeRegex(topic.trim())}$`, 'i');
    }

    if (quizId && quizId !== 'All') {
      query.quizId = quizId.trim().toLowerCase();
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [attempts, total] = await Promise.all([
      QuizAttempt.find(query)
        .select('-reviewData') // Exclude heavy reviewData from history list
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      QuizAttempt.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: attempts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/quizzes/attempts/:attemptId
 * Authenticated endpoint to fetch details of a specific attempt.
 * Enforces strict ownership.
 */
export const getAttemptById = async (req, res, next) => {
  try {
    const { attemptId } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(attemptId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid attempt identifier.'
      });
    }

    const attempt = await QuizAttempt.findById(attemptId);

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Quiz attempt not found.'
      });
    }

    // Strict tenant isolation ownership check
    if (attempt.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not own this quiz attempt.'
      });
    }

    // If attempt is in progress, do NOT expose answers or review data
    if (attempt.status === 'in_progress') {
      const quiz = await Quiz.findById(attempt.quiz).lean();
      const safeQuestions = (quiz?.questions || []).map((q) => ({
        questionId: q.questionId,
        question: q.question,
        options: q.options,
        points: q.points || 1
      }));

      return res.status(200).json({
        success: true,
        data: {
          ...attempt.toObject(),
          reviewData: [],
          questions: safeQuestions
        }
      });
    }

    // If submitted, return complete attempt with review snapshot
    res.status(200).json({
      success: true,
      data: attempt
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/quizzes/attempts/:attemptId/submit
 * Authenticated endpoint to finalize and independently score a quiz attempt.
 *
 * CRITICAL SCORING SECURITY:
 * Backend validates all question IDs, option IDs, calculates scores independently,
 * performs an atomic conditional update, and rejects duplicate or malformed submissions.
 */
export const submitAttempt = async (req, res, next) => {
  try {
    const { attemptId } = req.params;
    const userId = req.user.id;
    const rawAnswers = req.body?.answers;

    if (!mongoose.Types.ObjectId.isValid(attemptId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid attempt identifier.'
      });
    }

    // 1. Fetch attempt and verify ownership
    const attempt = await QuizAttempt.findById(attemptId);

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Quiz attempt not found.'
      });
    }

    if (attempt.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not own this quiz attempt.'
      });
    }

    // 2. Prevent repeated submissions on already finalized attempts
    if (attempt.status === 'submitted' || attempt.status === 'completed') {
      return res.status(409).json({
        success: false,
        message: 'Attempt has already been submitted and finalized.',
        attempt
      });
    }

    // 3. Load authoritative quiz from database
    const quiz = await Quiz.findById(attempt.quiz);

    if (!quiz) {
      return res.status(500).json({
        success: false,
        message: 'Associated quiz could not be found.'
      });
    }

    // 4. Standardize and validate submitted answers
    const answersMap = new Map();
    if (Array.isArray(rawAnswers)) {
      for (const item of rawAnswers) {
        if (!item || typeof item !== 'object') {
          return res.status(422).json({
            success: false,
            message: 'Malformed answer object in submission array.'
          });
        }
        const qId = item.questionId ?? item.id;
        if (qId === undefined || qId === null || isNaN(Number(qId))) {
          return res.status(422).json({
            success: false,
            message: 'Each answer must specify a valid questionId.'
          });
        }
        answersMap.set(Number(qId), item.selectedOption ?? item.answer ?? null);
      }
    } else if (rawAnswers && typeof rawAnswers === 'object') {
      for (const [key, value] of Object.entries(rawAnswers)) {
        if (isNaN(Number(key))) {
          return res.status(422).json({
            success: false,
            message: 'Answer object keys must be numeric question IDs.'
          });
        }
        answersMap.set(Number(key), value);
      }
    } else {
      return res.status(422).json({
        success: false,
        message: 'Answers payload must be an array or object.'
      });
    }

    // Validate that submitted question IDs belong to the quiz
    const quizQuestionMap = new Map();
    for (const q of quiz.questions) {
      quizQuestionMap.set(q.questionId, q);
    }

    for (const [submittedQId, submittedOption] of answersMap.entries()) {
      const matchedQuestion = quizQuestionMap.get(submittedQId);
      if (!matchedQuestion) {
        return res.status(422).json({
          success: false,
          message: `Question ID ${submittedQId} does not belong to this quiz.`
        });
      }
      if (
        submittedOption !== null &&
        submittedOption !== undefined &&
        !matchedQuestion.options.includes(submittedOption)
      ) {
        return res.status(422).json({
          success: false,
          message: `Option "${submittedOption}" is not a valid choice for question ${submittedQId}.`
        });
      }
    }

    // 5. Authoritative server-side evaluation
    let totalScore = 0;
    let maxScore = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;

    const selectedAnswersToStore = [];
    const reviewDataToStore = [];

    for (const q of quiz.questions) {
      const qPoints = q.points || 1;
      maxScore += qPoints;

      const userChoice = answersMap.has(q.questionId) ? answersMap.get(q.questionId) : null;
      const isUnanswered = userChoice === null || userChoice === undefined || userChoice === '';

      let isCorrect = false;
      let pointsAwarded = 0;

      if (isUnanswered) {
        unansweredCount += 1;
      } else if (userChoice === q.answer) {
        isCorrect = true;
        pointsAwarded = qPoints;
        totalScore += qPoints;
        correctCount += 1;
      } else {
        incorrectCount += 1;
      }

      selectedAnswersToStore.push({
        questionId: q.questionId,
        selectedOption: isUnanswered ? null : userChoice,
        isCorrect,
        pointsAwarded
      });

      reviewDataToStore.push({
        questionId: q.questionId,
        question: q.question,
        options: q.options,
        selectedOption: isUnanswered ? null : userChoice,
        correctAnswer: q.answer,
        explanation: q.explanation,
        isCorrect,
        points: qPoints
      });
    }

    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    const isPassed = percentage >= (quiz.passingPercentage || 70);
    const submittedAt = new Date();
    const startedAt = attempt.startedAt || submittedAt;
    const durationSeconds = Math.max(0, Math.round((submittedAt.getTime() - new Date(startedAt).getTime()) / 1000));

    // 6. Concurrency-safe atomic conditional update
    const finalizedAttempt = await QuizAttempt.findOneAndUpdate(
      { _id: attemptId, user: userId, status: 'in_progress' },
      {
        $set: {
          status: 'submitted',
          isPassed,
          selectedAnswers: selectedAnswersToStore,
          score: totalScore,
          maxScore,
          percentage,
          correctAnswers: correctCount,
          incorrectAnswers: incorrectCount,
          unanswered: unansweredCount,
          submittedAt,
          durationSeconds,
          reviewData: reviewDataToStore
        }
      },
      { returnDocument: 'after' }
    );

    if (!finalizedAttempt) {
      // Another concurrent request already finalized this attempt
      const refreshed = await QuizAttempt.findById(attemptId);
      return res.status(409).json({
        success: false,
        message: 'Attempt was already submitted by a concurrent request.',
        attempt: refreshed,
        data: refreshed
      });
    }

    // 7. Backward-compatible update to legacy Progress document
    try {
      await Progress.findOneAndUpdate(
        { user: userId },
        {
          $push: {
            quizAttempts: {
              quizId: attempt.quizId,
              score: totalScore,
              totalQuestions: quiz.questions.length,
              percentage,
              completedAt: submittedAt
            }
          }
        },
        { upsert: true, returnDocument: 'after' }
      );
    } catch (progressErr) {
      console.warn('[submitAttempt] Progress update warning:', progressErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'Quiz submitted and evaluated successfully.',
      attempt: finalizedAttempt,
      data: finalizedAttempt
    });
  } catch (error) {
    next(error);
  }
};
