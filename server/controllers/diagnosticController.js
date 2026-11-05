import mongoose from 'mongoose';
import Question from '../models/Question.js';
import DiagnosticSession from '../models/DiagnosticSession.js';
import User from '../models/User.js';

/**
 * Conservative diagnostic evidence thresholds.
 * Centralized and documented:
 * - A minimum sample size of 2 questions is required to classify beyond 'not_enough_evidence'.
 * - 70% accuracy or higher indicates 'promising' understanding.
 */
export const EVIDENCE_THRESHOLDS = {
  MIN_SAMPLE_SIZE: 2,
  PROMISING_ACCURACY: 70
};

/**
 * Controlled Topic Taxonomy and Subtopic Mappings
 */
const TOPIC_CATEGORY_MAP = {
  'javascript fundamentals': {
    primaryTopic: 'JavaScript',
    tags: ['JavaScript Fundamentals', 'JavaScript', 'Variables', 'Data Types', 'Functions', 'Arrays', 'Objects', 'Loops', 'DOM Basics', 'ES6', 'Promises', 'Scope']
  },
  'javascript': {
    primaryTopic: 'JavaScript',
    tags: ['JavaScript Fundamentals', 'JavaScript']
  },
  'data structures & algorithms': {
    primaryTopic: 'Data Structures & Algorithms',
    tags: ['Data Structures & Algorithms', 'DSA', 'Searching', 'Sorting', 'Stack', 'Queue', 'Linked List', 'Arrays', 'Graphs', 'Trees']
  },
  'arrays': {
    primaryTopic: 'Data Structures & Algorithms',
    tags: ['Arrays']
  },
  'stack': {
    primaryTopic: 'Data Structures & Algorithms',
    tags: ['Stack']
  },
  'queue': {
    primaryTopic: 'Data Structures & Algorithms',
    tags: ['Queue']
  },
  'linked list': {
    primaryTopic: 'Data Structures & Algorithms',
    tags: ['Linked List']
  },
  'searching': {
    primaryTopic: 'Data Structures & Algorithms',
    tags: ['Searching', 'BST']
  },
  'sorting': {
    primaryTopic: 'Data Structures & Algorithms',
    tags: ['Sorting', 'QuickSort']
  },
  'recursion': {
    primaryTopic: 'Data Structures & Algorithms',
    tags: ['Recursion', 'Dynamic Programming']
  },
  'operating systems': {
    primaryTopic: 'Operating Systems',
    tags: ['Operating Systems', 'Processes', 'Threads', 'Deadlocks', 'Memory', 'CPU Scheduling']
  },
  'computer networks': {
    primaryTopic: 'Computer Networks',
    tags: ['Computer Networks', 'OSI', 'TCP', 'UDP', 'DNS', 'HTTP']
  },
  'cybersecurity': {
    primaryTopic: 'Cybersecurity',
    tags: ['Cybersecurity', 'SQLi', 'XSS', 'Cryptography', 'MFA', 'CSP']
  }
};

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Serializes a DiagnosticSession for client consumption.
 * Strictly excludes answers and explanations while session is in_progress.
 */
