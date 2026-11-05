import Question from '../models/Question.js';
import Progress from '../models/Progress.js';

/**
 * Escapes regex special characters.
 * @param {string} str
 * @returns {string}
 */
const escapeRegex = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * GET /api/questions
 * Public endpoint retrieving assessment questions.
 *
 * CRITICAL SECURITY GUARANTEE:
 * 'answer' and 'explanation' fields are strictly stripped out of every question
 * so students cannot inspect client-side network payloads or dev tools to cheat.
 */
export const getQuestions = async (req, res, next) => {
  try {
    const query = {};

    if (req.query.topic && req.query.topic !== 'All') {
      query.topic = new RegExp(`^${escapeRegex(req.query.topic.trim())}$`, 'i');
    }

    // Explicitly exclude 'answer' and 'explanation'
    const questions = await Question.find(query)
      .select('-answer -explanation -__v')
      .sort({ id: 1 })
      .lean();

    res.status(200).json({
      success: true,
      questions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/questions/submit
 * Authenticated endpoint evaluating quiz answers on the backend.
 *
 * Computes authoritative score, passes/needs-practice status, itemized review,
 * and records attempt to Progress in MongoDB.
 *
 * Request Body:
 * {
 *   answers: [ { questionId: 1, answer: "let" }, ... ] OR { 1: "let", ... }
 * }
 */
export const submitQuiz = async (req, res, next) => {
  try {
    const rawAnswers = req.body?.answers;

    if (!rawAnswers || (Array.isArray(rawAnswers) && rawAnswers.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Answers payload is required to evaluate assessment.'
      });
    }

    // Standardize answers into a map of questionId -> answer
    const answersMap = new Map();
    if (Array.isArray(rawAnswers)) {
      for (const item of rawAnswers) {
        const qId = item.questionId ?? item.id;
        if (qId !== undefined && qId !== null) {
          answersMap.set(Number(qId), item.answer);
        }
      }
    } else if (typeof rawAnswers === 'object') {
      for (const [key, value] of Object.entries(rawAnswers)) {
        answersMap.set(Number(key), value);
      }
    }

    // Fetch all questions with answers and explanations from database
    const allQuestions = await Question.find().sort({ id: 1 }).lean();

    if (allQuestions.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'No assessment questions found in database.'
      });
    }

    let correctCount = 0;
    const reviewData = allQuestions.map((q) => {
      const selectedAnswer = answersMap.get(q.id) || null;
      const isCorrect = Boolean(selectedAnswer && selectedAnswer === q.answer);

      if (isCorrect) {
        correctCount += 1;
      }

      return {
        questionId: q.id,
        id: q.id,
        topic: q.topic,
        question: q.question,
        selectedAnswer: selectedAnswer || 'Not Answered',
        userAnswer: selectedAnswer || 'Not Answered',
        correctAnswer: q.answer,
        explanation: q.explanation,
        isCorrect
      };
    });

    const total = allQuestions.length;
    const incorrectCount = total - correctCount;
    const scorePercentage = Math.round((correctCount / total) * 100);
    const status = scorePercentage >= 70 ? 'Passed' : 'Needs Practice';

    const resultPayload = {
      total,
      totalQuestions: total,
      correct: correctCount,
      correctAnswers: correctCount,
      incorrect: incorrectCount,
      incorrectAnswers: incorrectCount,
      percentage: scorePercentage,
      scorePercentage,
      status
    };

    // Persist attempt to MongoDB Progress document for authenticated user
    try {
      await Progress.findOneAndUpdate(
        { user: req.user.id },
        {
          $push: {
            quizAttempts: {
              quizId: 'javascript-fundamentals',
              score: correctCount,
              totalQuestions: total,
              percentage: scorePercentage,
              completedAt: new Date()
            }
          }
        },
        { upsert: true, returnDocument: 'after' }
      );
    } catch (progressError) {
      console.warn('[submitQuiz] Could not auto-record progress:', progressError.message);
    }

    res.status(200).json({
      success: true,
      result: resultPayload,
      review: reviewData,
      reviewData
    });
  } catch (error) {
    next(error);
  }
};
