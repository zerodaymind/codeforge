import QuizAttempt from '../models/QuizAttempt.js';

/**
 * GET /api/analytics/overview
 * Authenticated endpoint returning user's overall quiz performance summary.
 * Strictly scoped to req.user.id and completed ('submitted') attempts.
 */
export const getOverview = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Fetch all submitted or completed attempts for user
    const submittedAttempts = await QuizAttempt.find({
      user: userId,
      status: { $in: ['submitted', 'completed'] }
    })
      .sort({ submittedAt: -1 })
      .lean();

    const totalCompletedAttempts = submittedAttempts.length;

    if (totalCompletedAttempts === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalCompletedAttempts: 0,
          averageScorePercentage: 0,
          bestScorePercentage: 0,
          recentPerformance: 0,
          distinctQuizzesAttempted: 0,
          totalCorrectAnswers: 0,
          totalIncorrectAnswers: 0,
          totalQuestionsAnswered: 0
        }
      });
    }

    let totalPercentageSum = 0;
    let bestScorePercentage = 0;
    let totalCorrectAnswers = 0;
    let totalIncorrectAnswers = 0;
    const distinctQuizzes = new Set();

    for (const attempt of submittedAttempts) {
      totalPercentageSum += attempt.percentage || 0;
      if ((attempt.percentage || 0) > bestScorePercentage) {
        bestScorePercentage = attempt.percentage || 0;
      }
      totalCorrectAnswers += attempt.correctAnswers || 0;
      totalIncorrectAnswers += attempt.incorrectAnswers || 0;
      if (attempt.quizId) {
        distinctQuizzes.add(attempt.quizId);
      }
    }

    const averageScorePercentage = Math.round(totalPercentageSum / totalCompletedAttempts);

    // Recent performance: average of up to 5 most recent attempts
    const recentSlice = submittedAttempts.slice(0, 5);
    const recentSum = recentSlice.reduce((sum, att) => sum + (att.percentage || 0), 0);
    const recentPerformance = Math.round(recentSum / recentSlice.length);

    res.status(200).json({
      success: true,
      data: {
        totalCompletedAttempts,
        averageScorePercentage,
        bestScorePercentage,
        recentPerformance,
        distinctQuizzesAttempted: distinctQuizzes.size,
        totalCorrectAnswers,
        totalIncorrectAnswers,
        totalQuestionsAnswered: totalCorrectAnswers + totalIncorrectAnswers
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/analytics/topics
 * Authenticated endpoint returning topic-wise breakdown and strongest/weakest topics.
 */
export const getTopicAnalytics = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const submittedAttempts = await QuizAttempt.find({
      user: userId,
      status: { $in: ['submitted', 'completed'] }
    }).lean();

    if (submittedAttempts.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          topics: [],
          strongestTopic: null,
          weakestTopic: null
        }
      });
    }

    // Group metrics by topic
    const topicStats = new Map();

    for (const att of submittedAttempts) {
      const topicName = att.topic || 'General';
      if (!topicStats.has(topicName)) {
        topicStats.set(topicName, {
          topic: topicName,
          completedAttempts: 0,
          percentageSum: 0,
          totalCorrect: 0,
          totalIncorrect: 0
        });
      }

      const stat = topicStats.get(topicName);
      stat.completedAttempts += 1;
      stat.percentageSum += att.percentage || 0;
      stat.totalCorrect += att.correctAnswers || 0;
      stat.totalIncorrect += att.incorrectAnswers || 0;
    }

    const topics = Array.from(topicStats.values()).map((stat) => {
      const avgPercentage = Math.round(stat.percentageSum / stat.completedAttempts);
      const totalAnswered = stat.totalCorrect + stat.totalIncorrect;
      const correctRate = totalAnswered > 0 ? Math.round((stat.totalCorrect / totalAnswered) * 100) : 0;

      return {
        topic: stat.topic,
        completedAttempts: stat.completedAttempts,
        averageScorePercentage: avgPercentage,
        totalCorrect: stat.totalCorrect,
        totalQuestionsAnswered: totalAnswered,
        correctRate
      };
    });

    // Sort descending by averageScorePercentage
    topics.sort((a, b) => b.averageScorePercentage - a.averageScorePercentage);

    // Identify strongest and weakest topics (minimum threshold: at least 1 completed attempt)
    let strongestTopic = null;
    let weakestTopic = null;

    if (topics.length > 0) {
      strongestTopic = topics[0].topic;
      weakestTopic = topics[topics.length - 1].topic;
    }

    res.status(200).json({
      success: true,
      data: {
        topics,
        strongestTopic,
        weakestTopic
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/analytics/trends
 * Authenticated endpoint returning time-series performance data for charts.
 * Bounded to the last 30 completed attempts.
 */
export const getTrendAnalytics = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const attempts = await QuizAttempt.find({
      user: userId,
      status: { $in: ['submitted', 'completed'] }
    })
      .sort({ submittedAt: 1 })
      .limit(30)
      .lean();

    const trends = attempts.map((att) => ({
      attemptId: att._id,
      date: att.submittedAt || att.createdAt,
      quizTitle: att.quizTitle,
      quizId: att.quizId,
      topic: att.topic,
      score: att.score,
      maxScore: att.maxScore,
      percentage: att.percentage,
      durationSeconds: att.durationSeconds || 0
    }));

    res.status(200).json({
      success: true,
      data: {
        trends
      }
    });
  } catch (error) {
    next(error);
  }
};