export function formatSafeSession(session) {
  if (!session) return null;
  const doc = typeof session.toObject === 'function' ? session.toObject() : { ...session };
  const isInProgress = doc.status === 'in_progress';

  const safeQuestions = (doc.questions || []).map((q) => ({
    questionId: q.questionId,
    topic: q.topic,
    subtopic: q.subtopic,
    question: q.question,
    codeSnippet: q.codeSnippet || '',
    options: q.options,
    difficulty: q.difficulty,
    points: q.points || 1,
    // Strictly strip answer and explanation if still in progress
    ...(isInProgress
      ? {}
      : {
          answer: q.answer,
          correctAnswer: q.answer,
          explanation: q.explanation,
          isCorrect: doc.selectedAnswers?.find((a) => a.questionId === q.questionId)?.isCorrect ?? false,
          selectedOption: doc.selectedAnswers?.find((a) => a.questionId === q.questionId)?.selectedOption,
          selectedOptionIndex:
            doc.selectedAnswers?.find((a) => a.questionId === q.questionId)?.selectedOption !== null &&
            doc.selectedAnswers?.find((a) => a.questionId === q.questionId)?.selectedOption !== undefined
              ? q.options.indexOf(doc.selectedAnswers?.find((a) => a.questionId === q.questionId)?.selectedOption)
              : -1
        })
  }));

  const formattedTopicResults = (doc.topicResults || []).map((t) => ({
    topic: t.topic,
    totalQuestions: t.totalQuestions,
    answeredQuestions: t.answeredQuestions,
    correctAnswers: t.correctAnswers,
    accuracyPercentage: t.accuracyPercentage,
    status: t.status,
    evidenceStatus: t.status,
    confidence: t.confidence,
    sampleSizeWarning: t.sampleSizeWarning,
    explanation: t.explanation,
    total: t.totalQuestions,
    answered: t.answeredQuestions,
    correct: t.correctAnswers,
    score: t.correctAnswers,
    maxScore: t.totalQuestions
  }));

  const formattedRecommendations = (doc.recommendations || []).map((r) => ({
    topic: r.topic,
    title: r.title,
    recommendation: r.recommendation,
    reason: r.recommendation,
    actionText: r.actionText,
    actionPath: r.actionPath,
    link: r.actionPath,
    status: r.status,
    type: r.status === 'promising' ? 'Reinforce Mastery' : r.status === 'needs_revision' ? 'Priority Gap' : 'Explore'
  }));

  return {
    id: doc._id.toString(),
    _id: doc._id.toString(),
    userId: doc.user ? doc.user.toString() : '',
    user: doc.user ? doc.user.toString() : '',
    status: doc.status,
    learningGoals: doc.learningGoals || [],
    targetLanguages: doc.targetLanguages || [],
    requestedTopics: doc.requestedTopics || [],
    assessedTopics: doc.assessedTopics || [],
    unassessedTopics: doc.unassessedTopics || [],
    questions: safeQuestions,
    totalQuestions: doc.totalQuestions || safeQuestions.length,
    answeredQuestions: doc.answeredQuestions || 0,
    startedAt: doc.startedAt,
    submittedAt: doc.submittedAt,
    durationSeconds: doc.durationSeconds || 0,
    // Results & recommendations included only after submission
    ...(!isInProgress
      ? {
          score: doc.score,
          maxScore: doc.maxScore,
          percentage: doc.percentage,
          correctCount: doc.correctCount,
          incorrectCount: doc.incorrectCount,
          unansweredCount: doc.unansweredCount,
          selectedAnswers: doc.selectedAnswers || [],
          topicResults: formattedTopicResults,
          recommendations: formattedRecommendations
        }
      : {})
  };
}

/**
 * POST /api/diagnostics/sessions
 * Starts or resumes an adaptive diagnostic assessment session.
 */
export const startDiagnosticSession = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { topics: requestedTopicsBody, forceNew = false, seed = null } = req.body || {};

    // 1. Fetch authenticated user profile for learning goals & preferences
    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // 2. Check for existing in_progress session if not forcing new
    if (!forceNew) {
      const existingSession = await DiagnosticSession.findOne({
        user: userId,
        status: 'in_progress'
      }).sort({ createdAt: -1 });

      if (existingSession) {
        const formatted = formatSafeSession(existingSession);
        return res.status(200).json({
          success: true,
          message: 'Resuming active diagnostic session.',
          isResumed: true,
          session: formatted,
          data: formatted
        });
      }
    } else {
      // Mark any existing in_progress session as abandoned
      await DiagnosticSession.updateMany(
        { user: userId, status: 'in_progress' },
        { $set: { status: 'abandoned' } }
      );
    }

    // 3. Determine topics to assess
    let topicsToAssess = [];
    if (Array.isArray(requestedTopicsBody) && requestedTopicsBody.length > 0) {
      topicsToAssess = requestedTopicsBody.map((t) => t.trim()).filter(Boolean);
    } else if (Array.isArray(user.selectedTopics) && user.selectedTopics.length > 0) {
      topicsToAssess = user.selectedTopics;
    } else {
      // Defaults aligned to learning goals
      const goals = user.learningGoals || [];
      if (goals.includes('interview')) {
        topicsToAssess = ['Data Structures & Algorithms', 'Arrays', 'Stack'];
      } else if (goals.includes('revival')) {
        topicsToAssess = ['JavaScript Fundamentals', 'Arrays'];
      } else if (goals.includes('beginner')) {
        topicsToAssess = ['JavaScript Fundamentals'];
      } else {
        topicsToAssess = ['JavaScript Fundamentals', 'Data Structures & Algorithms'];
      }
    }

    // Deduplicate requested topics
    topicsToAssess = [...new Set(topicsToAssess)];

    // 4. Query Question Bank for suitable questions per topic
    const assessedTopics = [];
    const unassessedTopics = [];
    const selectedQuestions = [];
    const selectedQuestionIds = new Set();

    for (const topicName of topicsToAssess) {
      const topicLower = topicName.toLowerCase().trim();
      const categoryMapping = TOPIC_CATEGORY_MAP[topicLower];

      const queryCriteria = [];
      const topicRegex = new RegExp(`^${escapeRegex(topicName)}$`, 'i');
      queryCriteria.push({ topic: topicRegex });
      queryCriteria.push({ tags: topicRegex });

      if (categoryMapping) {
        queryCriteria.push({ topic: new RegExp(`^${escapeRegex(categoryMapping.primaryTopic)}$`, 'i') });
        for (const t of categoryMapping.tags) {
          queryCriteria.push({ tags: new RegExp(`^${escapeRegex(t)}$`, 'i') });
        }
      }

      // Query active questions matching criteria
      const candidateQuestions = await Question.find({
        status: 'active',
        $or: queryCriteria
      }).lean();

      // Filter out questions already selected for another topic
      const availableQuestions = candidateQuestions.filter((q) => !selectedQuestionIds.has(q.id));

      if (availableQuestions.length === 0) {
        unassessedTopics.push({
          topic: topicName,
          reason: 'No multiple-choice questions currently available in the question bank for this topic.'
        });
      } else {
        assessedTopics.push(topicName);

        // Sort / prioritize according to learner goals
        const goals = user.learningGoals || [];
        const isBeginner = goals.includes('beginner');
        const isInterview = goals.includes('interview');

        availableQuestions.sort((a, b) => {
          if (isBeginner) {
            const diffRank = { Easy: 1, Medium: 2, Hard: 3 };
            return (diffRank[a.difficulty] || 2) - (diffRank[b.difficulty] || 2);
          }
          if (isInterview) {
            const diffRank = { Hard: 1, Medium: 2, Easy: 3 };
            return (diffRank[a.difficulty] || 2) - (diffRank[b.difficulty] || 2);
          }
          return 0;
        });

        // Take up to 2-3 questions for this topic
        const takeCount = Math.min(availableQuestions.length, topicsToAssess.length <= 2 ? 3 : 2);
        const chosen = availableQuestions.slice(0, takeCount);

        for (const q of chosen) {
          selectedQuestionIds.add(q.id);
          selectedQuestions.push({
            questionId: q.id,
            topic: topicName,
            subtopic: q.tags?.[0] || q.topic,
            question: q.question,
            codeSnippet: q.codeSnippet || '',
            options: q.options,
            difficulty: q.difficulty || 'Medium',
            points: q.points || 1,
            answer: q.answer,
            explanation: q.explanation
          });
        }
      }
    }

    // If zero questions could be matched across all requested topics
    if (selectedQuestions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No assessment questions currently available for the requested topics.',
        unassessedTopics
      });
    }

    // 5. Create new DiagnosticSession document in MongoDB
    const session = await DiagnosticSession.create({
      user: userId,
      status: 'in_progress',
      learningGoals: user.learningGoals || [],
      targetLanguages: user.languages || [],
      requestedTopics: topicsToAssess,
      assessedTopics,
      unassessedTopics,
      questions: selectedQuestions,
      totalQuestions: selectedQuestions.length,
      startedAt: new Date(),
      seed: seed || null
    });

    const formatted = formatSafeSession(session);
    return res.status(201).json({
      success: true,
      message: 'Diagnostic assessment session started successfully.',
      isResumed: false,
      session: formatted,
      data: formatted
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/diagnostics/sessions/:id
 * Retrieves diagnostic session details (guarded by tenant isolation).
 */
export const getDiagnosticSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid session identifier.' });
    }

    const session = await DiagnosticSession.findById(id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Diagnostic session not found.' });
    }

    // Tenant isolation verification
    if (session.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not own this diagnostic session.'
      });
    }

    const formatted = formatSafeSession(session);
    return res.status(200).json({
      success: true,
      session: formatted,
      data: formatted
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/diagnostics/sessions/:id/submit
 * Authoritatively scores diagnostic session and produces conservative evidence reports.
 */
export const submitDiagnosticSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const rawAnswers = req.body?.answers;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid session identifier.' });
    }

    const session = await DiagnosticSession.findById(id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Diagnostic session not found.' });
    }

    // Tenant isolation verification
    if (session.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not own this diagnostic session.'
      });
    }

    // Prevent duplicate submissions on finalized session
    if (session.status === 'submitted') {
      const formatted = formatSafeSession(session);
      return res.status(409).json({
        success: false,
        message: 'Diagnostic session has already been submitted and finalized.',
        session: formatted,
        data: formatted
      });
    }

    if (session.status === 'abandoned') {
      const formatted = formatSafeSession(session);
      return res.status(409).json({
        success: false,
        message: 'Cannot submit an abandoned diagnostic session.',
        session: formatted,
        data: formatted
      });
    }

    // Standardize submitted answers
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
            message: 'Each answer must specify a valid numeric questionId.'
          });
        }

        let chosenOption = item.selectedOption ?? item.answer ?? null;
        if (
          (chosenOption === null || chosenOption === undefined) &&
          typeof item.selectedOptionIndex === 'number'
        ) {
          if (item.selectedOptionIndex >= 0) {
            const matchedQ = session.questions.find((sq) => sq.questionId === Number(qId));
            if (matchedQ && Array.isArray(matchedQ.options) && matchedQ.options[item.selectedOptionIndex]) {
              chosenOption = matchedQ.options[item.selectedOptionIndex];
            }
          } else {
            chosenOption = null;
          }
        }
        answersMap.set(Number(qId), chosenOption);
      }
    } else if (rawAnswers && typeof rawAnswers === 'object') {
      for (const [key, value] of Object.entries(rawAnswers)) {
        if (isNaN(Number(key))) {
          return res.status(422).json({
            success: false,
            message: 'Answer keys must be numeric question IDs.'
          });
        }
        answersMap.set(Number(key), value);
      }
    } else if (rawAnswers !== undefined && rawAnswers !== null) {
      return res.status(400).json({
        success: false,
        message: 'Answers payload must be an array or object.'
      });
    }

    // Validate that submitted question IDs belong to this session
    const sessionQuestionMap = new Map();
    for (const q of session.questions) {
      sessionQuestionMap.set(q.questionId, q);
    }

    for (const [submittedQId, submittedOption] of answersMap.entries()) {
      const matchedQ = sessionQuestionMap.get(submittedQId);
      if (!matchedQ) {
        return res.status(422).json({
          success: false,
          message: `Question ID ${submittedQId} does not belong to this diagnostic session.`
        });
      }
      if (
        submittedOption !== null &&
        submittedOption !== undefined &&
        !matchedQ.options.includes(submittedOption)
      ) {
        return res.status(422).json({
          success: false,
          message: `Option "${submittedOption}" is not a valid choice for question ${submittedQId}.`
        });
      }
    }

    // Authoritative Server-Side Scoring
    let totalScore = 0;
    let maxScore = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;

    const selectedAnswersToStore = [];
    const topicStats = new Map();

    for (const q of session.questions) {
      const qPoints = q.points || 1;
      maxScore += qPoints;

      // Initialize topic bucket
      if (!topicStats.has(q.topic)) {
        topicStats.set(q.topic, { total: 0, answered: 0, correct: 0 });
      }
      const tStat = topicStats.get(q.topic);
      tStat.total += 1;

      const userChoice = answersMap.get(q.questionId);
      if (userChoice === undefined || userChoice === null || userChoice === '') {
        unansweredCount++;
        selectedAnswersToStore.push({
          questionId: q.questionId,
          selectedOption: null,
          isCorrect: false,
          pointsAwarded: 0
        });
      } else {
        tStat.answered += 1;
        const isCorrect = userChoice.trim() === q.answer.trim();
        if (isCorrect) {
          correctCount++;
          totalScore += qPoints;
          tStat.correct += 1;
          selectedAnswersToStore.push({
            questionId: q.questionId,
            selectedOption: userChoice,
            isCorrect: true,
            pointsAwarded: qPoints
          });
        } else {
          incorrectCount++;
          selectedAnswersToStore.push({
            questionId: q.questionId,
            selectedOption: userChoice,
            isCorrect: false,
            pointsAwarded: 0
          });
        }
      }
    }

    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    const answeredQuestions = correctCount + incorrectCount;

    // Conservative Topic Evidence Classification
    const topicResults = [];
    const recommendations = [];

    for (const [topic, stats] of topicStats.entries()) {
      const topicAccuracy = stats.answered > 0 ? Math.round((stats.correct / stats.answered) * 100) : 0;
      let status = 'not_enough_evidence';
      let confidence = 'low';
      let sampleSizeWarning = false;
      let explanation = '';

      if (stats.answered < EVIDENCE_THRESHOLDS.MIN_SAMPLE_SIZE) {
        status = 'not_enough_evidence';
        confidence = 'low';
        sampleSizeWarning = true;
        explanation = `Insufficient evidence (${stats.answered}/${stats.total} questions answered). At least ${EVIDENCE_THRESHOLDS.MIN_SAMPLE_SIZE} answered questions are needed to make a reliable diagnostic assessment.`;
      } else if (topicAccuracy >= EVIDENCE_THRESHOLDS.PROMISING_ACCURACY) {
        status = 'promising';
        confidence = stats.total >= 4 ? 'high' : 'moderate';
        sampleSizeWarning = false;
        explanation = `Solid understanding demonstrated (${stats.correct}/${stats.total} correct, ${topicAccuracy}%). Foundational concepts are well in place.`;
      } else {
        status = 'needs_revision';
        confidence = stats.total >= 4 ? 'high' : 'moderate';
        sampleSizeWarning = false;
        explanation = `Observed answers indicate revisiting this topic will help (${stats.correct}/${stats.total} correct, ${topicAccuracy}%). A targeted concept refresh is recommended.`;
      }

      topicResults.push({
        topic,
        totalQuestions: stats.total,
        answeredQuestions: stats.answered,
        correctAnswers: stats.correct,
        accuracyPercentage: topicAccuracy,
        status,
        confidence,
        sampleSizeWarning,
        explanation
      });

      // Grounded Next Steps
      if (status === 'needs_revision') {
        const isDsa = topic.toLowerCase().includes('data') || topic.toLowerCase().includes('array') || topic.toLowerCase().includes('stack');
        recommendations.push({
          topic,
          title: `Revise ${topic} Concepts`,
          recommendation: `Brush up on key syntax and core principles before moving to difficult problem challenges.`,
          actionText: isDsa ? 'Explore DSA Practice Challenges' : 'Take Topic Diagnostic Quiz',
          actionPath: isDsa ? '/practice' : '/quiz',
          status: 'needs_revision'
        });
      } else if (status === 'promising') {
        recommendations.push({
          topic,
          title: `Reinforce ${topic} Through Practice`,
          recommendation: `Your conceptual intuition is strong. Apply it to timed algorithmic challenges in the editor.`,
          actionText: 'Solve Problem Challenges',
          actionPath: '/practice',
          status: 'promising'
        });
      } else {
        recommendations.push({
          topic,
          title: `Assess ${topic} With More Questions`,
          recommendation: `Complete a full assessment to establish stronger evidence.`,
          actionText: 'Open Full Quiz Catalog',
          actionPath: '/quiz',
          status: 'not_enough_evidence'
        });
      }
    }

    // Finalize session in MongoDB
    session.status = 'submitted';
    session.submittedAt = new Date();
    session.durationSeconds = Math.max(0, Math.round((session.submittedAt - session.startedAt) / 1000));
    session.selectedAnswers = selectedAnswersToStore;
    session.totalQuestions = session.questions.length;
    session.answeredQuestions = answeredQuestions;
    session.correctCount = correctCount;
    session.incorrectCount = incorrectCount;
    session.unansweredCount = unansweredCount;
    session.score = totalScore;
    session.maxScore = maxScore;
    session.percentage = percentage;
    session.topicResults = topicResults;
    session.recommendations = recommendations;

    await session.save();

    const formattedSubmitted = formatSafeSession(session);
    return res.status(200).json({
      success: true,
      message: 'Diagnostic assessment evaluated and finalized successfully.',
      session: formattedSubmitted,
      data: formattedSubmitted
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/diagnostics/sessions/:id/abandon
 * Marks an in-progress diagnostic session as abandoned.
 */
export const abandonDiagnosticSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid session identifier.' });
    }

    const session = await DiagnosticSession.findById(id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Diagnostic session not found.' });
    }

    if (session.user.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    if (session.status === 'submitted') {
      return res.status(400).json({
        success: false,
        message: 'Cannot abandon a completed and submitted session.'
      });
    }

    session.status = 'abandoned';
    await session.save();

    const formattedAbandoned = formatSafeSession(session);
    return res.status(200).json({
      success: true,
      message: 'Diagnostic session marked as abandoned.',
      session: formattedAbandoned,
      data: formattedAbandoned
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/diagnostics/sessions/latest
 * Retrieves the authenticated user's latest finalized diagnostic session report or in-progress session.
 */
export const getLatestDiagnosticReport = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const latest = await DiagnosticSession.findOne({
      user: userId,
      status: { $in: ['submitted', 'in_progress'] }
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!latest) {
      return res.status(200).json({
        success: true,
        hasReport: false,
        session: null,
        data: null
      });
    }

    const formattedLatest = formatSafeSession(latest);
    return res.status(200).json({
      success: true,
      hasReport: latest.status === 'submitted',
      session: formattedLatest,
      data: formattedLatest
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/diagnostics/history
 * Retrieves paginated diagnostic sessions summary for authenticated user.
 */
export const getDiagnosticHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const query = { user: userId, status: 'submitted' };

    const [sessions, total] = await Promise.all([
      DiagnosticSession.find(query)
        .select('-questions.answer -questions.explanation')
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      DiagnosticSession.countDocuments(query)
    ]);

    const formattedSessions = sessions.map(formatSafeSession);
    return res.status(200).json({
      success: true,
      data: formattedSessions,
      sessions: formattedSessions,
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
